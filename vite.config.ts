import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handlePlanRequest } from './server/planHandler.mjs'

/** Mounts the same /api/plan handler used in production into the dev server. */
function apiPlugin() {
  return {
    name: 'date-night-api',
    configureServer(server: any) {
      server.middlewares.use('/api/plan', async (req: any, res: any) => {
        await handlePlanRequest(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Vite only exposes VITE_* to the client. The server handler runs in this same
  // process during dev, so lift the private keys into process.env by hand.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['ANTHROPIC_API_KEY', 'DATE_NIGHT_MODEL']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }

  return {
    plugins: [react(), apiPlugin()],
    server: { host: true, port: 5173 },
    build: { target: 'es2022' },
  }
})
