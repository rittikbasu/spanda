import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.PORT ?? 4174)
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  const relative = pathname === '/' ? 'demo/index.html' : pathname.slice(1)
  const file = resolve(root, relative)

  if (!file.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('forbidden')
    return
  }

  try {
    if (!statSync(file).isFile()) throw new Error('not a file')
    response.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    createReadStream(file).pipe(response)
  } catch {
    response.writeHead(404).end('not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`spanda audition: http://127.0.0.1:${port}`)
})
