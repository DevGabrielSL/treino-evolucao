// Atualização do app: o novo service worker assume sozinho; aqui só avisamos a tela
// para o usuário recarregar quando quiser (nunca recarrega sozinho no meio de um treino).
import { useSyncExternalStore } from 'react';

let ready = false;
const ls = new Set<() => void>();
const emit = () => ls.forEach(l => l());
export function useUpdateReady() { return useSyncExternalStore(l => { ls.add(l); return () => { ls.delete(l); }; }, () => ready); }
export function applyUpdate() { location.reload(); }

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  // Primeira instalação não é "atualização": só avisa quando já havia uma versão controlando a página.
  let previous = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (previous && !ready) { ready = true; emit(); }
    previous = navigator.serviceWorker.controller;
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
      // Procura versão nova ao voltar para o app e a cada 30 minutos com ele aberto.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 30 * 60 * 1000);
    } catch (err) { console.warn('Cache offline não está pronto', err); }
  });
}
