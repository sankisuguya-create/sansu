#!/usr/bin/env python3
"""sphere-cut を GAS（HtmlService）用の1ファイル gas/index.html にまとめる。
使い方:  npx esbuild app.js --bundle --minify --format=iife --target=es2020 --outfile=/tmp/bundle.js
         python3 gas/build.py /tmp/bundle.js
"""
import re, sys, pathlib
here = pathlib.Path(__file__).resolve().parent
root = here.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'style.css').read_text(encoding='utf-8')
js = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8').replace('</script', '<\\/script')
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
{js}</script>
</body>
</html>
'''
(here / 'index.html').write_text(out, encoding='utf-8')
print('wrote', here / 'index.html', len(out) // 1024, 'KB')
