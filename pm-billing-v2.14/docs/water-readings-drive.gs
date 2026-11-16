/**
 * Park Manor — water meter photos → Google Drive (Google Apps Script web app)
 * ===========================================================================
 * The Park Manor app posts each water-meter photo here and this script files
 * it in Drive, mirroring the electricity readings:
 *
 *     Park Manor Water Meter Readings / November 2026 / Unit 3 - 16 Nov 2026 21h35.jpg
 *
 * The date and time are when the reading reached the app (South African time).
 * Two photos in the same minute become "… 21h35 (2).jpg".
 * The folder is created next to "Park Manor Electricity Meter Readings" if
 * that exists, otherwise at the top of My Drive.
 *
 * ── ONE-TIME SETUP (about 5 minutes) ──────────────────────────────────────
 * 1. Sign in to Google with the account whose Drive holds the electricity
 *    readings folder.
 * 2. Go to https://script.google.com → New project. Name it
 *    "Park Manor water readings".
 * 3. Delete the sample code, paste THIS whole file in.
 * 4. Change SECRET below to a long password you make up (letters and numbers,
 *    20+ characters). You will type the same password into Netlify.
 * 5. Save, choose the function  pmTest  in the toolbar and press Run.
 *    Google asks you to authorise access to Drive — approve it (it is your own
 *    account; you may have to click "Advanced" → "Go to … (unsafe)").
 *    The log should say "Folder ready: https://drive.google.com/…".
 * 6. Deploy ▸ New deployment ▸ type "Web app"
 *       Execute as:        Me
 *       Who has access:    Anyone
 *    Deploy, then copy the Web app URL (it ends in /exec).
 * 7. In Netlify → Site configuration → Environment variables add:
 *       WATER_DRIVE_URL     = the URL from step 6
 *       WATER_DRIVE_SECRET  = the password from step 4
 *    and trigger a redeploy (Deploys ▸ Trigger deploy).
 *
 * The app can also PICK UP photos you drop straight into a month folder
 * (name them "Unit 3.jpg"): Water readings in the app lists them and adds
 * them as readings. That uses the "list" and "get" actions below.
 *
 * If you ever change this code, use Deploy ▸ Manage deployments ▸ edit ▸
 * "New version" — the URL stays the same.
 * To stop it: Deploy ▸ Manage deployments ▸ Archive.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
var SECRET       = 'CHANGE-ME-to-a-long-password';
var ROOT_NAME    = 'Park Manor Water Meter Readings';
var SIBLING_NAME = 'Park Manor Electricity Meter Readings';   // create ours beside this one
var MAX_FILES    = 5;
var VERSION      = 3;            // 3 = date/time in file names + list/get for photos added by hand
var PART_CHARS   = 3000000;      // base64 characters per "get" answer (keeps each answer small)
var MAX_GET_BYTES = 15 * 1024 * 1024;

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!SECRET || SECRET.indexOf('CHANGE-ME') === 0) return out_({ ok: false, error: 'SECRET has not been set in the script' });
    if (body.secret !== SECRET) return out_({ ok: false, error: 'unauthorised' });
    if (body.action === 'list') return out_(list_(body));
    if (body.action === 'get')  return out_(get_(body));
    lock.waitLock(20000);                        // one upload at a time so names never clash
    var root   = getRoot_();
    var month  = getOrCreate_(root, clean_(body.month, 40) || 'Unsorted');
    var unit   = clean_(body.unit, 12) || 'Unknown';
    var saved  = [];
    (body.files || []).slice(0, MAX_FILES).forEach(function (f) {
      if (!f || !f.data) return;
      var mime = String(f.mime || 'image/jpeg');
      var ext  = /png/i.test(mime) ? 'png' : (/webp/i.test(mime) ? 'webp' : 'jpg');
      var name = nextName_(month, 'Unit ' + unit + (clean_(body.stamp, 40) ? ' - ' + clean_(body.stamp, 40) : ''), ext);
      var file = month.createFile(Utilities.newBlob(Utilities.base64Decode(f.data), mime, name));
      if (body.description) file.setDescription(String(body.description).slice(0, 500));
      saved.push({ name: name, id: file.getId(), url: file.getUrl() });
    });
    return out_({ ok: true, v: VERSION, folder: month.getUrl(), files: saved });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// Opening the web-app URL in a browser shows this — a quick "is it deployed?" check.
function doGet() { return out_({ ok: true, v: VERSION, service: 'Park Manor water readings → Drive', ready: SECRET.indexOf('CHANGE-ME') !== 0 }); }

// What is in a month folder (photos only) — so the app can pick up ones added by hand.
function list_(body) {
  var root = getRoot_(), name = clean_(body.month, 40), it = root.getFoldersByName(name), folder = null;
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) { folder = f; break; } }
  if (!folder) return { ok: true, v: VERSION, listed: true, folder: '', files: [] };
  var out = [], files = folder.getFiles();
  while (files.hasNext() && out.length < 200) {
    var x = files.next(); if (x.isTrashed()) continue;
    var mime = String(x.getMimeType() || '');
    if (!/^image\//i.test(mime) && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(x.getName())) continue;
    out.push({ id: x.getId(), name: x.getName(), url: x.getUrl(), mime: mime, size: x.getSize(), created: x.getDateCreated().getTime() });
  }
  return { ok: true, v: VERSION, listed: true, folder: folder.getUrl(), files: out };
}

// One photo, as base64 text in parts. Only files inside the water readings folder are served.
function get_(body) {
  var file;
  try { file = DriveApp.getFileById(String(body.id || '')); } catch (e) { return { ok: false, error: 'file not found' }; }
  if (file.isTrashed() || !inRoot_(file)) return { ok: false, error: 'file is not in the water readings folder' };
  if (file.getSize() > MAX_GET_BYTES) return { ok: false, error: 'file is too large' };
  var b64 = Utilities.base64Encode(file.getBlob().getBytes());
  var parts = Math.max(1, Math.ceil(b64.length / PART_CHARS)), part = Math.min(parts - 1, Math.max(0, Number(body.part) || 0));
  return { ok: true, v: VERSION, got: true, id: file.getId(), name: file.getName(), mime: String(file.getMimeType() || ''), parts: parts, part: part,
           data: b64.substring(part * PART_CHARS, (part + 1) * PART_CHARS) };
}
function inRoot_(file) {
  var rootId = getRoot_().getId(), ps = file.getParents();
  while (ps.hasNext()) {
    var p = ps.next(); if (p.getId() === rootId) return true;
    var gp = p.getParents(); while (gp.hasNext()) { if (gp.next().getId() === rootId) return true; }
  }
  return false;
}

// Run once from the editor: authorises Drive access and creates the folder.
function pmTest() {
  var root = getRoot_();
  Logger.log('Folder ready: ' + root.getUrl());
  if (SECRET.indexOf('CHANGE-ME') === 0) Logger.log('⚠ Remember to change SECRET at the top of the script.');
}

function getRoot_() {
  var it = DriveApp.getFoldersByName(ROOT_NAME);
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  var sib = DriveApp.getFoldersByName(SIBLING_NAME);
  while (sib.hasNext()) {
    var s = sib.next(); if (s.isTrashed()) continue;
    var parents = s.getParents();
    if (parents.hasNext()) return parents.next().createFolder(ROOT_NAME);
  }
  return DriveApp.createFolder(ROOT_NAME);
}
function getOrCreate_(parent, name) {
  var it = parent.getFoldersByName(name);
  while (it.hasNext()) { var f = it.next(); if (!f.isTrashed()) return f; }
  return parent.createFolder(name);
}
function nextName_(folder, base, ext) {
  var name = base + '.' + ext, n = 1;
  while (hasFile_(folder, name)) { n++; name = base + ' (' + n + ').' + ext; }
  return name;
}
function hasFile_(folder, name) { var it = folder.getFilesByName(name); while (it.hasNext()) { if (!it.next().isTrashed()) return true; } return false; }
function clean_(s, max) { return String(s == null ? '' : s).replace(/[^\w \-]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
