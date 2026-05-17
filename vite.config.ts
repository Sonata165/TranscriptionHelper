import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const songsDir = path.resolve(process.cwd(), 'songs')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'chart-api',
      configureServer(server) {

        // GET /api/songs — list .chart files in songs/
        server.middlewares.use('/api/songs', (req, res) => {
          if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
          try {
            const files = fs.readdirSync(songsDir).filter(f => f.endsWith('.chart'))
            const songs = files.map(f => {
              try {
                const text = fs.readFileSync(path.join(songsDir, f), 'utf-8')
                const match = text.match(/^title:\s*(.+)/m)
                return { filename: f, title: match?.[1]?.trim() || f.replace(/\.chart$/, '') }
              } catch { return { filename: f, title: f.replace(/\.chart$/, '') } }
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(songs))
          } catch (e) {
            res.statusCode = 500; res.end(String(e))
          }
        })

        // GET /api/load?file=autumn-leaves.chart — read a file
        server.middlewares.use('/api/load', (req, res) => {
          if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
          const url = new URL(req.url!, 'http://localhost')
          const file = url.searchParams.get('file') ?? ''
          const resolved = path.resolve(songsDir, path.basename(file))
          if (!resolved.startsWith(songsDir + path.sep)) {
            res.statusCode = 403; res.end('Forbidden'); return
          }
          try {
            const content = fs.readFileSync(resolved, 'utf-8')
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end(content)
          } catch (e) {
            res.statusCode = 404; res.end(String(e))
          }
        })

        // DELETE /api/delete?file=autumn-leaves.chart — remove a file
        server.middlewares.use('/api/delete', (req, res) => {
          const method = req.method || 'GET'
          if (method.toUpperCase() !== 'DELETE') { res.statusCode = 405; res.end(); return }
          try {
            const url = new URL(req.url || '/', 'http://localhost')
            const file = url.searchParams.get('file') ?? ''
            if (!file) { res.statusCode = 400; res.end('Missing file'); return }
            const resolved = path.resolve(songsDir, path.basename(file))
            if (!resolved.startsWith(songsDir + path.sep)) {
              res.statusCode = 403; res.end('Forbidden'); return
            }
            fs.unlinkSync(resolved)
            res.statusCode = 200; res.end('OK')
          } catch (e) {
            res.statusCode = 500; res.end(String(e))
          }
        })

        // POST /api/save — write a file
        server.middlewares.use('/api/save', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              const { filePath, content } = JSON.parse(body)
              const resolved = path.resolve(process.cwd(), filePath)
              if (!resolved.startsWith(songsDir + path.sep)) {
                res.statusCode = 403; res.end('Forbidden'); return
              }
              fs.mkdirSync(path.dirname(resolved), { recursive: true })
              fs.writeFileSync(resolved, content, 'utf-8')
              res.statusCode = 200; res.end('OK')
            } catch (e) {
              res.statusCode = 500; res.end(String(e))
            }
          })
        })

      },
    },
  ],
})
