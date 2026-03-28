/**
 * Large glTF assets under /models may exceed Vercel's 100MB-per-file limit.
 * Host copies on any HTTPS static origin and set VITE_MODEL_CDN_BASE (no trailing slash).
 */
const base = (import.meta.env.VITE_MODEL_CDN_BASE as string | undefined)?.replace(
  /\/$/,
  '',
) ?? ''

export function resolveModelUrl(url: string): string {
  if (!base || !url.startsWith('/models/')) return url
  return `${base}${url}`
}
