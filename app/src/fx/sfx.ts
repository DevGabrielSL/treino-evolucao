// Efeitos sonoros sintetizados na hora (Web Audio). Nenhum arquivo de áudio, nada de terceiros.
const KEY = 'treino-evolucao-sfx-v1';
let ctx: AudioContext | null = null;
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();

export function soundOn() { return enabled; }
export function setSound(on: boolean) { enabled = on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* sem armazenamento */ } }

function ac() {
  if (!enabled) return null;
  try { ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; }
}
function tone(freq: number, at: number, dur: number, { type = 'square' as OscillatorType, vol = .08, slide = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
}
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* sem vibração */ } };

export const sfx = {
  tap() { tone(660, 0, .05, { type: 'triangle', vol: .04 }); },
  set() { tone(523, 0, .09); tone(784, .07, .14); buzz(25); },
  xp() { [988, 1319, 1568].forEach((f, i) => tone(f, i * .05, .12, { type: 'triangle', vol: .06 })); },
  combo(n: number) { tone(440 * Math.pow(1.122, Math.min(n, 8)), 0, .12, { type: 'sawtooth', vol: .04 }); },
  pr() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .22, { vol: .07 })); tone(1047, .4, .5, { type: 'triangle', vol: .08 }); buzz([40, 60, 40, 60, 120]); },
  start() { tone(196, 0, .5, { type: 'sawtooth', vol: .05, slide: 2 }); tone(392, .45, .35, { vol: .06 }); buzz([30, 40, 80]); },
  complete() { [392, 494, 587, 784].forEach((f, i) => tone(f, i * .12, .35, { vol: .07 })); [784, 988, 1175].forEach(f => tone(f, .55, .9, { type: 'triangle', vol: .05 })); buzz([60, 80, 60, 80, 200]); },
  level() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * .07, .3, { type: 'triangle', vol: .07 })); buzz([100, 50, 100, 50, 300]); },
  tick() { tone(1200, 0, .04, { type: 'square', vol: .03 }); },
  restEnd() { tone(880, 0, .12); tone(880, .18, .12); tone(1320, .36, .3); buzz([120, 80, 120, 80, 250]); },
};
