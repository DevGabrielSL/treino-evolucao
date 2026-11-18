// Séries por tempo: formato aceito pelo coordenador, ida para a planilha e volta para o app.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {harness} from './coordinator/mock_service.mjs';
import {setValues, stageInbound} from '../dist/sheet_sync_core.js';
import {emptyDocument, validateDocument} from '../dist/store.js';

let count = 0;
const test = (name, fn) => { fn(); count++; console.log('PASS ' + name); };
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures.json', import.meta.url)));
const session = ['2026-11-18', 'Quarta', 'Core · Assistente', 'Concluído', '', '', '', '', '', 'session_t'];
let n = 0;
const row = (notes, { unit = 'segundos', load = 0, reps = '' } = {}) => ['2026-11-18', 'Core · Assistente', 'Prancha frontal', 'Peso corporal', 'Core', 1, load, unit, reps, '', '', '', '', notes, 'set_t_' + (++n)];
const op = (rows, id = 'operation_00000001') => ({ protocol: 1, action: 'append', operationId: id, expectedRevision: 0, records: [{ tab: 'Treinos', values: session }, ...rows.map(values => ({ tab: 'Series', values }))] });
const send = rows => { const h = harness(); return h.call(h.a, op(rows)); };

test('Coordenador aceita série por tempo do roteiro', () => assert.equal(send([row('Tempo · 32.50 segundos')]).ok, true));
test('Coordenador continua aceitando a prancha do bloco final', () => assert.equal(send([row('Bloco final · Prancha · 61.20 segundos')]).ok, true));
test('Tempo com repetições é recusado', () => assert.throws(() => send([row('Tempo · 30.00 segundos', { reps: 5 })]), /INVALID_SET/));
test('Tempo com carga é recusado', () => assert.throws(() => send([row('Tempo · 30.00 segundos', { load: 5 })]), /INVALID_SET/));
test('Segundos sem nota no formato combinado são recusados', () => assert.throws(() => send([row('segurei 30 segundos')]), /INVALID_SET/));
test('Tempo zero é recusado', () => assert.throws(() => send([row('Tempo · 0 segundos')]), /INVALID_SET/));
test('Série comum continua exigindo repetições', () => assert.throws(() => send([row('', { unit: 'kg', load: 20, reps: '' })]), /INVALID_SET/));

test('Série gravada pelo app vira linha aceita pelo coordenador', () => {
  const entities = {
    sessions: [{ id: 'session_t', date: '2026-11-18', name: 'Core · Assistente', status: 'completed' }],
    exercises: [{ id: 'ex_p', name: 'Prancha frontal' }],
    exercise_variants: [{ id: 'v_sec', exercise_id: 'ex_p', equipment_or_variation: 'Peso corporal', unit: 'segundos', unit_confirmed: true }],
  };
  const set = { id: 'set_app_1', date: '2026-11-18', session_id: 'session_t', exercise_id: 'ex_p', variant_id: 'v_sec', planned_variant_id: 'v_plan', set_type: 'core', set_number: 1, load_value: 0, load_unit_original: 'segundos', repetitions: null, rir: null, rpe: null, legacy_volume_index: null, discomfort: null, duration_ms: 32500, notes: 'Tempo · 32.50 segundos' };
  const values = setValues(set, entities);
  assert.equal(values[7], 'segundos'); assert.equal(values[6], 0); assert.equal(values[8], ''); assert.equal(values[11], '');
  assert.equal(send([values]).ok, true);
});

test('Importação da planilha recupera a duração sem marcar como bloco final', () => {
  const data = { Treinos: [fixture.Treinos[0], session], Series: [fixture.Series[0], row('Tempo · 32.50 segundos'), row('Bloco final · Prancha · 61.20 segundos')], Peso: [fixture.Peso[0]] };
  const result = stageInbound(emptyDocument(), data);
  const [timed, plank] = result.next.overlay.sets;
  assert.equal(timed.duration_ms, 32500); assert.equal(timed.finisher_key, undefined);
  assert.equal(plank.duration_ms, 61200); assert.equal(plank.finisher_key, 'plank');
  assert.equal(validateDocument(result.next), true);
});

console.log('TIMED_SETS_TESTS=' + count);
