// Testes da camada de jogo (TypeScript carregado pelo próprio Vite, sem dependências novas).
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const S = await server.ssrLoadModule('/src/game/season.ts');
const { PRESET_DECKS } = await server.ssrLoadModule('/src/legacy/principal_presets.js');
const P = await server.ssrLoadModule('/src/engine/progression.ts');
const H = await server.ssrLoadModule('/src/engine/home.ts');
const F = await server.ssrLoadModule('/src/engine/finisherMarks.ts');
const RK = await server.ssrLoadModule('/src/game/ranked.ts');
const D = await server.ssrLoadModule('/src/engine/decks.ts');
const LIVE = await server.ssrLoadModule('/src/legacy/principal_live.js');

let failed = 0, passed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('ok -', name); } catch (e) { failed++; console.error('FALHOU -', name, '\n', e); } }

let n = 0;
function mission(date, deck = 0, sets = 18, extra = {}) {
  const id = 'sess' + (++n);
  const session = { id, date, name: PRESET_DECKS[deck].name, status: 'completed', ...extra };
  const rows = Array.from({ length: sets }, (_, k) => ({ id: `${id}_s${k}`, session_id: id, date, set_type: 'effective', repetitions: 10, load_value: 20, variant_id: 'v1', exercise_id: 'e1' }));
  return { session, rows };
}
function world(list) {
  const e = { sessions: [], sets: [], exercises: [], exercise_variants: [] };
  for (const m of list) { e.sessions.push(m.session); e.sets.push(...m.rows); }
  return e;
}
const addDays = (d, k) => new Date(Date.parse(d + 'T00:00:00Z') + k * 86400000).toISOString().slice(0, 10);

await test('calendário fixo de 8 semanas a partir de 05/01/2026', () => {
  const a = S.seasonOf('2026-01-05');
  assert.equal(a.number, 1); assert.equal(a.start, '2026-01-05'); assert.equal(a.end, '2026-03-01'); assert.equal(a.week, 1);
  const b = S.seasonOf('2026-03-01'); assert.equal(b.number, 1); assert.equal(b.week, 8); assert.equal(b.daysLeft, 0);
  const c = S.seasonOf('2026-03-02'); assert.equal(c.number, 2); assert.equal(c.week, 1);
  const d = S.seasonOf('2026-11-19'); assert.equal(d.number, 6); assert.equal(d.start, '2026-10-12'); assert.equal(d.end, '2026-12-06'); assert.equal(d.week, 6);
  assert.equal(d.weekStarts.length, 8); assert.equal(d.weekStarts[7], '2026-11-30');
  const old = S.seasonOf('2025-12-31'); assert.equal(old.number, 0); assert.ok(old.name);
});

