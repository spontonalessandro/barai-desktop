/**
 * BarAI Desktop v9.0 - Sync cloud + fogli Google leggibili
 *
 * Uso:
 * 1) Incolla questo script nel Google Sheet cloud dedicato a BarAI Sync.
 * 2) Proprietà script obbligatoria:
 *    BARAI_SYNC_TOKEN = stesso token impostato in BarAI Desktop.
 * 3) Proprietà script opzionali:
 *    BARAI_SYNC_FOLDER_ID = cartella Drive dove salvare BarAI_Cloud_Snapshot_v9_0.json.
 *    BARAI_SYNC_SPREADSHEET_ID = ID foglio cloud se lo script non è container-bound.
 * 4) Pubblica come Web App: esegui come te, accesso: Chiunque.
 * 5) Da BarAI Desktop usa Push + aggiorna fogli.
 * 6) Per aggiornare i fogli 2 volte al giorno esegui una volta installBarAiExplodeTriggers().
 */

const BARAI_SYNC_FILE_NAME = 'BarAI_Cloud_Snapshot_v9_0.json';
const SHEET_META = 'Sync_Meta';
const SHEET_LOG = 'Sync_Log';
const SHEET_INFO = 'Sync_Info';

const SHEET_DEFS = [
  { sheet: 'Fornitori', table: 'fornitori', columns: ['id','ragione_sociale','partita_iva','codice_fiscale','iban','email','telefono','metodo_pagamento_default','regola_pagamento_id','attivo','created_at','updated_at'] },
  { sheet: 'Fatture_Acquisto', table: 'fatture_acquisto', columns: ['id','fornitore_id','fornitore_nome','numero','data_fattura','imponibile','iva','totale','valuta','metodo_pagamento','stato','data_pagamento','origine_import','xml_nome_file','note','created_at','updated_at'] },
  { sheet: 'Fatture_Righe', table: 'fatture_acquisto_righe', columns: ['id','fattura_id','numero_linea','codice_articolo','descrizione_originale','prodotto_id','categoria','quantita','um','prezzo_unitario','totale_riga','aliquota_iva','created_at','updated_at'] },
  { sheet: 'Scadenze', table: 'scadenze', columns: ['id','fattura_id','fornitore_id','data_scadenza','data_pagamento','importo','importo_pagato','stato','metodo_pagamento','note','created_at','updated_at'] },
  { sheet: 'Pagamenti', table: 'pagamenti', columns: ['id','scadenza_id','fattura_id','data_pagamento','importo','metodo_pagamento','conto','note','created_at','updated_at'] },
  { sheet: 'Prodotti_Normalizzati', table: 'prodotti', columns: ['id','nome','categoria','um_base','pezzi_per_cartone','quantita_per_unita','um_acquisto_default','note_conversione','attivo','created_at','updated_at'] },
  { sheet: 'Prodotti_Mapping', table: 'prodotti_mapping', columns: ['id','descrizione_originale','fornitore_id','prodotto_id','confidenza','pezzi_per_cartone','quantita_per_unita','conversione_attiva','created_at','updated_at'] },
  { sheet: 'Food_Cost_Ricette', table: 'ricette', columns: ['id','nome','categoria','prezzo_vendita','porzioni','metodo_costo','costi_fissi_percent','attiva','note','created_at','updated_at'] },
  { sheet: 'Food_Cost_Ingredienti', table: 'ricette_ingredienti', columns: ['id','ricetta_id','prodotto_id','quantita','um','costo_unitario_override','created_at','updated_at'] },
  { sheet: 'Prima_Nota', table: 'prima_nota', columns: ['id','data_movimento','tipo','conto','conto_destinazione','categoria','sottocategoria','descrizione','importo','metodo_pagamento','origine','riferimento_tipo','riferimento_id','fornitore_id','fornitore_nome','note','auto_generato','modificabile','created_at','updated_at'] },
  { sheet: 'Prima_Nota_Conti', table: 'prima_nota_conti', columns: ['id','nome','tipo','attivo','ordine','created_at','updated_at'] },
  { sheet: 'Prima_Nota_Categorie', table: 'prima_nota_categorie', columns: ['id','nome','tipo_default','attivo','ordine','created_at','updated_at'] },
  { sheet: 'Incassi_Cassa', table: 'incassi_cassa', columns: ['id','data_incasso','contanti','pos','carta_credito','ticket','delivery','altro','non_riscosso','totale','iva_10','iva_22','fatture_da','fatture_a','origine_import','nome_file','note','created_at','updated_at'] },
  { sheet: 'Buste_Paga', table: 'buste_paga', columns: ['id','mese','dipendente','lordo','netto','contributi_inps','irpef','tfr','costo_azienda','data_pagamento','metodo_pagamento','origine_import','nome_file','note','created_at','updated_at'] },
  { sheet: 'Versamenti_F24', table: 'versamenti_f24', columns: ['id','data_pagamento','periodo_competenza','tipo','importo','metodo_pagamento','origine_import','nome_file','note','created_at','updated_at'] }
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    assertToken_(body.token);

    if (body.action === 'status') return json_({ ok: true, ...getStatus_() });
    if (body.action === 'pushSnapshot') return json_(pushSnapshot_(body));
    if (body.action === 'pullSnapshot') return json_(pullSnapshot_());
    if (body.action === 'explodeSnapshotToSheets') return json_(explodeSnapshotToSheets_());
    if (body.action === 'explodeSheets') return json_(explodeSnapshotToSheets_());
    if (body.action === 'refreshReadableSheets') return json_(explodeSnapshotToSheets_());

    return json_({ ok: false, error: 'Azione non riconosciuta: ' + body.action, receivedAction: body.action || '' });
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
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('BARAI_SYNC_SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Nessun Google Sheet attivo. Imposta BARAI_SYNC_SPREADSHEET_ID.');
  return active;
}

