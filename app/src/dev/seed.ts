// Somente em desenvolvimento (npm run dev, endereço ?demo): cria um histórico FICTÍCIO
// em localhost, para visualizar as telas. Nunca roda no app publicado.
import { readSnapshot, saveSnapshot, emptyDocument, commit } from '../legacy/store.js';
import { PRESET_DECKS, presetPlan } from '../legacy/principal_presets.js';
import { catalogEntities } from '../legacy/balanced_coach.js';

export async function seedDemo() {
  const snap = await readSnapshot();
  if (snap.document) return;
  let doc = emptyDocument();
  const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() - offset); return d.toLocaleDateString('en-CA'); };
  doc = commit(doc, (d: any) => {
    const seen = new Set<string>();
    let rnd = 7; const rand = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
    const plans = PRESET_DECKS.map((deck: any) => presetPlan(deck.id, { sessions: [], sets: [], exercises: [], exercise_variants: [] }, day(0), {}));
    for (const plan of plans) {
      const cat = catalogEntities(plan.items);
      for (const e of cat.exercises) if (!seen.has(e.id)) { seen.add(e.id); d.overlay.exercises.push(e); }
      for (const v of cat.variants) if (!seen.has(v.id)) { seen.add(v.id); d.overlay.exercise_variants.push({ ...v, unit: v.unit === 'a confirmar' ? 'kg' : v.unit, unit_confirmed: true }); }
    }
    const offsets = [40, 38, 36, 33, 31, 29, 26, 24, 22, 19, 17, 15, 12, 10, 8, 5, 3, 1];
    offsets.forEach((off, n) => {
      const plan = plans[n % plans.length], date = day(off), id = 'session_demo_' + n;
      const start = new Date(date + 'T18:30:00'); start.setMinutes(start.getMinutes() + Math.round(rand() * 90));
      d.overlay.sessions.push({ id, date, name: plan.presetName, status: 'completed', started_at: start.toISOString(), finished_at: new Date(start.getTime() + 62 * 60000).toISOString(), duration_minutes: 62, body_weight_kg: null, lower_back_pain_before: null, lower_back_pain_after: null, notes: 'Demonstração', planned_variant_ids: plan.items.map((x: any) => x.variant_id), planned_guidance: Object.fromEntries(plan.items.map((x: any) => [x.variant_id, { ...x.dose }])), provenance: { source: 'android_local' } });
      plan.items.forEach((item: any, k: number) => {
        const base = [40, 22, 50, 45, 25, 30, 14, 12][k % 8] + Math.floor(n / 4) * 2.5;
        for (let s = 1; s <= 3; s++) d.overlay.sets.push({ recorded_at: start.toISOString(), id: `set_demo_${n}_${k}_${s}`, date, session_id: id, session_name_original: plan.presetName, exercise_id: item.exercise_id, variant_id: item.variant_id, set_type: 'effective', set_type_original: null, set_number: s, load_value: base, load_unit_original: 'kg', repetitions: 12 - s - Math.floor(rand() * 2), rir: null, rpe: null, legacy_volume_index: null, discomfort: null, notes: null, provenance: { source: 'android_local' } });
      });
    });
    // pesagens e diário de recuperação fictícios
    for (let k = 0; k < 14; k++) {
      const off = 42 - k * 3;
      d.overlay.weigh_ins.push({ id: 'weighin_demo_' + k, date: day(off), weight_kg: Math.round((84.6 - k * .22 + (rand() - .5) * .6) * 10) / 10, goal_weight_kg_reported: null, notes: '', provenance: { source: 'android_local' } });
    }
    d.settings.recovery_entries = Array.from({ length: 8 }, (_, k) => ({ id: 'recovery_demo_' + k, date: day(k * 2 + 1), sleep_hours: 6 + Math.round(rand() * 8) / 4, energy: 2 + Math.floor(rand() * 4), soreness: Math.floor(rand() * 6), notes: '' }));
  });
  await saveSnapshot(doc, snap.generation);
}
