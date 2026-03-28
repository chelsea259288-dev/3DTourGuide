import { useEffect, useRef, useState } from 'react'
import { speak, stop as stopTTS } from '../utils/tts'

type Props = {
  title: string | null
  text: string | null
  /** Called when narration finishes (TTS done or dismissed) */
  onDone: () => void
}

/**
 * Compact subtitle bar at the bottom of the screen.
 * Uses ElevenLabs for emotional AI voice (if API key set), otherwise
 * falls back to browser SpeechSynthesis with varied cadence.
 */
export function NarrationOverlay({ title, text, onDone }: Props) {
  const [visible, setVisible] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [charIndex, setCharIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const timerRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!text || !title) {
      setVisible(false)
      setDisplayText('')
      setCharIndex(0)
      setFading(false)
      return
    }

    doneRef.current = false
    setVisible(true)
    setFading(false)
    setDisplayText('')
    setCharIndex(0)

    // Stop any ongoing speech
    stopTTS()

    // Start TTS (ElevenLabs or browser fallback)
    void speak(text, () => {
      // Auto-dismiss 2s after speech ends
      if (!doneRef.current) {
        setTimeout(() => {
          if (!doneRef.current) fadeOut()
        }, 2000)
      }
    }).catch((err) => {
      console.warn('Narration TTS failed:', err)
    })

    // Typewriter effect
    let idx = 0
    const fullText = text
    const type = () => {
      if (idx <= fullText.length) {
        setDisplayText(fullText.slice(0, idx))
        setCharIndex(idx)
        idx++
        timerRef.current = window.setTimeout(type, 32)
      }
    }
    timerRef.current = window.setTimeout(type, 500)

    return () => {
      stopTTS()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text, title])

  const fadeOut = () => {
    if (doneRef.current) return
    doneRef.current = true
    setFading(true)
    setTimeout(() => {
      setVisible(false)
      onDone()
    }, 400)
  }

  const dismiss = () => {
    stopTTS()
    if (timerRef.current) clearTimeout(timerRef.current)
    fadeOut()
  }

  if (!visible || !title) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 620,
        width: '85vw',
        zIndex: 9000,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
        animation: fading ? 'none' : 'narrationIn 0.5s ease-out',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          background: 'rgba(10, 10, 10, 0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 12,
          padding: '14px 20px 14px 20px',
          color: '#fff',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Title — small, subtle */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 5,
          }}
        >
          {title}
        </div>
        {/* Narration text */}
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.88)',
            minHeight: 36,
          }}
        >
          {displayText}
          {charIndex < (text?.length ?? 0) && (
            <span style={{ opacity: 0.4, animation: 'blink 0.9s step-end infinite' }}>|</span>
          )}
        </div>
        {/* Dismiss button */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 14,
            cursor: 'pointer',
            padding: '2px 6px',
            lineHeight: 1,
          }}
          onMouseOver={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.7)' }}
          onMouseOut={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.3)' }}
        >
          ✕
        </button>
      </div>

      <style>{`
        @keyframes narrationIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
