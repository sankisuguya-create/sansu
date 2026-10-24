/**
 * 何倍でしょう 図 — GAS Webアプリ（表示だけ。保存先なし）
 * index.html は gas/build.py で ../index.html から作る。
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('何倍でしょう 図')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
