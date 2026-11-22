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
// Saída com compressor: permite um alarme bem mais alto sem distorcer.
let master: GainNode | null = null;
function out(c: AudioContext) {
  if (!master) { const comp = c.createDynamicsCompressor(); master = c.createGain(); master.gain.value = 1; master.connect(comp).connect(c.destination); }
  return master;
}
function tone(freq: number, at: number, dur: number, { type = 'square' as OscillatorType, vol = .08, slide = 0 } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(out(c)); o.start(t); o.stop(t + dur + .02);
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
  /** Contagem final do descanso (3, 2, 1): bipe curto e audível. */
  tick() { tone(1200, 0, .08, { type: 'square', vol: .14 }); buzz(60); },
  /** Fim do descanso: 3 rajadas fortes (~2,5 s) e vibração longa, para não passar despercebido. */
  restEnd() {
    for (const at of [0, .9, 1.8]) {
      tone(988, at, .14, { vol: .32 }); tone(988, at + .18, .14, { vol: .32 }); tone(1480, at + .36, .38, { vol: .34 });
      tone(1976, at + .36, .38, { type: 'triangle', vol: .18 });
    }
    buzz([400, 150, 400, 150, 800, 250, 400, 150, 400]);
  },
};
