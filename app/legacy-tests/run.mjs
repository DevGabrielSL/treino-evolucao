// Bateria de regressões da lógica (armazenamento, backup, Sheets, assistente, séries),
// rodando diretamente sobre app/src/legacy — os mesmos arquivos que vão para o app.
// Os testes ficam inalterados: o script só monta, numa pasta temporária, a estrutura de
// pastas que eles esperam (dist/, integration/, quality/, testing/) apontando para a lógica atual.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '..');
const legacy = join(app, 'src/legacy');
const tmp = mkdtempSync(join(tmpdir(), 'treino-legacy-'));
const put = (dir) => { mkdirSync(join(tmp, dir), { recursive: true }); for (const f of readdirSync(legacy)) cpSync(join(legacy, f), join(tmp, dir, f)); };
for (const d of ['dist', 'integration', 'testing', 'public']) put(d);
cpSync(join(repo, 'integration/tests'), join(tmp, 'integration/tests'), { recursive: true });
mkdirSync(join(tmp, 'tests'));
cpSync(join(repo, 'integration/tests/sheets_additional.mjs'), join(tmp, 'tests/sheets_additional.mjs'));
writeFileSync(join(tmp, 'tests/sheets_additional.mjs'), readFileSync(join(tmp, 'tests/sheets_additional.mjs'), 'utf8').replaceAll("'../public/", "'../dist/"));
cpSync(join(repo, 'quality'), join(tmp, 'quality'), { recursive: true });
for (const f of ['grid_mock.mjs', 'fixtures.json', 'coordinator', 'diagnostico_conexao.js', ...readdirSync(join(repo, 'testing')).filter(f => /_tests\.mjs$|transport_integration\.mjs$/.test(f))]) cpSync(join(repo, 'testing', f), join(tmp, 'testing', f), { recursive: true });
cpSync(join(app, 'legacy-tests/packaged'), join(tmp, 'dist/tests'), { recursive: true });
// Os testes de transporte rodavam no "candidato de produção", antes da ativação do coordenador:
// recebem a mesma lógica, com a configuração daquele momento (coordenador desligado).
const candidate = join(tmp, 'candidate');
cpSync(join(tmp, 'dist'), join(candidate, 'dist'), { recursive: true });
cpSync(join(tmp, 'testing'), join(candidate, 'testing'), { recursive: true });
const cfg = join(candidate, 'dist/sheets_config.js');
// Mesmo preparo de testing/production_candidate.py: servidor simulado = Code.gs de produção.
cpSync(join(repo, 'production/coordinator/Code.gs'), join(candidate, 'testing/coordinator/Code.gs'));
const mock = join(candidate, 'testing/coordinator/mock_service.mjs');
writeFileSync(mock, readFileSync(mock, 'utf8').replace('1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA', '15Nntilky9pyv1OrQMyOd6k97DsE_tU7I4aJtISQdL2M'));
writeFileSync(cfg, readFileSync(cfg, 'utf8').replace(/COORDINATOR_DEPLOYMENT_ID='[^']*'/, "COORDINATOR_DEPLOYMENT_ID=''").replace('COORDINATOR_ENABLED=true', 'COORDINATOR_ENABLED=false'));

// [arquivo, marcador esperado (ou null = basta terminar sem erro), argumentos]
const suite = [
  ['dist/tests/v051_regression.mjs', null],
  ['dist/tests/insights_v06.mjs', 'TOTAL_INSIGHTS_TESTS=35'],
  ['dist/tests/history_v07.mjs', 'TOTAL_HISTORY_TESTS=55'],
  ['dist/tests/body_v08.mjs', 'TOTAL_BODY_TESTS=68'],
  ['dist/tests/v09_backup.mjs', 'V09_BACKUP_SMOKE=7'],
  ['dist/tests/rir_hotfix.mjs', 'SHEETS_RIR_HOTFIX_TESTS=15'],
  ['dist/tests/coach.mjs', 'COACH_TESTS=25'],
  ['dist/tests/coach_commands.mjs', 'COACH_COMMAND_TESTS=36'],
  ['integration/tests/sheets_core.mjs', 'SHEETS_SYNC_TESTS=13'],
  ['tests/sheets_additional.mjs', 'TOTAL_SHEETS_GUARD_TESTS=11'],
  ['quality/sync_preflight_tests.mjs', 'ETAPA0_PREFLIGHT_TESTS=17'],
  ['integration/tests/legacy_identity.mjs', 'ETAPA1_DEDUP_TESTS=36'],
  ['integration/tests/remote_reconcile.mjs', 'ETAPA2_RECONCILIATION_TESTS=53'],
  ['integration/tests/automatic_sync.mjs', 'ETAPA4_AUTO_POLICY_TESTS=35'],
  ['integration/tests/coach_policy.mjs', 'ETAPA5_COACH_POLICY_TESTS=39'],
  ['quality/stage6_end_to_end.mjs', 'STAGE6_E2E_TESTS=56'],
  ['testing/coordinator_tests.mjs', 'COORDINATOR_CANDIDATE_TESTS=26'],
  ['testing/principal_transport_tests.mjs', 'PRINCIPAL_TRANSPORT_TESTS=8'],
  ['testing/principal_transport_integration.mjs', null, [candidate]],
  ['testing/production_session_tests.mjs', null, [candidate]],
  ['testing/principal_intent_tests.mjs', 'PRINCIPAL_INTENT_TESTS=14'],
  ['testing/principal_unit_tests.mjs', null],
  ['testing/principal_xp_tests.mjs', null],
  ['testing/principal_presets_tests.mjs', null],
  ['testing/principal_variety_tests.mjs', null],
  ['testing/principal_cancel_tests.mjs', null],
  ['testing/diagnostico_conexao_tests.mjs', null],
  ['testing/timed_sets_tests.mjs', 'TIMED_SETS_TESTS=9'],
];

let failed = 0;
for (const [file, marker, args = []] of suite) {
  const r = spawnSync(process.execPath, [join(tmp, file), ...args], { cwd: tmp, encoding: 'utf8', timeout: 120000 });
  const ok = r.status === 0 && (!marker || r.stdout.split(/\r?\n/).includes(marker));
  console.log(`${ok ? 'OK  ' : 'FALHOU'} ${file}${marker ? ' · ' + marker : ''}`);
  if (!ok) { failed++; console.log((r.stdout || '').slice(-1500), (r.stderr || '').slice(-2500)); }
}
rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `LEGACY_SUITE_FAILED=${failed}` : `LEGACY_SUITE_FILES=${suite.length}`);
process.exit(failed ? 1 : 0);
