import { Sky, useProgress } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { GeoPOI, SceneConfig } from '../data/scenes'
import { EcefWalkNavigation, type GeoSyncPosition } from './EcefWalkNavigation'
import { GeoMarker } from './GeoMarker'
import { Google3DTiles, getECEFPosition } from './Google3DTiles'
import { NarrationOverlay } from './NarrationOverlay'
import { POINavigator } from './POINavigator'
import { SceneGltfLayers } from './SceneGltfLayers'
import { WalkNavigation } from './WalkNavigation'
import { stop as stopTTS } from '../utils/tts'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

type LoadState = { active: boolean; progress: number }

type Props = {
  scene: SceneConfig
  resetSignal: number
  dpr: [number, number]
  onLoadChange?: (s: LoadState) => void
}

function LoadingBinder({
  onLoadChange,
}: {
  onLoadChange?: (s: LoadState) => void
}) {
  const { active, progress } = useProgress()
  useEffect(() => {
    onLoadChange?.({ active, progress })
  }, [active, progress, onLoadChange])
  return null
}

function FallbackEnvironment() {
  return (
    <>
      <Sky
        sunPosition={[100, 60, 50]}
        turbidity={8}
        rayleigh={2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 60, 50]} intensity={1.2} castShadow />
      <directionalLight position={[-30, 20, -40]} intensity={0.3} />
      <hemisphereLight intensity={0.5} color="#87ceeb" groundColor="#8b7355" />
    </>
  )
}

/**
 * Sky dome for ECEF scenes. Uses camera.up (the local ellipsoid normal)
 * to correctly compute elevation angle regardless of ECEF orientation.
 */
function EcefSkyDome() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        localUp: { value: new THREE.Vector3(0, 1, 0) },
        sunDir: { value: new THREE.Vector3(0.5, 0.3, 0.7).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vDir = normalize(wp.xyz - cameraPosition);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 localUp;
        uniform vec3 sunDir;
        varying vec3 vDir;

        void main() {
          vec3 dir = normalize(vDir);
          // elevation relative to the local ground plane
          float el = dot(dir, localUp);

          // --- sky gradient ---
          float t = max(el, 0.0);
          // zenith deep blue -> horizon light blue/white
          vec3 zenith = vec3(0.35, 0.6, 1.1);
          vec3 horizon = vec3(0.82, 0.92, 1.05);
          vec3 sky = mix(horizon, zenith, smoothstep(0.0, 0.55, t));

          // warm horizon glow
          float hGlow = exp(-5.0 * t);
          sky = mix(sky, vec3(0.95, 0.97, 1.0), hGlow * 0.45);

          // --- sun ---
          float sd = dot(dir, sunDir);
          sky += vec3(1.2, 1.1, 0.95) * (
            smoothstep(0.9997, 0.9999, sd) +          // disc
            pow(max(sd, 0.0), 512.0) * 0.5 +          // glow
            pow(max(sd, 0.0), 16.0) * 0.1             // halo
          );

          // --- below horizon ---
          if (el < 0.0) {
            float bf = smoothstep(0.0, -0.12, el);
            sky = mix(sky, vec3(0.25, 0.28, 0.32), bf);
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })
  }, [])

  // Update the localUp uniform every frame from camera.up
  useFrame(({ camera }) => {
    material.uniforms.localUp.value.copy(camera.up).normalize()
    // Also orient the sun relative to local up: sun is "southeast, elevated"
    const up = camera.up
    // Build a rough east/north from up
    const east = new THREE.Vector3(-up.z, 0, up.x).normalize()
    if (east.lengthSq() < 0.01) east.set(1, 0, 0)
    const north = new THREE.Vector3().crossVectors(up, east).normalize()
    // Sun at ~45° elevation, slightly southeast
    material.uniforms.sunDir.value
      .copy(up).multiplyScalar(0.7)
      .addScaledVector(east, 0.5)
      .addScaledVector(north, -0.3)
      .normalize()
  })

  return (
    <mesh renderOrder={-1} material={material}>
      <sphereGeometry args={[5e7, 32, 32]} />
    </mesh>
  )
}

/** Content when using Google 3D Tiles with first-person walk */
function GoogleTilesContent(props: Props & {
  flyTarget: GeoPOI | null
  activePOIId: string | null
  syncPosition: GeoSyncPosition | null
  onPOIClick: (poi: GeoPOI) => void
  onFlyArrived: () => void
  onFlyStart: () => void
  walkActive: boolean
}) {
  const geo = props.scene.geolocation!
  const pois = props.scene.geoPOIs ?? []
  return (
    <>
      <LoadingBinder onLoadChange={props.onLoadChange} />
      <EcefSkyDome />
      <Google3DTiles apiKey={GOOGLE_API_KEY!} />
      <EcefWalkNavigation
        active={props.walkActive}
        resetSignal={props.resetSignal}
        lat={geo.lat}
        lng={geo.lng}
        eyeHeight={geo.altitude ?? 2}
        moveSpeed={props.scene.walkSpeed ?? 8}
        initialYaw={geo.heading ?? 0}
        initialPitch={geo.pitch ?? 0}
        syncPosition={props.syncPosition}
      />
      <POINavigator
        target={props.flyTarget}
        minAltitude={(geo.altitude ?? 2) + 40}
        onArrived={props.onFlyArrived}
        onFlyStart={props.onFlyStart}
      />
      {pois.map((poi) => (
        <GeoMarker
          key={poi.id}
          poi={poi}
          active={poi.id === props.activePOIId}
          onClick={props.onPOIClick}
        />
      ))}
    </>
  )
}

