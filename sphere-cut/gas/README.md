# 球を切ってみよう — GAS Webアプリ版

外部通信なしで動く1ファイル版（three.js 同梱）。

## 設置
1. https://script.google.com で新しいプロジェクトを作る（名前：球を切ってみよう）。
2. `Code.gs` の中身を、エディタの `コード.gs` に貼る。
3. ファイル「+」→ HTML → 名前を `index` にして、`index.html` の中身を全部貼る。
4. 右上「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」。
   - 次のユーザーとして実行：自分
   - アクセスできるユーザー：児童が開ける範囲（下の注意を参照）
5. 発行された URL（…/exec）を Classroom の「資料」にリンクとして貼る。

## 注意
- 児童（@kyoiku.edu.nishi.or.jp）と教師（@edu.nishi.or.jp）のドメインが違う。
  「（自分のドメイン）内の全員」にすると児童が開けない場合がある。その時は「全員」にするか、管理者に確認する。
- 中身を直したら、デプロイの「管理」→ 鉛筆 → バージョン「新バージョン」で更新する（URLは変わらない）。

## index.html の作り直し（app.js / style.css / ../index.html を変更した時）
```
npx esbuild app.js --bundle --minify --format=iife --target=es2020 --supported:template-literal=false --outfile=/tmp/bundle.js
python3 gas/build.py /tmp/bundle.js
```
（sphere-cut フォルダで実行）

## なぜ `--supported:template-literal=false` か
GAS を通すと、JS の文字列の中の改行が失われることがある。three.js のシェーダー（`#ifdef` などの行）は
改行に依存するため、改行が消えると「CUBEUV_MAX_MIP: undeclared identifier」等で球が描けなくなる。
テンプレート文字列を通常の文字列＋`\n`に変換して、生の改行を含まないようにしている。
