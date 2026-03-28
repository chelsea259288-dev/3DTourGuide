import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../data/scenes'

type Props = {
  active: boolean
  resetSignal: number
  initialEye: Vec3
  initialTarget: Vec3
  moveSpeed?: number
}

/**
 * First-person free-roam navigation:
 * - Arrow keys / WASD to move (forward / back / strafe left / strafe right)
 * - Mouse drag on canvas to look around (no pointer lock needed)
 * - Space to go up, C to go down
 * - Shift to sprint
 */
export function WalkNavigation({
  active,
  resetSignal,
  initialEye,
  initialTarget,
  moveSpeed = 6,
}: Props) {
  const { camera, gl } = useThree()
  const keys = useRef(new Set<string>())

  // Euler for yaw/pitch from mouse drag
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const isDragging = useRef(false)
  const prevMouse = useRef({ x: 0, y: 0 })

  // Initialize camera direction from initial look-at
  useEffect(() => {
    if (!active) return
    camera.position.set(initialEye[0], initialEye[1], initialEye[2])
    camera.lookAt(initialTarget[0], initialTarget[1], initialTarget[2])
    euler.current.setFromQuaternion(camera.quaternion, 'YXZ')
  }, [active, initialEye, initialTarget, camera])

  // Reset
  useEffect(() => {
    if (!active || resetSignal === 0) return
    camera.position.set(initialEye[0], initialEye[1], initialEye[2])
    camera.lookAt(initialTarget[0], initialTarget[1], initialTarget[2])
    euler.current.setFromQuaternion(camera.quaternion, 'YXZ')
  }, [resetSignal, active, camera, initialEye, initialTarget])

  // Keyboard listeners
  useEffect(() => {
    if (!active) {
      keys.current.clear()
      return
    }
    const down = (e: KeyboardEvent) => {
      if (
        [
          'Space',
          'KeyW', 'KeyA', 'KeyS', 'KeyD',
          'KeyC',
          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        ].includes(e.code) ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        e.preventDefault()
      }
      keys.current.add(e.code)
    }
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code)
    }
    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [active])

  // Mouse drag listeners on the canvas for look-around
  useEffect(() => {
    if (!active) return
    const dom = gl.domElement
    if (!dom) return

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true
      prevMouse.current = { x: e.clientX, y: e.clientY }
      try { dom.setPointerCapture(e.pointerId) } catch { /* */ }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - prevMouse.current.x
      const dy = e.clientY - prevMouse.current.y
      prevMouse.current = { x: e.clientX, y: e.clientY }

      const sensitivity = 0.003
      euler.current.y -= dx * sensitivity
      euler.current.x -= dy * sensitivity
      // Clamp pitch to avoid flipping
      euler.current.x = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, euler.current.x),
      )
      camera.quaternion.setFromEuler(euler.current)
    }

    const onPointerUp = (e: PointerEvent) => {
      isDragging.current = false
      try { if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId) } catch { /* */ }
    }

    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', onPointerUp)
    dom.addEventListener('pointercancel', onPointerUp)

    return () => {
      try {
        dom.removeEventListener('pointerdown', onPointerDown)
        dom.removeEventListener('pointermove', onPointerMove)
        dom.removeEventListener('pointerup', onPointerUp)
        dom.removeEventListener('pointercancel', onPointerUp)
      } catch { /* Canvas already disposed */ }
    }
  }, [active, camera, gl.domElement])

  // Movement per frame
  useFrame((_, delta) => {
    if (!active) return

    let v = moveSpeed * delta
    if (keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')) {
      v *= 1.9
    }

    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    const fwd = keys.current.has('KeyW') || keys.current.has('ArrowUp')
    const back = keys.current.has('KeyS') || keys.current.has('ArrowDown')
    const moveRight = keys.current.has('KeyD') || keys.current.has('ArrowRight')
    const moveLeft = keys.current.has('KeyA') || keys.current.has('ArrowLeft')

    if (fwd) camera.position.addScaledVector(forward, v)
    if (back) camera.position.addScaledVector(forward, -v)
    if (moveRight) camera.position.addScaledVector(right, v)
    if (moveLeft) camera.position.addScaledVector(right, -v)

    if (keys.current.has('Space')) {
      camera.position.y += v * 0.55
    }
    if (keys.current.has('KeyC')) {
      camera.position.y -= v * 0.55
    }
  })

  // No rendered element needed — this is purely imperative
  return null
}