await test('XP da temporada usa a mesma regra do app e ignora missões fora do período', () => {
  const info = S.seasonOf('2026-10-20');
  const e = world([mission('2026-10-10'), mission('2026-10-13'), mission('2026-10-14', 1, 10)]);
  const p = S.seasonProgress(e, 4, info, '2026-10-20');
  assert.equal(p.xp, (100 + 180) + (100 + 100)); assert.equal(p.missions, 2);
  assert.deepEqual(p.weeks, [2, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(p.size, S.tierSize(4)); assert.equal(p.tier, Math.floor(480 / p.size));
});

await test('faixas do passe escalam com a meta e param na 10', () => {
  assert.equal(S.tierSize(4), 1100); assert.ok(S.tierSize(1) >= 300); assert.ok(S.tierSize(6) > S.tierSize(4));
  const info = S.seasonOf('2026-10-12'); const list = [];
  for (let w = 0; w < 8; w++) for (let k = 0; k < 6; k++) list.push(mission(addDays('2026-10-12', w * 7 + k), k % 4, 30));
  const p = S.seasonProgress(world(list), 4, info, '2026-12-07');
  assert.equal(p.tier, 10); assert.equal(p.next, null); assert.equal(S.tierName(10), 'Lendária'); assert.equal(S.tierName(0), 'Sem faixa');
});

await test('desafios: ritmo, turnê, volume e chefão vencido', () => {
  const info = S.seasonOf('2026-10-12'); const list = [];
  for (let w = 0; w < 8; w++) for (let k = 0; k < 4; k++) list.push(mission(addDays('2026-10-12', w * 7 + k), k, 12));
  const p = S.seasonProgress(world(list), 4, info, '2026-12-06');
  const c = Object.fromEntries(p.challenges.map(x => [x.id, x]));
  assert.equal(c.ritmo.done, true); assert.equal(c.turne.done, true);
  assert.equal(c.volume.value, 32 * 12); assert.equal(c.volume.done, true);
  assert.equal(p.bar, 48); assert.equal(c.chefao.state, 'won'); assert.equal(c.recordes.done, false);
});

await test('chefão: bloqueado antes da semana 8, ativo nela e perdido depois', () => {
  const info = S.seasonOf('2026-10-12');
  const list = [mission('2026-10-12'), mission('2026-10-13')];
  assert.equal(S.seasonProgress(world(list), 4, S.seasonOf('2026-11-19'), '2026-11-19').bossState, 'locked');
  assert.equal(S.seasonProgress(world(list), 4, S.seasonOf('2026-12-01'), '2026-12-01').bossState, 'active');
  assert.equal(S.seasonProgress(world(list), 4, info, '2026-12-07').bossState, 'lost');
  // A meta mínima do chefão nunca fica abaixo de 10 séries por missão da meta semanal.
  assert.equal(S.seasonProgress(world(list), 4, info, '2026-12-07').bar, 40);
});

await test('missões canceladas ou em andamento não contam', () => {
  const info = S.seasonOf('2026-10-12');
  const a = mission('2026-10-12', 0, 10, { status: 'in_progress' }), b = mission('2026-10-13', 0, 10, { status: 'cancelled' });
  const p = S.seasonProgress(world([a, b]), 4, info, '2026-10-14');
  assert.equal(p.xp, 0); assert.equal(p.missions, 0);
});

await test('arquivo lista só temporadas anteriores com missões', () => {
  const e = world([mission('2026-01-06'), mission('2026-05-05'), mission('2026-11-02')]);
  const past = S.pastSeasons(e, 4, '2026-11-19');
  assert.deepEqual(past.map(p => p.info.number), [3, 1]);
  assert.equal(past[0].missions, 1); assert.equal(past[0].boss, false);
});

await test('domínio dos distritos: 4 missões em 28 dias = 100%', () => {
  const e = world([mission('2026-11-19', 0), mission('2026-11-12', 0), mission('2026-11-05', 0), mission('2026-10-29', 0), mission('2026-10-21', 0), mission('2026-11-18', 3)]);
  const c = S.districtControl(e, '2026-11-19');
  assert.deepEqual(c, [1, 0, 0, 0.25]);
});

await test('luzes da cidade acendem por total de missões', () => {
  assert.deepEqual(S.cityLights(0), { lit: 0, total: 10, next: S.CITY_UNLOCKS[0], missing: 1 });
  const l = S.cityLights(12); assert.equal(l.lit, 4); assert.equal(l.next.at, 15); assert.equal(l.missing, 3);
  assert.equal(S.cityLights(500).next, null);
});

// ---------- sugestão de progressão ----------
const DOSE = { min: 8, max: 12, unit: 'repetições' };
function hist(sessions, unit = 'kg') {
  const e = { sessions: [], sets: [], exercises: [{ id: 'e1', name: 'Supino' }], exercise_variants: [{ id: 'v1', exercise_id: 'e1', unit, unit_confirmed: true, equipment_or_variation: 'Máquina' }] };
  sessions.forEach(([date, rows], i) => {
    const id = 'p' + i; e.sessions.push({ id, date, name: 'X', status: 'completed', finished_at: date + 'T20:00:00Z' });
    rows.forEach(([load, reps, rir = null, type = 'effective'], k) => e.sets.push({ id: `${id}_${k}`, session_id: id, date, variant_id: 'v1', exercise_id: 'e1', set_type: type, load_value: load, load_unit_original: unit, repetitions: reps, rir }));
  });
  return e;
}

await test('progressão: topo da faixa com RIR ≥ 1 sugere subir um degrau', () => {
  const h = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[40, 12, 2], [40, 12, 1], [40, 12, 1]]]]));
  assert.equal(h.kind, 'subir'); assert.equal(h.next, 42.5); assert.equal(h.pct, 6); assert.match(h.detail, /Comece em 8/);
});

