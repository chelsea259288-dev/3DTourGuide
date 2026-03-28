import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = { children: ReactNode }
type State = { error: Error | null; retries: number }

/** Transient errors from R3F / three.js cleanup that are safe to retry */
const TRANSIENT_PATTERNS = [
  'removeEventListener',
  'loadingState',
  'Cannot read properties of null',
  'Cannot read properties of undefined',
]

function isTransientError(error: Error): boolean {
  const msg = error.message || ''
  return TRANSIENT_PATTERNS.some((p) => msg.includes(p))
}

const MAX_RETRIES = 3

/**
 * Catches Three.js / R3F loader failures (e.g. missing glTF on static hosts)
 * so the whole app does not go blank.
 *
 * Transient cleanup errors (removeEventListener on null, loadingState on undefined)
 * are auto-retried up to MAX_RETRIES times before showing the fallback.
 */
export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retries: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SceneErrorBoundary]', error.message, info.componentStack)

    // Auto-retry transient errors
    if (isTransientError(error) && this.state.retries < MAX_RETRIES) {
      console.warn(`[SceneErrorBoundary] Transient error, retrying (${this.state.retries + 1}/${MAX_RETRIES})…`)
      this.setState((prev) => ({
        error: null,
        retries: prev.retries + 1,
      }))
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="scene-error-fallback">
          <h2 className="scene-error-title">This scene could not load</h2>
          <p className="scene-error-msg">{this.state.error.message}</p>
          <p className="scene-error-hint">
            On production without 3D model files, set{' '}
            <code className="inline-code">VITE_GOOGLE_MAPS_API_KEY</code> for map
            tiles, or host models and set{' '}
            <code className="inline-code">VITE_MODEL_CDN_BASE</code>.
          </p>
          <Link className="btn primary" to="/">
            ← Back to library
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}
