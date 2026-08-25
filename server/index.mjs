import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handlePlanRequest } from './planHandler.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dist = path.join(root, 'dist')

try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  // No .env file — env vars may be provided by the host instead.
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function serveFile(res, filePath, { immutable = false } = {}) {
  const stream = fs.createReadStream(filePath)
  res.statusCode = 200
  res.setHeader('content-type', MIME[path.extname(filePath)] || 'application/octet-stream')
  res.setHeader('cache-control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
  stream.pipe(res)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/api/plan') {
    return handlePlanRequest(req, res)
  }

  // Resolve inside dist only — no path traversal.
  const requested = path.normalize(path.join(dist, decodeURIComponent(url.pathname)))
  if (requested.startsWith(dist) && fs.existsSync(requested) && fs.statSync(requested).isFile()) {
    return serveFile(res, requested, { immutable: url.pathname.startsWith('/assets/') })
  }

  const index = path.join(dist, 'index.html')
  if (!fs.existsSync(index)) {
    res.statusCode = 500
    res.end('dist/ is missing. Run `npm run build` first.')
    return
  }
  serveFile(res, index)
})

const port = Number(process.env.PORT) || 4173
server.listen(port, () => {
  console.log(`Date night is running at http://localhost:${port}`)
  console.log(process.env.ANTHROPIC_API_KEY ? 'AI planner: on' : 'AI planner: off (offline planner in use)')
})