await test('progressão: topo no limite (RIR 0) mantém a carga', () => {
  const h = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[40, 12, 2], [40, 12, 0]]]]));
  assert.equal(h.kind, 'manter'); assert.equal(h.next, 40);
});

await test('progressão: sem RIR pede 2 treinos seguidos no topo', () => {
  const one = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[40, 12], [40, 12], [40, 12]]]]));
  assert.equal(one.kind, 'confirmar'); assert.equal(one.next, 42.5);
  const two = P.progressionHint('v1', DOSE, hist([['2026-11-03', [[40, 12], [40, 12]]], ['2026-11-10', [[40, 12], [40, 12], [40, 12]]]]));
  assert.equal(two.kind, 'subir');
});

await test('progressão: dentro ou abaixo da faixa mantém, e só a última sessão decide', () => {
  const mid = P.progressionHint('v1', DOSE, hist([['2026-11-03', [[40, 12, 2], [40, 12, 2]]], ['2026-11-10', [[42.5, 10, 2], [42.5, 9, 2]]]]));
  assert.equal(mid.kind, 'manter'); assert.equal(mid.current, 42.5); assert.match(mid.detail, /\+1 repetição/);
  const low = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[50, 7], [50, 6], [50, 9]]]]));
  assert.equal(low.kind, 'reduzir'); assert.equal(low.next, 47.5); assert.match(low.detail, /abaixo da faixa/);
});

await test('progressão: avalia a carga mais alta; aquecimento e drop não contam', () => {
  const h = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[20, 15, null, 'warmup'], [40, 12, 1], [40, 12, 1], [30, 15, null, 'drop_set'], [35, 10, 3]]]]));
  assert.equal(h.kind, 'subir'); assert.equal(h.current, 40);
  const single = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[40, 12, 2]]]]));
  assert.equal(single.kind, 'manter'); assert.match(single.detail, /pelo menos 2/);
});

await test('progressão: degraus por unidade e aviso de salto grande', () => {
  assert.equal(P.loadStep('kg', 40), 2.5); assert.equal(P.loadStep('kg', 100), 5);
  assert.equal(P.loadStep('kg/lado', 20), 1.25); assert.equal(P.loadStep('kg/halter', 10), 2); assert.equal(P.loadStep('plaquetas', 5), 1);
  const h = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[8, 12, 2], [8, 12, 2]]]], 'kg/halter'));
  assert.equal(h.next, 10); assert.equal(h.pct, 25); assert.match(h.detail, /salto é de 25%/);
});

await test('progressão: não sugere sem unidade confirmada, por tempo, sem histórico ou na sessão atual', () => {
  const e = hist([['2026-11-10', [[40, 12, 2], [40, 12, 2]]]]);
  assert.equal(P.progressionHint('v1', { ...DOSE, unit: 'segundos' }, e), null);
  assert.equal(P.progressionHint('v1', null, e), null);
  assert.equal(P.progressionHint('v1', DOSE, e, { excludeSession: 'p0' }), null);
  assert.equal(P.progressionHint('v1', DOSE, e, { today: '2026-11-09' }), null);
  e.exercise_variants[0].unit_confirmed = false; assert.equal(P.progressionHint('v1', DOSE, e), null);
  assert.equal(P.progressionHint('v1', DOSE, hist([['2026-11-10', [[10, 12, 2], [10, 12, 2]]]], 'peso corporal')), null);
});

