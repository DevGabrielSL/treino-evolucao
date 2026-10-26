from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'dist/testes/sheet_sync_browser.js';s=p.read_text()
start=s.index('/** Read displayed ISO dates');end=s.index('/** Read-only Google API request.',start)
s=s[:start]+(root/'testing/fetch_tables_grid.js').read_text()+'\n'+s[end:];p.write_text(s)
