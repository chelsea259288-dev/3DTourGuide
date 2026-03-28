/**
 * World Labs Marble API — browser calls only through the Vite dev proxy
 * (`/api/worldlabs` → api.worldlabs.ai with WLT-Api-Key from server env).
 *
 * Docs: https://docs.worldlabs.ai/api/index
 *
 * Production: static hosting has no proxy — deploy a small backend or
 * serverless route that adds `WLT-Api-Key` and forwards to api.worldlabs.ai.
 */

const PREFIX = import.meta.env.DEV ? '/api/worldlabs' : ''

function url(path: string) {
  if (!PREFIX) {
    throw new Error(
      'World Labs API is only wired for local dev (Vite proxy). Add a backend proxy for production.',
    )
  }
  return `${PREFIX}${path.startsWith('/') ? path : `/${path}`}`
}

export type GenerateTextBody = {
  display_name: string
  world_prompt: {
    type: 'text'
    text_prompt: string
  }
  model?: string
}

export type Operation = {
  operation_id: string
  done: boolean
  error: unknown
  metadata?: { world_id?: string; progress?: unknown }
  response?: unknown
}

export async function worldsGenerate(body: GenerateTextBody): Promise<Operation> {
  const res = await fetch(url('/marble/v1/worlds:generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`worlds:generate ${res.status}: ${t}`)
  }
  return res.json() as Promise<Operation>
}

export async function operationsGet(operationId: string): Promise<Operation> {
  const res = await fetch(url(`/marble/v1/operations/${operationId}`), {
    method: 'GET',
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`operations:get ${res.status}: ${t}`)
  }
  return res.json() as Promise<Operation>
}

export async function pollOperationUntilDone(
  operationId: string,
  opts?: {
    intervalMs?: number
    maxWaitMs?: number
    signal?: AbortSignal
  },
): Promise<Operation> {
  const intervalMs = opts?.intervalMs ?? 4000
  const maxWaitMs = opts?.maxWaitMs ?? 20 * 60_000
  const signal = opts?.signal
  const start = Date.now()
  for (;;) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const op = await operationsGet(operationId)
    if (op.done) return op
    if (Date.now() - start > maxWaitMs) {
      throw new Error('pollOperationUntilDone: timeout')
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

export async function worldsGet(worldId: string): Promise<unknown> {
  const res = await fetch(url(`/marble/v1/worlds/${worldId}`), {
    method: 'GET',
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`worlds:get ${res.status}: ${t}`)
  }
  return res.json()
}
