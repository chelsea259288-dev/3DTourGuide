import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { WGS84_ELLIPSOID } from '3d-tiles-renderer'
import type { GeoPOI } from '../data/scenes'

const DEG2RAD = Math.PI / 180

/**
 * Proper ECEF → WGS84 geodetic conversion using Bowring's iterative method.
 */
function ecefToGeodetic(x: number, y: number, z: number) {
  const a = 6378137.0
  const f = 1 / 298.257223563
  const e2 = 2 * f - f * f

  const p = Math.sqrt(x * x + y * y)
  const lon = Math.atan2(y, x)

  let lat = Math.atan2(z, p * (1 - e2))
  for (let i = 0; i < 5; i++) {
    const s = Math.sin(lat)
    const N = a / Math.sqrt(1 - e2 * s * s)
    lat = Math.atan2(z + e2 * N * s, p)
  }
  const sinLat = Math.sin(lat)
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat)
  const alt = p / Math.cos(lat) - N

  return { lat, lon, alt } // radians, radians, meters
}

type Props = {
  /** The POI to fly to, or null if idle */
  target: GeoPOI | null
  /** Minimum WGS84 altitude — camera will never go below this during flight */
  minAltitude: number
  /** Called when camera has arrived at the target */
  onArrived: () => void
  /** Called when the fly animation starts (to disable walk nav) */
  onFlyStart: () => void
}

/**
 * Smoothly flies the camera to a POI viewpoint over ~2.5 seconds.
 *
 * Interpolation is done in geodetic space (lat/lon/alt) with an arc
 * on altitude, then converted to ECEF each frame. This guarantees the
 * camera always stays above terrain — no chord-cutting through the Earth.
 */
export function POINavigator({ target, minAltitude, onArrived, onFlyStart }: Props) {
  const { camera } = useThree()

  const flying = useRef(false)
  const progress = useRef(0)
  const duration = 2.5 // seconds

  // Start/end in geodetic (radians) + ECEF orientation
  const startGeo = useRef({ lat: 0, lon: 0, alt: 0 })
  const endGeo = useRef({ lat: 0, lon: 0, alt: 0 })
  const startQuat = useRef(new THREE.Quaternion())
  const endQuat = useRef(new THREE.Quaternion())
  const startUp = useRef(new THREE.Vector3())
  const endUp = useRef(new THREE.Vector3())

  // End ECEF position (for final snap)
  const endPos = useRef(new THREE.Vector3())

  const _tmpPos = useRef(new THREE.Vector3())
  const _tmpUp = useRef(new THREE.Vector3())
  const _east = useRef(new THREE.Vector3())
  const _north = useRef(new THREE.Vector3())
  const _upVec = useRef(new THREE.Vector3())

  useEffect(() => {
    if (!target) {
      flying.current = false
      return
    }

    // Capture start state
    startQuat.current.copy(camera.quaternion)
    startUp.current.copy(camera.up)

    // Convert start ECEF → geodetic using proper Bowring method
    const sg = ecefToGeodetic(camera.position.x, camera.position.y, camera.position.z)
    startGeo.current = { lat: sg.lat, lon: sg.lon, alt: sg.alt }

    // End position in geodetic
    const eLat = target.viewLat * DEG2RAD
    const eLon = target.viewLng * DEG2RAD
    const eAlt = Math.max(target.viewAlt, minAltitude)
    endGeo.current = { lat: eLat, lon: eLon, alt: eAlt }

    // Compute end ECEF + orientation
    WGS84_ELLIPSOID.getCartographicToPosition(eLat, eLon, eAlt, endPos.current)
    WGS84_ELLIPSOID.getEastNorthUpAxes(eLat, eLon, _east.current, _north.current, _upVec.current)
    endUp.current.copy(_upVec.current)

    // Build end orientation from heading/pitch
    const forward = _north.current.clone()
    forward.applyAxisAngle(_upVec.current, -target.viewHeading * DEG2RAD)
    const right = _east.current.clone()
    right.applyAxisAngle(_upVec.current, -target.viewHeading * DEG2RAD)
    forward.applyAxisAngle(right, target.viewPitch * DEG2RAD)

    const tmpCam = camera.clone()
    tmpCam.position.copy(endPos.current)
    tmpCam.up.copy(_upVec.current)
    const lookTarget = endPos.current.clone().add(forward)
    tmpCam.lookAt(lookTarget)
    endQuat.current.copy(tmpCam.quaternion)

    progress.current = 0
    flying.current = true
    onFlyStart()
  }, [target, camera, onFlyStart, minAltitude])

  useFrame((_, delta) => {
    if (!flying.current) return

    progress.current += delta / duration
    if (progress.current >= 1) {
      progress.current = 1
      flying.current = false
    }

    const t = progress.current
    const ease = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2

    // Interpolate in geodetic space — no ECEF chord-cutting
    const sG = startGeo.current
    const eG = endGeo.current

    const iLat = sG.lat + (eG.lat - sG.lat) * ease
    const iLon = sG.lon + (eG.lon - sG.lon) * ease

    // Altitude: linear interpolation + arc boost to fly OVER terrain
    const baseAlt = sG.alt + (eG.alt - sG.alt) * ease
    const arcPeak = Math.max(sG.alt, eG.alt) + 30 // 30m above the higher endpoint
    const arcBoost = Math.max(0, arcPeak - baseAlt) * Math.sin(Math.PI * ease)
    const iAlt = Math.max(baseAlt + arcBoost, minAltitude)

    // Convert geodetic → ECEF
    WGS84_ELLIPSOID.getCartographicToPosition(iLat, iLon, iAlt, _tmpPos.current)
    camera.position.copy(_tmpPos.current)

    // Interpolate up vector
    _tmpUp.current.lerpVectors(startUp.current, endUp.current, ease).normalize()
    camera.up.copy(_tmpUp.current)

    // Interpolate orientation
    camera.quaternion.slerpQuaternions(startQuat.current, endQuat.current, ease)

    if (progress.current >= 1) {
      // Snap exactly to end position
      camera.position.copy(endPos.current)
      camera.up.copy(endUp.current)
      camera.quaternion.copy(endQuat.current)
      onArrived()
    }
  })

  return null
}
