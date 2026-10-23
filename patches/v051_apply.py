#!/usr/bin/env python3
"""Reproducible and hash-checked PWA v0.5.1 patch. Public program text only."""
import hashlib, json, sys
from pathlib import Path
changes=json.loads(r'''{"metrics.js":{"sha_base":"ecbb34965b7e792c563089afb41651256f6bb80890e2ef7777d870deb0b730cc","sha_after":"37d516ab2c1b4dbb731c9c42d3151659bb9bc2adbea186a28b6a80f1014098b7","ops":[[2367,2367,"||!Number.isFinite(s.load_value)||s.load_value<=0||!Number.isInteger(s.repetitions)||s.repetitions<=0"],[3007,3007,"const done=new Set(e.sessions.filter(x=>x.status==='completed').map(x=>x.id));"],[3036,3036,"done.has(s.session_id)&&"],[3087,3087,"&&Number.isInteger(s.repetitions)&&s.repetitions>0"]]},"edit_ops.js":{"sha_base":"bbaf5e48060e0aa50aae8702485ff86c4580fe6495075871b85e4886a76b6d63","sha_after":"a7925f6f218e61f4f091a39603b1c61f62e262d7003cc59da1b2318a89b5d933","ops":[[1990,1990,"||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date"],[2024,2024,";\n if([...(doc.base?.entities?.sessions||[]),...doc.overlay.sessions].some(s=>s.id===newId))throw new Error('Identificador de sessão já utilizado.');\n const planned_variant_ids=[...new Set([...(Array.isArray(source.planned_variant_ids)?source.planned_variant_ids:[]),...[...(doc.base?.entities?.sets||[]),...doc.overlay.sets].filter(s=>s.session_id===source.id).map(s=>s.variant_id)])]"],[2084,2084,",planned_variant_ids"]]},"index.html":{"sha_base":"a6a65d75af389e4f6e0474640f519da9724e8920779ff95e7462688e010b632f","sha_after":"619d18e74b0f46b92c9a3abc0968b842faf7c6966917f2e5055842b208c0bae6","ops":[[935,935,".1"]]},"sw.js":{"sha_base":"39c96b1a71a0e766047cbed4932b57aa6f6560e14373d02083f0cb81c15e4fbe","sha_after":"add3e081cdc40d10c432c8544ff0c0378495549a383d57893181eafc524b2674","ops":[[113,113,"0"],[114,114,"1"]]}}''')
dist=Path(sys.argv[1] if len(sys.argv)>1 else 'dist')
for name,change in changes.items():
 path=dist/name; before=path.read_text(encoding='utf-8')
 assert hashlib.sha256(before.encode()).hexdigest()==change['sha_base'], 'Base incompatible: '+name
 after=before
 for i,j,replacement in reversed(change['ops']):after=after[:i]+replacement+after[j:]
 assert hashlib.sha256(after.encode()).hexdigest()==change['sha_after'], 'Hash mismatch after patch: '+name
 path.write_text(after,encoding='utf-8')
print('PWA v0.5.1: four source files hash-verified, offline cache rotated')
