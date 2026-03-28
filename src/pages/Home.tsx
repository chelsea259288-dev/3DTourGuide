import { useGLTF } from '@react-three/drei'
import { useEffect, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { preloadAllModels, SCENES } from '../data/scenes'
import { resolveModelUrl } from '../lib/modelUrl'
import { useRecentScenes } from '../hooks/useRecentScenes'

export function Home() {
  const { recentIds } = useRecentScenes()

  useEffect(() => {
    preloadAllModels((url) => {
      useGLTF.preload(resolveModelUrl(url))
    })
  }, [])

  const recentScenes = recentIds
    .map((id) => SCENES.find((s) => s.id === id))
    .filter((s): s is (typeof SCENES)[number] => s != null)

  return (
    <div className="page home">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1 className="brand-title">3DTourGuide</h1>
            <p className="brand-sub">Historic landmarks in the browser</p>
          </div>
        </div>
      </header>

      {recentScenes.length > 0 && (
        <section className="recent" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="section-title">
            Continue exploring
          </h2>
          <ul className="recent-list">
            {recentScenes.map((s) =>
              s ? (
                <li key={s.id}>
                  <Link className="recent-link" to={`/tour/${s.id}`}>
                    {s.title}
                  </Link>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      )}

      <section className="catalog" aria-labelledby="catalog-heading">
        <h2 id="catalog-heading" className="section-title">
          Scene library
        </h2>
        <ul className="scene-grid">
          {SCENES.map((scene) => (
            <li key={scene.id}>
              <article
                className="scene-card"
                style={
                  { '--card-bg': scene.preview.gradient } as CSSProperties & {
                    '--card-bg': string
                  }
                }
              >
                {scene.preview.image ? (
                  <img
                    className="scene-card-visual"
                    src={scene.preview.image}
                    alt={scene.title}
                    loading="lazy"
                  />
                ) : (
                  <div className="scene-card-visual" aria-hidden />
                )}
                <div className="scene-card-body">
                  <h3 className="scene-card-title">{scene.title}</h3>
                  <p className="scene-card-tagline">{scene.tagline}</p>
                  <p className="scene-card-desc">{scene.description}</p>

                  <Link className="btn primary" to={`/tour/${scene.id}`}>
                    Explore now
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>

    </div>
  )
}