// ---------- desafios diários, treino em casa e bloco final ----------
function dayWorld(rows, extraSessions = []) {
  const e = { sessions: [...extraSessions], sets: [], exercises: [
    { id: 'abs', name: 'Abdominal máquina' }, { id: 'plk', name: 'Prancha' }, { id: 'pol', name: 'Polichinelo' },
    { id: 'fx', name: 'Flexão de braço' }, { id: 'cf', name: 'Cadeira flexora' }, { id: 'sup', name: 'Supino reto' }], exercise_variants: [] };
  rows.forEach(([date, ex, reps, secs, type = 'effective', status = 'completed', name = 'X'], i) => {
    const sid = 'd' + date + status + name;
    if (!e.sessions.some(s => s.id === sid)) e.sessions.push({ id: sid, date, status, name });
    e.sets.push({ id: 'r' + i, session_id: sid, date, exercise_id: ex, set_type: secs ? 'core' : type, repetitions: secs ? null : reps,
      load_unit_original: secs ? 'segundos' : 'kg', duration_ms: secs ? secs * 1000 : undefined, notes: secs ? `Tempo · ${secs.toFixed(2)} segundos` : '' });
  });
  return e;
}

await test('desafios diários: somam academia e casa do dia; aquecimento e cancelados não contam', () => {
  const e = dayWorld([
    ['2026-11-20', 'abs', 30], ['2026-11-20', 'abs', 25], ['2026-11-20', 'abs', 40, 0, 'warmup'],
    ['2026-11-20', 'plk', 0, 70], ['2026-11-20', 'plk', 0, 55, 'core', 'in_progress', 'Y'],
    ['2026-11-20', 'pol', 0, 300], ['2026-11-20', 'pol', 0, 400, 'core', 'cancelled', 'Z'],
    ['2026-11-20', 'cf', 12], ['2026-11-19', 'abs', 80],
  ]);
  const q = Object.fromEntries(H.dailyQuests(e, '2026-11-20').map(x => [x.key, x]));
  assert.equal(q.abs.value, 55); assert.equal(q.abs.done, true);
  assert.equal(q.plank.value, 125); assert.equal(q.plank.done, true);
  assert.equal(q.cardio.value, 300); assert.equal(q.cardio.done, false);
  assert.equal(H.dailyQuests(e, '2026-11-20').length, 4);
});

