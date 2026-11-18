import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

const demo = process.env.VITE_DEMO === '1';

// Política de segurança do app publicado (a mesma base do app anterior + fontes/estilos locais).
const CSP = "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' https://accounts.google.com/gsi/style; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://sheets.googleapis.com https://script.googleapis.com https://script.google.com https://accounts.google.com; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";

/** Gera sw.js com a lista exata de arquivos do build (cache offline versionado pelo conteúdo). */
function offlineShell(): Plugin {
  let outDir = 'dist';
  return {
    name: 'treino-offline-shell', apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    transformIndexHtml: { order: 'post', handler: html => html
      .replace('<meta name="referrer"', `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n    <meta name="referrer"`)
      .replace('</head>', '  <link rel="manifest" href="./manifest.webmanifest">\n  </head>') },
    closeBundle() {
      const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
      // fontes: só woff2 latin/latin-ext (o navegador baixa o resto sob demanda)
      const files = walk(outDir).filter(f => !/sw\.js$|\.map$|\.woff$|(cyrillic|greek|vietnamese)[^/]*\.woff2$/.test(f));
      const hash = createHash('sha256'); for (const f of files.sort()) hash.update(f).update(readFileSync(f));
      const assets = ['./index.html', ...files.map(f => './' + relative(outDir, f).split('\\').join('/')).filter(a => a !== './index.html')];
      const sw = readFileSync('sw-template.js', 'utf8').replace('__CACHE__', 'treino-evolucao-android-shell-react-' + hash.digest('hex').slice(0, 12)).replace('__ASSETS__', JSON.stringify(assets));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

// base relativo: o app continua em https://<usuario>.github.io/treino-evolucao/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), ...(demo ? [viteSingleFile()] : [offlineShell()])],
  build: demo ? { target: 'es2022', outDir: 'dist-demo', copyPublicDir: false, assetsInlineLimit: 100_000_000 } : { target: 'es2022', assetsInlineLimit: 0 },
});
