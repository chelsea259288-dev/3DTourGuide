import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { WGS84_ELLIPSOID } from '3d-tiles-renderer'

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

export type EcefDebugInfo = {
  lat: number
  lng: number
  alt: number
  yaw: number
  pitch: number
}

/** Exact geodetic position to sync to after fly-to (avoids ECEF reverse-computation errors) */
export type GeoSyncPosition = {
  lat: number
  lng: number
  alt: number
  heading: number
  pitch: number
}

type Props = {
  active: boolean
  resetSignal: number
  lat: number
  lng: number
  /** Eye height above ellipsoid surface in meters (default 2) */
  eyeHeight?: number
  /** Walking speed in meters/s (default 8) */
  moveSpeed?: number
  /** Initial yaw in degrees (default 0 = north) */
  initialYaw?: number
  /** Initial pitch in degrees (default 0 = horizontal) */
  initialPitch?: number
  /** Called every ~10 frames with current position info */
  onDebugUpdate?: (info: EcefDebugInfo) => void
  /** When set, sync walk nav to these exact coordinates (used after fly-to) */
  syncPosition?: GeoSyncPosition | null
}

/**
 * First-person walking navigation on top of Google 3D Tiles (ECEF).
 *
 * - Arrow keys / WASD: walk forward/back/strafe
 * - Mouse drag: look around
 * - Space / C: go up / down
 * - Shift: sprint
 *
 * Movement is done in the local East-North-Up (ENU) frame so the
 * camera stays on the ellipsoid surface at eye height.
 */