await test('desafios diários: bônus gira por dia e "Cadeira flexora" não conta como flexão', () => {
  const keys = new Set(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'].map(d => H.questsFor(d)[3].key));
  assert.equal(keys.size, 4);
  const day = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'].find(d => H.questsFor(d)[3].key === 'pushup');
  const e = dayWorld([[day, 'cf', 30], [day, 'fx', 12]]);
  assert.equal(H.dailyQuests(e, day)[3].value, 12);
});

await test('desafios diários: sequência de dias com os 3 principais completos', () => {
  const full = d => [[d, 'abs', 50], [d, 'plk', 0, 120], [d, 'pol', 0, 600]];
  const e = dayWorld([...full('2026-11-18'), ...full('2026-11-19'), ...full('2026-11-20')]);
  assert.equal(H.dailyStreak(e, '2026-11-20'), 3);
  assert.equal(H.dailyStreak(e, '2026-11-21'), 3); // hoje ainda aberto não quebra
  assert.equal(H.dailyStreak(e, '2026-11-22'), 0);
});

await test('desafio diário soma XP mas não conta como missão; treino em casa conta', () => {
  assert.equal(H.isMission({ status: 'completed', name: 'Desafio diário' }), false);
  assert.equal(H.isMission({ status: 'completed', name: 'Treino em casa' }), true);
  const e = world([mission('2026-10-13'), mission('2026-10-14')]);
  e.sessions.push({ id: 'dd', date: '2026-10-14', name: 'Desafio diário', status: 'completed' });
  e.sets.push({ id: 'dd1', session_id: 'dd', date: '2026-10-14', set_type: 'effective', repetitions: 20, load_value: 0, variant_id: 'v9', exercise_id: 'e9' });
  const p = S.seasonProgress(e, 4, S.seasonOf('2026-10-14'), '2026-10-14');
  assert.equal(p.missions, 2); assert.deepEqual(p.weeks.slice(0, 1), [2]);
  assert.ok(p.xp > (100 + 180) * 2);
});

await test('planos: casa com unidades já confirmadas; desafio rápido só com o que falta', () => {
  const home = H.homePlan({ sessions: [], sets: [], exercises: [], exercise_variants: [] });
  assert.equal(home.presetName, 'Treino em casa'); assert.equal(home.items.length, 8);
  assert.ok(home.items.every(i => i.unit_confirmed === true && ['peso corporal', 'segundos'].includes(i.unit)));
  assert.ok(home.items.filter(i => i.unit === 'segundos').every(i => i.dose.unit === 'segundos'));
  const e = dayWorld([['2026-11-20', 'abs', 60]]);
  const daily = H.dailyPlan(e, '2026-11-20');
  assert.equal(daily.presetName, 'Desafio diário');
  assert.ok(!daily.items.some(i => i.name === 'Abdominal'));
  assert.ok(daily.items.some(i => i.name === 'Cardio livre' && i.dose.sets === 1 && i.dose.unit === 'segundos'));
});

await test('core profundo: vácuo e estabilidade, sem crunch; extra fora da meta de missões', () => {
  const core = H.corePlan({ sessions: [], sets: [], exercises: [], exercise_variants: [] });
  assert.equal(core.presetName, 'Core profundo'); assert.equal(core.presetId, 'core');
  assert.deepEqual(core.items.map(i => i.name), ['Vácuo abdominal', 'Inseto morto', 'Perdigueiro', 'Prancha', 'Prancha lateral', 'Ponte de glúteo']);
  assert.ok(!core.items.some(i => i.name === 'Abdominal'));
  assert.ok(core.items.every(i => i.unit_confirmed === true));
  const vac = core.items[0]; assert.equal(vac.dose.unit, 'segundos'); assert.equal(vac.dose.sets, 4); assert.match(vac.dose.effort, /umbigo/);
  // mesma prancha e ponte do treino em casa: histórico e recorde continuam juntos
  assert.equal(core.items[3].variant_id, 'home_var_prancha'); assert.equal(core.items[5].variant_id, 'home_var_ponte');
  assert.equal(H.isMission({ status: 'completed', name: 'Core profundo' }), false);
  // catálogo de "adicionar exercício" ganha os novos, sem duplicar prancha e ponte
  const names = H.homeCatalog({ sessions: [], sets: [], exercises: [], exercise_variants: [] }).map(i => i.name);
  for (const n of ['Vácuo abdominal', 'Inseto morto', 'Perdigueiro', 'Prancha lateral']) assert.ok(names.includes(n), n);
  assert.equal(names.filter(n => n === 'Prancha').length, 1); assert.equal(names.filter(n => n === 'Ponte de glúteo').length, 1);
});

await test('catálogo ampliado: muitos exercícios, ids estáveis e sem repetir os dos decks', async () => {
  const P = await server.ssrLoadModule('/src/legacy/principal_presets.js');
  const all = P.catalogItems();
  assert.ok(all.length >= 150, String(all.length));
  assert.equal(new Set(all.map(i => i.variant_id)).size, all.length);
  const key = (i) => (i.name + '|' + i.equipment).toLowerCase();
  assert.equal(new Set(all.map(key)).size, all.length);
  for (const n of ['Remada cavalinho', 'Agachamento búlgaro', 'Tríceps corda', 'Face pull', 'Stiff', 'Barra fixa', 'Rosca concentrada', 'Elevação pélvica']) assert.ok(all.some(i => i.name === n), n);
  assert.ok(all.some(i => i.variant_id === 'preset_var_x_remada_cavalinho_barra_t'));
  assert.ok(all.every(i => ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'pernas', 'core'].includes(i.group)));
});

