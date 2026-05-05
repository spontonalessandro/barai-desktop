/**
 * BarAI Desktop v7.1 - Apps Script sync cloud base
 *
 * Uso consigliato:
 * 1) Crea un Google Sheet dedicato al sync BarAI.
 * 2) Estensioni > Apps Script > incolla questo file.
 * 3) In Impostazioni progetto > Proprietà script aggiungi:
 *    - BARAI_SYNC_TOKEN = token segreto scelto da te
 *    - BARAI_SYNC_FOLDER_ID = opzionale, ID cartella Drive dove salvare lo snapshot JSON
 * 4) Pubblica come Web App: esegui come te, accesso solo a chi ha il link.
 * 5) Copia l'URL /exec dentro BarAI Desktop > Sync / Backup.
 *
 * Nota: lo snapshot viene salvato su Drive perché può diventare grande.
 * Il Google Sheet tiene solo metadati/log e non diventa un database operativo.
 */

const BARAI_SYNC_FILE_NAME = 'BarAI_Cloud_Snapshot_v7.json';
const SHEET_META = 'Sync_Meta';
const SHEET_LOG = 'Sync_Log';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    assertToken_(body.token);

    if (body.action === 'status') return json_({ ok: true, ...getStatus_() });
    if (body.action === 'pushSnapshot') return json_(pushSnapshot_(body));
    if (body.action === 'pullSnapshot') return json_(pullSnapshot_());

    return json_({ ok: false, error: 'Azione non riconosciuta: ' + body.action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function assertToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('BARAI_SYNC_TOKEN');
  if (!expected) throw new Error('BARAI_SYNC_TOKEN non impostato nelle proprietà script.');
  if (!token || token !== expected) throw new Error('Token sync non valido.');
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headers && headers.length) sh.appendRow(headers);
  return sh;
}

function getSyncFolder_() {
  const folderId = PropertiesService.getScriptProperties().getProperty('BARAI_SYNC_FOLDER_ID');
  if (folderId) return DriveApp.getFolderById(folderId);
  return DriveApp.getRootFolder();
}

function getSnapshotFile_() {
  const folder = getSyncFolder_();
  const files = folder.getFilesByName(BARAI_SYNC_FILE_NAME);
  if (files.hasNext()) return files.next();
  return null;
}

function createOrUpdateSnapshotFile_(text) {
  const folder = getSyncFolder_();
  const existing = getSnapshotFile_();
  if (existing) {
    existing.setContent(text);
    return existing;
  }
  return folder.createFile(BARAI_SYNC_FILE_NAME, text, MimeType.PLAIN_TEXT);
}

function upsertMeta_(key, value) {
  const sh = getOrCreateSheet_(SHEET_META, ['chiave', 'valore', 'updated_at']);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === key) {
      sh.getRange(i + 1, 2, 1, 2).setValues([[value, new Date()]]);
      return;
    }
  }
  sh.appendRow([key, value, new Date()]);
}

function readMeta_() {
  const sh = getOrCreateSheet_(SHEET_META, ['chiave', 'valore', 'updated_at']);
  const values = sh.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < values.length; i++) out[values[i][0]] = values[i][1];
  return out;
}

function log_(row) {
  const sh = getOrCreateSheet_(SHEET_LOG, ['created_at', 'action', 'device_id', 'device_name', 'revision', 'rows_total', 'message']);
  sh.appendRow([
    new Date(),
    row.action || '',
    row.deviceId || '',
    row.deviceName || '',
    row.revision || '',
    row.rowsTotal || 0,
    row.message || ''
  ]);
}

function getStatus_() {
  const meta = readMeta_();
  const file = getSnapshotFile_();
  return {
    cloudRevision: meta.cloudRevision || '',
    lastPushAt: meta.lastPushAt || '',
    lastDeviceId: meta.lastDeviceId || '',
    lastDeviceName: meta.lastDeviceName || '',
    snapshotFileId: file ? file.getId() : '',
    snapshotFileName: file ? file.getName() : ''
  };
}

function pushSnapshot_(body) {
  if (!body.snapshot || body.snapshot.format !== 'BarAI.SyncSnapshot.v1') {
    throw new Error('Snapshot BarAI.SyncSnapshot.v1 mancante o non valido.');
  }
  const revision = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd'T'HHmmss") + '_' + (body.deviceId || 'device');
  const snapshot = body.snapshot;
  snapshot.cloudRevision = revision;
  snapshot.receivedAt = new Date().toISOString();

  const text = JSON.stringify(snapshot);
  const file = createOrUpdateSnapshotFile_(text);
  const rowsTotal = Object.keys(snapshot.tables || {}).reduce((sum, table) => sum + ((snapshot.tables[table] || []).length), 0);

  upsertMeta_('cloudRevision', revision);
  upsertMeta_('lastPushAt', new Date().toISOString());
  upsertMeta_('lastDeviceId', body.deviceId || '');
  upsertMeta_('lastDeviceName', body.deviceName || '');
  upsertMeta_('snapshotFileId', file.getId());
  log_({ action: 'pushSnapshot', deviceId: body.deviceId, deviceName: body.deviceName, revision, rowsTotal, message: 'Snapshot salvato su Drive' });

  return { ok: true, cloudRevision: revision, rowsTotal, snapshotFileId: file.getId() };
}

function pullSnapshot_() {
  const file = getSnapshotFile_();
  if (!file) return { ok: true, snapshot: null, cloudRevision: '' };
  const snapshot = JSON.parse(file.getBlob().getDataAsString());
  const meta = readMeta_();
  return { ok: true, snapshot, cloudRevision: meta.cloudRevision || snapshot.cloudRevision || '' };
}
