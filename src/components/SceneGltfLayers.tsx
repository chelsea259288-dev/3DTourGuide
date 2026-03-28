import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import type { GltfLayer } from '../data/scenes'
import { resolveModelUrl } from '../lib/modelUrl'

export function SceneGltfLayers({ layers }: { layers: GltfLayer[] }) {
  return (
    <>
      {layers.map((layer, i) => (
        <GltfPart key={`${layer.url}-${i}`} layer={layer} />
      ))}
    </>
  )
}

function GltfPart({ layer }: { layer: GltfLayer }) {
  const src = resolveModelUrl(layer.url)
  const { scene } = useGLTF(src)
  const clone = useMemo(() => scene.clone(), [scene])
  const p = layer.position ?? [0, 0, 0]
  const s = layer.scale ?? 1
  return (
    <group position={p} scale={s}>
      <primitive object={clone} />
    </group>
  )
}
