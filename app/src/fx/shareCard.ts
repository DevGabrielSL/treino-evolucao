// Cartão da missão (1080×1350) desenhado no próprio aparelho, sem enviar dados a nenhum servidor.
// Compartilha pelo menu do celular quando disponível; senão, baixa a imagem.
import { missionSummary } from '../game/summary';
import { xp, rankFor } from '../game/progress';
import { asset } from '../ui/assets';

const W = 1080, H = 1350;
const fmt = (n: number, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
const clock = (ms: number) => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(r).padStart(2, '0'); };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
}
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
  if (filled) { c.fillStyle = '#ffc54d'; c.shadowColor = 'rgba(255,197,77,.8)'; c.shadowBlur = 24; c.fill(); c.shadowBlur = 0; }
  else { c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 4; c.stroke(); }
}

export async function renderMissionCard(model: any, sessionId: string): Promise<Blob> {
  const sum = missionSummary(model, sessionId);
  const level = xp(model.entities);
  await Promise.all(['120px Anton', '700 40px "Barlow Condensed"', '600 30px "Barlow Condensed"', '500 30px Barlow'].map(f => document.fonts.load(f).catch(() => null)));
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d')!;

  // fundo: céu escuro + cenário do deck
  c.fillStyle = '#0b0716'; c.fillRect(0, 0, W, H);
  try {
    const img = await loadImage(asset(sum.cover));
    const scale = Math.max(W / img.width, 760 / img.height), w = img.width * scale, h = img.height * scale;
    c.drawImage(img, (W - w) / 2, 0, w, h);
  } catch { /* sem imagem, segue só com o gradiente */ }
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(11,7,22,.25)'); g.addColorStop(.42, 'rgba(11,7,22,.55)'); g.addColorStop(.58, 'rgba(11,7,22,.96)'); g.addColorStop(1, '#0b0716');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  g = c.createRadialGradient(W / 2, H, 50, W / 2, H, 800); g.addColorStop(0, 'rgba(255,107,61,.35)'); g.addColorStop(1, 'rgba(255,107,61,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // título
  c.textAlign = 'center';
  c.font = '700 34px "Barlow Condensed"'; c.fillStyle = '#1ee8d6'; c.letterSpacing = '8px';
  c.fillText((sum.session?.name || 'Missão').toUpperCase(), W / 2, 370);
  c.letterSpacing = '0px';
  const title = c.createLinearGradient(0, 450, 0, 690);
  title.addColorStop(0, '#ffe08a'); title.addColorStop(.45, '#ff6b3d'); title.addColorStop(1, '#ff2e93');
  c.font = '150px Anton'; c.fillStyle = title; c.shadowColor = 'rgba(40,6,40,.9)'; c.shadowOffsetY = 8;
  c.fillText('MISSÃO', W / 2, 590); c.fillText('CONCLUÍDA', W / 2, 745);
  c.shadowColor = 'transparent'; c.shadowOffsetY = 0;

  // estrelas
  for (let i = 0; i < 3; i++) star(c, W / 2 + (i - 1) * 96, 822, 38, i < sum.rating);
  c.font = '700 32px "Barlow Condensed"'; c.fillStyle = '#ffc54d'; c.fillText(sum.ratingText.toUpperCase(), W / 2, 895);

  // estatísticas
  const stats: [string, string][] = [['TEMPO', clock(sum.ms)], ['SÉRIES', String(sum.work.length)], ['VOLUME', fmt(sum.volume, 0) + ' kg'], ['RECORDES', String(sum.prs.length)]];
  stats.forEach(([k, v], i) => {
    const x = 90 + i * 225, y = 935;
    c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.roundRect(x, y, 205, 150, 22); c.fill();
    c.fillStyle = '#fff4e6'; c.font = '700 54px "Barlow Condensed"'; c.fillText(v, x + 102, y + 78);
    c.fillStyle = '#bfaed3'; c.font = '600 24px "Barlow Condensed"'; c.fillText(k, x + 102, y + 120);
  });
  if (sum.prs.length) {
    c.font = '600 30px "Barlow Condensed"'; c.fillStyle = '#ffc54d';
    const p = sum.prs[0];
    c.fillText(`★ ${p.exercise}: ${fmt(p.previous)} → ${fmt(p.load)} ${p.unit}${sum.prs.length > 1 ? `  +${sum.prs.length - 1}` : ''}`, W / 2, 1130);
  }

  // XP e rodapé
  c.font = '700 74px "Barlow Condensed"'; c.fillStyle = '#7cf29a'; c.fillText(`+${fmt(sum.missionXp, 0)} XP`, W / 2, 1215);
  c.font = '500 28px Barlow'; c.fillStyle = '#bfaed3';
  const t = Date.parse(sum.session?.started_at || '');
  const date = (sum.session?.date ? sum.session.date.split('-').reverse().join('/') : '') + (Number.isFinite(t) ? ' · ' + new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  c.fillText(`Nível ${level.level} · ${rankFor(level.level)} · ${date}`, W / 2, 1270);
  c.font = '30px Anton'; c.fillStyle = '#fff4e6'; c.fillText('TREINO & EVOLUÇÃO', W / 2, 1320);

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'));
}

export async function shareMission(model: any, sessionId: string) {
  const blob = await renderMissionCard(model, sessionId);
  const date = model.entities.sessions.find((s: any) => s.id === sessionId)?.date || 'missao';
  const file = new File([blob], `missao-${date}.png`, { type: 'image/png' });
  const nav: any = navigator;
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'Missão concluída', text: 'Missão concluída no Treino & Evolução' }); return 'shared'; }
    catch (err: any) { if (err?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
