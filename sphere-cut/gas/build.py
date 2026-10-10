#!/usr/bin/env python3
"""sphere-cut を GAS（HtmlService）用の1ファイル gas/index.html にまとめる。
使い方:  npx esbuild app.js --bundle --minify --format=iife --target=es2020 --supported:template-literal=false --outfile=/tmp/bundle.js
         python3 gas/build.py /tmp/bundle.js
"""
import re, sys, pathlib
here = pathlib.Path(__file__).resolve().parent
root = here.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
import base64, zlib, textwrap
js_raw = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
# GAS を通ると script 内の記号（< > や改行）が書き換えられることがあるため、
# 本体は Base64 にして埋め込み、ブラウザで戻してから実行する。CRC32 で中身を照合する。
b64 = '\n'.join(textwrap.wrap(base64.b64encode(js_raw.encode('utf-8')).decode('ascii'), 100))
crc = zlib.crc32(js_raw.encode('utf-8'))
body = html[html.index('<body'):html.index('<script type="module"')]
out = f'''<!DOCTYPE html>
<html lang="ja">
<head>
<base target="_top">
<meta charset="utf-8">
<style>
{css}</style>
</head>
{body}<script>
/* 不具合の原因を画面に出す（GAS環境での診断用） */
(function () {{
  function show(msg) {{
    var d = document.getElementById('diag');
    if (!d) {{ d = document.createElement('div'); d.id = 'diag';
      d.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99;background:#fff3f3;color:#8a1010;border:2px solid #c33;border-radius:8px;padding:10px;font:14px/1.5 sans-serif;white-space:pre-wrap';
      document.body.appendChild(d); }}
    d.textContent += msg + '\\n';
  }}
  window.addEventListener('error', function (e) {{ show('エラー: ' + e.message + (e.lineno ? ' (行 ' + e.lineno + ':' + e.colno + ')' : '')); }});
  window.addEventListener('unhandledrejection', function (e) {{ show('エラー: ' + (e.reason && e.reason.message || e.reason)); }});
  try {{
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) show('この端末・ブラウザでは3D表示（WebGL）が使えません。chrome://gpu で「WebGL」の項目を確認してください。');
  }} catch (e) {{ show('WebGLの確認で失敗: ' + e.message); }}
  ['error', 'warn'].forEach(function (k) {{
    var orig = console[k];
    console[k] = function () {{
      try {{ show('[' + k + '] ' + Array.prototype.map.call(arguments, function (a) {{ return (a && a.message) || String(a); }}).join(' ').slice(0, 600)); }} catch (e) {{}}
      return orig.apply(console, arguments);
    }};
  }});
  window.__diagShow = show;
}})();
</script>
<script type="text/plain" id="appB64">
{b64}
</script>
<script>
(function () {{
  var b64 = document.getElementById('appB64').textContent.replace(/[^A-Za-z0-9+/=]/g, '');
  var bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var crc = -1;
  for (var j = 0; j < bytes.length; j++) {{ crc ^= bytes[j]; for (var k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); }}
  crc = (crc ^ -1) >>> 0;
  if (crc !== {crc}) {{ window.__diagShow && window.__diagShow('プログラムの中身が壊れています（照合失敗）。index を貼り直してください。'); return; }}
  var code = new TextDecoder('utf-8').decode(bytes);
  var sc = document.createElement('script');
  sc.textContent = code;
  document.body.appendChild(sc);
}})();
</script>
</body>
</html>
'''
(here / 'index.html').write_text(out, encoding='utf-8')
print('wrote', here / 'index.html', len(out) // 1024, 'KB')
