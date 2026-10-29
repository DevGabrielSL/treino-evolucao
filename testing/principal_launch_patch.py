"""RPG launch branding, no changes to storage or initialization timing."""
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
shutil.copy2(root/'testing/principal_launch.css',dist/'principal_launch.css')
for size in (192,512):shutil.copy2(root/f'testing/assets/icon-rpg-{size}.png',dist/f'icons/icon-rpg-{size}.png')
p=dist/'manifest.webmanifest';m=json.loads(p.read_text())
m.update(background_color='#10171e',theme_color='#10171e',description='Monte seus treinos, registre suas séries e acompanhe seu histórico com uma experiência RPG.')
m['icons']=[{'src':f'./icons/icon-rpg-{size}.png','sizes':f'{size}x{size}','type':'image/png','purpose':'any maskable'} for size in (192,512)]
p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
p=dist/'index.html';s=p.read_text().replace('app.js?v=149','app.js?v=150').replace('v1.4.9 Assistente e modelos','v1.5.0 Abertura RPG').replace('content="#10243D"','content="#10171e"').replace('name="color-scheme" content="light"','name="color-scheme" content="dark"')
s=s.replace('./icons/icon-192.png','./icons/icon-rpg-192.png')
s=s.replace('href="./manifest.webmanifest"','href="./manifest.webmanifest?v=150"')
s=s.replace('</head>','<link rel="stylesheet" href="./principal_launch.css?v=150">\n<link rel="preload" as="image" href="./icons/icon-rpg-192.png">\n</head>')
start=s.index('<main id="app"');end=s.index('</main>',start)+len('</main>')
s=s[:start]+'''<main id="app" class="app-container" aria-live="polite"><section class="rpg-launch" aria-labelledby="launch-title"><div class="launch-content"><div class="launch-emblem"><img src="./icons/icon-rpg-192.png" width="128" height="128" alt="Emblema de cristal esmeralda e escudo dourado"></div><p class="launch-kicker">SUA PRÓXIMA JORNADA</p><h1 id="launch-title">Treino &amp; Evolução</h1><div class="launch-rule" aria-hidden="true">◆</div><p role="status" class="launch-status">Preparando seus treinos…</p><div class="launch-loader" aria-hidden="true"></div><p class="launch-note">Abrindo os dados salvos neste aparelho.</p><noscript>Ative o JavaScript para abrir o aplicativo.</noscript></div></section></main>'''+s[end:]
p.write_text(s)
p=dist/'app.js';s=p.read_text().replace('Treino & Evolução · v1.4.9','Treino & Evolução · v1.5.0');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=149','app.js?v=150').replace('shell-v149-assistant','shell-v150-launch')
 s=s.replace("'./manifest.webmanifest'","'./manifest.webmanifest?v=150','./principal_launch.css?v=150','./icons/icon-rpg-192.png','./icons/icon-rpg-512.png'")
 p.write_text(s)
