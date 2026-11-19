// Testes da camada de jogo (TypeScript carregado pelo próprio Vite, sem dependências novas).
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
const S = await server.ssrLoadModule('/src/game/season.ts');
const { PRESET_DECKS } = await server.ssrLoadModule('/src/legacy/principal_presets.js');

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

await server.close();
console.log(`\n${passed} ok, ${failed} falharam`);
process.exit(failed ? 1 : 0);
