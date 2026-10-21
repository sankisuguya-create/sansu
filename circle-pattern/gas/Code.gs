/**
 * 円の模様エディタ — GAS Webアプリ（先生どうしで図を共有する「棚」つき）
 * index.html は gas/build.py で ../index.html から作る。
 * 棚はこのプロジェクトの持ち主のスプレッドシートに置く（初回の保存で自動作成）。
 */
var API_VER = 2;                     // index.html の SHELF_API と合わせる
var TEACHER_DOMAIN = 'edu.nishi.or.jp';
var STUDENT_DOMAIN = 'kyoiku.edu.nishi.or.jp';
var SUB_SHEET = '提出', SUB_HEAD = ['id', '課題', 'メール', '名前', '時刻', '図の名前', 'データ', '画像'];
var KADAI_SHEET = '課題', KADAI_HEAD = ['課題', '作った人', '作った日'];
var SHEET_NAME = '図';
var HEAD = ['id', '名前', '保存した人', '更新', 'データ'];
var MAX_JSON = 45000;                // セル1つは5万字まで

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('円の模様エディタ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiVersion() { return API_VER; }

function email_() { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); }
function role_(email) {
  var d = email.split('@')[1] || '';
  return d === TEACHER_DOMAIN ? 'teacher' : d === STUDENT_DOMAIN ? 'student' : 'unknown';
}
// 画面の出し分け用。児童のメールは、設置の条件によっては取れない（空になる）
function whoami() {
  var email = email_();
  return { email: email, role: role_(email), url: ScriptApp.getService().getUrl(), api: API_VER };
}

function me_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email || email.split('@')[1] !== TEACHER_DOMAIN) throw new Error('先生の アカウント（@' + TEACHER_DOMAIN + '）で 開いてください。');
  return email;
}

function book_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { sheet_(); ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID')); }
  return ss;
}
function named_(name, head) {
  var ss = book_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function rowsOf_(sh, n) {
  var k = sh.getLastRow() - 1;
  return k > 0 ? sh.getRange(2, 1, k, n).getValues() : [];
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

// ===== 課題と提出 =====
function listKadai() {
  me_();
  return rowsOf_(named_(KADAI_SHEET, KADAI_HEAD), KADAI_HEAD.length).map(function (r) { return String(r[0]); }).reverse();
}

function addKadai(name) {
  var email = me_(), k = String(name || '').trim().slice(0, 30);
  if (!k) throw new Error('課題の 名前が ありません。');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = named_(KADAI_SHEET, KADAI_HEAD);
    if (rowsOf_(sh, 1).some(function (r) { return String(r[0]) === k; })) return k;
    sh.appendRow([k, email, stamp_()]);
    return k;
  } finally { lock.releaseLock(); }
}

// 児童の提出。メールが取れないときは、児童が入れた名前で受け付ける
function submitWork(o) {
  var email = email_(), role = role_(email);
  var kadai = String(o && o.kadai || ''), name = String(o && o.name || '').trim().slice(0, 30);
  var json = String(o && o.json || ''), png = String(o && o.png || ''), fig = String(o && o.fig || '').slice(0, 40);
  if (role === 'unknown' && email) throw new Error('学校の アカウントで 開いてください。');
  if (!email && !name) throw new Error('名前を 入れてください。');
  if (json.length > MAX_JSON) throw new Error('図が 大きすぎて 出せません。');
  if (png.length > MAX_JSON || png.indexOf('data:image/') !== 0) png = '';
  var data = JSON.parse(json);
  if (!data || data.version !== 2 || !Array.isArray(data.circles)) throw new Error('図の データが ちがいます。');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (!rowsOf_(named_(KADAI_SHEET, KADAI_HEAD), 1).some(function (r) { return String(r[0]) === kadai; })) throw new Error('この 課題は ありません。先生に 聞いてください。');
    named_(SUB_SHEET, SUB_HEAD).appendRow([Utilities.getUuid(), kadai, email, name || email.split('@')[0], stamp_(), fig, json, png]);
    return { at: stamp_() };
  } finally { lock.releaseLock(); }
}

function listSubmissions(kadai) {
  me_();
  return rowsOf_(named_(SUB_SHEET, SUB_HEAD), SUB_HEAD.length)
    .filter(function (r) { return String(r[1]) === String(kadai); })
    .map(function (r) { return { id: String(r[0]), who: String(r[2]) || ('名前:' + r[3]), name: String(r[3]), at: String(r[4]), fig: String(r[5]), png: String(r[7]) }; });
}

function loadSubmission(id) {
  me_();
  var r = rowsOf_(named_(SUB_SHEET, SUB_HEAD), SUB_HEAD.length).filter(function (x) { return String(x[0]) === String(id); })[0];
  if (!r) throw new Error('その 提出は ありません。');
  return String(r[6]);
}
