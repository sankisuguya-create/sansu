/**
 * 円の模様エディタ — GAS Webアプリ（先生どうしで図を共有する「棚」つき）
 * index.html は gas/build.py で ../index.html から作る。
 * 棚はこのプロジェクトの持ち主のスプレッドシートに置く（初回の保存で自動作成）。
 */
var API_VER = 1;                     // index.html の SHELF_API と合わせる
var TEACHER_DOMAIN = 'edu.nishi.or.jp';
var SHEET_NAME = '図';
var HEAD = ['id', '名前', '保存した人', '更新', 'データ'];
var MAX_JSON = 45000;                // セル1つは5万字まで

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('円の模様エディタ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiVersion() { return API_VER; }

function me_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email || email.split('@')[1] !== TEACHER_DOMAIN) throw new Error('先生の アカウント（@' + TEACHER_DOMAIN + '）で 開いてください。');
  return email;
}

function sheet_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('円の模様エディタ 先生の棚');
    props.setProperty('SHEET_ID', ss.getId());
  }
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.getSheets()[0].setName(SHEET_NAME);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(sh) {
  var n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
}

function stamp_() { return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'); }

function listShared() {
  var email = me_();
  return rows_(sheet_()).map(function (r) {
    return { id: String(r[0]), name: String(r[1]), author: String(r[2]).split('@')[0], updated: String(r[3]), mine: String(r[2]) === email };
  }).reverse();   // 新しいものを上に
}

function loadShared(id) {
  me_();
  var r = rows_(sheet_()).filter(function (x) { return String(x[0]) === String(id); })[0];
  if (!r) throw new Error('その 図は もう ありません。');
  return String(r[4]);
}

function saveShared(o) {
  var email = me_(), name = String(o && o.name || '').slice(0, 40), json = String(o && o.json || '');
  if (!name) throw new Error('名前が ありません。');
  if (json.length > MAX_JSON) throw new Error('図が 大きすぎて 保存できません（' + json.length + '字）。');
  var data = JSON.parse(json);
  if (!data || data.version !== 2 || !Array.isArray(data.circles)) throw new Error('図の データが ちがいます。');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = sheet_(), rows = rows_(sh);
    for (var i = 0; i < rows.length; i++) {
      if (o.id && String(rows[i][0]) === String(o.id) && String(rows[i][2]) === email) {
        sh.getRange(i + 2, 2, 1, 4).setValues([[name, email, stamp_(), json]]);
        return { id: String(o.id), updated: true };
      }
    }
    var id = Utilities.getUuid();
    sh.appendRow([id, name, email, stamp_(), json]);
    return { id: id, updated: false };
  } finally { lock.releaseLock(); }
}

function deleteShared(id) {
  var email = me_(), lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = sheet_(), rows = rows_(sh);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        if (String(rows[i][2]) !== email) throw new Error('ほかの 先生の 図は けせません。');
        sh.deleteRow(i + 2); return true;
      }
    }
    throw new Error('その 図は もう ありません。');
  } finally { lock.releaseLock(); }
}
