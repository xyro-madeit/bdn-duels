# Bundles the built game (dist/) into ONE self-contained HTML file: JS, CSS and sounds inlined.
# Run: npx vite build && python3 tools/build_offline.py  -> BDN-Duels-offline.html
import os, re, base64, json, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'dist')
html = open(os.path.join(D, 'index.html')).read()
def asset(p): return open(os.path.join(D, p.lstrip('/')), encoding='utf-8').read()
# CSS
html = re.sub(r'<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>', lambda m: '<style>' + asset(m.group(1)) + '</style>', html)
# drop modulepreload hints, inline the entry script
html = re.sub(r'<link rel="modulepreload"[^>]*>', '', html)
sfx = {os.path.basename(f): 'data:audio/mpeg;base64,' + base64.b64encode(open(f, 'rb').read()).decode() for f in glob.glob(os.path.join(D, 'sfx', '*.mp3'))}
models = {os.path.basename(f)[:-4]: 'data:model/gltf-binary;base64,' + base64.b64encode(open(f, 'rb').read()).decode() for f in glob.glob(os.path.join(D, 'models', '*.glb'))}
def script(m):
    js = asset(m.group(1)).replace('</script', '<\\/script')
    return ('<script>window.__BDN_SFX=' + json.dumps(sfx) + ';window.__BDN_MODELS=' + json.dumps(models) + '</script>'
            '<script type="module">' + js + '</script>')
html = re.sub(r'<script type="module" crossorigin src="([^"]+)"></script>', script, html)
logo = 'data:image/svg+xml;base64,' + base64.b64encode(open(os.path.join(D, 'logo.svg'), 'rb').read()).decode()
html = html.replace('"/logo.svg"', '"' + logo + '"')
out = os.path.join(ROOT, 'BDN-Duels-offline.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, round(os.path.getsize(out) / 1e6, 2), 'MB', len(sfx), 'sounds', len(models), 'models')
