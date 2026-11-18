// Servidor estático para os testes: imita o GitHub Pages (/treino-evolucao/) e permite
// trocar a versão publicada no meio do teste (GET /__use?dir=b) para testar atualizações.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dirs = { a: join(root, 'dist'), b: join(root, 'e2e/.dist-b') };
let current = 'a';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__use') { current = url.searchParams.get('dir') === 'b' ? 'b' : 'a'; res.end(current); return; }
  const prefix = '/treino-evolucao/';
  if (!url.pathname.startsWith(prefix)) { res.statusCode = 404; res.end(); return; }
  let rel = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
  const file = join(dirs[current], rel);
  if (!file.startsWith(dirs[current])) { res.statusCode = 403; res.end(); return; }
  try {
    if ((await stat(file)).isDirectory()) throw new Error('dir');
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end('not found'); }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1');
