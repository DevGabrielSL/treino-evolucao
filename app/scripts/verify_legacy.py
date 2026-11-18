"""Garante que a lógica usada pelo app novo (app/src/legacy) é idêntica,
byte a byte, aos módulos que a cadeia de publicação monta e testa em dist/.
A única diferença permitida é a remoção dos sufixos ?v=NNN nos imports."""
import re, sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
legacy, dist = root / 'app/src/legacy', root / 'dist'
norm = lambda s: re.sub(r"((?:from|import) ['\"]\./[A-Za-z0-9_]+\.js)\?v=[A-Za-z0-9]+(['\"])", r"\1\2", s)
bad = []
for f in sorted(legacy.glob('*.js')):
    built = dist / f.name
    if not built.exists():
        bad.append(f'{f.name}: ausente em dist/'); continue
    if norm(built.read_text('utf8')) != f.read_text('utf8'):
        bad.append(f'{f.name}: diferente do módulo testado')
if bad:
    print('\n'.join(bad)); sys.exit(1)
print(f'LEGACY_LOGIC_IDENTICAL={len(list(legacy.glob("*.js")))}')
