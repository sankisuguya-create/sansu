#!/usr/bin/env python3
"""../index.html から GAS 用の gas/index.html を作る。使い方: python3 gas/build.py（bai-zu フォルダで）
GAS を通すと script 内の JS コメントが消され、文字列中の // なども巻き込まれうるため、
本体の script は Base64 にして埋め込み、ブラウザで戻してから実行する。長さで中身を照合する。"""
import base64, pathlib, re, textwrap
here = pathlib.Path(__file__).resolve().parent
html = (here.parent / 'index.html').read_text(encoding='utf-8')
m = re.search(r'<script>\n(.*?)\n</script>', html, re.S)
js = m.group(1).encode('utf-8')
b64 = '\n'.join(textwrap.wrap(base64.b64encode(js).decode('ascii'), 100))
loader = f'''<script type="text/plain" id="appB64">
{b64}
</script>
<script>
(function () {{
  var t = document.getElementById('appB64').textContent.replace(/[^A-Za-z0-9+/=]/g, '');
  var bin = atob(t), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length !== {len(js)}) {{ document.body.insertAdjacentHTML('afterbegin', '<p style="color:#b42318;font-weight:700;padding:8px">ページが こわれています（' + bytes.length + '/{len(js)}）。index.html を 貼り直してください。</p>'); return; }}
  var s = document.createElement('script');
  s.textContent = new TextDecoder('utf-8').decode(bytes);
  document.body.appendChild(s);
}})();
</script>'''
out = html[:m.start()] + loader + html[m.end():]
out = out.replace('<head>', '<head>\n<base target="_top">', 1)
(here / 'index.html').write_text(out, encoding='utf-8')
print(f'gas/index.html ← index.html（本体 {len(js)} バイト）')
