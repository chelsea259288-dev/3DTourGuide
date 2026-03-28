import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  operationsGet,
  pollOperationUntilDone,
  worldsGenerate,
  worldsGet,
} from '../lib/worldlabsClient'

type Phase = 'idle' | 'starting' | 'polling' | 'done' | 'error'

export function WorldLabsPlayground() {
  const [displayName, setDisplayName] = useState('3DTourGuide test world')
  const [textPrompt, setTextPrompt] = useState(
    'A small Roman forum at golden hour, cobblestones and columns',
  )
  const [useMini, setUseMini] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')
  const [operationId, setOperationId] = useState<string | null>(null)
  const [lastOperationJson, setLastOperationJson] = useState<string>('')
  const [worldJson, setWorldJson] = useState<string>('')
  const abortRef = useRef<AbortController | null>(null)

  const isDev = import.meta.env.DEV

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const run = useCallback(async () => {
    if (!isDev) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    setPhase('starting')
    setMessage('正在调用 worlds:generate…')
    setLastOperationJson('')
    setWorldJson('')
    setOperationId(null)

    try {
      const op0 = await worldsGenerate({
        display_name: displayName.trim() || 'Untitled',
        world_prompt: { type: 'text', text_prompt: textPrompt.trim() },
        ...(useMini ? { model: 'Marble 0.1-mini' } : {}),
      })
      setOperationId(op0.operation_id)
      setLastOperationJson(JSON.stringify(op0, null, 2))

      setPhase('polling')
      setMessage(
        `已创建任务 ${op0.operation_id}。完整生成可能需数分钟；Marble 0.1-mini 较快。轮询中…`,
      )

      const opDone = await pollOperationUntilDone(op0.operation_id, {
        intervalMs: 3500,
        maxWaitMs: 25 * 60_000,
        signal,
      })
      setLastOperationJson(JSON.stringify(opDone, null, 2))

      if (opDone.error) {
        setPhase('error')
        setMessage('任务结束但包含 error 字段，请查看下方 JSON。')
        return
      }

      const resp = opDone.response as {
        id?: string
        world_id?: string
      } | null
      const wid =
        resp?.world_id ??
        resp?.id ??
        (opDone.metadata as { world_id?: string } | undefined)?.world_id
      if (!wid) {
        setPhase('done')
        setMessage('已完成，但未解析到 world id，请查看 JSON。')
        return
      }

      setMessage('正在拉取 world 详情…')
      const world = await worldsGet(wid)
      setWorldJson(JSON.stringify(world, null, 2))
      setPhase('done')
      setMessage('完成。可在 JSON 中查找 world_marble_url、splats.spz_urls 等。')
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setPhase('idle')
        setMessage('已取消。')
        return
      }
      setPhase('error')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }, [displayName, textPrompt, useMini, isDev])

  const refreshOp = useCallback(async () => {
    if (!operationId) return
    try {
      const op = await operationsGet(operationId)
      setLastOperationJson(JSON.stringify(op, null, 2))
      setMessage(op.done ? '任务已 done。' : '仍在进行中。')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }, [operationId])

  if (!isDev) {
    return (
      <div className="page home">
        <p>
          World Labs 试调页仅在 <code className="inline-code">npm run dev</code>{' '}
          下可用（需要 Vite 代理注入 API Key）。生产构建请部署带服务端转发的
          API。
        </p>
        <Link to="/">返回首页</Link>
      </div>
    )
  }

  return (
    <div className="page home worldlabs-playground">
      <header className="site-header">
        <Link className="btn ghost" to="/">
          ← 返回 3DTourGuide
        </Link>
        <h1 className="brand-title" style={{ marginTop: '1rem' }}>
          World Labs API 试调
        </h1>
        <p className="lede">
          仅用于本地开发：请求走{' '}
          <code className="inline-code">/api/worldlabs</code>，密钥来自项目根目录{' '}
          <code className="inline-code">.env</code> 中的{' '}
          <code className="inline-code">WORLDLABS_API_KEY</code>。
        </p>
      </header>

      <section className="wl-form" aria-label="生成表单">
        <label className="wl-label">
          显示名称
          <input
            className="wl-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="wl-label">
          文本提示（英文或中文均可，以官方模型理解为准）
          <textarea
            className="wl-textarea"
            rows={4}
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
          />
        </label>
        <label className="wl-check">
          <input
            type="checkbox"
            checked={useMini}
            onChange={(e) => setUseMini(e.target.checked)}
          />
          使用 <code className="inline-code">Marble 0.1-mini</code>（更快、更省，适合调试）
        </label>
        <div className="wl-actions">
          <button
            type="button"
            className="btn primary"
            onClick={run}
            disabled={phase === 'starting' || phase === 'polling'}
          >
            {phase === 'polling' ? '生成中…' : '开始生成'}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => abortRef.current?.abort()}
            disabled={phase !== 'polling' && phase !== 'starting'}
          >
            取消
          </button>
          {operationId && (
            <button type="button" className="btn ghost" onClick={refreshOp}>
              手动刷新任务状态
            </button>
          )}
        </div>
        <p className="wl-status" role="status">
          {message}
        </p>
      </section>

      {lastOperationJson && (
        <section className="wl-json-block" aria-label="Operation JSON">
          <h2 className="section-title">Operation</h2>
          <pre className="wl-pre">{lastOperationJson}</pre>
        </section>
      )}

      {worldJson && (
        <section className="wl-json-block" aria-label="World JSON">
          <h2 className="section-title">World</h2>
          <pre className="wl-pre">{worldJson}</pre>
        </section>
      )}

      <footer className="site-footer">
        <p>
          官方文档：{' '}
          <a
            href="https://docs.worldlabs.ai/api/index"
            target="_blank"
            rel="noreferrer"
          >
            World API Quickstart
          </a>
          。下一步可把返回的 splat URL 接到 SparkJS（见 Marble 导出文档）。
        </p>
      </footer>
    </div>
  )
}
