import { Cloud, Environment, Sky } from '@react-three/drei'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { EnvironmentConfig } from '../data/scenes'

type Props = {
  config?: EnvironmentConfig
}

/** Animated water plane with simple wave motion */
function WaterPlane({ y }: { y: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.position.y = y + Math.sin(t * 0.4) * 0.15
  })

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[800, 800, 64, 64]} />
      <meshStandardMaterial
        color="#1a5276"
        transparent
        opacity={0.75}
        roughness={0.1}
        metalness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/** Simple ground plane */
function GroundPlane({ color, y }: { color: string; y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[800, 800]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

export function SceneEnvironment({ config }: Props) {
  if (!config) {
    // Fallback: simple sky
    return (
      <>
        <Sky sunPosition={[100, 60, 50]} turbidity={8} rayleigh={2} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 60, 50]} intensity={1.2} />
        <directionalLight position={[-30, 20, -40]} intensity={0.3} />
        <hemisphereLight intensity={0.5} color="#87ceeb" groundColor="#8b7355" />
      </>
    )
  }

  const sunPos = config.sunPosition ?? [100, 60, 50]

  return (
    <>
      {/* HDRI environment for realistic background */}
      <Environment
        preset={config.preset}
        background
        backgroundBlurriness={config.backgroundBlurriness ?? 0.3}
        backgroundIntensity={config.backgroundIntensity ?? 0.8}
        environmentIntensity={0.6}
        ground={config.ground ? config.ground : undefined}
      />

      {/* Sky as additional fill */}
      <Sky
        sunPosition={sunPos}
        turbidity={10}
        rayleigh={1.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.85}
      />

      {/* Lighting matched to sun direction */}
      <ambientLight intensity={0.45} />
      <directionalLight
        position={sunPos}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-30, 20, -40]} intensity={0.25} />
      <hemisphereLight intensity={0.45} color="#b0d4f1" groundColor="#7a6b52" />

      {/* Decorative clouds */}
      <Cloud
        position={[-60, 50, -80]}
        speed={0.15}
        opacity={0.4}
        bounds={[30, 6, 6]}
        segments={12}
      />
      <Cloud
        position={[70, 55, -50]}
        speed={0.1}
        opacity={0.35}
        bounds={[25, 5, 5]}
        segments={10}
      />

      {/* Water plane for harbor scenes */}
      {config.waterY !== undefined && <WaterPlane y={config.waterY} />}

      {/* Ground plane for land scenes */}
      {config.groundColor && !config.waterY && (
        <GroundPlane color={config.groundColor} y={-5} />
      )}
    </>
  )
}
