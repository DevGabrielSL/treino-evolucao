// Imagens empacotadas pelo Vite (ganham hash de versão e entram no cache offline).
const urls = import.meta.glob('../assets/art/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const byName = Object.fromEntries(Object.entries(urls).map(([k, v]) => [k.split('/').pop()!, v]));
export function asset(path: string) { const name = path.split('/').pop()!; return byName[name] || path; }