function getOrCreateSheet_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (headers && headers.length && sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function writeSheet_(name, headers, rows) {
  const sh = getOrCreateSheet_(name, headers);
  sh.clearContents();
  const values = [headers].concat(rows || []);
  if (values.length) sh.getRange(1, 1, values.length, headers.length).setValues(values);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, Math.min(headers.length, 18));
  return Math.max(0, values.length - 1);
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
  const legacy81 = folder.getFilesByName('BarAI_Cloud_Snapshot_v8_1.json');
  if (legacy81.hasNext()) return legacy81.next();
  const legacy75 = folder.getFilesByName('BarAI_Cloud_Snapshot_v7_5_2.json');
  if (legacy75.hasNext()) return legacy75.next();
  const legacy8 = folder.getFilesByName('BarAI_Cloud_Snapshot_v8.json');
  if (legacy8.hasNext()) return legacy8.next();
  const legacy72 = folder.getFilesByName('BarAI_Cloud_Snapshot_v7_2.json');
  if (legacy72.hasNext()) return legacy72.next();
  const legacy = folder.getFilesByName('BarAI_Cloud_Snapshot_v7.json');
  if (legacy.hasNext()) return legacy.next();
  return null;
}

function createOrUpdateSnapshotFile_(text) {
  const folder = getSyncFolder_();
  const existing = getSnapshotFile_();
  if (existing) {
    existing.setContent(text);
    if (existing.getName() !== BARAI_SYNC_FILE_NAME) existing.setName(BARAI_SYNC_FILE_NAME);
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
  const sh = getOrCreateSheet_(SHEET_LOG, ['created_at','action','device_id','device_name','revision','rows_total','message']);
  sh.appendRow([new Date(), row.action || '', row.deviceId || '', row.deviceName || '', row.revision || '', row.rowsTotal || 0, row.message || '']);
}

function getStatus_() {
  const meta = readMeta_();
  const file = getSnapshotFile_();
  return {
    cloudRevision: meta.cloudRevision || '',
    lastPushAt: meta.lastPushAt || '',
    lastDeviceId: meta.lastDeviceId || '',
    lastDeviceName: meta.lastDeviceName || '',
    lastSheetExplodeAt: meta.lastSheetExplodeAt || '',
    lastSheetExplodeRows: Number(meta.lastSheetExplodeRows || 0),
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
  const rowsTotal = countSnapshotRows_(snapshot);

  upsertMeta_('cloudRevision', revision);
  upsertMeta_('lastPushAt', new Date().toISOString());
  upsertMeta_('lastDeviceId', body.deviceId || '');
  upsertMeta_('lastDeviceName', body.deviceName || '');
  upsertMeta_('snapshotFileId', file.getId());
  log_({ action: 'pushSnapshot', deviceId: body.deviceId, deviceName: body.deviceName, revision, rowsTotal, message: 'Snapshot salvato su Drive' });

  let explodeSummary = null;
  if (body.explodeSheets) explodeSummary = explodeSnapshotToSheets_(snapshot);
  return { ok: true, cloudRevision: revision, rowsTotal, snapshotFileId: file.getId(), explodeSummary };
}

function pullSnapshot_() {
  const file = getSnapshotFile_();
  if (!file) return { ok: true, snapshot: null, cloudRevision: '' };
  const snapshot = JSON.parse(file.getBlob().getDataAsString());
  const meta = readMeta_();
  return { ok: true, snapshot, cloudRevision: meta.cloudRevision || snapshot.cloudRevision || '' };
}

function explodeSnapshotToSheets_(snapshotOpt) {
  const snapshot = snapshotOpt || pullSnapshot_().snapshot;
  if (!snapshot || snapshot.format !== 'BarAI.SyncSnapshot.v1') throw new Error('Snapshot cloud mancante o non valido.');

  const counts = {};
  let rowsTotal = 0;
  SHEET_DEFS.forEach((def) => {
    const sourceRows = Array.isArray(snapshot.tables && snapshot.tables[def.table]) ? snapshot.tables[def.table] : [];
    const values = sourceRows.map((row) => def.columns.map((col) => value_(row[col])));
    const count = writeSheet_(def.sheet, def.columns, values);
    counts[def.sheet] = count;
    rowsTotal += count;
  });

  const controllo = buildControlloPrezzi_(snapshot);
  const cpHeaders = ['prodotto_id','prodotto','categoria','um_base','ultimo_prezzo','data_ultimo_acquisto','fornitore_ultimo','prezzo_precedente','data_precedente','delta_percent','prezzo_medio','prezzo_min','prezzo_max','righe'];
  const cpCount = writeSheet_('Controllo_Prezzi', cpHeaders, controllo.map((r) => cpHeaders.map((h) => value_(r[h]))));
  counts.Controllo_Prezzi = cpCount;
  rowsTotal += cpCount;

  const updatedAt = new Date().toISOString();
  const infoRows = [
    ['format', snapshot.format],
    ['appVersion', snapshot.appVersion || ''],
    ['generatedAt', snapshot.generatedAt || ''],
    ['cloudRevision', snapshot.cloudRevision || ''],
    ['sourceDeviceId', snapshot.sourceDeviceId || ''],
    ['sourceDeviceName', snapshot.sourceDeviceName || ''],
    ['lastSheetExplodeAt', updatedAt],
    ['lastSheetExplodeRows', rowsTotal]
  ];
  writeSheet_(SHEET_INFO, ['chiave','valore'], infoRows);

  upsertMeta_('lastSheetExplodeAt', updatedAt);
  upsertMeta_('lastSheetExplodeRows', rowsTotal);
  log_({ action: 'explodeSnapshotToSheets', deviceId: snapshot.sourceDeviceId, deviceName: snapshot.sourceDeviceName, revision: snapshot.cloudRevision, rowsTotal, message: 'Fogli leggibili aggiornati' });
  return { updatedAt, rowsTotal, counts, cloudRevision: snapshot.cloudRevision || '' };
}


function prezzoUnitarioScontato_(r) {
  const qta = Number(r.quantita || 0);
  const totale = Number(r.totale_riga || 0);
  if (isFinite(qta) && qta > 0 && isFinite(totale) && totale >= 0) return totale / qta;
  return Number(r.prezzo_unitario || 0);
}

function prezzoBaseCalcolo_(r, prodotto) {
  const prezzoScontato = prezzoUnitarioScontato_(r);
  const pezzi = Math.max(1, Number(prodotto.pezzi_per_cartone || 1));
  const quantitaPerUnita = Math.max(0.000001, Number(prodotto.quantita_per_unita || 1));
  return prezzoScontato / pezzi / quantitaPerUnita;
}

function buildControlloPrezzi_(snapshot) {
  const tables = snapshot.tables || {};
  const prodotti = mapById_(tables.prodotti || []);
  const fatture = mapById_(tables.fatture_acquisto || []);
  const grouped = {};

  (tables.fatture_acquisto_righe || []).forEach((r) => {
    if (!r.prodotto_id) return;
    const prodotto = prodotti[r.prodotto_id] || {};
    const prezzo = prezzoBaseCalcolo_(r, prodotto);
    if (!isFinite(prezzo) || prezzo <= 0) return;
    const fattura = fatture[r.fattura_id] || {};
    if (!grouped[r.prodotto_id]) grouped[r.prodotto_id] = [];
    grouped[r.prodotto_id].push({
      prodotto_id: r.prodotto_id,
      prodotto: prodotto.nome || r.descrizione_originale || r.prodotto_id,
      categoria: prodotto.categoria || r.categoria || '',
      um_base: prodotto.um_base || r.um || '',
      prezzo,
      prezzo_unitario_xml_originale: Number(r.prezzo_unitario || 0),
      prezzo_unitario_scontato: prezzoUnitarioScontato_(r),
      data: fattura.data_fattura || r.created_at || '',
      fornitore: fattura.fornitore_nome || ''
    });
  });

  return Object.keys(grouped).map((pid) => {
    const arr = grouped[pid].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const ultimo = arr[0];
    const precedente = arr.find((x, i) => i > 0 && x.prezzo !== ultimo.prezzo) || arr[1] || null;
    const prices = arr.map((x) => x.prezzo);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const delta = precedente && precedente.prezzo ? ((ultimo.prezzo - precedente.prezzo) / precedente.prezzo) * 100 : '';
    return {
      prodotto_id: pid,
      prodotto: ultimo.prodotto,
      categoria: ultimo.categoria,
      um_base: ultimo.um_base,
      ultimo_prezzo: round_(ultimo.prezzo),
      data_ultimo_acquisto: ultimo.data,
      fornitore_ultimo: ultimo.fornitore,
      prezzo_precedente: precedente ? round_(precedente.prezzo) : '',
      data_precedente: precedente ? precedente.data : '',
      delta_percent: delta === '' ? '' : round_(delta),
      prezzo_medio: round_(avg),
      prezzo_min: round_(Math.min.apply(null, prices)),
      prezzo_max: round_(Math.max.apply(null, prices)),
      righe: arr.length
    };
  }).sort((a, b) => String(a.prodotto).localeCompare(String(b.prodotto)));
}

function countSnapshotRows_(snapshot) {
  return Object.keys(snapshot.tables || {}).reduce((sum, table) => sum + ((snapshot.tables[table] || []).length), 0);
}

function mapById_(rows) {
  const out = {};
  (rows || []).forEach((r) => { if (r && r.id) out[r.id] = r; });
  return out;
}

function value_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function round_(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function installBarAiExplodeTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'scheduledExplodeSnapshotToSheets') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('scheduledExplodeSnapshotToSheets').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('scheduledExplodeSnapshotToSheets').timeBased().everyDays(1).atHour(17).create();
}

function scheduledExplodeSnapshotToSheets() {
  explodeSnapshotToSheets_();
}
