import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { WGS84_ELLIPSOID } from '3d-tiles-renderer'
import type { GeoPOI } from '../data/scenes'

const DEG2RAD = Math.PI / 180

const BEAM_HEIGHT = 25
const DIAMOND_Y = BEAM_HEIGHT + 2
const ARROW_Y = DIAMOND_Y + 5

type Props = {
  poi: GeoPOI
  active: boolean
  onClick: (poi: GeoPOI) => void
}

/**
 * 80m semi-transparent light beam + floating spinning diamond + bouncing
 * downward arrow above diamond + pulsing ground ring. All same color.
 */
export function GeoMarker({ poi, active, onClick }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const diamondRef = useRef<THREE.Mesh>(null)
  const arrowRef = useRef<THREE.Group>(null)
  const beamRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  const { position, upDir } = useMemo(() => {
    const pos = new THREE.Vector3()
    WGS84_ELLIPSOID.getCartographicToPosition(
      poi.markerLat * DEG2RAD,
      poi.markerLng * DEG2RAD,
      poi.markerAlt,
      pos,
    )
    const east = new THREE.Vector3()
    const north = new THREE.Vector3()
    const up = new THREE.Vector3()
    WGS84_ELLIPSOID.getEastNorthUpAxes(
      poi.markerLat * DEG2RAD,
      poi.markerLng * DEG2RAD,
      east, north, up,
    )
    return { position: pos, upDir: up }
  }, [poi.markerLat, poi.markerLng, poi.markerAlt])

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upDir)
    return q
  }, [upDir])

  // All elements white, amber when active
  const color = active ? '#f59e0b' : '#ffffff'

  const solidMat = useMemo(() => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthTest: true,
  }), [color])

  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.3,
    depthTest: true,
  }), [color])

  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthTest: true,
  }), [color])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Diamond: float + spin
    if (diamondRef.current) {
      diamondRef.current.position.y = DIAMOND_Y + Math.sin(t * 1.2) * 2.0
      diamondRef.current.rotation.y = t * 0.5
    }
    // Arrow: bounce above diamond
    if (arrowRef.current) {
      arrowRef.current.position.y = ARROW_Y + Math.sin(t * 2.5) * 2.5
    }
    // Ring: pulse
    if (ringRef.current) {
      const pulse = 0.8 + Math.sin(t * 2.0) * 0.2
      ringRef.current.scale.set(pulse, pulse, pulse)
      if (ringRef.current.material instanceof THREE.MeshBasicMaterial) {
        ringRef.current.material.opacity = 0.2 + Math.sin(t * 2.0) * 0.15
      }
    }
    // Beam: gentle opacity pulse
    if (beamRef.current && beamRef.current.material instanceof THREE.MeshBasicMaterial) {
      beamRef.current.material.opacity = 0.2 + Math.sin(t * 1.5) * 0.1
    }
  })

  return (
    <group
      ref={groupRef}
      position={position}
      quaternion={quaternion}
      onClick={(e) => {
        e.stopPropagation()
        onClick(poi)
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = '' }}
    >
      {/* Ground ring */}
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} material={ringMat}>
        <ringGeometry args={[3, 5.5, 32]} />
      </mesh>

      {/* Semi-transparent beam — same color as diamond */}
      <mesh ref={beamRef} position={[0, BEAM_HEIGHT / 2, 0]} material={beamMat}>
        <cylinderGeometry args={[0.3, 0.8, BEAM_HEIGHT, 8]} />
      </mesh>

      {/* Floating spinning diamond */}
      <mesh ref={diamondRef} position={[0, DIAMOND_Y, 0]} material={solidMat}>
        <octahedronGeometry args={[2.5, 0]} />
      </mesh>

      {/* Bouncing downward arrow above diamond */}
      <group ref={arrowRef} position={[0, ARROW_Y, 0]}>
        {/* Cone pointing down */}
        <mesh rotation-x={Math.PI} material={solidMat}>
          <coneGeometry args={[1.8, 3.5, 4]} />
        </mesh>
        {/* Short shaft */}
        <mesh position={[0, 3.2, 0]} material={solidMat}>
          <cylinderGeometry args={[0.6, 0.6, 3, 4]} />
        </mesh>
      </group>
    </group>
  )
}
