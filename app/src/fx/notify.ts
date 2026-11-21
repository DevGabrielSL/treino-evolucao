// Notificação do fim do descanso quando o app está em segundo plano (opcional).
// Observação: com a tela bloqueada, o Android pode atrasar os timers da página; com a tela ligada
// (o app mantém a tela acesa durante o treino) o aviso é imediato.
const KEY = 'treino-evolucao-rest-notify-v1';
export const notifySupported = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
export function restNotifyOn() { try { return notifySupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === 'on'; } catch { return false; } }
export async function setRestNotify(on: boolean) {
  if (on && notifySupported() && Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') { try { localStorage.setItem(KEY, 'off'); } catch { /* sem armazenamento */ } return false; }
  }
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* sem armazenamento */ }
  return on;
}
export async function notifyRestEnd(next: string) {
  if (!restNotifyOn() || document.visibilityState === 'visible') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.showNotification('Descanso acabou!', { body: `A seguir: ${next}`, tag: 'rest-end', renotify: true, requireInteraction: false, vibrate: [400, 150, 400, 150, 800], icon: './icons/icon-mission-192.png' } as any);
  } catch { /* sem notificação */ }
}
