"""Expose installation in More and keep browser-controlled install lifecycle honest."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
shutil.copy2(root/'testing/principal_install.js',dist/'principal_install.js')
p=dist/'app.js';s=p.read_text();s="import {renderInstallCard} from './principal_install.js?v=151';\n"+s
needle='<div class="more-menu">';assert s.count(needle)==1
s=s.replace(needle,'${renderInstallCard()}<div class="more-menu">')
start=s.index("window.addEventListener('beforeinstallprompt',ev=>")
end=s.index("\ndocument.addEventListener('submit'",start)
s=s[:start]+s[end:]
s=s.replace('Treino & Evolução · v1.5.0','Treino & Evolução · v1.5.1');p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=150','app.js?v=151').replace('v1.5.0 Abertura RPG','v1.5.1 Instalar em Mais');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=150','app.js?v=151').replace('shell-v150-launch','shell-v151-install').replace("'./principal_launch.css?v=150'","'./principal_install.js?v=151','./principal_launch.css?v=150'");p.write_text(s)
