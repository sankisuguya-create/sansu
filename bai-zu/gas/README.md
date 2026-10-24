# 何倍でしょう 図 — GAS版

校内から GitHub Pages を開けない場合に使う。中身は `../index.html` と同じ（保存先なし）。

## 設置（1回だけ）
1. https://script.google.com で新しいプロジェクトを作る。
2. `Code.gs` の中身を `コード.gs` に貼る。
3. ファイル「+」→ HTML → 名前を `index` にして、`gas/index.html` の中身を全部貼る（`../index.html` ではない）。
4. 「デプロイ」→「新しいデプロイ」→ ウェブアプリ。実行：自分／アクセス：edu.nishi.or.jp 内の全員。

## 直した時
`python3 gas/build.py`（bai-zu フォルダで）→ `gas/index.html` を貼り直し → デプロイの「管理」で新バージョン。

GAS は配る HTML の JS コメントを消すため、本体を Base64 で埋め込んでいる（circle-pattern と同じ方式）。