await test('nome exibido sem o equipamento (o dado não muda)', async () => {
  const { exName } = await server.ssrLoadModule('/src/ui/format.ts');
  assert.equal(exName('Tríceps francês na polia barra V', 'Polia · barra V'), 'Tríceps francês');
  assert.equal(exName('Tríceps testa com halteres', 'Halteres'), 'Tríceps testa');
  assert.equal(exName('Remada alta com apoio no peito', 'Apoio no peito · equipamento a confirmar'), 'Remada alta');
  assert.equal(exName('Rosca na polia unilateral', 'Polia · unilateral'), 'Rosca unilateral');
  assert.equal(exName('Supino reto', 'Barra livre'), 'Supino reto');
  assert.equal(exName('Puxada alta', 'Polia alta'), 'Puxada alta');
  assert.equal(exName('Tríceps', 'Polia'), 'Tríceps');
  assert.equal(exName('Polia', 'Polia'), 'Polia'); // nunca fica vazio
});

await test('bloco final: última execução e melhor marca, sem a sessão atual', () => {
  const e = { sessions: [
    { id: 'a', date: '2026-11-10', status: 'completed' }, { id: 'b', date: '2026-11-14', status: 'completed' }, { id: 'c', date: '2026-11-20', status: 'in_progress' }], sets: [
    { session_id: 'a', finisher_key: 'abs', set_type: 'effective', repetitions: 60 }, { session_id: 'a', finisher_key: 'abs', set_type: 'effective', repetitions: 50 },
    { session_id: 'b', finisher_key: 'abs', set_type: 'effective', repetitions: 80 }, { session_id: 'b', finisher_key: 'abs', set_type: 'warmup', repetitions: 30 },
    { session_id: 'a', exercise_id: 'exercise_finisher_plank', notes: 'Bloco final · Prancha · 150.00 segundos' },
    { session_id: 'b', finisher_key: 'plank', duration_ms: 95000 }, { session_id: 'c', finisher_key: 'plank', duration_ms: 400000 } ] };
  const abs = F.finisherMarks(e, 'abs', 'c'); assert.deepEqual(abs.last, { value: 80, date: '2026-11-14' }); assert.deepEqual(abs.best, { value: 110, date: '2026-11-10' });
  const pl = F.finisherMarks(e, 'plank', 'c'); assert.equal(pl.last.value, 95); assert.equal(pl.best.value, 150);
  assert.deepEqual(F.finisherMarks({ sessions: [], sets: [] }, 'abs'), { last: null, best: null });
});

// ---------- redução de carga ----------
await test('redução: repetições bem abaixo da faixa cortam ~10%; falha em 2 séries corta um degrau', () => {
  const far = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[60, 4], [60, 5], [60, 4]]]]));
  assert.equal(far.kind, 'reduzir'); assert.equal(far.next, 55); assert.equal(far.pct, -8);
  const fail = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[40, 10, 0], [40, 9, 0], [40, 8, 1]]]]));
  assert.equal(fail.kind, 'reduzir'); assert.equal(fail.next, 37.5); assert.match(fail.detail, /falha \(RIR 0\) em 2/);
  const one = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[40, 10, 2], [40, 9, 0]]]]));
  assert.equal(one.kind, 'manter');
  const plates = P.progressionHint('v1', DOSE, hist([['2026-11-10', [[1, 5], [1, 4]]]], 'plaquetas'));
  assert.notEqual(plates.kind, 'reduzir'); // não sugere zero placas
});

// ---------- prancha: maior série única ----------
await test('prancha: maior série única entre bloco final e prancha em casa', () => {
  const e = { sessions: [{ id: 'a', date: '2026-11-10', status: 'completed' }, { id: 'b', date: '2026-11-14', status: 'completed' }, { id: 'c', date: '2026-11-20', status: 'in_progress' }], sets: [
    { session_id: 'a', finisher_key: 'plank', duration_ms: 60000 }, { session_id: 'a', finisher_key: 'plank', duration_ms: 60000 }, { session_id: 'a', finisher_key: 'plank', duration_ms: 60000 },
    { session_id: 'b', exercise_id: 'home_ex_prancha', duration_ms: 72400 }, { session_id: 'c', finisher_key: 'plank', duration_ms: 99000 }] };
  assert.deepEqual(F.plankBestSingle(e, 'c'), { value: 72, date: '2026-11-14' });
  assert.equal(F.finisherMarks(e, 'plank', 'c').best.value, 180); // total por treino continua separado
  assert.equal(F.plankBestSingle({ sessions: [], sets: [] }), null);
});

