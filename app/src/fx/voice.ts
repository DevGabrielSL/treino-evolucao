// Voz no fim do descanso, com a síntese de fala do próprio aparelho (Web Speech API).
// Opcional e desligada por padrão. Se o aparelho não tiver voz em português, usa a padrão.
const KEY = 'treino-evolucao-voz-v1';

export const voiceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
export function voiceOn() { try { return voiceSupported() && localStorage.getItem(KEY) === 'on'; } catch { return false; } }
export function setVoice(on: boolean) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* sem armazenamento */ } }

/** Números falados como se escreve no Brasil: 22,5 em vez de 22.5. */
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const UNIT_SPOKEN: Record<string, string> = { 'kg': 'quilos', 'kg/lado': 'quilos por lado', 'kg/halter': 'quilos por halter', 'plaquetas': 'placas' };

/** Frase do próximo passo: "Rosca Scott. Série 2 de 3. 20 quilos." */
export function restEndPhrase(o: { name: string; set?: number | null; of?: number | null; load?: number | null; unit?: string | null; seconds?: boolean }) {
  const parts = [o.name || 'Próximo exercício'];
  if (o.set && o.of && o.set <= o.of) parts.push(`Série ${o.set} de ${o.of}`);
  else if (o.set) parts.push('Série extra');
  if (!o.seconds && o.load != null && Number.isFinite(o.load) && o.load > 0 && o.unit && UNIT_SPOKEN[o.unit]) parts.push(`${num(o.load)} ${UNIT_SPOKEN[o.unit]}`);
  return parts.join('. ') + '.';
}

export function speak(text: string) {
  if (!voiceOn() || !text) return;
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR'; u.rate = 1.05;
    const v = s.getVoices().find(x => /^pt[-_]BR/i.test(x.lang)) || s.getVoices().find(x => /^pt/i.test(x.lang));
    if (v) u.voice = v;
    s.speak(u);
  } catch { /* sem voz disponível */ }
}
