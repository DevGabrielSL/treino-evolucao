import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { loadDocument } from './engine/store';
import { registerServiceWorker } from './engine/updates';

async function boot() {
  if (import.meta.env.VITE_DEMO === '1' || (import.meta.env.DEV && new URLSearchParams(location.search).has('demo'))) {
    const { seedDemo } = await import('./dev/seed');
    await seedDemo();
  }
  await loadDocument();
}
boot();
// Modo offline e aviso de nova versão: só no app publicado (não no desenvolvimento nem na demo).
if (import.meta.env.PROD && import.meta.env.VITE_DEMO !== '1') registerServiceWorker();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
