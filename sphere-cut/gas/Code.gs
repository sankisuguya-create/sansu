/**
 * 球を切ってみよう（3年「円と球」）— GAS Webアプリ
 * index.html は gas/build.py で生成した1ファイル版（three.js 同梱・外部通信なし）。
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('球を切ってみよう')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);   // Googleサイトへの埋め込みも可能にする
}
