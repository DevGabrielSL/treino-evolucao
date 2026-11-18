"""Apply the brand artwork and wordmark to the main app."""

art = 'brand-waterfront.webp'
shutil.copy2(root / 'testing/assets' / art, dist)
shutil.copy2(root / 'testing/principal_brand.css', dist)
for size in (192, 512):
    shutil.copy2(root / f'testing/assets/icon-mission-{size}.png', dist / 'icons')

wordmark = '<span>Treino &amp;</span><span>Evolução</span>'
for name in ('index.html', 'app.js', 'manifest.webmanifest', 'sw.js', 'integrity.js'):
    path = dist / name
    source = (path.read_text()
              .replace('shell-v204-mission', 'shell-v205-brand')
              .replace('app.js?v=204', 'app.js?v=205')
              .replace('index.html?release=204', 'index.html?release=205')
              .replace('manifest.webmanifest?v=202', 'manifest.webmanifest?v=205')
              .replace('icon-coastal-', 'icon-mission-')
              .replace('v1.6.12', 'v1.6.13'))
    if name == 'index.html':
        source = source.replace('</head>', '<link rel="stylesheet" href="./principal_brand.css?v=205">\n</head>')
        old = '<h1 id="launch-title">Treino &amp; Evolução</h1><div class="launch-rule" aria-hidden="true">◆</div>'
        assert source.count(old) == 1
        source = source.replace(old, f'<h1 class="brand-wordmark" id="launch-title">{wordmark}</h1>')
        source = source.replace('width="128" height="128" alt="Ícone do Treino &amp; Evolução"', 'width="104" height="104" alt=""')
    if name == 'app.js':
        start = source.index('  <img class="mission-cover"')
        end = source.index('\n', start)
        source = (source[:start]
                  + f'  <div class="mission-brand-hero"><img class="mission-cover" src="./{art}" width="900" height="450" alt=""><span class="brand-wordmark">{wordmark}</span></div>'
                  + source[end:])
    if name in ('sw.js', 'integrity.js'):
        needle = "'./app.js?v=205'"
        assert source.count(needle) == 1
        source = source.replace(needle, needle + f",'./{art}','./principal_brand.css?v=205'")
    path.write_text(source)