// ---------- ranqueada ----------
await test('ranqueada: divisões e faixas', () => {
  assert.equal(RK.rankOf(0).label, 'Ferro III'); assert.equal(RK.rankOf(250).label, 'Ferro I');
  assert.equal(RK.rankOf(300).label, 'Bronze III'); assert.equal(RK.rankOf(1799).label, 'Diamante I');
  assert.equal(RK.rankOf(1800).label, 'Mestre'); assert.equal(RK.rankOf(5000).label, 'Lenda'); assert.equal(RK.rankOf(5000).ceil, null);
});

await test('ranqueada: missões pontuam, semana vencida/incompleta e reinício de temporada', () => {
  const list = [];
  // semana de 12/10: 4 missões (meta cumprida); semana de 19/10: 1 missão; semana de 26/10: nada
  for (const d of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-20']) list.push(mission(d));
  const e = world(list);
  for (const s of e.sessions) s.finished_at = s.date + 'T20:00:00Z';
  const r = RK.ranked(e, 4, '2026-11-03');
  const kinds = r.events.map(x => x.kind + ':' + x.delta);
  assert.deepEqual(kinds, ['mission:12', 'mission:12', 'mission:12', 'mission:12', 'week:15', 'mission:12', 'week:-36', 'week:-36']);
  assert.equal(r.points, 12 * 5 + 15 - 72);
  assert.equal(r.missions, 5);
  // virada de temporada (07/12) mantém 60%
  const big = world(Array.from({ length: 40 }, (_, k) => mission(addDays('2026-10-12', k), k % 4)));
  const after = RK.ranked(big, 4, '2026-12-07');
  assert.equal(after.events.at(-1).kind, 'season'); assert.equal(after.events.at(-2).label, 'Semana sem treino');
  assert.equal(after.points, Math.round(after.events.at(-2).points * 0.6));
  assert.equal(after.seasons[0].number, 6);
});

await test('ranqueada: desafio diário não é partida; promoção é marcada', () => {
  const e = world([mission('2026-10-12')]);
  e.sessions.push({ id: 'dd', date: '2026-10-12', name: 'Desafio diário', status: 'completed' });
  assert.equal(RK.ranked(e, 4, '2026-10-13').missions, 1);
  const many = world(Array.from({ length: 30 }, (_, k) => mission(addDays('2026-10-12', k), k % 4)));
  const r = RK.ranked(many, 4, '2026-11-10');
  assert.ok(r.events.some(x => x.promoted === 'Ferro II'));
  assert.equal(RK.missionRanked(many, many.sessions[0].id, 4).delta, 12);
});

// ---------- decks personalizados ----------
const empty = () => ({ sessions: [], sets: [], exercises: [], exercise_variants: [] });
await test('decks: padrão vira referências; sem personalização o plano é o pronto', () => {
  const m = { entities: empty() };
  const def = D.defaultEntries('rpg_deck_01', m.entities);
  assert.equal(def.length, 7); assert.equal(def[0].ref, 'cat:bench'); assert.deepEqual([def[0].sets, def[0].min], [3, def[0].min]);
  const p = D.deckPlan('rpg_deck_01', m, {});
  assert.equal(p.items.length, 7); assert.equal(p.custom, undefined);
});

await test('decks: personalizado reordena, tira, muda séries/faixa e inclui catálogo, casa e variação sua', () => {
  const e = empty();
  e.exercises.push({ id: 'ex1', name: 'Remada curvada', muscle_group: 'costas' });
  e.exercise_variants.push({ id: 'v1', exercise_id: 'ex1', equipment_or_variation: 'Barra', unit: 'kg', unit_confirmed: true });
  const settings = { deck_custom: { rpg_deck_01: { items: [
    { ref: 'cat:bench', sets: 4, min: 5, max: 8 }, { ref: 'var:v1', sets: 2, min: 10, max: 12 },
    { ref: 'home:prancha', sets: 2, min: 30, max: 90 }, { ref: 'var:sumiu', sets: 3, min: 8, max: 12 } ] } } };
  const p = D.deckPlan('rpg_deck_01', { entities: e }, settings);
  assert.equal(p.custom, true);
  assert.deepEqual(p.items.map(i => i.name), ['Supino reto', 'Remada curvada', 'Prancha']);
  assert.deepEqual([p.items[0].dose.sets, p.items[0].dose.min, p.items[0].dose.max], [4, 5, 8]);
  assert.equal(p.items[1].is_catalog, false); assert.equal(p.items[1].dose.sets, 2);
  assert.equal(p.items[2].dose.unit, 'segundos'); assert.equal(p.items[2].unit_confirmed, true);
  assert.deepEqual(p.groups.sort(), ['costas', 'peito']);
});

await test('decks: item do catálogo usa a sua variação confirmada de mesmo nome/equipamento', () => {
  const e = empty();
  const cat = D.resolveEntry(e, { ref: 'cat:bench', sets: 3, min: 6, max: 10 });
  e.exercises.push({ id: 'meu', name: cat.name, muscle_group: 'peito' });
  e.exercise_variants.push({ id: 'meuv', exercise_id: 'meu', equipment_or_variation: cat.equipment, unit: 'kg', unit_confirmed: true });
  const r = D.resolveEntry(e, { ref: 'cat:bench', sets: 3, min: 6, max: 10 });
  assert.equal(r.variant_id, 'meuv'); assert.equal(r.is_catalog, false); assert.equal(r.group, 'peito');
});

await test('decks: validação e referência das opções do seletor', () => {
  assert.throws(() => D.validateEntries([]), /1 a 18/);
  assert.throws(() => D.validateEntries([{ ref: 'cat:a', sets: 3, min: 12, max: 8 }]), /Faixa/);
  assert.throws(() => D.validateEntries([{ ref: 'cat:a', sets: 11, min: 8, max: 12 }]), /Séries/);
  assert.throws(() => D.validateEntries([{ ref: 'cat:a', sets: 3, min: 8, max: 12 }, { ref: 'cat:a', sets: 3, min: 8, max: 12 }]), /repetido/);
  assert.equal(D.validateEntries([{ ref: 'var:x', sets: 1, min: 1, max: 1 }]), true);
  assert.equal(D.refForOption({ mine: true, item: { variant_id: 'v9' } }), 'var:v9');
  assert.equal(D.refForOption({ mine: false, item: { variant_id: 'preset_var_bench' } }), 'cat:bench');
  assert.equal(D.refForOption({ mine: false, item: { variant_id: 'home_var_prancha' } }), 'home:prancha');
});

await test('meta de séries respeita o planejado (1, 2 ou 5), também em andamento', () => {
  const s = (n) => ({ id: 's', status: 'in_progress', planned_variant_ids: ['v'], planned_guidance: { v: { sets: n, min: 8, max: 12, unit: 'repetições' } } });
  for (const n of [1, 2, 5]) assert.equal(LIVE.liveGuidance(s(n), 'v', empty()).target, n);
});

await test('desafios diários com metas personalizadas', () => {
  const e = dayWorld([['2026-11-20', 'abs', 30], ['2026-11-20', 'plk', 0, 60], ['2026-11-20', 'pol', 0, 300]]);
  const q = Object.fromEntries(H.dailyQuests(e, '2026-11-20', { abs: 30, plank: 60, cardio: 300 }).map(x => [x.key, x]));
  assert.ok(q.abs.done && q.plank.done && q.cardio.done);
  assert.equal(H.dailyStreak(e, '2026-11-20', { abs: 30, plank: 60, cardio: 300 }), 1);
  assert.equal(H.dailyStreak(e, '2026-11-20'), 0);
});

await server.close();
console.log(`\n${passed} ok, ${failed} falharam`);
process.exit(failed ? 1 : 0);
