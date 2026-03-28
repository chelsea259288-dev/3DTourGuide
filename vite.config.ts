import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const worldlabsKey = env.WORLDLABS_API_KEY ?? ''
  // Vercel sets VERCEL=1 during build — skip copying huge glTF under public/models (100MB+ file limit).
  const publicDir = process.env.VERCEL === '1' ? 'public-lite' : 'public'

  return {
    publicDir,
    plugins: [react()],
    server: {
      proxy: {
        // Browser calls /api/worldlabs/marble/v1/... → api.worldlabs.ai (key injected here only).
        '/api/worldlabs': {
          target: 'https://api.worldlabs.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/worldlabs/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (worldlabsKey) {
                proxyReq.setHeader('WLT-Api-Key', worldlabsKey)
              }
            })
          },
        },
      },
    },
  }
})