export function EcefWalkNavigation({
  active,
  resetSignal,
  lat,
  lng,
  eyeHeight = 2,
  moveSpeed = 8,
  initialYaw = 0,
  initialPitch = 0,
  onDebugUpdate,
  syncPosition,
}: Props) {
  const { camera, gl } = useThree()
  const keys = useRef(new Set<string>())
  const frameCount = useRef(0)
  // Smooth sprint: current multiplier lerps toward target
  const sprintMul = useRef(1)

  // Track current geographic position so we can update ENU frame as we walk
  const geoPos = useRef({ lat: lat * DEG2RAD, lon: lng * DEG2RAD, height: eyeHeight })

  // Mouse look state
  const isDragging = useRef(false)
  const prevMouse = useRef({ x: 0, y: 0 })
  // yaw = rotation around local Up, pitch = tilt up/down
  const yaw = useRef(0)
  const pitch = useRef(0)

  // Reusable vectors
  const _east = useRef(new THREE.Vector3())
  const _north = useRef(new THREE.Vector3())
  const _up = useRef(new THREE.Vector3())
  const _pos = useRef(new THREE.Vector3())
  const _lookTarget = useRef(new THREE.Vector3())

  /** Place camera at current geoPos and orient it with current yaw/pitch */
  const applyCamera = () => {
    const { lat: la, lon: lo, height: h } = geoPos.current

    // Position on the ellipsoid
    WGS84_ELLIPSOID.getCartographicToPosition(la, lo, h, _pos.current)
    camera.position.copy(_pos.current)

    // Get local ENU axes at this position
    WGS84_ELLIPSOID.getEastNorthUpAxes(la, lo, _east.current, _north.current, _up.current)

    // Build look direction from yaw (around up) and pitch (tilt)
    // Forward = north rotated by yaw around up axis
    const forward = _north.current.clone()
    forward.applyAxisAngle(_up.current, -yaw.current)

    // Apply pitch: rotate forward around the local right (east rotated by yaw)
    const right = _east.current.clone()
    right.applyAxisAngle(_up.current, -yaw.current)
    forward.applyAxisAngle(right, pitch.current)

    _lookTarget.current.copy(camera.position).add(forward)
    camera.up.copy(_up.current)
    camera.lookAt(_lookTarget.current)
  }

  // Track whether we have ever initialized
  const initialized = useRef(false)
  const wasActive = useRef(false)
  // When true, skip applyCamera() in useFrame — camera stays where fly-to left it.
  // Cleared on first user input (key or mouse), which triggers a proper sync.
  const frozen = useRef(false)

  // Initialize camera only on first mount.
  // When re-activated after a fly-to, sync geoPos from camera's ECEF position
  // but DON'T call applyCamera() — leave camera exactly where it is to avoid jumps.
  useEffect(() => {
    if (!active) {
      wasActive.current = initialized.current
      return
    }

    if (!initialized.current) {
      // First time: set to the scene's initial position
      initialized.current = true
      geoPos.current = { lat: lat * DEG2RAD, lon: lng * DEG2RAD, height: eyeHeight }
      yaw.current = initialYaw * DEG2RAD
      pitch.current = initialPitch * DEG2RAD
      frozen.current = false
      applyCamera()
    } else if (wasActive.current) {
      // Re-activated after fly-to: use exact syncPosition if available,
      // otherwise fall back to reverse-computing from ECEF (less accurate).
      if (syncPosition) {
        // Use the exact known coordinates — no conversion errors!
        geoPos.current = {
          lat: syncPosition.lat * DEG2RAD,
          lon: syncPosition.lng * DEG2RAD,
          height: Math.max(syncPosition.alt, eyeHeight * 0.6),
        }
        yaw.current = syncPosition.heading * DEG2RAD
        pitch.current = syncPosition.pitch * DEG2RAD
      } else {
        // Fallback: reverse-compute from ECEF (may have small errors)
        const pos = camera.position
        const r = pos.length()
        const latNow = Math.asin(pos.z / r)
        const lonNow = Math.atan2(pos.y, pos.x)
        const surfaceR = 6378137 * (1 - 0.00335281 * Math.sin(latNow) * Math.sin(latNow))
        const heightNow = r - surfaceR

        geoPos.current = { lat: latNow, lon: lonNow, height: Math.max(heightNow, eyeHeight * 0.6) }

        // Derive yaw/pitch from camera's current look direction
        WGS84_ELLIPSOID.getEastNorthUpAxes(latNow, lonNow, _east.current, _north.current, _up.current)
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
        const fwdGround = fwd.clone().addScaledVector(_up.current, -fwd.dot(_up.current)).normalize()
        const dotE = fwdGround.dot(_east.current)
        const dotN = fwdGround.dot(_north.current)
        yaw.current = Math.atan2(dotE, dotN)
        pitch.current = Math.asin(Math.max(-1, Math.min(1, fwd.dot(_up.current))))
      }

      // FREEZE: don't call applyCamera, leave camera where the fly-to placed it.
      // First user input will unfreeze and start moving from this position.
      frozen.current = true
    }
    wasActive.current = true
  }, [active])

  // Reset
  useEffect(() => {
    if (!active || resetSignal === 0) return
    geoPos.current = { lat: lat * DEG2RAD, lon: lng * DEG2RAD, height: eyeHeight }
    yaw.current = initialYaw * DEG2RAD
    pitch.current = initialPitch * DEG2RAD
    applyCamera()
  }, [resetSignal])

  // Keyboard
  useEffect(() => {
    if (!active) { keys.current.clear(); return }
    const down = (e: KeyboardEvent) => {
      if ([
        'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'ShiftLeft', 'ShiftRight',
      ].includes(e.code)) {
        e.preventDefault()
      }
      keys.current.add(e.code)
    }
    const up = (e: KeyboardEvent) => { keys.current.delete(e.code) }
    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [active])

  // Mouse drag
  useEffect(() => {
    if (!active) return
    const dom = gl.domElement

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true
      prevMouse.current = { x: e.clientX, y: e.clientY }
      dom.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - prevMouse.current.x
      const dy = e.clientY - prevMouse.current.y
      prevMouse.current = { x: e.clientX, y: e.clientY }

      const sensitivity = 0.003
      yaw.current += dx * sensitivity
      pitch.current -= dy * sensitivity
      pitch.current = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch.current))
    }
    const onPointerUp = (e: PointerEvent) => {
      isDragging.current = false
      dom.releasePointerCapture(e.pointerId)
    }

    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', onPointerUp)
    dom.addEventListener('pointercancel', onPointerUp)
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('pointercancel', onPointerUp)
    }
  }, [active, gl.domElement])

  // Per-frame movement
  useFrame((_, delta) => {
    if (!active) return

    // Smooth sprint ramp: lerp toward 5x when holding Shift, back to 1x when released
    const sprinting = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
    const target = sprinting ? 5 : 1
    const lerpRate = sprinting ? 3 : 5 // ramp up slower, ramp down faster
    sprintMul.current += (target - sprintMul.current) * Math.min(lerpRate * delta, 1)
    let speed = moveSpeed * delta * sprintMul.current

    const { lat: la, lon: lo } = geoPos.current

    // Get ENU axes at current position
    WGS84_ELLIPSOID.getEastNorthUpAxes(la, lo, _east.current, _north.current, _up.current)

    // Forward direction on the ground plane (north rotated by yaw)
    const forward = _north.current.clone().applyAxisAngle(_up.current, -yaw.current)
    // Right direction on the ground plane
    const right = _east.current.clone().applyAxisAngle(_up.current, -yaw.current)

    // Accumulate movement in meters (east, north, up)
    let dEast = 0
    let dNorth = 0
    let dUp = 0

    const fwd = keys.current.has('KeyW') || keys.current.has('ArrowUp')
    const back = keys.current.has('KeyS') || keys.current.has('ArrowDown')
    const moveRight = keys.current.has('KeyD') || keys.current.has('ArrowRight')
    const moveLeft = keys.current.has('KeyA') || keys.current.has('ArrowLeft')

    if (fwd) { dEast += forward.dot(_east.current) * speed; dNorth += forward.dot(_north.current) * speed }
    if (back) { dEast -= forward.dot(_east.current) * speed; dNorth -= forward.dot(_north.current) * speed }
    if (moveRight) { dEast += right.dot(_east.current) * speed; dNorth += right.dot(_north.current) * speed }
    if (moveLeft) { dEast -= right.dot(_east.current) * speed; dNorth -= right.dot(_north.current) * speed }

    if (keys.current.has('Space')) dUp += speed * 0.6
    if (keys.current.has('KeyC')) dUp -= speed * 0.6

    const hasInput = dEast !== 0 || dNorth !== 0 || dUp !== 0 || isDragging.current

    // If frozen (just returned from fly-to), skip applyCamera until user gives input
    if (frozen.current) {
      if (hasInput) {
        frozen.current = false // unfreeze on first real input
      } else {
        return // no input yet — leave camera exactly where fly-to placed it
      }
    }

    if (dEast === 0 && dNorth === 0 && dUp === 0) {
      // No movement, still apply camera in case pitch/yaw changed from mouse
      applyCamera()
    } else {
      // Convert meter offsets to lat/lon changes
      const R = 6378137 // WGS84 equatorial radius
      const dLat = dNorth / R
      const dLon = dEast / (R * Math.cos(geoPos.current.lat))

      geoPos.current.lat += dLat
      geoPos.current.lon += dLon
      geoPos.current.height += dUp

      // Hard floor: don't go too far underground (allow descending to 60% of initial altitude)
      const minHeight = eyeHeight * 0.6
      if (geoPos.current.height < minHeight) geoPos.current.height = minHeight

      applyCamera()
    }

    // Send debug info every 10 frames
    if (onDebugUpdate) {
      frameCount.current++
      if (frameCount.current % 10 === 0) {
        onDebugUpdate({
          lat: geoPos.current.lat * RAD2DEG,
          lng: geoPos.current.lon * RAD2DEG,
          alt: geoPos.current.height,
          yaw: yaw.current * RAD2DEG,
          pitch: pitch.current * RAD2DEG,
        })
      }
    }
  })

  return null
}
