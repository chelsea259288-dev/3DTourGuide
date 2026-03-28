/**
 * Text-to-Speech utility with ElevenLabs (primary) and browser SpeechSynthesis (fallback).
 *
 * ElevenLabs free tier: 10,000 characters/month, very natural emotional voices.
 * Set VITE_ELEVENLABS_API_KEY in .env to enable.
 */

const ELEVENLABS_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined

// ElevenLabs voice IDs — expressive, warm narration voices
// "Rachel" — warm female, great for tour narration
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null

export type TTSHandle = {
  /** Stop playback immediately */
  stop: () => void
}

/**
 * Speak text using ElevenLabs if available, otherwise browser TTS.
 * Returns a handle to stop playback.
 */
export async function speak(
  text: string,
  onEnd?: () => void,
): Promise<TTSHandle> {
  // Always cancel any ongoing speech first
  stop()

  if (ELEVENLABS_KEY) {
    return speakElevenLabs(text, onEnd)
  }
  return speakBrowser(text, onEnd)
}

/** Stop any currently playing speech */
export function stop() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.removeAttribute('src')
    currentAudio = null
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
  window.speechSynthesis.cancel()
}

// ─── ElevenLabs ────────────────────────────────────────────────

async function speakElevenLabs(text: string, onEnd?: () => void): Promise<TTSHandle> {
  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_KEY!,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.4,        // lower = more expressive/emotional
            similarity_boost: 0.75,
            style: 0.5,            // more stylistic variation
            use_speaker_boost: true,
          },
        }),
      },
    )

    if (!resp.ok) {
      console.warn('ElevenLabs TTS failed, falling back to browser TTS:', resp.status)
      return speakBrowser(text, onEnd)
    }

    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    currentObjectUrl = url

    const audio = new Audio(url)
    audio.volume = 0.85
    currentAudio = audio

    audio.onended = () => {
      cleanup()
      onEnd?.()
    }
    audio.onerror = () => {
      cleanup()
      // Fallback on error
      speakBrowser(text, onEnd)
    }

    await audio.play()

    return { stop: () => { cleanup(); } }
  } catch (err) {
    console.warn('ElevenLabs TTS error, falling back:', err)
    return speakBrowser(text, onEnd)
  }
}

function cleanup() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
}

// ─── Browser SpeechSynthesis fallback ──────────────────────────

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const en = voices.filter((v) => v.lang.startsWith('en'))
  if (en.length === 0) return null

  const tier1 = en.find((v) =>
    /Samantha|Karen|Daniel|Moira|Tessa|Ava.*Premium|Zoe.*Premium/i.test(v.name),
  )
  if (tier1) return tier1

  const tier2 = en.find((v) => /Enhanced|Premium|Natural|Neural/i.test(v.name))
  if (tier2) return tier2

  const tier3 = en.find((v) => v.name.includes('Google UK English'))
  if (tier3) return tier3

  const tier4 = en.find((v) => v.name.includes('Google'))
  if (tier4) return tier4

  const tier5 = en.find((v) => /Microsoft.*Online|Microsoft.*Natural/i.test(v.name))
  if (tier5) return tier5

  return en[0] ?? null
}

function speakBrowser(text: string, onEnd?: () => void): TTSHandle {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text]
  const voice = pickVoice()
  let i = 0
  let stopped = false

  const speakNext = () => {
    if (i >= sentences.length || stopped) {
      if (!stopped) onEnd?.()
      return
    }

    const s = sentences[i].trim()
    if (!s) { i++; speakNext(); return }

    const utter = new SpeechSynthesisUtterance(s)
    utter.lang = 'en-US'
    if (voice) utter.voice = voice
    utter.volume = 0.85

    const isExclaim = s.includes('!')
    const isQuestion = s.includes('?')
    const isFirst = i === 0
    const isLast = i === sentences.length - 1

    if (isFirst) {
      utter.rate = 0.72; utter.pitch = 0.95
    } else if (isExclaim) {
      utter.rate = 0.82; utter.pitch = 1.08
    } else if (isQuestion) {
      utter.rate = 0.78; utter.pitch = 1.05
    } else if (isLast) {
      utter.rate = 0.7; utter.pitch = 0.88
    } else {
      utter.rate = 0.76 + (i % 3) * 0.03
      utter.pitch = 0.92 + (i % 2) * 0.06
    }

    utter.onend = () => {
      i++
      const pause = isFirst ? 500 : isLast ? 300 : 350
      setTimeout(speakNext, pause)
    }
    window.speechSynthesis.speak(utter)
  }

  // Voices might not be loaded yet
  const start = () => {
    // Small delay for subtitle to appear first
    setTimeout(speakNext, 300)
  }

  if (window.speechSynthesis.getVoices().length > 0) {
    start()
  } else {
    window.speechSynthesis.onvoiceschanged = start
  }

  return {
    stop: () => {
      stopped = true
      window.speechSynthesis.cancel()
    },
  }
}