/** Content when using fallback Sky + Sketchfab model */
function FallbackContent(props: Props) {
  const { scene } = props
  const pos = scene.model.rootPosition ?? [0, 0, 0]
  return (
    <>
      <LoadingBinder onLoadChange={props.onLoadChange} />
      <FallbackEnvironment />
      <group position={pos}>
        <Suspense fallback={null}>
          <SceneGltfLayers layers={scene.model.layers} />
        </Suspense>
      </group>
      <WalkNavigation
        active
        resetSignal={props.resetSignal}
        initialEye={scene.walkStart?.cameraPosition ?? scene.initial.cameraPosition}
        initialTarget={scene.walkStart?.lookAt ?? scene.initial.lookAt}
        moveSpeed={scene.walkSpeed}
      />
    </>
  )
}

export function SceneCanvas(props: Props) {
  const geo = props.scene.geolocation
  const useGoogleTiles = !!(GOOGLE_API_KEY && geo)

  // POI guided-tour state
  const [activePOI, setActivePOI] = useState<GeoPOI | null>(null)
  const [flyTarget, setFlyTarget] = useState<GeoPOI | null>(null)
  const [isFlying, setIsFlying] = useState(false)
  const [narrationPOI, setNarrationPOI] = useState<GeoPOI | null>(null)
  const [syncPosition, setSyncPosition] = useState<GeoSyncPosition | null>(null)

  const handlePOIClick = useCallback((poi: GeoPOI) => {
    // Ignore clicks while already flying
    if (isFlying) return
    // If narrating a different POI, stop audio and switch
    if (narrationPOI && narrationPOI.id !== poi.id) {
      stopTTS()
      setNarrationPOI(null)
    }
    setSyncPosition(null) // Clear stale sync before new fly-to
    setActivePOI(poi)
    setFlyTarget(poi)
  }, [isFlying, narrationPOI])

  const handleFlyStart = useCallback(() => {
    setIsFlying(true)
  }, [])

  const handleFlyArrived = useCallback(() => {
    setIsFlying(false)
    setFlyTarget(null)
    // Pass exact view coordinates to walk nav so it doesn't need to reverse-compute from ECEF
    if (activePOI) {
      const minAlt = geo?.altitude ?? 2
      setSyncPosition({
        lat: activePOI.viewLat,
        lng: activePOI.viewLng,
        alt: Math.max(activePOI.viewAlt, minAlt),
        heading: activePOI.viewHeading,
        pitch: activePOI.viewPitch,
      })
      setNarrationPOI(activePOI)
    }
  }, [activePOI, geo])

  const handleNarrationDone = useCallback(() => {
    // Just clear narration state — do NOT reset camera or activePOI
    // User stays exactly where they are and can continue walking
    setNarrationPOI(null)
    setActivePOI(null)
  }, [])

  // Walk navigation is only disabled during the fly animation itself;
  // once arrived, user can freely walk around while narration plays
  const walkActive = !isFlying

  if (useGoogleTiles) {
    const eyeH = geo!.altitude ?? 2
    const startPos = getECEFPosition(geo!.lat, geo!.lng, eyeH)
    return (
      <>
        <Canvas
          id="3dtourguide-gl"
          dpr={props.dpr}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            logarithmicDepthBuffer: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.7,
          }}
          camera={{
            position: startPos,
            fov: 60,
            near: 0.5,
            far: 1e8,
          }}
          style={{ filter: 'saturate(1.35) contrast(1.15)' }}
        >
          <Suspense fallback={null}>
            <GoogleTilesContent
              {...props}
              flyTarget={flyTarget}
              activePOIId={activePOI?.id ?? null}
              syncPosition={syncPosition}
              onPOIClick={handlePOIClick}
              onFlyArrived={handleFlyArrived}
              onFlyStart={handleFlyStart}
              walkActive={walkActive}
            />
          </Suspense>
        </Canvas>
        <NarrationOverlay
          title={narrationPOI?.title ?? null}
          text={narrationPOI?.narration ?? null}
          onDone={handleNarrationDone}
        />
      </>
    )
  }

  const startPos =
    props.scene.walkStart?.cameraPosition ?? props.scene.initial.cameraPosition
  return (
    <Canvas
      id="3dtourguide-gl"
      dpr={props.dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{
        position: startPos,
        fov: 50,
        near: 0.05,
        far: 2000,
      }}
    >
      <Suspense fallback={null}>
        <FallbackContent {...props} />
      </Suspense>
    </Canvas>
  )
}
