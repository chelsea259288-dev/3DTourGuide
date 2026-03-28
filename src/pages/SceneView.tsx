import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SceneCanvas } from '../components/SceneCanvas'
import { SceneErrorBoundary } from '../components/SceneErrorBoundary'
import { getSceneById } from '../data/scenes'
import { useAdaptiveDpr } from '../hooks/useAdaptiveDpr'
import { useRecentScenes } from '../hooks/useRecentScenes'

export function SceneView() {
  const { sceneId } = useParams<{ sceneId: string }>()
  const navigate = useNavigate()
  const dpr = useAdaptiveDpr()
  const { recordVisit } = useRecentScenes()

  const scene = useMemo(
    () => (sceneId ? getSceneById(sceneId) : undefined),
    [sceneId],
  )

  const [resetSignal, setResetSignal] = useState(0)
  const [load, setLoad] = useState({ active: true, progress: 0 })
  const [shareHint, setShareHint] = useState<string | null>(null)

  const onLoadChange = useCallback(
    (s: { active: boolean; progress: number }) => setLoad(s),
    [],
  )

  useEffect(() => {
    if (!sceneId || !scene) navigate('/', { replace: true })
  }, [sceneId, scene, navigate])

  useEffect(() => {
    if (!scene) return
    recordVisit(scene.id)
  }, [scene, recordVisit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  if (!scene) return null

  const resetView = () => {
    setResetSignal((n) => n + 1)
  }

  const share = async () => {
    const url = `${window.location.origin}/tour/${scene.id}`
    try {
      await navigator.clipboard.writeText(url)
      setShareHint('Link copied')
    } catch {
      setShareHint('Copy blocked — share manually')
    }
    window.setTimeout(() => setShareHint(null), 2200)
  }

  return (
    <div className="page scene-shell">
      <div className="scene-canvas-wrap">
        <SceneErrorBoundary key={scene.id}>
          <SceneCanvas
            scene={scene}
            resetSignal={resetSignal}
            dpr={dpr}
            onLoadChange={onLoadChange}
          />
        </SceneErrorBoundary>
        {load.active && (
          <div className="load-overlay" role="status" aria-live="polite">
            <div className="load-bar-outer">
              <div
                className="load-bar-inner"
                style={{ width: `${Math.min(100, load.progress)}%` }}
              />
            </div>
            <p className="load-label">Preparing the scene…</p>
          </div>
        )}
      </div>

      <div className="scene-chrome">
        <nav className="chrome-row chrome-top" aria-label="Tour navigation">
          <Link className="btn ghost" to="/">
            ← Library
          </Link>
          <div className="scene-title-block">
            <h1 className="scene-title">{scene.title}</h1>
          </div>
          <div className="chrome-actions">
            <button type="button" className="btn ghost" onClick={resetView}>
              Reset view
            </button>
            <button type="button" className="btn ghost" onClick={share}>
              Share link
            </button>
          </div>
        </nav>
        {shareHint && (
          <p className="toast" role="status">
            {shareHint}
          </p>
        )}

        <p className="chrome-hint">
          Arrow keys / WASD to move · Drag to look around · Space up · C down · Shift sprint
        </p>
      </div>
    </div>
  )
}
