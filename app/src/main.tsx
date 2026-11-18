import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { loadDocument } from './engine/store';

async function boot() {
  if (import.meta.env.VITE_DEMO === '1' || (import.meta.env.DEV && new URLSearchParams(location.search).has('demo'))) {
    const { seedDemo } = await import('./dev/seed');
    await seedDemo();
  }
  await loadDocument();
}
boot();
// Modo offline: só no app publicado (não no desenvolvimento nem na demo).
if (import.meta.env.PROD && import.meta.env.VITE_DEMO !== '1' && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(err => console.warn('Cache offline não está pronto', err)); });
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
