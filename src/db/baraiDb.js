import Database from '@tauri-apps/plugin-sql';
import { SCHEMA_STATEMENTS, INDEX_STATEMENTS } from './schema';
import { DEFAULT_REGOLE, DEMO_FATTURE } from '../data/demoData';
import { buildContoEconomicoConfronto, currentMonthKey } from '../logic/contoEconomico.js';

const DB_URL = 'sqlite:barai.sqlite';
let dbPromise = null;
let fallbackMemory = null;

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

async function cloudHttpPost(url, body) {
  const payload = JSON.stringify(body);

  if (isTauriRuntime()) {
    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      return await tauriFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload
      });
    } catch (err) {
      const msg = String(err?.message || err || '');
      throw new Error(`Chiamata cloud fallita tramite HTTP nativo Tauri. Dettaglio: ${msg}`);
    }
  }

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: payload
  });
}

async function tauriInvoke(command, args = {}) {
  if (!isTauriRuntime()) throw new Error('Funzione disponibile solo dentro l’app Tauri.');
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(command, args);
}

function formatEpochDate(epoch) {
  if (!epoch) return '';
  const date = new Date(Number(epoch) * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function backupSizeLabel(bytes) {
  const n = Number(bytes || 0);
  if (n <= 0) return '0 B';
  if (n < 1024) return String(n) + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}
function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function slugId(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || Math.random().toString(16).slice(2);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  const normalized = raw.includes(',') ? raw.replaceAll('.', '').replace(',', '.') : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function endOfMonth(dateObj) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 12, 0, 0);
}

function fmtDate(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function statoDaRegola(regola) {
  const nome = String(regola?.nome || '').toLowerCase();
  const metodo = String(regola?.metodo_pagamento || '').toLowerCase();
  if (Number(regola?.auto_pagato || 0) === 1) return 'PAGATO_AUTO';
  if (nome.includes('verificare') || metodo.includes('verificare')) return 'DA_VERIFICARE';
  return 'APERTO';
}

function inferRegolaFromMetodo(metodoPagamento) {
  const m = String(metodoPagamento || '').toLowerCase();
  if (m.includes('rid') || m.includes('riba') || m.includes('sepa') || m.includes('direct debit')) return 'reg_rid_auto';
  if (m.includes('contanti') || m.includes('pos') || m.includes('carta')) return 'reg_immediato';
  if (m.includes('bonifico')) return 'reg_da_verificare';
  return 'reg_da_verificare';
}

function normalizeFatturaInput(input) {
  const imponibile = toNumber(input.imponibile);
  const iva = toNumber(input.iva);
  const totale = toNumber(input.totale || imponibile + iva);
  return {
    id: input.id || uid('fa'),
    fornitore_id: input.fornitore_id || '',
    fornitore_nome: String(input.fornitore_nome || '').trim(),
    numero: String(input.numero || '').trim(),
    data_fattura: input.data_fattura || today(),
    imponibile,
    iva,
    totale,
    valuta: input.valuta || 'EUR',
    metodo_pagamento: input.metodo_pagamento || '',
    regola_pagamento_id: input.regola_pagamento_id || 'reg_da_verificare',
    data_scadenza_override: input.data_scadenza_override || input.data_scadenza_xml || '',
    data_pagamento: input.data_pagamento || '',
    origine_import: input.origine_import || '',
    xml_hash: input.xml_hash || '',
    xml_nome_file: input.xml_nome_file || '',
    note: input.note || ''
  };
}

export function calcolaScadenza(dataFattura, regola) {
  let d = addDays(dataFattura, regola?.giorni || 0);
  if (Number(regola?.fine_mese || 0) === 1) d = endOfMonth(d);
  if (regola?.giorni_extra) d = addDays(fmtDate(d), regola.giorni_extra);
  return fmtDate(d);
}

async function initFallback() {
  if (fallbackMemory) return fallbackMemory;
  const regole = DEFAULT_REGOLE.map((r) => ({ ...r }));
  const fornitori = [];
  const fatture = [];
  const scadenze = [];
  const pagamenti = [];
  const righe = [];
  const importLog = [];

  for (const f of DEMO_FATTURE) {
    const regola = regole.find((r) => r.id === f.regola_pagamento_id) || regole[0];
    if (!fornitori.find((x) => x.id === f.fornitore_id)) {
      fornitori.push({
        id: f.fornitore_id,
        ragione_sociale: f.fornitore_nome,
        metodo_pagamento_default: f.metodo_pagamento,
        regola_pagamento_id: f.regola_pagamento_id,
        attivo: 1
      });
    }
    fatture.push({ ...f, stato: 'DA_VERIFICARE', data_pagamento: '', note: '' });
    const stato = statoDaRegola(regola);
    const dataPagamento = stato === 'PAGATO_AUTO' ? calcolaScadenza(f.data_fattura, regola) : '';
    scadenze.push({
      id: `scad_${f.id}`,
      fattura_id: f.id,
      fornitore_id: f.fornitore_id,
      fornitore_nome: f.fornitore_nome,
      data_scadenza: calcolaScadenza(f.data_fattura, regola),
      data_pagamento: dataPagamento,
      importo: f.totale,
      importo_pagato: stato === 'PAGATO_AUTO' ? f.totale : 0,
      stato,
      metodo_pagamento: regola.metodo_pagamento,
      numero: f.numero,
      data_fattura: f.data_fattura,
      note: ''
    });
  }

  fallbackMemory = { mode: 'browser-demo', regole, fornitori, fatture, scadenze, pagamenti, righe, importLog, prodotti: [], ricette: [], ricetteIngredienti: [], primaNota: [], incassiCassa: [], bustePaga: [], versamentiF24: [], fattureVendita: [], fattureVenditaRighe: [] };
  return fallbackMemory;
}

export async function getDb() {
  if (!isTauriRuntime()) return null;
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL).then(async (db) => {
      await db.execute('PRAGMA journal_mode = WAL');
      await db.execute('PRAGMA synchronous = NORMAL');
      return db;
    });
  }
  return dbPromise;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withLockRetry(fn, maxRetries = 6, baseDelayMs = 300) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message || err || '').toLowerCase();
      const isLock = msg.includes('locked') || msg.includes('busy') || Number(err?.code) === 5 || Number(err?.code) === 517;
      if (!isLock) throw err;
      lastErr = err;
      await sleep(baseDelayMs * Math.pow(2, i));
    }
  }
  throw lastErr;
}

async function tableHasColumn(db, tableName, columnName) {
  const rows = await db.select(`PRAGMA table_info(${tableName})`);
  return rows.some((r) => r.name === columnName);
}

async function addColumnIfMissing(db, tableName, columnName, definition) {
  const exists = await tableHasColumn(db, tableName, columnName);
  if (!exists) await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function runMigrations(db) {
  await addColumnIfMissing(db, 'fatture_acquisto', 'data_pagamento', 'TEXT');
  await addColumnIfMissing(db, 'fatture_acquisto', 'origine_import', 'TEXT');
  await addColumnIfMissing(db, 'fatture_acquisto', 'xml_hash', 'TEXT');
  await addColumnIfMissing(db, 'fatture_acquisto', 'xml_nome_file', 'TEXT');
  await addColumnIfMissing(db, 'fatture_acquisto_righe', 'numero_linea', 'INTEGER');
  await addColumnIfMissing(db, 'scadenze', 'data_pagamento', 'TEXT');
  await addColumnIfMissing(db, 'prodotti', 'pezzi_per_cartone', 'REAL NOT NULL DEFAULT 1');
  await addColumnIfMissing(db, 'prodotti', 'quantita_per_unita', 'REAL NOT NULL DEFAULT 1');
  await addColumnIfMissing(db, 'prodotti', 'um_acquisto_default', 'TEXT');
  await addColumnIfMissing(db, 'prodotti', 'note_conversione', 'TEXT');
  await addColumnIfMissing(db, 'prodotti_mapping', 'pezzi_per_cartone', 'REAL NOT NULL DEFAULT 1');
  await addColumnIfMissing(db, 'prodotti_mapping', 'quantita_per_unita', 'REAL NOT NULL DEFAULT 1');
  await addColumnIfMissing(db, 'prodotti_mapping', 'conversione_attiva', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'ricette', 'metodo_costo', "TEXT NOT NULL DEFAULT 'ULTIMO'");
  await addColumnIfMissing(db, 'ricette', 'costi_fissi_percent', 'REAL NOT NULL DEFAULT 40');

  // v8: Prima Nota gestionale. Migrazioni additive per conservare tutti i dati esistenti.
  await addColumnIfMissing(db, 'prima_nota', 'conto', 'TEXT');
  await addColumnIfMissing(db, 'prima_nota', 'conto_destinazione', 'TEXT');
  await addColumnIfMissing(db, 'prima_nota', 'sottocategoria', 'TEXT');
  await addColumnIfMissing(db, 'prima_nota', 'origine', "TEXT NOT NULL DEFAULT 'Manuale'");
  await addColumnIfMissing(db, 'prima_nota', 'riferimento_tipo', 'TEXT');
  await addColumnIfMissing(db, 'prima_nota', 'fornitore_id', 'TEXT');
  await addColumnIfMissing(db, 'prima_nota', 'fornitore_nome', 'TEXT');
  await addColumnIfMissing(db, 'prima_nota', 'auto_generato', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'prima_nota', 'modificabile', 'INTEGER NOT NULL DEFAULT 1');

  // v7: base sincronizzazione multi-PC. Le colonne sono additive e non spostano
  // né ricreano il database locale esistente.
  await addColumnIfMissing(db, 'sync_log', 'origin_device_id', 'TEXT');
  await addColumnIfMissing(db, 'sync_log', 'cloud_revision', 'TEXT');
  await addColumnIfMissing(db, 'sync_log', 'attempts', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'sync_log', 'last_error_at', 'TEXT');

  // v5.4.1: normalizza le categorie già create in MAIUSCOLO,
  // così evitiamo duplicati tipo 'bevande' / 'Bevande' / 'BEVANDE'.
  await db.execute("UPDATE prodotti SET categoria = UPPER(TRIM(categoria)) WHERE categoria IS NOT NULL AND TRIM(categoria) <> ''");
  await db.execute("UPDATE fatture_acquisto_righe SET categoria = UPPER(TRIM(categoria)) WHERE categoria IS NOT NULL AND TRIM(categoria) <> ''");
}


async function runStatements(db, statements, label) {
  for (const statement of statements) {
    try {
      await db.execute(statement);
    } catch (err) {
      console.error(`Errore schema SQLite ()`, statement, err);
      throw err;
    }
  }
}

export async function initDatabase() {
  if (!isTauriRuntime()) return initFallback();
  const db = await getDb();

  // Prima creiamo/aggiorniamo le tabelle, poi aggiungiamo le colonne mancanti,
  // poi creiamo gli indici. Con database già nati in v1/v2, creare subito
  // l-indice su xml_hash falliva perché la colonna non esisteva ancora.
  await runStatements(db, SCHEMA_STATEMENTS, 'tabelle');
  await runMigrations(db);
  await runStatements(db, INDEX_STATEMENTS, 'indici');

  await upsertDefaultRegole(db);
  await upsertPrimaNotaDefaultOptions(db);
  await seedInitialData(db);
  return { mode: 'tauri-sqlite', version: 'v9.1' };
}

async function upsertDefaultRegole(db) {
  for (const r of DEFAULT_REGOLE) {
    await db.execute(
      `INSERT INTO regole_pagamento (id, nome, giorni, fine_mese, giorni_extra, metodo_pagamento, auto_pagato, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT(id) DO UPDATE SET
         nome = excluded.nome,
         giorni = excluded.giorni,
         fine_mese = excluded.fine_mese,
         giorni_extra = excluded.giorni_extra,
         metodo_pagamento = excluded.metodo_pagamento,
         auto_pagato = excluded.auto_pagato,
         note = excluded.note,
         updated_at = CURRENT_TIMESTAMP`,
      [r.id, r.nome, r.giorni, r.fine_mese, r.giorni_extra, r.metodo_pagamento, r.auto_pagato, r.note]
    );
  }
}

async function seedInitialData(db) {
  const existing = await db.select('SELECT COUNT(*) as count FROM fatture_acquisto');
  if (Number(existing?.[0]?.count || 0) > 0) return;

  for (const f of DEMO_FATTURE) {
    await db.execute(
      `INSERT OR IGNORE INTO fornitori (id, ragione_sociale, metodo_pagamento_default, regola_pagamento_id)
       VALUES ($1, $2, $3, $4)`,
      [f.fornitore_id, f.fornitore_nome, f.metodo_pagamento, f.regola_pagamento_id]
    );
    await db.execute(
      `INSERT INTO fatture_acquisto (id, fornitore_id, fornitore_nome, numero, data_fattura, imponibile, iva, totale, metodo_pagamento, stato, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '')`,
      [f.id, f.fornitore_id, f.fornitore_nome, f.numero, f.data_fattura, f.imponibile, f.iva, f.totale, f.metodo_pagamento, 'DA_VERIFICARE']
    );
    await upsertScadenzaForFattura(db, f);
  }
}

async function insertSyncLog(db, tabella, recordId, operazione, payload = {}) {
  let deviceId = '';
  try {
    deviceId = await ensureSyncDeviceId(db);
  } catch (_) {
    deviceId = '';
  }
  await db.execute(
    `INSERT INTO sync_log (id, tabella, record_id, operazione, payload_json, origin_device_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uid('sync'), tabella, recordId, operazione, JSON.stringify(payload), deviceId]
  );
}

async function insertImportLog(db, entry) {
  await db.execute(
    `INSERT INTO import_log (id, nome_file, tipo, esito, record_id, messaggio, hash_file)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uid('imp'), entry.nome_file || '-', entry.tipo || 'XML_FATTURA', entry.esito || 'OK', entry.record_id || '', entry.messaggio || '', entry.hash_file || '']
  );
}

async function upsertScadenzaForFattura(db, fattura) {
  const regole = await db.select('SELECT * FROM regole_pagamento WHERE id = $1', [fattura.regola_pagamento_id]);
  const regola = regole?.[0] || DEFAULT_REGOLE.find((r) => r.id === fattura.regola_pagamento_id) || DEFAULT_REGOLE[0];
  const dataScadenza = fattura.data_scadenza_override || calcolaScadenza(fattura.data_fattura, regola);
  const statoCalcolato = statoDaRegola(regola);
  const existing = await db.select('SELECT * FROM scadenze WHERE fattura_id = $1 LIMIT 1', [fattura.id]);
  const existingScad = existing?.[0];
  const stato = existingScad?.stato === 'PAGATO' ? 'PAGATO' : statoCalcolato;
  const importoPagato = stato === 'PAGATO' || stato === 'PAGATO_AUTO' ? fattura.totale : 0;
  const dataPagamento = stato === 'PAGATO_AUTO' ? (fattura.data_pagamento || dataScadenza) : (stato === 'PAGATO' ? existingScad?.data_pagamento || fattura.data_pagamento || today() : '');
  const scadenzaId = existingScad?.id || `scad_${fattura.id}`;

  await db.execute(
    `INSERT INTO scadenze (id, fattura_id, fornitore_id, data_scadenza, data_pagamento, importo, importo_pagato, stato, metodo_pagamento, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT(id) DO UPDATE SET
       fornitore_id = excluded.fornitore_id,
       data_scadenza = excluded.data_scadenza,
       data_pagamento = excluded.data_pagamento,
       importo = excluded.importo,
       importo_pagato = excluded.importo_pagato,
       stato = excluded.stato,
       metodo_pagamento = excluded.metodo_pagamento,
       note = excluded.note,
       updated_at = CURRENT_TIMESTAMP`,
    [scadenzaId, fattura.id, fattura.fornitore_id, dataScadenza, dataPagamento, fattura.totale, importoPagato, stato, regola.metodo_pagamento || fattura.metodo_pagamento, fattura.note || '']
  );

  if (dataPagamento) {
    await db.execute('UPDATE fatture_acquisto SET data_pagamento = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [dataPagamento, fattura.id]);
  }
}

export async function getDashboardData() {
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const totaleAperto = mem.scadenze.filter((s) => s.stato === 'APERTO' || s.stato === 'DA_VERIFICARE').reduce((a, s) => a + Number(s.importo || 0) - Number(s.importo_pagato || 0), 0);
    const totalePagato = mem.scadenze.filter((s) => s.stato === 'PAGATO' || s.stato === 'PAGATO_AUTO').reduce((a, s) => a + Number(s.importo || 0), 0);
    return { fatture: mem.fatture.length, scadenzeAperte: mem.scadenze.filter((s) => s.stato === 'APERTO').length, daVerificare: mem.scadenze.filter((s) => s.stato === 'DA_VERIFICARE').length, totaleAperto, totalePagato };
  }
  const db = await getDb();
  const rows = await db.select(`
    SELECT
      (SELECT COUNT(*) FROM fatture_acquisto) as fatture,
      (SELECT COUNT(*) FROM scadenze WHERE stato = 'APERTO') as scadenzeAperte,
      (SELECT COUNT(*) FROM scadenze WHERE stato = 'DA_VERIFICARE') as daVerificare,
      (SELECT COALESCE(SUM(importo - importo_pagato), 0) FROM scadenze WHERE stato IN ('APERTO', 'DA_VERIFICARE')) as totaleAperto,
      (SELECT COALESCE(SUM(importo), 0) FROM scadenze WHERE stato IN ('PAGATO', 'PAGATO_AUTO')) as totalePagato
  `);
  return rows[0];
}

export async function getScadenze() {
  const data = await getScadenziarioData();
  return data.scadenze;
}

export async function getScadenziarioData() {
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    return {
      scadenze: [...mem.scadenze].sort((a, b) => a.data_scadenza.localeCompare(b.data_scadenza)),
      fatture: [...mem.fatture].sort((a, b) => b.data_fattura.localeCompare(a.data_fattura)),
      fornitori: [...mem.fornitori].sort((a, b) => a.ragione_sociale.localeCompare(b.ragione_sociale)),
      regole: [...mem.regole].sort((a, b) => a.nome.localeCompare(b.nome)),
      pagamenti: [...mem.pagamenti],
      righe: [...mem.righe],
      importLog: [...mem.importLog]
    };
  }
  const db = await getDb();
  const [scadenze, fatture, fornitori, regole, pagamenti, righe, importLog] = await Promise.all([
    db.select(`
      SELECT s.*, f.fornitore_nome, f.numero, f.data_fattura, f.imponibile, f.iva, f.totale
      FROM scadenze s
      LEFT JOIN fatture_acquisto f ON f.id = s.fattura_id
      ORDER BY s.data_scadenza ASC, f.fornitore_nome ASC
    `),
    db.select(`
      SELECT f.*, s.data_scadenza, s.data_pagamento as data_pagamento_scadenza, s.stato as stato_scadenza, s.importo_pagato, fo.regola_pagamento_id
      FROM fatture_acquisto f
      LEFT JOIN scadenze s ON s.fattura_id = f.id
      LEFT JOIN fornitori fo ON fo.id = f.fornitore_id
      ORDER BY f.data_fattura DESC, f.fornitore_nome ASC
    `),
    db.select('SELECT * FROM fornitori WHERE attivo = 1 ORDER BY ragione_sociale ASC'),
    db.select('SELECT * FROM regole_pagamento ORDER BY nome ASC'),
    db.select(`
      SELECT p.*, f.fornitore_nome, f.numero
      FROM pagamenti p
      LEFT JOIN fatture_acquisto f ON f.id = p.fattura_id
      ORDER BY p.data_pagamento DESC, p.created_at DESC LIMIT 80
    `),
    db.select(`
      SELECT r.*, f.fornitore_nome, f.numero, f.data_fattura
      FROM fatture_acquisto_righe r
      LEFT JOIN fatture_acquisto f ON f.id = r.fattura_id
      ORDER BY f.data_fattura DESC, r.numero_linea ASC LIMIT 300
    `),
    db.select('SELECT * FROM import_log ORDER BY created_at DESC LIMIT 80')
  ]);
  return { scadenze, fatture, fornitori, regole, pagamenti, righe, importLog };
}

export async function saveFornitore(input) {
  const payload = {
    id: input.id || uid('for'),
    ragione_sociale: String(input.ragione_sociale || '').trim(),
    partita_iva: String(input.partita_iva || '').trim(),
    codice_fiscale: String(input.codice_fiscale || '').trim(),
    iban: String(input.iban || '').trim(),
    email: String(input.email || '').trim(),
    telefono: String(input.telefono || '').trim(),
    metodo_pagamento_default: input.metodo_pagamento_default || '',
    regola_pagamento_id: input.regola_pagamento_id || 'reg_da_verificare'
  };
  if (!payload.ragione_sociale) throw new Error('Inserisci la ragione sociale del fornitore.');

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const idx = mem.fornitori.findIndex((f) => f.id === payload.id);
    if (idx >= 0) mem.fornitori[idx] = { ...mem.fornitori[idx], ...payload };
    else mem.fornitori.push({ ...payload, attivo: 1 });
    return payload;
  }

  const db = await getDb();
  await db.execute(
    `INSERT INTO fornitori (id, ragione_sociale, partita_iva, codice_fiscale, iban, email, telefono, metodo_pagamento_default, regola_pagamento_id, attivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
     ON CONFLICT(id) DO UPDATE SET
       ragione_sociale = excluded.ragione_sociale,
       partita_iva = excluded.partita_iva,
       codice_fiscale = excluded.codice_fiscale,
       iban = excluded.iban,
       email = excluded.email,
       telefono = excluded.telefono,
       metodo_pagamento_default = excluded.metodo_pagamento_default,
       regola_pagamento_id = excluded.regola_pagamento_id,
       attivo = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [payload.id, payload.ragione_sociale, payload.partita_iva, payload.codice_fiscale, payload.iban, payload.email, payload.telefono, payload.metodo_pagamento_default, payload.regola_pagamento_id]
  );
  await insertSyncLog(db, 'fornitori', payload.id, input.id ? 'UPDATE' : 'INSERT', payload);
  return payload;
}

export async function saveRegolaPagamento(input) {
  const payload = {
    id: input.id || uid('reg'),
    nome: String(input.nome || '').trim(),
    giorni: Math.trunc(toNumber(input.giorni)),
    fine_mese: input.fine_mese ? 1 : 0,
    giorni_extra: Math.trunc(toNumber(input.giorni_extra)),
    metodo_pagamento: String(input.metodo_pagamento || '').trim(),
    auto_pagato: input.auto_pagato ? 1 : 0,
    note: String(input.note || '').trim()
  };
  if (!payload.nome) throw new Error('Inserisci il nome della regola.');

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const idx = mem.regole.findIndex((r) => r.id === payload.id);
    if (idx >= 0) mem.regole[idx] = { ...mem.regole[idx], ...payload };
    else mem.regole.push(payload);
    return payload;
  }

  const db = await getDb();
  await db.execute(
    `INSERT INTO regole_pagamento (id, nome, giorni, fine_mese, giorni_extra, metodo_pagamento, auto_pagato, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id) DO UPDATE SET
       nome = excluded.nome,
       giorni = excluded.giorni,
       fine_mese = excluded.fine_mese,
       giorni_extra = excluded.giorni_extra,
       metodo_pagamento = excluded.metodo_pagamento,
       auto_pagato = excluded.auto_pagato,
       note = excluded.note,
       updated_at = CURRENT_TIMESTAMP`,
    [payload.id, payload.nome, payload.giorni, payload.fine_mese, payload.giorni_extra, payload.metodo_pagamento, payload.auto_pagato, payload.note]
  );
  await insertSyncLog(db, 'regole_pagamento', payload.id, input.id ? 'UPDATE' : 'INSERT', payload);
  return payload;
}

export async function saveFatturaAcquisto(input) {
  const payload = normalizeFatturaInput(input);
  if (!payload.numero) throw new Error('Inserisci il numero fattura.');
  if (!payload.fornitore_nome && !payload.fornitore_id) throw new Error('Seleziona o inserisci un fornitore.');
  if (!payload.data_fattura) throw new Error('Inserisci la data fattura.');
  if (payload.totale <= 0) throw new Error('Il totale fattura deve essere maggiore di zero.');

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    let fornitore = mem.fornitori.find((f) => f.id === payload.fornitore_id);
    if (!fornitore) {
      fornitore = {
        id: payload.fornitore_id || uid('for'),
        ragione_sociale: payload.fornitore_nome,
        metodo_pagamento_default: payload.metodo_pagamento,
        regola_pagamento_id: payload.regola_pagamento_id,
        attivo: 1
      };
      mem.fornitori.push(fornitore);
    }
    payload.fornitore_id = fornitore.id;
    payload.fornitore_nome = fornitore.ragione_sociale;
    const idx = mem.fatture.findIndex((f) => f.id === payload.id);
    if (idx >= 0) mem.fatture[idx] = { ...mem.fatture[idx], ...payload };
    else mem.fatture.push({ ...payload, stato: 'DA_VERIFICARE' });
    const regola = mem.regole.find((r) => r.id === payload.regola_pagamento_id) || mem.regole[0];
    const scadIdx = mem.scadenze.findIndex((s) => s.fattura_id === payload.id);
    const stato = statoDaRegola(regola);
    const dataScadenza = payload.data_scadenza_override || calcolaScadenza(payload.data_fattura, regola);
    const dataPagamento = stato === 'PAGATO_AUTO' ? dataScadenza : payload.data_pagamento || '';
    const scad = {
      id: scadIdx >= 0 ? mem.scadenze[scadIdx].id : `scad_${payload.id}`,
      fattura_id: payload.id,
      fornitore_id: payload.fornitore_id,
      fornitore_nome: payload.fornitore_nome,
      numero: payload.numero,
      data_fattura: payload.data_fattura,
      data_scadenza: dataScadenza,
      data_pagamento: dataPagamento,
      importo: payload.totale,
      importo_pagato: stato === 'PAGATO_AUTO' ? payload.totale : 0,
      stato,
      metodo_pagamento: regola.metodo_pagamento || payload.metodo_pagamento,
      note: payload.note
    };
    if (scadIdx >= 0) mem.scadenze[scadIdx] = scad;
    else mem.scadenze.push(scad);
    return payload;
  }

  const db = await getDb();
  let fornitore = payload.fornitore_id ? (await db.select('SELECT * FROM fornitori WHERE id = $1 LIMIT 1', [payload.fornitore_id]))?.[0] : null;
  if (!fornitore) {
    const fornitoreId = payload.fornitore_id || uid('for');
    await db.execute(
      `INSERT INTO fornitori (id, ragione_sociale, metodo_pagamento_default, regola_pagamento_id, attivo)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT(id) DO UPDATE SET ragione_sociale = excluded.ragione_sociale, updated_at = CURRENT_TIMESTAMP`,
      [fornitoreId, payload.fornitore_nome, payload.metodo_pagamento, payload.regola_pagamento_id]
    );
    payload.fornitore_id = fornitoreId;
    fornitore = { id: fornitoreId, ragione_sociale: payload.fornitore_nome };
  } else {
    payload.fornitore_nome = fornitore.ragione_sociale;
  }

  const regole = await db.select('SELECT * FROM regole_pagamento WHERE id = $1 LIMIT 1', [payload.regola_pagamento_id]);
  const regola = regole?.[0] || DEFAULT_REGOLE.find((r) => r.id === payload.regola_pagamento_id) || DEFAULT_REGOLE[0];
  const metodoPagamento = payload.metodo_pagamento || regola.metodo_pagamento || fornitore.metodo_pagamento_default || '';

  await db.execute(
    `INSERT INTO fatture_acquisto (id, fornitore_id, fornitore_nome, numero, data_fattura, imponibile, iva, totale, valuta, metodo_pagamento, stato, data_pagamento, origine_import, xml_hash, xml_nome_file, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DA_VERIFICARE', $11, $12, $13, $14, $15)
     ON CONFLICT(id) DO UPDATE SET
       fornitore_id = excluded.fornitore_id,
       fornitore_nome = excluded.fornitore_nome,
       numero = excluded.numero,
       data_fattura = excluded.data_fattura,
       imponibile = excluded.imponibile,
       iva = excluded.iva,
       totale = excluded.totale,
       valuta = excluded.valuta,
       metodo_pagamento = excluded.metodo_pagamento,
       data_pagamento = excluded.data_pagamento,
       origine_import = excluded.origine_import,
       xml_hash = excluded.xml_hash,
       xml_nome_file = excluded.xml_nome_file,
       note = excluded.note,
       updated_at = CURRENT_TIMESTAMP`,
    [payload.id, payload.fornitore_id, payload.fornitore_nome, payload.numero, payload.data_fattura, payload.imponibile, payload.iva, payload.totale, payload.valuta, metodoPagamento, payload.data_pagamento, payload.origine_import, payload.xml_hash, payload.xml_nome_file, payload.note]
  );

  await upsertScadenzaForFattura(db, { ...payload, metodo_pagamento: metodoPagamento });
  await insertSyncLog(db, 'fatture_acquisto', payload.id, input.id ? 'UPDATE' : 'INSERT', payload);
  return payload;
}

export async function importFatturaAcquistoXml(parsedXml) {
  const parsed = parsedXml || {};
  const fatturaXml = parsed.fattura || {};
  const fornitoreXml = parsed.fornitore || {};
  const fileName = parsed.fileName || 'fattura.xml';

  if (!fatturaXml.numero || !fatturaXml.data_fattura) throw new Error('XML importato ma numero/data fattura mancanti.');
  if (!fornitoreXml.ragione_sociale) throw new Error('XML importato ma fornitore mancante.');

  const supplierKey = fornitoreXml.partita_iva || fornitoreXml.codice_fiscale || fornitoreXml.ragione_sociale;
  const fornitoreId = `for_${slugId(supplierKey)}`;
  const fatturaId = `fa_xml_${slugId(`${supplierKey}_${fatturaXml.data_fattura}_${fatturaXml.numero}`)}`;
  const regolaId = inferRegolaFromMetodo(fatturaXml.metodo_pagamento);

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    let fornitore = mem.fornitori.find((f) => f.id === fornitoreId);
    if (!fornitore) {
      fornitore = {
        id: fornitoreId,
        ragione_sociale: fornitoreXml.ragione_sociale,
        partita_iva: fornitoreXml.partita_iva || '',
        codice_fiscale: fornitoreXml.codice_fiscale || '',
        metodo_pagamento_default: fatturaXml.metodo_pagamento,
        regola_pagamento_id: regolaId,
        attivo: 1
      };
      mem.fornitori.push(fornitore);
    }
    await saveFatturaAcquisto({
      id: fatturaId,
      fornitore_id: fornitoreId,
      fornitore_nome: fornitoreXml.ragione_sociale,
      numero: fatturaXml.numero,
      data_fattura: fatturaXml.data_fattura,
      imponibile: fatturaXml.imponibile,
      iva: fatturaXml.iva,
      totale: fatturaXml.totale,
      valuta: fatturaXml.valuta,
      metodo_pagamento: fatturaXml.metodo_pagamento,
      regola_pagamento_id: regolaId,
      data_scadenza_override: fatturaXml.data_scadenza_xml,
      origine_import: 'XML',
      xml_hash: parsed.hash,
      xml_nome_file: fileName,
      note: fatturaXml.note
    });
    mem.righe = mem.righe.filter((r) => r.fattura_id !== fatturaId);
    parsed.righe?.forEach((r, idx) => mem.righe.push({ ...r, id: `${fatturaId}_r${idx + 1}`, fattura_id: fatturaId, fornitore_nome: fornitoreXml.ragione_sociale, numero: fatturaXml.numero }));
    mem.importLog.unshift({ id: uid('imp'), nome_file: fileName, tipo: 'XML_FATTURA', esito: 'OK', record_id: fatturaId, messaggio: `Importata fattura ${fatturaXml.numero}`, hash_file: parsed.hash, created_at: new Date().toISOString() });
    return { fatturaId, fornitoreId, righeImportate: parsed.righe?.length || 0, duplicatoAggiornato: false };
  }

  const db = await getDb();
  const existingHash = parsed.hash ? await db.select('SELECT id FROM fatture_acquisto WHERE xml_hash = $1 LIMIT 1', [parsed.hash]) : [];
  const existingById = await db.select('SELECT id FROM fatture_acquisto WHERE id = $1 LIMIT 1', [fatturaId]);
  const duplicatoAggiornato = Boolean(existingHash?.[0] || existingById?.[0]);

  const existingSupplier = await db.select(
    `SELECT * FROM fornitori WHERE id = $1 OR partita_iva = $2 OR codice_fiscale = $3 LIMIT 1`,
    [fornitoreId, fornitoreXml.partita_iva || '__NO_PIVA__', fornitoreXml.codice_fiscale || '__NO_CF__']
  );
  const supplier = existingSupplier?.[0];
  const finalFornitoreId = supplier?.id || fornitoreId;
  const finalRegolaId = supplier?.regola_pagamento_id || regolaId;
  const metodoDefault = supplier?.metodo_pagamento_default || fatturaXml.metodo_pagamento || 'DA VERIFICARE';

  await db.execute(
    `INSERT INTO fornitori (id, ragione_sociale, partita_iva, codice_fiscale, metodo_pagamento_default, regola_pagamento_id, attivo)
     VALUES ($1, $2, $3, $4, $5, $6, 1)
     ON CONFLICT(id) DO UPDATE SET
       ragione_sociale = excluded.ragione_sociale,
       partita_iva = CASE WHEN excluded.partita_iva <> '' THEN excluded.partita_iva ELSE partita_iva END,
       codice_fiscale = CASE WHEN excluded.codice_fiscale <> '' THEN excluded.codice_fiscale ELSE codice_fiscale END,
       metodo_pagamento_default = CASE WHEN COALESCE(metodo_pagamento_default, '') = '' THEN excluded.metodo_pagamento_default ELSE metodo_pagamento_default END,
       regola_pagamento_id = CASE WHEN COALESCE(regola_pagamento_id, '') = '' THEN excluded.regola_pagamento_id ELSE regola_pagamento_id END,
       attivo = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [finalFornitoreId, fornitoreXml.ragione_sociale, fornitoreXml.partita_iva || '', fornitoreXml.codice_fiscale || '', metodoDefault, finalRegolaId]
  );

  const saved = await saveFatturaAcquisto({
    id: fatturaId,
    fornitore_id: finalFornitoreId,
    fornitore_nome: fornitoreXml.ragione_sociale,
    numero: fatturaXml.numero,
    data_fattura: fatturaXml.data_fattura,
    imponibile: fatturaXml.imponibile,
    iva: fatturaXml.iva,
    totale: fatturaXml.totale,
    valuta: fatturaXml.valuta || 'EUR',
    metodo_pagamento: fatturaXml.metodo_pagamento,
    regola_pagamento_id: finalRegolaId,
    data_scadenza_override: fatturaXml.data_scadenza_xml,
    origine_import: 'XML',
    xml_hash: parsed.hash || '',
    xml_nome_file: fileName,
    note: fatturaXml.note || `Importata da XML: ${fileName}`
  });

  await db.execute('DELETE FROM fatture_acquisto_righe WHERE fattura_id = $1', [saved.id]);
  for (const [idx, r] of (parsed.righe || []).entries()) {
    // Alcuni XML hanno lo stesso NumeroLinea ripetuto o mancante: l'id riga deve quindi
    // usare sempre l'indice reale di import, non solo il numero linea letto dall'XML.
    const safeLine = Number(r.numero_linea || idx + 1);
    const id = `${saved.id}_r${String(idx + 1).padStart(4, '0')}`;
    await db.execute(
      `INSERT INTO fatture_acquisto_righe (id, fattura_id, numero_linea, codice_articolo, descrizione_originale, quantita, um, prezzo_unitario, totale_riga, aliquota_iva)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(id) DO UPDATE SET
         numero_linea = excluded.numero_linea,
         codice_articolo = excluded.codice_articolo,
         descrizione_originale = excluded.descrizione_originale,
         quantita = excluded.quantita,
         um = excluded.um,
         prezzo_unitario = excluded.prezzo_unitario,
         totale_riga = excluded.totale_riga,
         aliquota_iva = excluded.aliquota_iva`,
      [id, saved.id, safeLine, r.codice_articolo || '', r.descrizione_originale || 'Riga senza descrizione', toNumber(r.quantita), r.um || '', toNumber(r.prezzo_unitario), toNumber(r.totale_riga), toNumber(r.aliquota_iva)]
    );
  }
  await insertImportLog(db, {
    nome_file: fileName,
    tipo: 'XML_FATTURA',
    esito: 'OK',
    record_id: saved.id,
    messaggio: `${duplicatoAggiornato ? 'Aggiornata' : 'Importata'} fattura ${fatturaXml.numero} - ${fornitoreXml.ragione_sociale}`,
    hash_file: parsed.hash || ''
  });
  await insertSyncLog(db, 'fatture_acquisto', saved.id, duplicatoAggiornato ? 'UPDATE_XML' : 'IMPORT_XML', { fileName, hash: parsed.hash });

  return { fatturaId: saved.id, fornitoreId: finalFornitoreId, righeImportate: parsed.righe?.length || 0, duplicatoAggiornato };
}

export async function importFatturaVenditaXml(parsedXml) {
  const parsed = parsedXml || {};
  const clienteXml = parsed.cliente || {};
  const fatturaXml = parsed.fattura || {};
  const fileName = parsed.fileName || fatturaXml.xml_nome_file || 'fattura_vendita.xml';

  const clienteNome = String(clienteXml.ragione_sociale || clienteXml.denominazione || 'Cliente XML senza nome').trim();
  const numero = String(fatturaXml.numero || '').trim();
  const dataFattura = String(fatturaXml.data_fattura || '').trim();
  if (!numero || !dataFattura) throw new Error('Nel file XML mancano numero o data fattura vendita.');

  const fatturaId = `fatv_${slugId(`${clienteNome}_${numero}_${dataFattura}`)}`;
  const payload = {
    id: fatturaId,
    cliente_nome: clienteNome,
    cliente_partita_iva: clienteXml.partita_iva || '',
    cliente_codice_fiscale: clienteXml.codice_fiscale || '',
    numero,
    data_fattura: dataFattura,
    imponibile: toNumber(fatturaXml.imponibile),
    iva: toNumber(fatturaXml.iva),
    totale: toNumber(fatturaXml.totale),
    valuta: fatturaXml.valuta || parsed.valuta || 'EUR',
    stato: 'EMESSA',
    data_incasso: '',
    origine_import: 'XML vendita',
    xml_hash: parsed.hash || '',
    xml_nome_file: fileName,
    note: fatturaXml.note || `Importata da XML vendita: ${fileName}`
  };

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    mem.fattureVendita = (mem.fattureVendita || []).filter((f) => f.id !== payload.id);
    mem.fattureVendita.unshift(payload);
    mem.fattureVenditaRighe = (mem.fattureVenditaRighe || []).filter((r) => r.fattura_id !== payload.id);
    (parsed.righe || []).forEach((r, idx) => mem.fattureVenditaRighe.push({ ...r, id: `fatvr_${payload.id}_${idx + 1}`, fattura_id: payload.id }));
    return { fatturaId: payload.id, righeImportate: parsed.righe?.length || 0, duplicatoAggiornato: false };
  }

  const db = await getDb();
  const existingHash = parsed.hash ? await db.select('SELECT id FROM fatture_vendita WHERE xml_hash = $1 LIMIT 1', [parsed.hash]) : [];
  const existingById = await db.select('SELECT id FROM fatture_vendita WHERE id = $1 LIMIT 1', [payload.id]);
  const targetId = existingHash?.[0]?.id || existingById?.[0]?.id || payload.id;
  const duplicatoAggiornato = Boolean(existingHash?.length || existingById?.length);
  payload.id = targetId;

  await db.execute(
    `INSERT INTO fatture_vendita (id, cliente_nome, cliente_partita_iva, cliente_codice_fiscale, numero, data_fattura, imponibile, iva, totale, valuta, stato, data_incasso, origine_import, xml_hash, xml_nome_file, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT(id) DO UPDATE SET cliente_nome=excluded.cliente_nome, cliente_partita_iva=excluded.cliente_partita_iva, cliente_codice_fiscale=excluded.cliente_codice_fiscale, numero=excluded.numero, data_fattura=excluded.data_fattura, imponibile=excluded.imponibile, iva=excluded.iva, totale=excluded.totale, valuta=excluded.valuta, stato=excluded.stato, data_incasso=excluded.data_incasso, origine_import=excluded.origine_import, xml_hash=excluded.xml_hash, xml_nome_file=excluded.xml_nome_file, note=excluded.note, updated_at=CURRENT_TIMESTAMP`,
    [payload.id,payload.cliente_nome,payload.cliente_partita_iva,payload.cliente_codice_fiscale,payload.numero,payload.data_fattura,payload.imponibile,payload.iva,payload.totale,payload.valuta,payload.stato,payload.data_incasso,payload.origine_import,payload.xml_hash,payload.xml_nome_file,payload.note]
  );

  await db.execute('DELETE FROM fatture_vendita_righe WHERE fattura_id = $1', [payload.id]);
  for (const [idx, r] of (parsed.righe || []).entries()) {
    const numeroLinea = Number(r.numero_linea || idx + 1);
    const rigaId = `fatvr_${payload.id}_${numeroLinea}`;
    await db.execute(
      `INSERT INTO fatture_vendita_righe (id, fattura_id, numero_linea, codice_articolo, descrizione_originale, quantita, um, prezzo_unitario, totale_riga, aliquota_iva)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [rigaId, payload.id, numeroLinea, r.codice_articolo || '', r.descrizione_originale || 'Riga senza descrizione', toNumber(r.quantita), r.um || '', toNumber(r.prezzo_unitario), toNumber(r.totale_riga), toNumber(r.aliquota_iva)]
    );
  }

  await insertImportLog(db, {
    nome_file: fileName,
    tipo: 'XML_FATTURA_VENDITA',
    esito: 'OK',
    record_id: payload.id,
    messaggio: `${duplicatoAggiornato ? 'Aggiornata' : 'Importata'} fattura vendita ${payload.numero} - ${payload.cliente_nome}`,
    hash_file: parsed.hash || ''
  });
  await insertSyncLog(db, 'fatture_vendita', payload.id, duplicatoAggiornato ? 'UPDATE_XML' : 'IMPORT_XML', { fileName, hash: parsed.hash });
  return { fatturaId: payload.id, righeImportate: parsed.righe?.length || 0, duplicatoAggiornato };
}

export async function aggiornaStatoScadenza(scadenzaId, nuovoStato, dataPagamento = '', metodoPagamento = '') {
  const stato = String(nuovoStato || '').toUpperCase();
  const data = dataPagamento || (['PAGATO', 'PAGATO_AUTO'].includes(stato) ? today() : '');

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const s = mem.scadenze.find((x) => x.id === scadenzaId);
    if (s) {
      s.stato = stato;
      s.importo_pagato = ['PAGATO', 'PAGATO_AUTO'].includes(stato) ? s.importo : 0;
      s.data_pagamento = ['PAGATO', 'PAGATO_AUTO'].includes(stato) ? data : '';
      const f = mem.fatture.find((x) => x.id === s.fattura_id);
      if (f) f.data_pagamento = s.data_pagamento;
    }
    return true;
  }

  const db = await getDb();
  const rows = await db.select('SELECT * FROM scadenze WHERE id = $1 LIMIT 1', [scadenzaId]);
  const scad = rows?.[0];
  if (!scad) throw new Error('Scadenza non trovata');

  const isPaid = ['PAGATO', 'PAGATO_AUTO'].includes(stato);
  const metodo = metodoPagamento || scad.metodo_pagamento || '';
  await db.execute(
    'UPDATE scadenze SET stato = $1, importo_pagato = $2, data_pagamento = $3, metodo_pagamento = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
    [stato, isPaid ? scad.importo : 0, isPaid ? data : null, isPaid ? metodo : scad.metodo_pagamento, scadenzaId]
  );
  await db.execute('UPDATE fatture_acquisto SET data_pagamento = $1, metodo_pagamento = COALESCE($2, metodo_pagamento), updated_at = CURRENT_TIMESTAMP WHERE id = $3', [isPaid ? data : null, isPaid ? metodo : null, scad.fattura_id]);

  if (isPaid) {
    await db.execute(
      `INSERT INTO pagamenti (id, scadenza_id, fattura_id, data_pagamento, importo, metodo_pagamento, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uid('pag'), scadenzaId, scad.fattura_id, data, scad.importo, metodo, `Stato impostato a ${stato} da BarAI Desktop`]
    );
    await upsertPrimaNotaPagamentoScadenza(db, scad, data, metodo, `Stato impostato a ${stato} da BarAI Desktop`);
  } else {
    await db.execute('DELETE FROM pagamenti WHERE scadenza_id = $1', [scadenzaId]);
    await db.execute("DELETE FROM prima_nota WHERE origine = 'Scadenziario' AND riferimento_tipo = 'SCADENZA' AND riferimento_id = $1", [scadenzaId]);
  }
  await insertSyncLog(db, 'scadenze', scadenzaId, 'UPDATE_STATO', { stato, data_pagamento: isPaid ? data : '' });
  return true;
}

export async function aggiornaStatoScadenze(scadenzaIds, nuovoStato, dataPagamento = '') {
  const ids = Array.from(new Set(scadenzaIds || [])).filter(Boolean);
  for (const id of ids) await aggiornaStatoScadenza(id, nuovoStato, dataPagamento);
  return ids.length;
}
export async function segnaScadenzaPagata(scadenzaId, dataPagamento = today(), metodoPagamento = '', note = 'Pagamento registrato da BarAI Desktop') {
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const s = mem.scadenze.find((x) => x.id === scadenzaId);
    if (s) {
      const metodo = metodoPagamento || s.metodo_pagamento || '';
      s.importo_pagato = s.importo;
      s.stato = 'PAGATO';
      s.data_pagamento = dataPagamento;
      s.metodo_pagamento = metodo;
      const f = mem.fatture.find((x) => x.id === s.fattura_id);
      if (f) {
        f.data_pagamento = dataPagamento;
        f.metodo_pagamento = metodo;
      }
      mem.pagamenti = mem.pagamenti.filter((p) => p.scadenza_id !== scadenzaId);
      mem.pagamenti.push({ id: uid('pag'), scadenza_id: s.id, fattura_id: s.fattura_id, data_pagamento: dataPagamento, importo: s.importo, metodo_pagamento: metodo, note });
      mem.primaNota = (mem.primaNota || []).filter((m) => !(m.origine === 'Scadenziario' && m.riferimento_id === scadenzaId));
      mem.primaNota.push({
        id: `pn_scad_${s.id}`,
        data_movimento: dataPagamento,
        tipo: 'USCITA',
        conto: contoDaMetodoPagamento(metodo),
        categoria: 'Fornitori',
        sottocategoria: f?.fornitore_nome || s.fornitore_nome || '',
        descrizione: `Pagamento fattura ${f?.fornitore_nome || s.fornitore_nome || 'fornitore'} n. ${f?.numero || s.numero || '-'}`,
        importo: s.importo,
        metodo_pagamento: metodo,
        origine: 'Scadenziario',
        riferimento_tipo: 'SCADENZA',
        riferimento_id: s.id,
        fornitore_id: s.fornitore_id || '',
        fornitore_nome: f?.fornitore_nome || s.fornitore_nome || '',
        note,
        auto_generato: 1,
        modificabile: 0
      });
    }
    return true;
  }
  const db = await getDb();
  const rows = await db.select('SELECT * FROM scadenze WHERE id = $1', [scadenzaId]);
  const scad = rows?.[0];
  if (!scad) throw new Error('Scadenza non trovata');
  const metodo = metodoPagamento || scad.metodo_pagamento || '';
  await db.execute('UPDATE scadenze SET importo_pagato = importo, stato = $1, data_pagamento = $2, metodo_pagamento = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4', ['PAGATO', dataPagamento, metodo, scadenzaId]);
  await db.execute('UPDATE fatture_acquisto SET data_pagamento = $1, metodo_pagamento = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [dataPagamento, metodo, scad.fattura_id]);
  await db.execute('DELETE FROM pagamenti WHERE scadenza_id = $1', [scadenzaId]);
  await db.execute(
    `INSERT INTO pagamenti (id, scadenza_id, fattura_id, data_pagamento, importo, metodo_pagamento, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uid('pag'), scadenzaId, scad.fattura_id, dataPagamento, scad.importo, metodo, note]
  );
  await upsertPrimaNotaPagamentoScadenza(db, scad, dataPagamento, metodo, note);
  await insertSyncLog(db, 'scadenze', scadenzaId, 'UPDATE', { stato: 'PAGATO', data_pagamento: dataPagamento, metodo_pagamento: metodo });
  return true;
}
export async function segnaScadenzePagate(scadenzaIds, dataPagamento = today(), metodoPagamento = '') {
  const ids = Array.from(new Set(scadenzaIds || [])).filter(Boolean);
  for (const id of ids) await segnaScadenzaPagata(id, dataPagamento, metodoPagamento, 'Pagamento multiplo registrato da BarAI Desktop');
  return ids.length;
}

export async function riapriScadenza(scadenzaId) {
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const s = mem.scadenze.find((x) => x.id === scadenzaId);
    if (s) {
      s.importo_pagato = 0;
      s.stato = 'APERTO';
      s.data_pagamento = '';
      const f = mem.fatture.find((x) => x.id === s.fattura_id);
      if (f) f.data_pagamento = '';
      mem.pagamenti = mem.pagamenti.filter((p) => p.scadenza_id !== scadenzaId);
      mem.primaNota = (mem.primaNota || []).filter((m) => !(m.origine === 'Scadenziario' && m.riferimento_id === scadenzaId));
    }
    return true;
  }
  const db = await getDb();
  const rows = await db.select('SELECT fattura_id FROM scadenze WHERE id = $1 LIMIT 1', [scadenzaId]);
  const fatturaId = rows?.[0]?.fattura_id;
  await db.execute('UPDATE scadenze SET importo_pagato = 0, stato = $1, data_pagamento = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['APERTO', scadenzaId]);
  if (fatturaId) await db.execute('UPDATE fatture_acquisto SET data_pagamento = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [fatturaId]);
  await db.execute('DELETE FROM pagamenti WHERE scadenza_id = $1', [scadenzaId]);
  await db.execute("DELETE FROM prima_nota WHERE origine = 'Scadenziario' AND riferimento_tipo = 'SCADENZA' AND riferimento_id = $1", [scadenzaId]);
  await insertSyncLog(db, 'prima_nota', scadenzaId, 'DELETE_AUTO_SCADENZA', { scadenzaId });
  await insertSyncLog(db, 'scadenze', scadenzaId, 'UPDATE', { stato: 'APERTO' });
  return true;
}

// v8.1.2 - Prima Nota gestionale
const PRIMA_NOTA_CONTI = ['Cassa contanti', 'Banca', 'Bancomat/POS', 'Carta di credito', 'Ticket', 'Delivery', 'Assegno', 'Altro'];
const PRIMA_NOTA_CATEGORIE = ['Fornitori', 'Incassi bar', 'Personale', 'F24 / Tributi', 'Affitto', 'Assicurazioni', 'Stipendi', 'Commissioni banca', 'POS', 'Prelievi', 'Versamenti', 'Spese varie'];

function contoDaMetodoPagamento(metodoPagamento) {
  const m = String(metodoPagamento || '').toLowerCase();
  if (m.includes('contant')) return 'Cassa contanti';
  if (m.includes('bancomat') || m.includes('pos')) return 'Bancomat/POS';
  if (m.includes('carta')) return 'Carta di credito';
  if (m.includes('assegno')) return 'Assegno';
  if (m.includes('bonifico') || m.includes('rid') || m.includes('riba') || m.includes('sepa')) return 'Banca';
  return 'Altro';
}

function cleanOptionName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function uniqueOptions(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values || []) {
    const value = cleanOptionName(typeof raw === 'string' ? raw : raw?.nome);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

async function upsertPrimaNotaDefaultOptions(db) {
  let ordine = 0;
  for (const nome of PRIMA_NOTA_CONTI) {
    await db.execute(
      `INSERT INTO prima_nota_conti (id, nome, tipo, attivo, ordine)
       VALUES ($1, $2, 'CONTO', 1, $3)
       ON CONFLICT(nome) DO UPDATE SET attivo = 1, ordine = MIN(prima_nota_conti.ordine, excluded.ordine), updated_at = CURRENT_TIMESTAMP`,
      [`pnc_${slugId(nome)}`, nome, ordine]
    );
    ordine += 10;
  }
  ordine = 0;
  for (const nome of PRIMA_NOTA_CATEGORIE) {
    await db.execute(
      `INSERT INTO prima_nota_categorie (id, nome, tipo_default, attivo, ordine)
       VALUES ($1, $2, '', 1, $3)
       ON CONFLICT(nome) DO UPDATE SET attivo = 1, ordine = MIN(prima_nota_categorie.ordine, excluded.ordine), updated_at = CURRENT_TIMESTAMP`,
      [`pnc_${slugId(nome)}`, nome, ordine]
    );
    ordine += 10;
  }
}

function normalizePrimaNotaInput(input = {}) {
  const tipo = String(input.tipo || 'USCITA').toUpperCase();
  const validTipo = ['ENTRATA', 'USCITA', 'GIROCONTO'].includes(tipo) ? tipo : 'USCITA';
  const importo = Math.abs(toNumber(input.importo));
  const conto = cleanOptionName(input.conto) || 'Altro';
  const contoDestinazione = cleanOptionName(input.conto_destinazione || input.contoDestinazione || '');
  return {
    id: input.id || uid('pn'),
    data_movimento: input.data_movimento || today(),
    tipo: validTipo,
    conto,
    conto_destinazione: validTipo === 'GIROCONTO' ? (contoDestinazione || 'Altro') : '',
    categoria: cleanOptionName(input.categoria) || (validTipo === 'GIROCONTO' ? 'Giroconti' : 'Spese varie'),
    sottocategoria: cleanOptionName(input.sottocategoria),
    descrizione: cleanOptionName(input.descrizione),
    importo,
    metodo_pagamento: cleanOptionName(input.metodo_pagamento),
    origine: cleanOptionName(input.origine || 'Manuale') || 'Manuale',
    riferimento_tipo: cleanOptionName(input.riferimento_tipo),
    riferimento_id: cleanOptionName(input.riferimento_id),
    fornitore_id: cleanOptionName(input.fornitore_id),
    fornitore_nome: cleanOptionName(input.fornitore_nome),
    note: cleanOptionName(input.note),
    auto_generato: input.auto_generato ? 1 : 0,
    modificabile: input.modificabile === 0 || input.modificabile === false ? 0 : 1
  };
}

function primaNotaTotals(movimenti) {
  const entrate = movimenti.filter((m) => m.tipo === 'ENTRATA').reduce((a, m) => a + toNumber(m.importo), 0);
  const uscite = movimenti.filter((m) => m.tipo === 'USCITA').reduce((a, m) => a + toNumber(m.importo), 0);
  const giroconti = movimenti.filter((m) => m.tipo === 'GIROCONTO').reduce((a, m) => a + toNumber(m.importo), 0);
  const perConto = {};

  function ensureConto(nome) {
    const conto = cleanOptionName(nome) || 'Altro';
    if (!perConto[conto]) perConto[conto] = { conto, entrate: 0, uscite: 0, giroconti_in: 0, giroconti_out: 0, saldo: 0 };
    return perConto[conto];
  }

  for (const m of movimenti) {
    const importo = toNumber(m.importo);
    if (m.tipo === 'ENTRATA') {
      const c = ensureConto(m.conto);
      c.entrate += importo;
    } else if (m.tipo === 'USCITA') {
      const c = ensureConto(m.conto);
      c.uscite += importo;
    } else if (m.tipo === 'GIROCONTO') {
      const origine = ensureConto(m.conto);
      origine.giroconti_out += importo;
      const destinazione = ensureConto(m.conto_destinazione || 'Altro');
      destinazione.giroconti_in += importo;
    }
  }

  for (const c of Object.values(perConto)) {
    c.giroconti = (c.giroconti_in || 0) - (c.giroconti_out || 0);
    c.saldo = c.entrate - c.uscite + c.giroconti;
  }
  return { entrate, uscite, giroconti, saldo: entrate - uscite, perConto: Object.values(perConto).sort((a, b) => a.conto.localeCompare(b.conto)) };
}

function primaNotaMonthlySummary(movimenti) {
  const byMonth = new Map();
  for (const m of movimenti || []) {
    const mese = String(m.data_movimento || '').slice(0, 7) || 'Senza data';
    if (!byMonth.has(mese)) byMonth.set(mese, { mese, entrate: 0, uscite: 0, giroconti: 0, saldo: 0, movimenti: 0 });
    const row = byMonth.get(mese);
    row.movimenti += 1;
    if (m.tipo === 'ENTRATA') row.entrate += toNumber(m.importo);
    if (m.tipo === 'USCITA') row.uscite += toNumber(m.importo);
    if (m.tipo === 'GIROCONTO') row.giroconti += toNumber(m.importo);
    row.saldo = row.entrate - row.uscite;
  }
  return Array.from(byMonth.values()).sort((a, b) => String(b.mese).localeCompare(String(a.mese))).slice(0, 18);
}

function primaNotaCategorySummary(movimenti) {
  const byCat = new Map();
  for (const m of movimenti || []) {
    const categoria = cleanOptionName(m.categoria) || 'Senza categoria';
    if (!byCat.has(categoria)) byCat.set(categoria, { categoria, entrate: 0, uscite: 0, giroconti: 0, saldo: 0, movimenti: 0 });
    const row = byCat.get(categoria);
    row.movimenti += 1;
    if (m.tipo === 'ENTRATA') row.entrate += toNumber(m.importo);
    if (m.tipo === 'USCITA') row.uscite += toNumber(m.importo);
    if (m.tipo === 'GIROCONTO') row.giroconti += toNumber(m.importo);
    row.saldo = row.entrate - row.uscite;
  }
  return Array.from(byCat.values()).sort((a, b) => Math.abs(b.saldo || 0) - Math.abs(a.saldo || 0));
}

async function getPrimaNotaOptions(db) {
  const contoRows = await db.select(`SELECT nome FROM prima_nota_conti WHERE attivo = 1 ORDER BY ordine ASC, nome ASC`);
  const catRows = await db.select(`SELECT nome FROM prima_nota_categorie WHERE attivo = 1 ORDER BY ordine ASC, nome ASC`);
  const movConti = await db.select(`SELECT DISTINCT conto AS nome FROM prima_nota WHERE COALESCE(conto, '') <> '' UNION SELECT DISTINCT conto_destinazione AS nome FROM prima_nota WHERE COALESCE(conto_destinazione, '') <> '' ORDER BY nome ASC`);
  const movCats = await db.select(`SELECT DISTINCT categoria AS nome FROM prima_nota WHERE COALESCE(categoria, '') <> '' ORDER BY nome ASC`);
  const conti = uniqueOptions([...(contoRows || []).map((r) => r.nome), ...(movConti || []).map((r) => r.nome)]);
  const categorie = uniqueOptions([...(catRows || []).map((r) => r.nome), ...(movCats || []).map((r) => r.nome)]);
  return {
    conti: conti.length ? conti : PRIMA_NOTA_CONTI,
    categorie: categorie.length ? categorie : PRIMA_NOTA_CATEGORIE
  };
}

async function upsertPrimaNotaPagamentoScadenza(db, scadenza, dataPagamento, metodoPagamento, note = '') {
  const scad = scadenza || {};
  const fattRows = scad.fattura_id ? await db.select('SELECT * FROM fatture_acquisto WHERE id = $1 LIMIT 1', [scad.fattura_id]) : [];
  const fatt = fattRows?.[0] || {};
  const fornitoreNome = fatt.fornitore_nome || scad.fornitore_nome || '';
  const numero = fatt.numero || scad.numero || '';
  const dataFattura = fatt.data_fattura || scad.data_fattura || '';
  const metodo = metodoPagamento || scad.metodo_pagamento || fatt.metodo_pagamento || '';
  const movimento = normalizePrimaNotaInput({
    id: `pn_scad_${scad.id}`,
    data_movimento: dataPagamento || scad.data_pagamento || today(),
    tipo: 'USCITA',
    conto: contoDaMetodoPagamento(metodo),
    categoria: 'Fornitori',
    sottocategoria: fornitoreNome,
    descrizione: `Pagamento fattura ${fornitoreNome || 'fornitore'} n. ${numero || '-'}${dataFattura ? ` del ${dataFattura}` : ''}`,
    importo: scad.importo_pagato || scad.importo || fatt.totale || 0,
    metodo_pagamento: metodo,
    origine: 'Scadenziario',
    riferimento_tipo: 'SCADENZA',
    riferimento_id: scad.id,
    fornitore_id: scad.fornitore_id || fatt.fornitore_id || '',
    fornitore_nome: fornitoreNome,
    note: note || 'Generato automaticamente dal pagamento fattura',
    auto_generato: 1,
    modificabile: 0
  });

  await db.execute(
    `INSERT INTO prima_nota (id, data_movimento, tipo, conto, conto_destinazione, categoria, sottocategoria, descrizione, importo, metodo_pagamento, origine, riferimento_tipo, riferimento_id, fornitore_id, fornitore_nome, note, auto_generato, modificabile)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1, 0)
     ON CONFLICT(id) DO UPDATE SET
       data_movimento = excluded.data_movimento,
       tipo = excluded.tipo,
       conto = excluded.conto,
       conto_destinazione = excluded.conto_destinazione,
       categoria = excluded.categoria,
       sottocategoria = excluded.sottocategoria,
       descrizione = excluded.descrizione,
       importo = excluded.importo,
       metodo_pagamento = excluded.metodo_pagamento,
       origine = excluded.origine,
       riferimento_tipo = excluded.riferimento_tipo,
       riferimento_id = excluded.riferimento_id,
       fornitore_id = excluded.fornitore_id,
       fornitore_nome = excluded.fornitore_nome,
       note = excluded.note,
       auto_generato = 1,
       modificabile = 0,
       updated_at = CURRENT_TIMESTAMP`,
    [movimento.id, movimento.data_movimento, movimento.tipo, movimento.conto, movimento.conto_destinazione, movimento.categoria, movimento.sottocategoria, movimento.descrizione, movimento.importo, movimento.metodo_pagamento, movimento.origine, movimento.riferimento_tipo, movimento.riferimento_id, movimento.fornitore_id, movimento.fornitore_nome, movimento.note]
  );
  await insertSyncLog(db, 'prima_nota', movimento.id, 'UPSERT_AUTO_SCADENZA', movimento);
  return movimento;
}

export async function getPrimaNotaData(filters = {}) {
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const movimenti = [...(mem.primaNota || [])].sort((a, b) => String(b.data_movimento).localeCompare(String(a.data_movimento)));
    const totals = primaNotaTotals(movimenti);
    return { movimenti, conti: PRIMA_NOTA_CONTI, categorie: PRIMA_NOTA_CATEGORIE, totals, monthly: primaNotaMonthlySummary(movimenti), byCategory: primaNotaCategorySummary(movimenti) };
  }
  const db = await getDb();
  await upsertPrimaNotaDefaultOptions(db);
  const movimenti = await db.select(`
    SELECT *
    FROM prima_nota
    ORDER BY data_movimento DESC, created_at DESC
    LIMIT 1500
  `);
  const options = await getPrimaNotaOptions(db);
  return { movimenti, ...options, totals: primaNotaTotals(movimenti), monthly: primaNotaMonthlySummary(movimenti), byCategory: primaNotaCategorySummary(movimenti) };
}

export async function getPrimaNotaConfigData() {
  if (!isTauriRuntime()) return { conti: PRIMA_NOTA_CONTI, categorie: PRIMA_NOTA_CATEGORIE };
  const db = await getDb();
  await upsertPrimaNotaDefaultOptions(db);
  return getPrimaNotaOptions(db);
}

export async function savePrimaNotaConfig(input = {}) {
  const conti = uniqueOptions(input.conti || []);
  const categorie = uniqueOptions(input.categorie || []);
  if (!conti.length) throw new Error('Inserisci almeno un conto Prima Nota.');
  if (!categorie.length) throw new Error('Inserisci almeno una categoria Prima Nota.');

  if (!isTauriRuntime()) return { conti, categorie };
  const db = await getDb();
  await db.execute('UPDATE prima_nota_conti SET attivo = 0, updated_at = CURRENT_TIMESTAMP');
  await db.execute('UPDATE prima_nota_categorie SET attivo = 0, updated_at = CURRENT_TIMESTAMP');

  for (let i = 0; i < conti.length; i += 1) {
    const nome = conti[i];
    await db.execute(
      `INSERT INTO prima_nota_conti (id, nome, tipo, attivo, ordine)
       VALUES ($1, $2, 'CONTO', 1, $3)
       ON CONFLICT(nome) DO UPDATE SET attivo = 1, ordine = excluded.ordine, updated_at = CURRENT_TIMESTAMP`,
      [`pnc_${slugId(nome)}`, nome, i * 10]
    );
  }
  for (let i = 0; i < categorie.length; i += 1) {
    const nome = categorie[i];
    await db.execute(
      `INSERT INTO prima_nota_categorie (id, nome, tipo_default, attivo, ordine)
       VALUES ($1, $2, '', 1, $3)
       ON CONFLICT(nome) DO UPDATE SET attivo = 1, ordine = excluded.ordine, updated_at = CURRENT_TIMESTAMP`,
      [`pnc_${slugId(nome)}`, nome, i * 10]
    );
  }
  await insertSyncLog(db, 'prima_nota_conti', 'config', 'REPLACE_OPTIONS', { conti });
  await insertSyncLog(db, 'prima_nota_categorie', 'config', 'REPLACE_OPTIONS', { categorie });
  return { conti, categorie };
}

export async function savePrimaNotaMovimento(input) {
  const payload = normalizePrimaNotaInput(input);
  if (!payload.data_movimento) throw new Error('Inserisci la data movimento.');
  if (!payload.descrizione) throw new Error('Inserisci la descrizione.');
  if (payload.importo <= 0) throw new Error('L’importo deve essere maggiore di zero.');
  if (payload.tipo === 'GIROCONTO') {
    if (!payload.conto_destinazione) throw new Error('Per un giroconto inserisci il conto destinazione.');
    if (payload.conto_destinazione.toLowerCase() === payload.conto.toLowerCase()) throw new Error('Il conto destinazione deve essere diverso dal conto origine.');
  }

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    if (!mem.primaNota) mem.primaNota = [];
    const idx = mem.primaNota.findIndex((m) => m.id === payload.id);
    if (idx >= 0) mem.primaNota[idx] = { ...mem.primaNota[idx], ...payload, updated_at: new Date().toISOString() };
    else mem.primaNota.unshift({ ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return payload;
  }

  const db = await getDb();
  const existing = payload.id ? (await db.select('SELECT auto_generato, modificabile FROM prima_nota WHERE id = $1 LIMIT 1', [payload.id]))?.[0] : null;
  if (existing && Number(existing.auto_generato || 0) === 1 && Number(existing.modificabile || 0) === 0) {
    throw new Error('Questo movimento è automatico. Per modificarlo riapri o aggiorna il pagamento nello Scadenziario.');
  }

  await db.execute(
    `INSERT INTO prima_nota (id, data_movimento, tipo, conto, conto_destinazione, categoria, sottocategoria, descrizione, importo, metodo_pagamento, origine, riferimento_tipo, riferimento_id, fornitore_id, fornitore_nome, note, auto_generato, modificabile)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Manuale', $11, $12, $13, $14, $15, 0, 1)
     ON CONFLICT(id) DO UPDATE SET
       data_movimento = excluded.data_movimento,
       tipo = excluded.tipo,
       conto = excluded.conto,
       conto_destinazione = excluded.conto_destinazione,
       categoria = excluded.categoria,
       sottocategoria = excluded.sottocategoria,
       descrizione = excluded.descrizione,
       importo = excluded.importo,
       metodo_pagamento = excluded.metodo_pagamento,
       riferimento_tipo = excluded.riferimento_tipo,
       riferimento_id = excluded.riferimento_id,
       fornitore_id = excluded.fornitore_id,
       fornitore_nome = excluded.fornitore_nome,
       note = excluded.note,
       updated_at = CURRENT_TIMESTAMP`,
    [payload.id, payload.data_movimento, payload.tipo, payload.conto, payload.conto_destinazione, payload.categoria, payload.sottocategoria, payload.descrizione, payload.importo, payload.metodo_pagamento, payload.riferimento_tipo, payload.riferimento_id, payload.fornitore_id, payload.fornitore_nome, payload.note]
  );
  await insertSyncLog(db, 'prima_nota', payload.id, input?.id ? 'UPDATE_MANUALE' : 'INSERT_MANUALE', payload);
  return payload;
}

export async function deletePrimaNotaMovimento(id) {
  if (!id) throw new Error('ID movimento mancante.');
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const found = (mem.primaNota || []).find((m) => m.id === id);
    if (found?.auto_generato) throw new Error('Non puoi eliminare un movimento automatico dalla Prima Nota.');
    mem.primaNota = (mem.primaNota || []).filter((m) => m.id !== id);
    return true;
  }
  const db = await getDb();
  const rows = await db.select('SELECT auto_generato, modificabile FROM prima_nota WHERE id = $1 LIMIT 1', [id]);
  const mov = rows?.[0];
  if (!mov) return true;
  if (Number(mov.auto_generato || 0) === 1 && Number(mov.modificabile || 0) === 0) {
    throw new Error('Non puoi eliminare un movimento automatico. Riapri la scadenza collegata.');
  }
  await db.execute('DELETE FROM prima_nota WHERE id = $1', [id]);
  await insertSyncLog(db, 'prima_nota', id, 'DELETE_MANUALE', { id });
  return true;
}

export async function rigeneraPrimaNotaDaPagamenti() {
  if (!isTauriRuntime()) return { created: 0, updated: 0, createdOrUpdated: 0, fromPagamenti: 0, fromScadenze: 0, removedOrphans: 0, skipped: 0 };
  const db = await getDb();

  const validScadenzaIds = new Set();
  let created = 0;
  let updated = 0;
  let fromPagamenti = 0;
  let fromScadenze = 0;
  let skipped = 0;

  async function upsertFromScadenza(scad, sourceLabel) {
    const scadenzaId = scad?.id || scad?.scadenza_id;
    if (!scadenzaId) {
      skipped += 1;
      return;
    }
    validScadenzaIds.add(scadenzaId);
    const pnId = `pn_scad_${scadenzaId}`;
    const existing = await db.select('SELECT id FROM prima_nota WHERE id = $1 LIMIT 1', [pnId]);
    await upsertPrimaNotaPagamentoScadenza(
      db,
      { ...scad, id: scadenzaId },
      scad.data_pagamento || today(),
      scad.metodo_pagamento || scad.fattura_metodo || '',
      sourceLabel || 'Rigenerato automaticamente da Scadenziario'
    );
    if (existing?.[0]) updated += 1;
    else created += 1;
  }

  // Fonte primaria: tabella pagamenti. È il dato più corretto quando il pagamento è già stato registrato.
  const pagamenti = await db.select(`
    SELECT
      p.id AS pagamento_id,
      p.scadenza_id AS pagamento_scadenza_id,
      p.fattura_id AS pagamento_fattura_id,
      p.data_pagamento AS pagamento_data,
      p.importo AS pagamento_importo,
      p.metodo_pagamento AS pagamento_metodo,
      p.note AS pagamento_note,
      s.id AS scadenza_id,
      s.fattura_id AS scadenza_fattura_id,
      s.data_scadenza,
      s.importo,
      s.importo_pagato,
      s.stato,
      s.metodo_pagamento,
      s.data_pagamento,
      s.note,
      f.numero,
      f.data_fattura,
      f.fornitore_nome,
      f.metodo_pagamento AS fattura_metodo
    FROM pagamenti p
    LEFT JOIN scadenze s ON s.id = p.scadenza_id
    LEFT JOIN fatture_acquisto f ON f.id = COALESCE(p.fattura_id, s.fattura_id)
    WHERE COALESCE(p.scadenza_id, '') <> ''
    ORDER BY p.data_pagamento DESC, p.created_at DESC
  `);

  const pagamentiProcessedScadenze = new Set();
  for (const row of pagamenti || []) {
    const scadenzaId = row.scadenza_id || row.pagamento_scadenza_id;
    if (!scadenzaId) {
      skipped += 1;
      continue;
    }
    if (pagamentiProcessedScadenze.has(scadenzaId)) {
      skipped += 1;
      continue;
    }
    pagamentiProcessedScadenze.add(scadenzaId);
    await upsertFromScadenza({
      ...row,
      id: scadenzaId,
      fattura_id: row.scadenza_fattura_id || row.pagamento_fattura_id,
      data_pagamento: row.pagamento_data || row.data_pagamento || today(),
      importo_pagato: toNumber(row.pagamento_importo) || toNumber(row.importo_pagato) || toNumber(row.importo),
      importo: toNumber(row.pagamento_importo) || toNumber(row.importo_pagato) || toNumber(row.importo),
      metodo_pagamento: row.pagamento_metodo || row.metodo_pagamento || row.fattura_metodo || '',
      note: row.pagamento_note || row.note || ''
    }, 'Rigenerato automaticamente dalla tabella Pagamenti');
    fromPagamenti += 1;
  }

  // Fallback: scadenze marcate come pagate ma senza riga in pagamenti.
  // Serve per dati importati/vecchie versioni o stati modificati manualmente.
  const scadenzePagate = await db.select(`
    SELECT s.*, f.numero, f.data_fattura, f.fornitore_nome, f.metodo_pagamento AS fattura_metodo
    FROM scadenze s
    LEFT JOIN fatture_acquisto f ON f.id = s.fattura_id
    WHERE (
      s.stato IN ('PAGATO', 'PAGATO_AUTO')
      OR COALESCE(s.importo_pagato, 0) > 0
      OR COALESCE(s.data_pagamento, '') <> ''
    )
    AND NOT EXISTS (SELECT 1 FROM pagamenti p WHERE p.scadenza_id = s.id)
    ORDER BY s.data_pagamento DESC, s.data_scadenza DESC
  `);

  for (const scad of scadenzePagate || []) {
    await upsertFromScadenza(scad, 'Rigenerato automaticamente da Scadenziario');
    fromScadenze += 1;
  }

  let removedOrphans = 0;
  const autos = await db.select(`
    SELECT id, riferimento_id
    FROM prima_nota
    WHERE origine = 'Scadenziario'
      AND riferimento_tipo = 'SCADENZA'
      AND auto_generato = 1
  `);
  for (const mov of autos || []) {
    if (!validScadenzaIds.has(mov.riferimento_id)) {
      await db.execute('DELETE FROM prima_nota WHERE id = $1', [mov.id]);
      removedOrphans += 1;
    }
  }

  const result = { created, updated, createdOrUpdated: created + updated, fromPagamenti, fromScadenze, removedOrphans, skipped };
  await insertSyncLog(db, 'prima_nota', 'rigenera_auto', 'RIGENERA_AUTOMATICI', result);
  return result;
}

// v5 - Controllo Prezzi
function normalizeDescrizione(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeCategoria(value) {
  return normalizeDescrizione(value).toUpperCase();
}

function pezziCartoneDaRiga(r) {
  const n = toNumber(r.pezzi_per_cartone);
  return n > 1 ? n : 1;
}

function quantitaPerUnitaDaRiga(r) {
  const n = toNumber(r.quantita_per_unita);
  return n > 0 ? n : 1;
}

function prezzoUnitarioXmlOriginaleDaRiga(r) {
  return toNumber(r.prezzo_unitario);
}

function prezzoUnitarioScontatoDaRiga(r) {
  const qta = toNumber(r.quantita);
  const totale = toNumber(r.totale_riga);

  // Per controllo prezzi e food cost il valore corretto è il costo reale della riga,
  // quindi PrezzoTotale / Quantita. In questo modo vengono considerati sconti,
  // maggiorazioni e prezzi già netti indicati nell'XML.
  if (qta > 0 && Number.isFinite(totale) && totale >= 0) return totale / qta;

  // Fallback per righe anomale senza quantità o totale.
  return prezzoUnitarioXmlOriginaleDaRiga(r);
}

function prezzoUnitarioDaRiga(r) {
  const prezzoScontato = prezzoUnitarioScontatoDaRiga(r);
  const pezziCartone = pezziCartoneDaRiga(r);
  const quantitaPerUnita = quantitaPerUnitaDaRiga(r);
  return prezzoScontato / Math.max(1, pezziCartone) / Math.max(0.000001, quantitaPerUnita);
}

function sameNormalizedDescription(a, b) {
  return normalizeDescrizione(a).toLowerCase() === normalizeDescrizione(b).toLowerCase();
}

async function updateRigheForMapping(db, { descrizione, fornitoreId, prodottoId, categoria, umBase }) {
  const rows = await db.select(
    `SELECT r.id, r.descrizione_originale, f.fornitore_id
     FROM fatture_acquisto_righe r
     LEFT JOIN fatture_acquisto f ON f.id = r.fattura_id
     WHERE COALESCE(r.prodotto_id, '') = ''
       AND ($1 = '' OR COALESCE(f.fornitore_id, '') = $1)`,
    [fornitoreId || '']
  );

  const matchingIds = (rows || [])
    .filter((r) => sameNormalizedDescription(r.descrizione_originale, descrizione))
    .map((r) => r.id);

  for (const id of matchingIds) {
    await db.execute(
      `UPDATE fatture_acquisto_righe
       SET prodotto_id = $1,
           categoria = $2,
           um = CASE WHEN COALESCE(um, '') = '' THEN $3 ELSE um END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [prodottoId, categoria, umBase, id]
    );
  }
  return matchingIds.length;
}

async function applySavedProductMappings(db) {
  const mappings = await db.select(
    `SELECT m.descrizione_originale, COALESCE(m.fornitore_id, '') AS fornitore_id, m.prodotto_id,
            p.categoria, p.um_base, p.quantita_per_unita
     FROM prodotti_mapping m
     JOIN prodotti p ON p.id = m.prodotto_id
     WHERE COALESCE(m.prodotto_id, '') <> ''`
  );
  if (!mappings?.length) return 0;

  const rows = await db.select(
    `SELECT r.id, r.descrizione_originale, COALESCE(f.fornitore_id, '') AS fornitore_id
     FROM fatture_acquisto_righe r
     LEFT JOIN fatture_acquisto f ON f.id = r.fattura_id
     WHERE COALESCE(r.prodotto_id, '') = ''
     LIMIT 10000`
  );
  if (!rows?.length) return 0;

  const byKey = new Map();
  const generic = [];
  for (const m of mappings) {
    const key = `${m.fornitore_id || ''}__${normalizeDescrizione(m.descrizione_originale).toLowerCase()}`;
    if (m.fornitore_id) byKey.set(key, m);
    else generic.push(m);
  }

  let updated = 0;
  for (const r of rows) {
    const descrKey = normalizeDescrizione(r.descrizione_originale).toLowerCase();
    const mapping = byKey.get(`${r.fornitore_id || ''}__${descrKey}`) || generic.find((m) => sameNormalizedDescription(m.descrizione_originale, r.descrizione_originale));
    if (!mapping) continue;
    await db.execute(
      `UPDATE fatture_acquisto_righe
       SET prodotto_id = $1,
           categoria = $2,
           um = CASE WHEN COALESCE(um, '') = '' THEN $3 ELSE um END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [mapping.prodotto_id, normalizeCategoria(mapping.categoria), normalizeDescrizione(mapping.um_base || ''), r.id]
    );
    updated += 1;
  }
  return updated;
}

function buildPrezziPayload(righe, prodotti = []) {
  const grouped = new Map();
  for (const r of righe) {
    const prezzo = prezzoUnitarioDaRiga(r);
    if (!prezzo) continue;
    const key = r.prodotto_id ? `prod:${r.prodotto_id}` : `raw:${r.fornitore_id || ''}:${normalizeDescrizione(r.descrizione_originale).toLowerCase()}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        prodotto_id: r.prodotto_id || '',
        nome: r.prodotto_nome || normalizeDescrizione(r.descrizione_originale),
        descrizione_originale: normalizeDescrizione(r.descrizione_originale),
        categoria: normalizeCategoria(r.prodotto_categoria || r.categoria || ''),
        um: r.um_base || r.um || '',
        pezzi_per_cartone: pezziCartoneDaRiga(r),
        quantita_per_unita: quantitaPerUnitaDaRiga(r),
        um_acquisto_default: r.um_acquisto_default || '',
        note_conversione: r.note_conversione || '',
        mappato: Boolean(r.prodotto_id),
        righe: []
      });
    }
    grouped.get(key).righe.push({
      ...r,
      prezzo_unitario_xml_originale: prezzoUnitarioXmlOriginaleDaRiga(r),
      prezzo_unitario_scontato: prezzoUnitarioScontatoDaRiga(r),
      // Alias mantenuto per compatibilità UI/CSV: ora indica il prezzo unitario netto scontato.
      prezzo_unitario_xml: prezzoUnitarioScontatoDaRiga(r),
      pezzi_per_cartone: pezziCartoneDaRiga(r),
      quantita_per_unita: quantitaPerUnitaDaRiga(r),
      prezzo_unitario_effettivo: prezzo
    });
  }

  const prodottiPrezzo = Array.from(grouped.values()).map((g) => {
    const rows = g.righe.sort((a, b) => String(b.data_fattura || '').localeCompare(String(a.data_fattura || '')) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const prezzi = rows.map((r) => r.prezzo_unitario_effettivo).filter((n) => Number.isFinite(n) && n > 0);
    const ultimo = rows[0];
    const precedente = rows.find((r, idx) => idx > 0 && r.prezzo_unitario_effettivo !== ultimo.prezzo_unitario_effettivo) || rows[1];
    const ultimoPrezzo = ultimo?.prezzo_unitario_effettivo || 0;
    const prezzoPrecedente = precedente?.prezzo_unitario_effettivo || 0;
    const delta = prezzoPrecedente ? ((ultimoPrezzo - prezzoPrecedente) / prezzoPrecedente) * 100 : 0;
    return {
      ...g,
      righe_count: rows.length,
      ultimo_prezzo: ultimoPrezzo,
      data_ultimo: ultimo?.data_fattura || '',
      fornitore_ultimo: ultimo?.fornitore_nome || '',
      prezzo_precedente: prezzoPrecedente,
      data_precedente: precedente?.data_fattura || '',
      delta_percent: delta,
      prezzo_medio: prezzi.reduce((a, b) => a + b, 0) / Math.max(prezzi.length, 1),
      prezzo_min: prezzi.length ? Math.min(...prezzi) : 0,
      prezzo_max: prezzi.length ? Math.max(...prezzi) : 0,
      righe: rows.slice(0, 10)
    };
  }).sort((a, b) => Math.abs(b.delta_percent || 0) - Math.abs(a.delta_percent || 0));

  const notMappedMap = new Map();
  for (const r of righe.filter((x) => !x.prodotto_id)) {
    const descr = normalizeDescrizione(r.descrizione_originale);
    if (!descr) continue;
    const key = `${r.fornitore_id || ''}__${descr.toLowerCase()}`;
    const prezzo = prezzoUnitarioDaRiga(r);
    const current = notMappedMap.get(key) || {
      key,
      descrizione_originale: descr,
      fornitore_id: r.fornitore_id || '',
      fornitore_nome: r.fornitore_nome || '',
      um: r.um || '',
      categoria: normalizeCategoria(r.categoria || ''),
      righe_count: 0,
      ultimo_prezzo: 0,
      data_ultimo: '',
      esempio_fattura: ''
    };
    current.righe_count += 1;
    if (!current.data_ultimo || String(r.data_fattura || '') > String(current.data_ultimo || '')) {
      current.ultimo_prezzo = prezzo;
      current.data_ultimo = r.data_fattura || '';
      current.esempio_fattura = r.numero || '';
      current.um = r.um || current.um;
    }
    notMappedMap.set(key, current);
  }

  const righePrezzi = righe.map((r) => ({
    ...r,
    pezzi_per_cartone: pezziCartoneDaRiga(r),
    quantita_per_unita: quantitaPerUnitaDaRiga(r),
    prezzo_unitario_xml_originale: prezzoUnitarioXmlOriginaleDaRiga(r),
    prezzo_unitario_scontato: prezzoUnitarioScontatoDaRiga(r),
    // Alias mantenuto per compatibilità UI/CSV: ora indica il prezzo unitario netto scontato.
    prezzo_unitario_xml: prezzoUnitarioScontatoDaRiga(r),
    prezzo_unitario_effettivo: prezzoUnitarioDaRiga(r)
  }));

  return {
    prodotti: prodottiPrezzo,
    nonMappati: Array.from(notMappedMap.values()).sort((a, b) => b.righe_count - a.righe_count || a.descrizione_originale.localeCompare(b.descrizione_originale)),
    righe: righePrezzi.sort((a, b) => String(b.data_fattura || '').localeCompare(String(a.data_fattura || ''))),
    anagraficaProdotti: prodotti
  };
}


// v9.0 - Fonti dati mancanti per Controllo di Gestione
function normalizeIncassoCassaInput(input = {}) {
  const contanti = toNumber(input.contanti);
  const pos = toNumber(input.pos ?? input.bancomat ?? input.riscossi);
  const carta_credito = toNumber(input.carta_credito);
  const ticket = toNumber(input.ticket);
  const delivery = toNumber(input.delivery);
  const altro = toNumber(input.altro);
  const non_riscosso = toNumber(input.non_riscosso ?? input.nonRiscosso);
  const totaleManuale = toNumber(input.totale);
  const totale = totaleManuale || contanti + pos + carta_credito + ticket + delivery + altro + non_riscosso;
  return {
    id: input.id || `inc_${String(input.data_incasso || today()).replaceAll('-', '')}`,
    data_incasso: input.data_incasso || input.data || today(),
    contanti,
    pos,
    carta_credito,
    ticket,
    delivery,
    altro,
    non_riscosso,
    totale,
    iva_10: toNumber(input.iva_10 ?? input.iva10),
    iva_22: toNumber(input.iva_22 ?? input.iva22),
    fatture_da: String(input.fatture_da || input.fattureDa || ''),
    fatture_a: String(input.fatture_a || input.fattureA || ''),
    origine_import: input.origine_import || input.origine || 'Manuale',
    nome_file: input.nome_file || input.file || '',
    note: input.note || ''
  };
}

function normalizeBustaPagaInput(input = {}) {
  const mese = String(input.mese || input.periodo || '').slice(0, 7);
  const dipendente = String(input.dipendente || input.nome || input.employee || '').trim();
  const costo = toNumber(input.costo_azienda ?? input.costoAzienda ?? input.costo_totale ?? input.totale_costo);
  const id = input.id || `bp_${mese.replace('-', '')}_${slugId(dipendente)}`;
  return {
    id,
    mese,
    dipendente,
    lordo: toNumber(input.lordo),
    netto: toNumber(input.netto),
    contributi_inps: toNumber(input.contributi_inps ?? input.inps ?? input.contributi),
    irpef: toNumber(input.irpef),
    tfr: toNumber(input.tfr),
    costo_azienda: costo || toNumber(input.lordo) + toNumber(input.contributi_inps ?? input.inps ?? input.contributi) + toNumber(input.tfr),
    data_pagamento: input.data_pagamento || input.dataPagamento || '',
    metodo_pagamento: input.metodo_pagamento || input.metodoPagamento || 'Bonifico',
    origine_import: input.origine_import || input.origine || 'Manuale',
    nome_file: input.nome_file || input.file || '',
    note: input.note || ''
  };
}

function normalizeF24Input(input = {}) {
  const tipo = String(input.tipo || input.categoria || 'ALTRO').trim().toUpperCase();
  return {
    id: input.id || uid('f24'),
    data_pagamento: input.data_pagamento || input.dataPagamento || input.data || today(),
    periodo_competenza: String(input.periodo_competenza || input.periodo || '').slice(0, 7),
    tipo,
    importo: toNumber(input.importo || input.totale),
    metodo_pagamento: input.metodo_pagamento || input.metodoPagamento || 'Bonifico',
    origine_import: input.origine_import || input.origine || 'Manuale',
    nome_file: input.nome_file || input.file || '',
    note: input.note || ''
  };
}

async function recreatePrimaNotaForIncasso(db, incasso) {
  await db.execute("DELETE FROM prima_nota WHERE origine = 'Incassi' AND riferimento_tipo = 'INCASSO_CASSA' AND riferimento_id = $1", [incasso.id]);
  const lines = [
    ['contanti', incasso.contanti, 'Cassa contanti', 'Contanti'],
    ['pos', incasso.pos, 'Bancomat/POS', 'POS'],
    ['carta_credito', incasso.carta_credito, 'Carta di credito', 'Carta credito'],
    ['ticket', incasso.ticket, 'Ticket', 'Ticket'],
    ['delivery', incasso.delivery, 'Delivery', 'Delivery'],
    ['altro', incasso.altro, 'Altro', 'Altro']
  ];
  let created = 0;
  for (const [key, amount, conto, sotto] of lines) {
    if (toNumber(amount) <= 0) continue;
    const movimento = normalizePrimaNotaInput({
      id: `pn_inc_${incasso.id}_${key}`,
      data_movimento: incasso.data_incasso,
      tipo: 'ENTRATA',
      conto,
      categoria: 'Incassi bar',
      sottocategoria: sotto,
      descrizione: `Incasso ${sotto} del ${incasso.data_incasso}`,
      importo: amount,
      metodo_pagamento: sotto,
      origine: 'Incassi',
      riferimento_tipo: 'INCASSO_CASSA',
      riferimento_id: incasso.id,
      note: incasso.note || 'Generato automaticamente da chiusura giornata',
      auto_generato: 1,
      modificabile: 0
    });
    await db.execute(
      `INSERT INTO prima_nota (id, data_movimento, tipo, conto, conto_destinazione, categoria, sottocategoria, descrizione, importo, metodo_pagamento, origine, riferimento_tipo, riferimento_id, note, auto_generato, modificabile)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1,0)
       ON CONFLICT(id) DO UPDATE SET data_movimento=excluded.data_movimento,tipo=excluded.tipo,conto=excluded.conto,conto_destinazione=excluded.conto_destinazione,categoria=excluded.categoria,sottocategoria=excluded.sottocategoria,descrizione=excluded.descrizione,importo=excluded.importo,metodo_pagamento=excluded.metodo_pagamento,origine=excluded.origine,riferimento_tipo=excluded.riferimento_tipo,riferimento_id=excluded.riferimento_id,note=excluded.note,auto_generato=1,modificabile=0,updated_at=CURRENT_TIMESTAMP`,
      [movimento.id, movimento.data_movimento, movimento.tipo, movimento.conto, movimento.conto_destinazione, movimento.categoria, movimento.sottocategoria, movimento.descrizione, movimento.importo, movimento.metodo_pagamento, movimento.origine, movimento.riferimento_tipo, movimento.riferimento_id, movimento.note]
    );
    created += 1;
  }
  return created;
}

async function upsertPrimaNotaSimpleFonte(db, { id, data, tipo, conto, categoria, sottocategoria, descrizione, importo, metodo, origine, riferimentoTipo, riferimentoId, note }) {
  const movimento = normalizePrimaNotaInput({
    id,
    data_movimento: data,
    tipo,
    conto,
    categoria,
    sottocategoria,
    descrizione,
    importo,
    metodo_pagamento: metodo,
    origine,
    riferimento_tipo: riferimentoTipo,
    riferimento_id: riferimentoId,
    note,
    auto_generato: 1,
    modificabile: 0
  });
  await db.execute(
    `INSERT INTO prima_nota (id, data_movimento, tipo, conto, conto_destinazione, categoria, sottocategoria, descrizione, importo, metodo_pagamento, origine, riferimento_tipo, riferimento_id, note, auto_generato, modificabile)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,1,0)
     ON CONFLICT(id) DO UPDATE SET data_movimento=excluded.data_movimento,tipo=excluded.tipo,conto=excluded.conto,conto_destinazione=excluded.conto_destinazione,categoria=excluded.categoria,sottocategoria=excluded.sottocategoria,descrizione=excluded.descrizione,importo=excluded.importo,metodo_pagamento=excluded.metodo_pagamento,origine=excluded.origine,riferimento_tipo=excluded.riferimento_tipo,riferimento_id=excluded.riferimento_id,note=excluded.note,auto_generato=1,modificabile=0,updated_at=CURRENT_TIMESTAMP`,
    [movimento.id, movimento.data_movimento, movimento.tipo, movimento.conto, movimento.conto_destinazione, movimento.categoria, movimento.sottocategoria, movimento.descrizione, movimento.importo, movimento.metodo_pagamento, movimento.origine, movimento.riferimento_tipo, movimento.riferimento_id, movimento.note]
  );
  return movimento;
}

async function recreatePrimaNotaForBusta(db, busta) {
  await upsertPrimaNotaSimpleFonte(db, {
    id: `pn_bp_${busta.id}`,
    data: busta.data_pagamento || `${busta.mese}-28`,
    tipo: 'USCITA',
    conto: 'Banca',
    categoria: 'Personale',
    sottocategoria: busta.dipendente,
    descrizione: `Costo personale ${busta.dipendente} ${busta.mese}`,
    importo: busta.costo_azienda,
    metodo: busta.metodo_pagamento || 'Bonifico',
    origine: 'Buste paga',
    riferimentoTipo: 'BUSTA_PAGA',
    riferimentoId: busta.id,
    note: busta.note || 'Generato automaticamente da costo personale'
  });
}

async function recreatePrimaNotaForF24(db, f24) {
  await upsertPrimaNotaSimpleFonte(db, {
    id: `pn_f24_${f24.id}`,
    data: f24.data_pagamento,
    tipo: 'USCITA',
    conto: 'Banca',
    categoria: 'F24 / Tributi',
    sottocategoria: f24.tipo,
    descrizione: `F24 ${f24.tipo}${f24.periodo_competenza ? ` periodo ${f24.periodo_competenza}` : ''}`,
    importo: f24.importo,
    metodo: f24.metodo_pagamento || 'Bonifico',
    origine: 'F24',
    riferimentoTipo: 'F24',
    riferimentoId: f24.id,
    note: f24.note || 'Generato automaticamente da versamento F24'
  });
}

function gestioneTotals({ incassi = [], buste = [], f24 = [] }) {
  const ricavi = incassi.reduce((sum, r) => sum + toNumber(r.totale), 0);
  const personale = buste.reduce((sum, r) => sum + toNumber(r.costo_azienda), 0);
  const tributi = f24.reduce((sum, r) => sum + toNumber(r.importo), 0);
  return { ricavi, personale, f24: tributi, nettoFonti: ricavi - personale - tributi };
}

export async function getGestioneData() {
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const incassi = mem.incassiCassa || [];
    const buste = mem.bustePaga || [];
    const f24 = mem.versamentiF24 || [];
    const fatture = mem.fatture || [];
    const fattureVendita = mem.fattureVendita || [];
    const movimenti = mem.primaNota || [];
    const ce = buildContoEconomicoConfronto({ mese: currentMonthKey(), incassi, buste, f24, fatture, fattureVendita, movimenti });
    return { incassi, buste, f24, fatture, fattureVendita, movimenti, totals: gestioneTotals({ incassi, buste, f24 }), ce };
  }
  const db = await getDb();
  const [incassi, buste, f24, fatture, fattureVendita, movimenti] = await Promise.all([
    db.select('SELECT * FROM incassi_cassa ORDER BY data_incasso DESC LIMIT 1500'),
    db.select('SELECT * FROM buste_paga ORDER BY mese DESC, dipendente ASC LIMIT 1500'),
    db.select('SELECT * FROM versamenti_f24 ORDER BY data_pagamento DESC LIMIT 1500'),
    db.select('SELECT id, data_fattura, fornitore_nome, numero, imponibile, iva, totale, stato FROM fatture_acquisto ORDER BY data_fattura DESC LIMIT 2500'),
    db.select('SELECT id, data_fattura, cliente_nome, numero, imponibile, iva, totale, stato, xml_nome_file FROM fatture_vendita ORDER BY data_fattura DESC LIMIT 2500'),
    db.select('SELECT * FROM prima_nota ORDER BY data_movimento DESC, created_at DESC LIMIT 2500')
  ]);
  const ce = buildContoEconomicoConfronto({ mese: currentMonthKey(), incassi, buste, f24, fatture, fattureVendita, movimenti });
  return { incassi, buste, f24, fatture, fattureVendita, movimenti, totals: gestioneTotals({ incassi, buste, f24 }), ce };
}

export async function saveIncassoCassa(input) {
  const payload = normalizeIncassoCassaInput(input);
  if (!payload.data_incasso) throw new Error('Inserisci la data incasso.');
  if (payload.totale <= 0) throw new Error('Il totale incasso deve essere maggiore di zero.');
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    mem.incassiCassa = (mem.incassiCassa || []).filter((x) => x.id !== payload.id && x.data_incasso !== payload.data_incasso);
    mem.incassiCassa.unshift(payload);
    return payload;
  }
  const db = await getDb();
  await db.execute(
    `INSERT INTO incassi_cassa (id,data_incasso,contanti,pos,carta_credito,ticket,delivery,altro,non_riscosso,totale,iva_10,iva_22,fatture_da,fatture_a,origine_import,nome_file,note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT(data_incasso) DO UPDATE SET contanti=excluded.contanti,pos=excluded.pos,carta_credito=excluded.carta_credito,ticket=excluded.ticket,delivery=excluded.delivery,altro=excluded.altro,non_riscosso=excluded.non_riscosso,totale=excluded.totale,iva_10=excluded.iva_10,iva_22=excluded.iva_22,fatture_da=excluded.fatture_da,fatture_a=excluded.fatture_a,origine_import=excluded.origine_import,nome_file=excluded.nome_file,note=excluded.note,updated_at=CURRENT_TIMESTAMP`,
    [payload.id,payload.data_incasso,payload.contanti,payload.pos,payload.carta_credito,payload.ticket,payload.delivery,payload.altro,payload.non_riscosso,payload.totale,payload.iva_10,payload.iva_22,payload.fatture_da,payload.fatture_a,payload.origine_import,payload.nome_file,payload.note]
  );
  const rows = await db.select('SELECT * FROM incassi_cassa WHERE data_incasso = $1 LIMIT 1', [payload.data_incasso]);
  const saved = rows?.[0] || payload;
  await recreatePrimaNotaForIncasso(db, saved);
  await insertSyncLog(db, 'incassi_cassa', saved.id, input?.id ? 'UPDATE' : 'UPSERT', saved);
  return saved;
}

export async function importIncassiCassa(rows = []) {
  const items = Array.isArray(rows) ? rows : [];
  let imported = 0;
  for (const row of items) {
    const payload = normalizeIncassoCassaInput({ ...row, origine_import: row.origine_import || 'XLSX corrispettivi' });
    if (!payload.data_incasso || payload.totale <= 0) continue;
    await saveIncassoCassa(payload);
    imported += 1;
  }
  return { imported, skipped: items.length - imported };
}

export async function deleteIncassoCassa(id) {
  if (!id) throw new Error('ID incasso mancante.');
  if (!isTauriRuntime()) return true;
  const db = await getDb();
  await db.execute('DELETE FROM prima_nota WHERE origine = \'Incassi\' AND riferimento_tipo = \'INCASSO_CASSA\' AND riferimento_id = $1', [id]);
  await db.execute('DELETE FROM incassi_cassa WHERE id = $1', [id]);
  await insertSyncLog(db, 'incassi_cassa', id, 'DELETE', { id });
  return true;
}

export async function saveBustaPaga(input) {
  const payload = normalizeBustaPagaInput(input);
  if (!payload.mese) throw new Error('Inserisci il mese della busta paga.');
  if (!payload.dipendente) throw new Error('Inserisci il dipendente.');
  if (payload.costo_azienda <= 0) throw new Error('Inserisci il costo azienda totale.');
  if (!isTauriRuntime()) return payload;
  const db = await getDb();
  await db.execute(
    `INSERT INTO buste_paga (id,mese,dipendente,lordo,netto,contributi_inps,irpef,tfr,costo_azienda,data_pagamento,metodo_pagamento,origine_import,nome_file,note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT(mese,dipendente) DO UPDATE SET lordo=excluded.lordo,netto=excluded.netto,contributi_inps=excluded.contributi_inps,irpef=excluded.irpef,tfr=excluded.tfr,costo_azienda=excluded.costo_azienda,data_pagamento=excluded.data_pagamento,metodo_pagamento=excluded.metodo_pagamento,origine_import=excluded.origine_import,nome_file=excluded.nome_file,note=excluded.note,updated_at=CURRENT_TIMESTAMP`,
    [payload.id,payload.mese,payload.dipendente,payload.lordo,payload.netto,payload.contributi_inps,payload.irpef,payload.tfr,payload.costo_azienda,payload.data_pagamento,payload.metodo_pagamento,payload.origine_import,payload.nome_file,payload.note]
  );
  const rows = await db.select('SELECT * FROM buste_paga WHERE mese = $1 AND dipendente = $2 LIMIT 1', [payload.mese, payload.dipendente]);
  const saved = rows?.[0] || payload;
  await recreatePrimaNotaForBusta(db, saved);
  await insertSyncLog(db, 'buste_paga', saved.id, input?.id ? 'UPDATE' : 'UPSERT', saved);
  return saved;
}

export async function importBustePagaJson(rows = []) {
  const list = Array.isArray(rows) ? rows : (Array.isArray(rows?.buste_paga) ? rows.buste_paga : []);
  let imported = 0;
  for (const item of list) {
    const payload = normalizeBustaPagaInput({ ...item, origine_import: item.origine_import || 'JSON lettura PDF buste paga' });
    if (!payload.mese || !payload.dipendente || payload.costo_azienda <= 0) continue;
    await saveBustaPaga(payload);
    imported += 1;
  }
  return { imported, skipped: list.length - imported };
}

export async function deleteBustaPaga(id) {
  if (!id) throw new Error('ID busta paga mancante.');
  if (!isTauriRuntime()) return true;
  const db = await getDb();
  await db.execute('DELETE FROM prima_nota WHERE origine = \'Buste paga\' AND riferimento_tipo = \'BUSTA_PAGA\' AND riferimento_id = $1', [id]);
  await db.execute('DELETE FROM buste_paga WHERE id = $1', [id]);
  await insertSyncLog(db, 'buste_paga', id, 'DELETE', { id });
  return true;
}

export async function saveVersamentoF24(input) {
  const payload = normalizeF24Input(input);
  if (!payload.data_pagamento) throw new Error('Inserisci la data pagamento F24.');
  if (payload.importo <= 0) throw new Error('Inserisci un importo F24 maggiore di zero.');
  if (!isTauriRuntime()) return payload;
  const db = await getDb();
  await db.execute(
    `INSERT INTO versamenti_f24 (id,data_pagamento,periodo_competenza,tipo,importo,metodo_pagamento,origine_import,nome_file,note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(id) DO UPDATE SET data_pagamento=excluded.data_pagamento,periodo_competenza=excluded.periodo_competenza,tipo=excluded.tipo,importo=excluded.importo,metodo_pagamento=excluded.metodo_pagamento,origine_import=excluded.origine_import,nome_file=excluded.nome_file,note=excluded.note,updated_at=CURRENT_TIMESTAMP`,
    [payload.id,payload.data_pagamento,payload.periodo_competenza,payload.tipo,payload.importo,payload.metodo_pagamento,payload.origine_import,payload.nome_file,payload.note]
  );
  const rows = await db.select('SELECT * FROM versamenti_f24 WHERE id = $1 LIMIT 1', [payload.id]);
  const saved = rows?.[0] || payload;
  await recreatePrimaNotaForF24(db, saved);
  await insertSyncLog(db, 'versamenti_f24', saved.id, input?.id ? 'UPDATE' : 'INSERT', saved);
  return saved;
}

export async function importF24Json(rows = []) {
  const list = Array.isArray(rows) ? rows : (Array.isArray(rows?.f24) ? rows.f24 : []);
  let imported = 0;
  for (const item of list) {
    const payload = normalizeF24Input({ ...item, origine_import: item.origine_import || 'JSON lettura PDF F24' });
    if (!payload.data_pagamento || payload.importo <= 0) continue;
    await saveVersamentoF24(payload);
    imported += 1;
  }
  return { imported, skipped: list.length - imported };
}

export async function deleteVersamentoF24(id) {
  if (!id) throw new Error('ID F24 mancante.');
  if (!isTauriRuntime()) return true;
  const db = await getDb();
  await db.execute('DELETE FROM prima_nota WHERE origine = \'F24\' AND riferimento_tipo = \'F24\' AND riferimento_id = $1', [id]);
  await db.execute('DELETE FROM versamenti_f24 WHERE id = $1', [id]);
  await insertSyncLog(db, 'versamenti_f24', id, 'DELETE', { id });
  return true;
}

export async function getControlloPrezziData() {
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    return buildPrezziPayload(mem.righe || [], mem.prodotti || []);
  }
  const db = await getDb();
  await applySavedProductMappings(db);
  const [righe, prodotti] = await Promise.all([
    db.select(`
      SELECT r.*, f.fornitore_id, f.fornitore_nome, f.numero, f.data_fattura, f.xml_nome_file, p.nome as prodotto_nome, p.categoria as prodotto_categoria, p.um_base, p.pezzi_per_cartone, p.quantita_per_unita, p.um_acquisto_default, p.note_conversione
      FROM fatture_acquisto_righe r
      LEFT JOIN fatture_acquisto f ON f.id = r.fattura_id
      LEFT JOIN prodotti p ON p.id = r.prodotto_id
      ORDER BY f.data_fattura DESC, f.fornitore_nome ASC, r.numero_linea ASC
      LIMIT 5000
    `),
    db.select('SELECT * FROM prodotti WHERE attivo = 1 ORDER BY nome ASC')
  ]);
  return buildPrezziPayload(righe || [], prodotti || []);
}


function buildFoodCostPayload(prodottiPrezzi, ricette = [], ingredienti = []) {
  const mappedProducts = prodottiPrezzi
    .filter((p) => p.mappato && p.prodotto_id)
    .map((p) => ({
      id: p.prodotto_id,
      nome: p.nome,
      categoria: p.categoria || '',
      um_base: p.um || p.um_base || '',
      ultimo_prezzo: toNumber(p.ultimo_prezzo),
      prezzo_medio: toNumber(p.prezzo_medio),
      prezzo_max: toNumber(p.prezzo_max),
      prezzo_min: toNumber(p.prezzo_min),
      fornitore_ultimo: p.fornitore_ultimo || '',
      data_ultimo: p.data_ultimo || '',
      righe_count: p.righe_count || 0,
      pezzi_per_cartone: p.pezzi_per_cartone || 1,
      quantita_per_unita: p.quantita_per_unita || 1,
      delta_percent: toNumber(p.delta_percent),
      prezzo_precedente: toNumber(p.prezzo_precedente)
    }))
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

  const productMap = new Map(mappedProducts.map((p) => [p.id, p]));
  const ingByRecipe = new Map();
  for (const ing of ingredienti || []) {
    const list = ingByRecipe.get(ing.ricetta_id) || [];
    const product = productMap.get(ing.prodotto_id) || {};
    list.push({ ...ing, prodotto: product });
    ingByRecipe.set(ing.ricetta_id, list);
  }

  const ricetteCalcolate = (ricette || []).map((r) => {
    const metodo = r.metodo_costo || 'ULTIMO';
    const ings = (ingByRecipe.get(r.id) || []).map((ing) => {
      const p = ing.prodotto || {};
      const override = toNumber(ing.costo_unitario_override);
      const unitCost = override > 0
        ? override
        : metodo === 'MEDIO'
          ? toNumber(p.prezzo_medio)
          : metodo === 'MAX'
            ? toNumber(p.prezzo_max)
            : toNumber(p.ultimo_prezzo);
      const qty = toNumber(ing.quantita);
      const total = qty * unitCost;
      return {
        ...ing,
        prodotto_nome: p.nome || '',
        prodotto_categoria: p.categoria || '',
        um_base: p.um_base || ing.um || '',
        costo_unitario: unitCost,
        costo_totale: total
      };
    });
    const costoTotale = ings.reduce((sum, ing) => sum + toNumber(ing.costo_totale), 0);
    const porzioni = Math.max(1, toNumber(r.porzioni || 1));
    const costoPorzione = costoTotale / porzioni;
    const costiFissiPercent = toNumber(r.costi_fissi_percent ?? 40);
    const quotaCostiFissi = costoPorzione * (costiFissiPercent / 100);
    const costoGestionale = costoPorzione + quotaCostiFissi;
    const prezzoVendita = toNumber(r.prezzo_vendita);
    const foodCost = prezzoVendita > 0 ? (costoPorzione / prezzoVendita) * 100 : 0;
    const foodCostGestionale = prezzoVendita > 0 ? (costoGestionale / prezzoVendita) * 100 : 0;
    const margineLordo = prezzoVendita - costoPorzione;
    const margineGestionale = prezzoVendita - costoGestionale;
    const marginePercent = prezzoVendita > 0 ? (margineLordo / prezzoVendita) * 100 : 0;
    const margineGestionalePercent = prezzoVendita > 0 ? (margineGestionale / prezzoVendita) * 100 : 0;
    return {
      ...r,
      ingredienti: ings,
      costo_totale: costoTotale,
      costo_porzione: costoPorzione,
      costi_fissi_percent: costiFissiPercent,
      quota_costi_fissi: quotaCostiFissi,
      costo_gestionale: costoGestionale,
      food_cost_percent: foodCost,
      food_cost_gestionale_percent: foodCostGestionale,
      margine_lordo: margineLordo,
      margine_gestionale: margineGestionale,
      margine_percent: marginePercent,
      margine_gestionale_percent: margineGestionalePercent
    };
  }).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

  return { ricette: ricetteCalcolate, prodotti: mappedProducts };
}

export async function getFoodCostData() {
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const prezziPayload = buildPrezziPayload(mem.righe || [], mem.prodotti || []);
    return buildFoodCostPayload(prezziPayload.prodotti || [], mem.ricette || [], mem.ricetteIngredienti || []);
  }
  const db = await getDb();
  await applySavedProductMappings(db);
  const [righe, prodotti, ricette, ingredienti] = await Promise.all([
    db.select(`
      SELECT r.*, f.fornitore_id, f.fornitore_nome, f.numero, f.data_fattura, p.nome as prodotto_nome, p.categoria as prodotto_categoria, p.um_base, p.pezzi_per_cartone, p.quantita_per_unita, p.um_acquisto_default, p.note_conversione
      FROM fatture_acquisto_righe r
      LEFT JOIN fatture_acquisto f ON f.id = r.fattura_id
      LEFT JOIN prodotti p ON p.id = r.prodotto_id
      ORDER BY f.data_fattura DESC, r.numero_linea ASC
      LIMIT 5000
    `),
    db.select('SELECT * FROM prodotti WHERE attivo = 1 ORDER BY nome ASC'),
    db.select('SELECT * FROM ricette WHERE attiva = 1 ORDER BY nome ASC'),
    db.select('SELECT * FROM ricette_ingredienti ORDER BY created_at ASC')
  ]);
  const prezziPayload = buildPrezziPayload(righe || [], prodotti || []);
  return buildFoodCostPayload(prezziPayload.prodotti || [], ricette || [], ingredienti || []);
}

export async function saveRicettaFoodCost(input) {
  const ricettaId = input.id || uid('ric');
  const nome = normalizeDescrizione(input.nome);
  const categoria = normalizeCategoria(input.categoria || 'MENU');
  const prezzoVendita = toNumber(input.prezzo_vendita);
  const porzioni = Math.max(1, toNumber(input.porzioni || 1));
  const metodoCosto = ['ULTIMO', 'MEDIO', 'MAX'].includes(input.metodo_costo) ? input.metodo_costo : 'ULTIMO';
  const costiFissiPercent = Math.max(0, toNumber(input.costi_fissi_percent ?? 40));
  const note = String(input.note || '').trim();
  const ingredienti = Array.isArray(input.ingredienti) ? input.ingredienti : [];

  if (!nome) throw new Error('Inserisci il nome della ricetta/prodotto finito.');
  if (prezzoVendita <= 0) throw new Error('Inserisci un prezzo vendita maggiore di zero.');
  if (!ingredienti.length) throw new Error('Aggiungi almeno un ingrediente.');

  const normalizedIngredients = ingredienti
    .map((ing) => ({
      id: ing.id || uid('ing'),
      ricetta_id: ricettaId,
      prodotto_id: ing.prodotto_id || '',
      quantita: toNumber(ing.quantita),
      um: normalizeDescrizione(ing.um || ''),
      costo_unitario_override: ing.costo_unitario_override === '' || ing.costo_unitario_override === null || ing.costo_unitario_override === undefined ? null : toNumber(ing.costo_unitario_override)
    }))
    .filter((ing) => ing.prodotto_id && ing.quantita > 0);

  if (!normalizedIngredients.length) throw new Error('Gli ingredienti devono avere prodotto e quantità maggiore di zero.');

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    if (!mem.ricette) mem.ricette = [];
    if (!mem.ricetteIngredienti) mem.ricetteIngredienti = [];
    const payload = { id: ricettaId, nome, categoria, prezzo_vendita: prezzoVendita, porzioni, metodo_costo: metodoCosto, costi_fissi_percent: costiFissiPercent, attiva: 1, note };
    const idx = mem.ricette.findIndex((r) => r.id === ricettaId);
    if (idx >= 0) mem.ricette[idx] = { ...mem.ricette[idx], ...payload };
    else mem.ricette.push(payload);
    mem.ricetteIngredienti = mem.ricetteIngredienti.filter((ing) => ing.ricetta_id !== ricettaId).concat(normalizedIngredients);
    return { ricettaId, ingredienti: normalizedIngredients.length };
  }

  const db = await getDb();
  await db.execute(
    `INSERT INTO ricette (id, nome, categoria, prezzo_vendita, porzioni, metodo_costo, costi_fissi_percent, attiva, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
     ON CONFLICT(id) DO UPDATE SET
       nome = excluded.nome,
       categoria = excluded.categoria,
       prezzo_vendita = excluded.prezzo_vendita,
       porzioni = excluded.porzioni,
       metodo_costo = excluded.metodo_costo,
       costi_fissi_percent = excluded.costi_fissi_percent,
       attiva = 1,
       note = excluded.note,
       updated_at = CURRENT_TIMESTAMP`,
    [ricettaId, nome, categoria, prezzoVendita, porzioni, metodoCosto, costiFissiPercent, note]
  );
  await db.execute('DELETE FROM ricette_ingredienti WHERE ricetta_id = $1', [ricettaId]);
  for (const ing of normalizedIngredients) {
    await db.execute(
      `INSERT INTO ricette_ingredienti (id, ricetta_id, prodotto_id, quantita, um, costo_unitario_override)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ing.id, ricettaId, ing.prodotto_id, ing.quantita, ing.um, ing.costo_unitario_override]
    );
  }
  await insertSyncLog(db, 'ricette', ricettaId, input.id ? 'UPDATE' : 'INSERT', { ricettaId, nome, categoria, prezzoVendita, porzioni, metodoCosto, costiFissiPercent, ingredienti: normalizedIngredients.length });
  return { ricettaId, ingredienti: normalizedIngredients.length };
}

export async function deleteRicettaFoodCost(id) {
  if (!id) throw new Error('ID ricetta mancante.');
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    mem.ricette = (mem.ricette || []).filter((r) => r.id !== id);
    mem.ricetteIngredienti = (mem.ricetteIngredienti || []).filter((ing) => ing.ricetta_id !== id);
    return { id };
  }
  const db = await getDb();
  await db.execute('UPDATE ricette SET attiva = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  await insertSyncLog(db, 'ricette', id, 'DELETE', { id });
  return { id };
}

export async function saveProdottoMapping(input) {
  const descrizione = normalizeDescrizione(input.descrizione_originale);
  const fornitoreId = input.fornitore_id || '';
  const prodottoNome = normalizeDescrizione(input.prodotto_nome);
  const categoria = normalizeCategoria(input.categoria);
  const ALLOWED_UM = ['LT', 'PZ', 'KG', 'CRT'];
  const umBaseRaw = normalizeDescrizione(input.um_base || input.um).toUpperCase();
  const umBase = ALLOWED_UM.includes(umBaseRaw) ? umBaseRaw : 'PZ';
  const pezziPerCartone = Math.max(1, toNumber(input.pezzi_per_cartone || 1));
  const quantitaPerUnita = Math.max(0.000001, toNumber(input.quantita_per_unita || 1));
  const umAcquistoDefault = normalizeDescrizione(input.um_acquisto_default || input.um || '');
  const noteConversione = normalizeDescrizione(input.note_conversione || '');
  if (!descrizione) throw new Error('Descrizione originale mancante.');
  if (!prodottoNome) throw new Error('Inserisci il nome prodotto standard.');
  if (!categoria) throw new Error('La categoria è obbligatoria.');

  const prodottoId = input.prodotto_id || `prod_${slugId(prodottoNome)}`;
  // v7.5.2: il vecchio ID era basato solo sullo slug della descrizione troncato a 64 caratteri.
  // Alcune descrizioni molto simili/ lunghe potevano generare lo stesso id e causare:
  // UNIQUE constraint failed: prodotti_mapping.id. Aggiungiamo un hash stabile della chiave completa.
  const mappingKey = `${fornitoreId || 'all'}::${descrizione}`;
  const mappingId = input.mapping_id || input.id || `map_${slugId(fornitoreId || 'all')}_${slugId(descrizione).slice(0, 36)}_${simpleHash(mappingKey).replace('h_', '')}`;

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    if (!mem.prodotti) mem.prodotti = [];
    if (!mem.prodotti.find((p) => p.id === prodottoId)) mem.prodotti.push({ id: prodottoId, nome: prodottoNome, categoria, um_base: umBase, pezzi_per_cartone: pezziPerCartone, quantita_per_unita: quantitaPerUnita, um_acquisto_default: umAcquistoDefault, note_conversione: noteConversione, attivo: 1 });
    for (const r of mem.righe || []) {
      if (normalizeDescrizione(r.descrizione_originale) === descrizione && (!fornitoreId || r.fornitore_id === fornitoreId)) {
        r.prodotto_id = prodottoId;
        r.prodotto_nome = prodottoNome;
        r.categoria = categoria;
        r.um_base = umBase;
      }
    }
    return { prodottoId, mappingId, updatedRows: 0 };
  }

  const db = await getDb();
  await db.execute(
    `INSERT INTO prodotti (id, nome, categoria, um_base, pezzi_per_cartone, quantita_per_unita, um_acquisto_default, note_conversione, attivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
     ON CONFLICT(id) DO UPDATE SET
       nome = excluded.nome,
       categoria = excluded.categoria,
       um_base = excluded.um_base,
       pezzi_per_cartone = excluded.pezzi_per_cartone,
       quantita_per_unita = excluded.quantita_per_unita,
       um_acquisto_default = excluded.um_acquisto_default,
       note_conversione = excluded.note_conversione,
       attivo = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [prodottoId, prodottoNome, categoria, umBase, pezziPerCartone, quantitaPerUnita, umAcquistoDefault, noteConversione]
  );

  await db.execute(
    `INSERT INTO prodotti_mapping (id, descrizione_originale, fornitore_id, prodotto_id, confidenza, pezzi_per_cartone, quantita_per_unita, conversione_attiva)
     VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
     ON CONFLICT(descrizione_originale, fornitore_id) DO UPDATE SET
       prodotto_id = excluded.prodotto_id,
       confidenza = 1,
       pezzi_per_cartone = excluded.pezzi_per_cartone,
       quantita_per_unita = excluded.quantita_per_unita,
       conversione_attiva = excluded.conversione_attiva,
       updated_at = CURRENT_TIMESTAMP`,
    [mappingId, descrizione, fornitoreId, prodottoId, pezziPerCartone, quantitaPerUnita, (pezziPerCartone > 1 || quantitaPerUnita !== 1) ? 1 : 0]
  );

  const updatedRows = await updateRigheForMapping(db, { descrizione, fornitoreId, prodottoId, categoria, umBase });

  await insertSyncLog(db, 'prodotti_mapping', mappingId, 'UPSERT', { descrizione, fornitoreId, prodottoId, prodottoNome, categoria, umBase, pezziPerCartone, quantitaPerUnita, umAcquistoDefault, noteConversione, updatedRows });
  return { prodottoId, mappingId, updatedRows };
}


export async function saveProdottoAnagrafica(input) {
  const prodottoId = input.prodotto_id || input.id || `prod_${slugId(input.prodotto_nome || input.nome)}`;
  const prodottoNome = normalizeDescrizione(input.prodotto_nome || input.nome);
  const categoria = normalizeCategoria(input.categoria);
  const ALLOWED_UM2 = ['LT', 'PZ', 'KG', 'CRT'];
  const umBaseRaw2 = normalizeDescrizione(input.um_base || input.um).toUpperCase();
  const umBase = ALLOWED_UM2.includes(umBaseRaw2) ? umBaseRaw2 : 'PZ';
  const pezziPerCartone = Math.max(1, toNumber(input.pezzi_per_cartone || 1));
  const quantitaPerUnita = Math.max(0.000001, toNumber(input.quantita_per_unita || 1));
  const umAcquistoDefault = normalizeDescrizione(input.um_acquisto_default || '');
  const noteConversione = normalizeDescrizione(input.note_conversione || '');

  if (!prodottoId) throw new Error('ID prodotto mancante.');
  if (!prodottoNome) throw new Error('Inserisci il nome prodotto standard.');
  if (!categoria) throw new Error('La categoria è obbligatoria.');

  if (!isTauriRuntime()) {
    const mem = await initFallback();
    if (!mem.prodotti) mem.prodotti = [];
    const found = mem.prodotti.find((p) => p.id === prodottoId);
    const payload = { id: prodottoId, nome: prodottoNome, categoria, um_base: umBase, pezzi_per_cartone: pezziPerCartone, quantita_per_unita: quantitaPerUnita, um_acquisto_default: umAcquistoDefault, note_conversione: noteConversione, attivo: 1 };
    if (found) Object.assign(found, payload);
    else mem.prodotti.push(payload);
    for (const r of mem.righe || []) {
      if (r.prodotto_id === prodottoId) {
        r.prodotto_nome = prodottoNome;
        r.categoria = categoria;
        r.um_base = umBase;
      }
    }
    return { prodottoId, updatedRows: 0 };
  }

  const db = await getDb();
  await db.execute(
    `INSERT INTO prodotti (id, nome, categoria, um_base, pezzi_per_cartone, quantita_per_unita, um_acquisto_default, note_conversione, attivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
     ON CONFLICT(id) DO UPDATE SET
       nome = excluded.nome,
       categoria = excluded.categoria,
       um_base = excluded.um_base,
       pezzi_per_cartone = excluded.pezzi_per_cartone,
       quantita_per_unita = excluded.quantita_per_unita,
       um_acquisto_default = excluded.um_acquisto_default,
       note_conversione = excluded.note_conversione,
       attivo = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [prodottoId, prodottoNome, categoria, umBase, pezziPerCartone, quantitaPerUnita, umAcquistoDefault, noteConversione]
  );

  const result = await db.execute(
    `UPDATE fatture_acquisto_righe
     SET categoria = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE prodotto_id = $2`,
    [categoria, prodottoId]
  );

  await insertSyncLog(db, 'prodotti', prodottoId, 'UPSERT', { prodottoId, prodottoNome, categoria, umBase, pezziPerCartone, quantitaPerUnita, umAcquistoDefault, noteConversione });
  return { prodottoId, updatedRows: result?.rowsAffected || 0 };
}


// v7 - Sync multi-PC base
const SYNC_TABLES = [
  'fornitori',
  'regole_pagamento',
  'fatture_acquisto',
  'fatture_acquisto_righe',
  'fatture_vendita',
  'fatture_vendita_righe',
  'scadenze',
  'pagamenti',
  'prima_nota',
  'prima_nota_conti',
  'prima_nota_categorie',
  'incassi_cassa',
  'buste_paga',
  'versamenti_f24',
  'prodotti',
  'prodotti_mapping',
  'ricette',
  'ricette_ingredienti',
  'documenti'
];

const SYNC_CONFIG_KEYS = [
  'sync.device_id',
  'sync.device_name',
  'sync.cloud_webapp_url',
  'sync.cloud_sheet_id',
  'sync.token',
  'sync.auto_check_on_start',
  'sync.close_mode',
  'sync.last_sheet_explode_at',
  'sync.last_sheet_explode_rows',
  'sync.last_sync_at',
  'sync.last_push_at',
  'sync.last_pull_at',
  'sync.last_cloud_revision',
  'sync.last_cloud_checked_at',
  'sync.last_cloud_status_revision',
  'sync.last_cloud_status_device_id',
  'sync.last_cloud_status_device_name',
  'sync.last_cloud_status_push_at',
  'backup.last_auto_date',
  'backup.last_auto_at',
  'backup.last_manual_at',
  'backup.last_path',
  'backup.last_integrity_at',
  'backup.last_integrity_status'
];

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSqlDateForCompare(value) {
  if (!value) return 0;
  const raw = String(value).trim();
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? t : 0;
}

function simpleHash(value) {
  const text = String(value || '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

async function getConfigValue(db, key, fallback = '') {
  const rows = await db.select('SELECT valore FROM config WHERE chiave = $1 LIMIT 1', [key]);
  return rows?.[0]?.valore ?? fallback;
}

async function setConfigValue(db, key, value) {
  await db.execute(
    `INSERT INTO config (chiave, valore, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore, updated_at = CURRENT_TIMESTAMP`,
    [key, value == null ? '' : String(value)]
  );
}

async function getSyncConfigMap(db) {
  const rows = await db.select(
    `SELECT chiave, valore FROM config WHERE chiave IN (${SYNC_CONFIG_KEYS.map((_, i) => `$${i + 1}`).join(',')})`,
    SYNC_CONFIG_KEYS
  );
  const out = Object.fromEntries(SYNC_CONFIG_KEYS.map((key) => [key, '']));
  for (const row of rows || []) out[row.chiave] = row.valore || '';
  return out;
}

async function ensureSyncDeviceId(db) {
  let deviceId = await getConfigValue(db, 'sync.device_id', '');
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    await setConfigValue(db, 'sync.device_id', deviceId);
  }
  const deviceName = await getConfigValue(db, 'sync.device_name', '');
  if (!deviceName) await setConfigValue(db, 'sync.device_name', 'BarAI Desktop');
  return deviceId;
}

async function getTableColumns(db, tableName) {
  const rows = await db.select(`PRAGMA table_info(${tableName})`);
  return (rows || []).map((row) => row.name);
}

async function selectAllFromSyncTable(db, tableName) {
  if (!SYNC_TABLES.includes(tableName)) throw new Error(`Tabella sync non consentita: ${tableName}`);
  return db.select(`SELECT * FROM ${tableName} ORDER BY COALESCE(updated_at, created_at, id) ASC`);
}

async function countTableRows(db, tableName) {
  if (!SYNC_TABLES.includes(tableName)) throw new Error(`Tabella sync non consentita: ${tableName}`);
  const rows = await db.select(`SELECT COUNT(*) as count FROM ${tableName}`);
  return Number(rows?.[0]?.count || 0);
}

async function recordSyncSnapshot(db, entry) {
  await db.execute(
    `INSERT INTO sync_snapshots (id, direction, source_device_id, cloud_revision, rows_total, status, message, payload_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      uid('snap'),
      entry.direction || 'LOCAL',
      entry.source_device_id || '',
      entry.cloud_revision || '',
      Number(entry.rows_total || 0),
      entry.status || 'OK',
      entry.message || '',
      entry.payload_hash || ''
    ]
  );
}

function buildBrowserSyncData() {
  return {
    mode: 'browser-demo',
    config: {
      device_id: 'browser-demo',
      device_name: 'Browser demo',
      cloud_webapp_url: '',
      cloud_sheet_id: '',
      token_set: false,
      auto_check_on_start: false,
      close_mode: 'ask',
      last_sheet_explode_at: '',
      last_sheet_explode_rows: '',
      last_sync_at: '',
      last_push_at: '',
      last_pull_at: '',
      last_cloud_revision: '',
      last_cloud_checked_at: '',
      last_cloud_status_revision: '',
      last_cloud_status_device_id: '',
      last_cloud_status_device_name: '',
      last_cloud_status_push_at: ''
    },
    backup: { auto_daily: true, last_auto_date: '', last_auto_at: '', last_manual_at: '', last_path: '', last_integrity_at: '', last_integrity_status: '', backups: [] },
    stats: { pending: 0, synced: 0, errors: 0, lastLocalChange: '', lastSnapshot: null },
    counts: {},
    recentLogs: [],
    snapshots: []
  };
}

export async function getSyncBackupData() {
  if (!isTauriRuntime()) return buildBrowserSyncData();
  const db = await getDb();
  const deviceId = await ensureSyncDeviceId(db);
  const cfg = await getSyncConfigMap(db);
  const [pendingRows, syncedRows, errorRows, lastRows, logs, snapshots] = await Promise.all([
    db.select("SELECT COUNT(*) as count FROM sync_log WHERE stato = 'DA_SYNC'"),
    db.select("SELECT COUNT(*) as count FROM sync_log WHERE stato = 'SYNCED'"),
    db.select("SELECT COUNT(*) as count FROM sync_log WHERE stato = 'ERRORE'"),
    db.select('SELECT MAX(created_at) as value FROM sync_log'),
    db.select('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 60'),
    db.select('SELECT * FROM sync_snapshots ORDER BY created_at DESC LIMIT 20')
  ]);
  const counts = {};
  for (const table of SYNC_TABLES) counts[table] = await countTableRows(db, table);
  let localBackups = [];
  try {
    localBackups = await listLocalDbBackups();
  } catch (_) {
    localBackups = [];
  }
  return {
    mode: 'tauri-sqlite',
    config: {
      device_id: deviceId,
      device_name: cfg['sync.device_name'] || 'BarAI Desktop',
      cloud_webapp_url: cfg['sync.cloud_webapp_url'] || '',
      cloud_sheet_id: cfg['sync.cloud_sheet_id'] || '',
      token_set: Boolean(cfg['sync.token']),
      auto_check_on_start: cfg['sync.auto_check_on_start'] === '1',
      close_mode: cfg['sync.close_mode'] || 'ask',
      last_sheet_explode_at: cfg['sync.last_sheet_explode_at'] || '',
      last_sheet_explode_rows: cfg['sync.last_sheet_explode_rows'] || '',
      last_sync_at: cfg['sync.last_sync_at'] || '',
      last_push_at: cfg['sync.last_push_at'] || '',
      last_pull_at: cfg['sync.last_pull_at'] || '',
      last_cloud_revision: cfg['sync.last_cloud_revision'] || '',
      last_cloud_checked_at: cfg['sync.last_cloud_checked_at'] || '',
      last_cloud_status_revision: cfg['sync.last_cloud_status_revision'] || '',
      last_cloud_status_device_id: cfg['sync.last_cloud_status_device_id'] || '',
      last_cloud_status_device_name: cfg['sync.last_cloud_status_device_name'] || '',
      last_cloud_status_push_at: cfg['sync.last_cloud_status_push_at'] || ''
    },
    stats: {
      pending: Number(pendingRows?.[0]?.count || 0),
      synced: Number(syncedRows?.[0]?.count || 0),
      errors: Number(errorRows?.[0]?.count || 0),
      lastLocalChange: lastRows?.[0]?.value || '',
      lastSnapshot: snapshots?.[0] || null
    },
    counts,
    recentLogs: logs || [],
    snapshots: snapshots || [],
    backup: {
      auto_daily: true,
      last_auto_date: cfg['backup.last_auto_date'] || '',
      last_auto_at: cfg['backup.last_auto_at'] || '',
      last_manual_at: cfg['backup.last_manual_at'] || '',
      last_path: cfg['backup.last_path'] || '',
      last_integrity_at: cfg['backup.last_integrity_at'] || '',
      last_integrity_status: cfg['backup.last_integrity_status'] || '',
      backups: localBackups
    }
  };
}

export async function saveSyncConfig(input = {}) {
  if (!isTauriRuntime()) return buildBrowserSyncData().config;
  const db = await getDb();
  await ensureSyncDeviceId(db);
  const values = {
    'sync.device_name': String(input.device_name || 'BarAI Desktop').trim() || 'BarAI Desktop',
    'sync.cloud_webapp_url': String(input.cloud_webapp_url || '').trim(),
    'sync.cloud_sheet_id': String(input.cloud_sheet_id || '').trim(),
    'sync.auto_check_on_start': input.auto_check_on_start ? '1' : '0',
    'sync.close_mode': ['off', 'ask', 'auto'].includes(input.close_mode) ? input.close_mode : 'ask'
  };
  if (Object.prototype.hasOwnProperty.call(input, 'token')) {
    const token = String(input.token || '').trim();
    if (token || input.clear_token) values['sync.token'] = token;
  }
  for (const [key, value] of Object.entries(values)) await setConfigValue(db, key, value);
  return getSyncBackupData();
}

export async function generateSyncSnapshot(options = {}) {
  const includeLogs = Boolean(options.includeLogs);
  if (!isTauriRuntime()) {
    const mem = await initFallback();
    const snapshot = {
      format: 'BarAI.SyncSnapshot.v1',
      appVersion: 'v9.1',
      generatedAt: nowIso(),
      sourceDeviceId: 'browser-demo',
      sourceDeviceName: 'Browser demo',
      cloudRevision: '',
      tables: { fornitori: mem.fornitori, regole_pagamento: mem.regole, fatture_acquisto: mem.fatture, scadenze: mem.scadenze, pagamenti: mem.pagamenti },
      syncLog: []
    };
    return { snapshot, json: JSON.stringify(snapshot, null, 2), rowsTotal: Object.values(snapshot.tables).reduce((a, rows) => a + rows.length, 0) };
  }
  const db = await getDb();
  const deviceId = await ensureSyncDeviceId(db);
  const cfg = await getSyncConfigMap(db);
  const tables = {};
  let rowsTotal = 0;
  for (const table of SYNC_TABLES) {
    const rows = await selectAllFromSyncTable(db, table);
    tables[table] = rows || [];
    rowsTotal += tables[table].length;
  }
  const pendingLog = includeLogs
    ? await db.select("SELECT * FROM sync_log WHERE stato = 'DA_SYNC' ORDER BY created_at ASC LIMIT 500")
    : [];
  const snapshot = {
    format: 'BarAI.SyncSnapshot.v1',
    appVersion: 'v9.1',
    generatedAt: nowIso(),
    sourceDeviceId: deviceId,
    sourceDeviceName: cfg['sync.device_name'] || 'BarAI Desktop',
    cloudRevision: cfg['sync.last_cloud_revision'] || '',
    tables,
    syncLog: pendingLog || []
  };
  const json = JSON.stringify(snapshot, null, 2);
  await recordSyncSnapshot(db, {
    direction: options.direction || 'EXPORT_LOCAL',
    source_device_id: deviceId,
    cloud_revision: snapshot.cloudRevision,
    rows_total: rowsTotal,
    status: 'OK',
    message: `Snapshot generato da ${snapshot.sourceDeviceName}`,
    payload_hash: simpleHash(json)
  });
  return { snapshot, json, rowsTotal, hash: simpleHash(json) };
}

async function upsertSnapshotRow(db, tableName, row) {
  if (!SYNC_TABLES.includes(tableName)) return { inserted: 0, updated: 0, skipped: 1 };
  if (!row?.id) return { inserted: 0, updated: 0, skipped: 1 };
  const columns = await getTableColumns(db, tableName);
  const usableColumns = columns.filter((col) => Object.prototype.hasOwnProperty.call(row, col));
  if (!usableColumns.includes('id')) return { inserted: 0, updated: 0, skipped: 1 };

  const localRows = await db.select(`SELECT * FROM ${tableName} WHERE id = $1 LIMIT 1`, [row.id]);
  const local = localRows?.[0];
  const incomingUpdated = normalizeSqlDateForCompare(row.updated_at || row.created_at);
  const localUpdated = normalizeSqlDateForCompare(local?.updated_at || local?.created_at);

  if (local && incomingUpdated && localUpdated && incomingUpdated < localUpdated) {
    return { inserted: 0, updated: 0, skipped: 1 };
  }

  if (!local) {
    const placeholders = usableColumns.map((_, idx) => `$${idx + 1}`).join(', ');
    await db.execute(
      `INSERT INTO ${tableName} (${usableColumns.join(', ')}) VALUES (${placeholders})`,
      usableColumns.map((col) => row[col])
    );
    return { inserted: 1, updated: 0, skipped: 0 };
  }

  const updateColumns = usableColumns.filter((col) => col !== 'id' && col !== 'created_at');
  if (!updateColumns.length) return { inserted: 0, updated: 0, skipped: 1 };
  const assignments = updateColumns.map((col, idx) => `${col} = $${idx + 1}`).join(', ');
  await db.execute(
    `UPDATE ${tableName} SET ${assignments} WHERE id = $${updateColumns.length + 1}`,
    [...updateColumns.map((col) => row[col]), row.id]
  );
  return { inserted: 0, updated: 1, skipped: 0 };
}

export async function applySyncSnapshot(snapshotInput, options = {}) {
  const text = typeof snapshotInput === 'string' ? snapshotInput : JSON.stringify(snapshotInput || {});
  const snapshot = safeJsonParse(text, null);
  if (!snapshot || snapshot.format !== 'BarAI.SyncSnapshot.v1' || !snapshot.tables) {
    throw new Error('Snapshot non valido. Incolla un JSON BarAI.SyncSnapshot.v1 generato dalla pagina Sync.');
  }
  if (!isTauriRuntime()) return { inserted: 0, updated: 0, skipped: 0, rowsTotal: 0, tables: {} };

  const db = await getDb();
  const localDeviceId = await ensureSyncDeviceId(db);
  if (!options.allowSameDevice && snapshot.sourceDeviceId && snapshot.sourceDeviceId === localDeviceId) {
    throw new Error('Questo snapshot sembra generato dallo stesso dispositivo. Import annullato per evitare doppioni inutili.');
  }

  const summary = { inserted: 0, updated: 0, skipped: 0, rowsTotal: 0, tables: {} };

  // Importa una tabella alla volta con retry su lock
  for (const table of SYNC_TABLES) {
    const rows = Array.isArray(snapshot.tables?.[table]) ? snapshot.tables[table] : [];
    const tableSummary = { inserted: 0, updated: 0, skipped: 0, total: rows.length };
    if (rows.length === 0) { summary.tables[table] = tableSummary; continue; }

    await withLockRetry(async () => {
      tableSummary.inserted = 0;
      tableSummary.updated = 0;
      tableSummary.skipped = 0;
      let txStarted = false;
      try {
        await db.execute('PRAGMA busy_timeout = 30000');
        await db.execute('BEGIN IMMEDIATE');
        txStarted = true;
        for (const row of rows) {
          const result = await upsertSnapshotRow(db, table, row);
          tableSummary.inserted += result.inserted;
          tableSummary.updated += result.updated;
          tableSummary.skipped += result.skipped;
        }
        await db.execute('COMMIT');
        txStarted = false;
      } catch (err) {
        if (txStarted) { try { await db.execute('ROLLBACK'); } catch (_) {} }
        throw err;
      }
    });

    summary.tables[table] = tableSummary;
    summary.inserted += tableSummary.inserted;
    summary.updated += tableSummary.updated;
    summary.skipped += tableSummary.skipped;
    summary.rowsTotal += rows.length;
  }

  let transactionStarted = false;
  try {
    await db.execute('BEGIN');
    transactionStarted = true;

    await setConfigValue(db, 'sync.last_pull_at', nowIso());
    await setConfigValue(db, 'sync.last_sync_at', nowIso());
    if (snapshot.cloudRevision) await setConfigValue(db, 'sync.last_cloud_revision', snapshot.cloudRevision);
    await recordSyncSnapshot(db, {
      direction: options.direction || 'IMPORT_LOCAL',
      source_device_id: snapshot.sourceDeviceId || '',
      cloud_revision: snapshot.cloudRevision || '',
      rows_total: summary.rowsTotal,
      status: 'OK',
      message: `Import snapshot: ${summary.inserted} inseriti, ${summary.updated} aggiornati, ${summary.skipped} saltati`,
      payload_hash: simpleHash(text)
    });

    await db.execute('COMMIT');
    transactionStarted = false;
    return summary;
  } catch (err) {
    if (transactionStarted) {
      try {
        await db.execute('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback import snapshot non riuscito', rollbackErr);
      }
    }
    throw err;
  }
}

export async function listLocalDbBackups() {
  if (!isTauriRuntime()) return [];
  const entries = await tauriInvoke('list_local_db_backups');
  return (entries || []).map((entry) => ({
    ...entry,
    modified_at: formatEpochDate(entry.modified_epoch),
    size_label: backupSizeLabel(entry.size_bytes)
  }));
}

export async function createLocalDbBackup(reason = 'manuale') {
  if (!isTauriRuntime()) throw new Error('Backup SQLite disponibile solo dentro l’app Desktop.');
  const db = await getDb();
  const result = await tauriInvoke('create_local_db_backup', { reason });
  await setConfigValue(db, reason === 'auto_start' ? 'backup.last_auto_at' : 'backup.last_manual_at', nowIso());
  if (reason === 'auto_start') await setConfigValue(db, 'backup.last_auto_date', today());
  if (result?.backup_path) await setConfigValue(db, 'backup.last_path', result.backup_path);
  await recordSyncSnapshot(db, {
    direction: reason === 'auto_start' ? 'BACKUP_AUTO' : 'BACKUP_MANUALE',
    source_device_id: await ensureSyncDeviceId(db),
    cloud_revision: '',
    rows_total: 0,
    status: 'OK',
    message: 'Backup SQLite creato: ' + (result?.file_name || ''),
    payload_hash: ''
  });
  return {
    ...result,
    size_label: backupSizeLabel(result?.size_bytes),
    created_at: formatEpochDate(result?.created_epoch),
    backups: await listLocalDbBackups()
  };
}

export async function createAutomaticStartupBackupIfNeeded() {
  if (!isTauriRuntime()) return { skipped: true, reason: 'browser-demo' };
  const db = await getDb();
  const lastAutoDate = await getConfigValue(db, 'backup.last_auto_date', '');
  const todayValue = today();
  if (lastAutoDate === todayValue) return { skipped: true, reason: 'gia_eseguito_oggi', lastAutoDate };
  return createLocalDbBackup('auto_start');
}

export async function openLocalBackupFolder() {
  if (!isTauriRuntime()) throw new Error('Apertura cartella backup disponibile solo dentro l’app Desktop.');
  return tauriInvoke('open_local_backup_folder');
}

export async function runDatabaseDiagnostics() {
  if (!isTauriRuntime()) {
    return { ok: true, mode: 'browser-demo', integrity: 'browser-demo', quickCheck: 'browser-demo', counts: {}, checkedAt: nowIso() };
  }
  const db = await getDb();
  const checkedAt = nowIso();
  const [integrityRows, quickRows, fkRows, pageRows, freeRows] = await Promise.all([
    db.select('PRAGMA integrity_check'),
    db.select('PRAGMA quick_check'),
    db.select('PRAGMA foreign_key_check'),
    db.select('PRAGMA page_count'),
    db.select('PRAGMA freelist_count')
  ]);
  const integrity = Object.values(integrityRows?.[0] || {})?.[0] || '';
  const quickCheck = Object.values(quickRows?.[0] || {})?.[0] || '';
  const pageCount = Number(Object.values(pageRows?.[0] || {})?.[0] || 0);
  const freeListCount = Number(Object.values(freeRows?.[0] || {})?.[0] || 0);
  const counts = {};
  for (const table of SYNC_TABLES) {
    try {
      counts[table] = await countTableRows(db, table);
    } catch (_) {
      counts[table] = 0;
    }
  }
  const ok = String(integrity).toLowerCase() === 'ok' && String(quickCheck).toLowerCase() === 'ok' && (!fkRows || fkRows.length === 0);
  await setConfigValue(db, 'backup.last_integrity_at', checkedAt);
  await setConfigValue(db, 'backup.last_integrity_status', ok ? 'OK' : 'ERRORE');
  await recordSyncSnapshot(db, {
    direction: 'DIAGNOSTICA_DB',
    source_device_id: await ensureSyncDeviceId(db),
    cloud_revision: '',
    rows_total: Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0),
    status: ok ? 'OK' : 'ERRORE',
    message: ok ? 'Diagnostica SQLite OK' : 'Diagnostica SQLite con errori',
    payload_hash: ''
  });
  return { ok, checkedAt, integrity, quickCheck, foreignKeyErrors: fkRows || [], pageCount, freeListCount, counts };
}
async function callSyncCloud(action, extraPayload = {}) {
  if (!isTauriRuntime()) throw new Error('Sync cloud disponibile solo dentro l’app Tauri.');
  const db = await getDb();
  const cfg = await getSyncConfigMap(db);
  const url = String(cfg['sync.cloud_webapp_url'] || '').trim();
  const token = String(cfg['sync.token'] || '').trim();
  if (!url) throw new Error('Configura prima l’URL della Web App Apps Script.');
  if (!token) throw new Error('Configura prima il token segreto di sincronizzazione.');

  const deviceId = await ensureSyncDeviceId(db);
  const body = {
    action,
    token,
    deviceId,
    deviceName: cfg['sync.device_name'] || 'BarAI Desktop',
    appVersion: 'v9.1',
    ...extraPayload
  };
  const response = await cloudHttpPost(url, body);
  const raw = await response.text();
  const data = safeJsonParse(raw, null);
  if (!response.ok || !data) {
    const prefix = response?.status ? `HTTP ${response.status}` : 'HTTP';
    throw new Error(`${prefix}: risposta cloud non valida. Verifica URL /exec, pubblicazione Web App e permessi. Dettaglio: ${String(raw).slice(0, 240)}`);
  }
  if (data.ok === false) throw new Error(data.error || 'Errore cloud non specificato.');
  return data;
}

function normalizeExplodeSummary(data) {
  if (!data) return null;
  if (data.explodeSummary) return data.explodeSummary;
  if (data.summary) return data.summary;
  if (data.updatedAt || data.rowsTotal !== undefined || data.counts) return data;
  return null;
}

function isUnknownActionError(err) {
  return String(err?.message || err || '').includes('Azione non riconosciuta');
}

function explainOldAppsScriptError(err) {
  if (!isUnknownActionError(err)) return err;
  return new Error('Apps Script cloud non è aggiornato: incolla docs/AppsScript_Sync_v9_0.gs nel progetto Apps Script, salva, poi fai Gestisci deployment > Modifica > Nuova versione. Dettaglio originale: ' + String(err?.message || err));
}


function buildPushConflictMessage(status = {}) {
  const device = status.cloudDeviceName || 'un altro PC';
  const when = status.cloudPushAt || 'data non disponibile';
  return 'Push bloccato per sicurezza: il cloud contiene una revisione diversa pubblicata da ' + device + ' (' + when + '). Fai prima “Pull cloud e unisci”, poi riprova il push. Usa “Forza push” solo se sei sicuro di voler sovrascrivere lo snapshot cloud.';
}

async function readAndStoreCloudStatusForGuard(db) {
  const cfg = await getSyncConfigMap(db);
  const localDeviceId = await ensureSyncDeviceId(db);
  const data = await callSyncCloud('status');
  const checkedAt = nowIso();
  const cloudRevision = data.cloudRevision || data.revision || '';
  const cloudDeviceId = data.lastDeviceId || '';
  const cloudDeviceName = data.lastDeviceName || '';
  const cloudPushAt = data.lastPushAt || '';
  const localRevision = cfg['sync.last_cloud_revision'] || '';

  await setConfigValue(db, 'sync.last_cloud_checked_at', checkedAt);
  await setConfigValue(db, 'sync.last_cloud_status_revision', cloudRevision);
  await setConfigValue(db, 'sync.last_cloud_status_device_id', cloudDeviceId);
  await setConfigValue(db, 'sync.last_cloud_status_device_name', cloudDeviceName);
  await setConfigValue(db, 'sync.last_cloud_status_push_at', cloudPushAt);
  if (data.lastSheetExplodeAt) await setConfigValue(db, 'sync.last_sheet_explode_at', data.lastSheetExplodeAt);
  if (data.lastSheetExplodeRows !== undefined) await setConfigValue(db, 'sync.last_sheet_explode_rows', String(data.lastSheetExplodeRows || 0));

  const hasCloudSnapshot = Boolean(cloudRevision);
  const cloudRevisionDiffers = Boolean(hasCloudSnapshot && cloudRevision !== localRevision);
  const cloudFromAnotherDevice = Boolean(cloudRevisionDiffers && (!cloudDeviceId || cloudDeviceId !== localDeviceId));
  const canPushSafely = !cloudFromAnotherDevice;

  return {
    ...data,
    checkedAt,
    cloudRevision,
    localRevision,
    localDeviceId,
    cloudDeviceId,
    cloudDeviceName,
    cloudPushAt,
    hasCloudSnapshot,
    cloudRevisionDiffers,
    cloudFromAnotherDevice,
    canPushSafely
  };
}

export async function getPushSafetyStatus() {
  const db = await getDb();
  if (!db) return { canPushSafely: true, mode: 'browser-demo' };
  return readAndStoreCloudStatusForGuard(db);
}

async function assertPushAllowed(db, options = {}) {
  if (options.forcePush === true || options.skipSafetyCheck === true) {
    return { canPushSafely: true, forced: Boolean(options.forcePush), skipped: Boolean(options.skipSafetyCheck) };
  }
  const status = await readAndStoreCloudStatusForGuard(db);
  if (!status.canPushSafely) {
    const err = new Error(buildPushConflictMessage(status));
    err.code = 'BARAI_CLOUD_NEEDS_PULL';
    err.status = status;
    throw err;
  }
  return status;
}

export async function checkCloudSyncStatus() {
  const db = await getDb();
  const data = await callSyncCloud('status');
  const checkedAt = nowIso();
  const cloudRevision = data.cloudRevision || data.revision || '';
  await setConfigValue(db, 'sync.last_cloud_checked_at', checkedAt);
  await setConfigValue(db, 'sync.last_cloud_status_revision', cloudRevision);
  await setConfigValue(db, 'sync.last_cloud_status_device_id', data.lastDeviceId || '');
  await setConfigValue(db, 'sync.last_cloud_status_device_name', data.lastDeviceName || '');
  await setConfigValue(db, 'sync.last_cloud_status_push_at', data.lastPushAt || '');
  if (data.lastSheetExplodeAt) await setConfigValue(db, 'sync.last_sheet_explode_at', data.lastSheetExplodeAt);
  if (data.lastSheetExplodeRows !== undefined) await setConfigValue(db, 'sync.last_sheet_explode_rows', String(data.lastSheetExplodeRows || 0));
  return { ...data, checkedAt, cloudRevision };
}

export async function pushSyncSnapshotToCloud(options = {}) {
  const db = await getDb();
  await assertPushAllowed(db, options);
  const generated = await generateSyncSnapshot({ includeLogs: true, direction: 'EXPORT_CLOUD_PREP' });
  const data = await callSyncCloud('pushSnapshot', { snapshot: generated.snapshot, explodeSheets: Boolean(options.explodeSheets) });
  const revision = data.cloudRevision || data.revision || generated.snapshot.generatedAt;
  const explodeSummary = normalizeExplodeSummary(data);
  if (options.explodeSheets && !explodeSummary) {
    throw new Error('Push JSON completato, ma Apps Script non ha aggiornato i fogli leggibili. Aggiorna il codice cloud con docs/AppsScript_Sync_v9_0.gs e pubblica una nuova versione del deployment.');
  }
  await setConfigValue(db, 'sync.last_push_at', nowIso());
  await setConfigValue(db, 'sync.last_sync_at', nowIso());
  await setConfigValue(db, 'sync.last_cloud_revision', revision);
  if (explodeSummary) {
    await setConfigValue(db, 'sync.last_sheet_explode_at', explodeSummary.updatedAt || nowIso());
    await setConfigValue(db, 'sync.last_sheet_explode_rows', String(explodeSummary.rowsTotal || 0));
  }
  await db.execute("UPDATE sync_log SET stato = 'SYNCED', synced_at = CURRENT_TIMESTAMP, cloud_revision = $1 WHERE stato = 'DA_SYNC'", [revision]);
  await recordSyncSnapshot(db, {
    direction: options.explodeSheets ? 'EXPORT_CLOUD_SHEETS_OK' : 'EXPORT_CLOUD_OK',
    source_device_id: generated.snapshot.sourceDeviceId,
    cloud_revision: revision,
    rows_total: generated.rowsTotal,
    status: 'OK',
    message: options.explodeSheets ? `Snapshot inviato e fogli Google aggiornati. Revisione ${revision}` : `Snapshot inviato al cloud. Revisione ${revision}`,
    payload_hash: generated.hash
  });
  return { ...data, explodeSummary, rowsTotal: generated.rowsTotal, revision };
}

export async function pushSyncSnapshotToCloudAndExplode(options = {}) {
  return pushSyncSnapshotToCloud({ ...options, explodeSheets: true });
}

export async function forcePushSyncSnapshotToCloudAndExplode() {
  return pushSyncSnapshotToCloud({ explodeSheets: true, forcePush: true });
}

export async function pullThenPushSyncSnapshotToCloudAndExplode() {
  const pull = await pullSyncSnapshotFromCloud();
  const push = await pushSyncSnapshotToCloud({ explodeSheets: true });
  return { ok: true, pull, push, message: 'Pull cloud completato, poi snapshot locale inviato e fogli Google aggiornati.' };
}

export async function explodeCloudSnapshotToSheets() {
  const db = await getDb();
  let data;
  try {
    data = await callSyncCloud('explodeSnapshotToSheets');
  } catch (err) {
    throw explainOldAppsScriptError(err);
  }
  const explodeSummary = normalizeExplodeSummary(data);
  if (explodeSummary) {
    await setConfigValue(db, 'sync.last_sheet_explode_at', explodeSummary.updatedAt || nowIso());
    await setConfigValue(db, 'sync.last_sheet_explode_rows', String(explodeSummary.rowsTotal || 0));
  }
  await recordSyncSnapshot(db, {
    direction: 'EXPLODE_SHEETS',
    source_device_id: '',
    cloud_revision: data.cloudRevision || data.revision || explodeSummary?.cloudRevision || '',
    rows_total: explodeSummary?.rowsTotal || 0,
    status: 'OK',
    message: 'Fogli Google aggiornati dallo snapshot cloud',
    payload_hash: ''
  });
  return { ...data, explodeSummary };
}

export async function pullSyncSnapshotFromCloud() {
  const db = await getDb();
  // Piccolo delay per assicurarsi che l'init DB sia completamente rilasciato
  await sleep(500);
  await db.execute('PRAGMA busy_timeout = 30000');
  await db.execute('PRAGMA wal_checkpoint(PASSIVE)');
  let data;
  try {
    data = await callSyncCloud('pullSnapshot');
  } catch (err) {
    throw explainOldAppsScriptError(err);
  }
  const snapshot = data.snapshot;
  if (!snapshot) throw new Error('Il cloud non contiene ancora uno snapshot BarAI. Fai prima “Solo push JSON” o “Push + aggiorna fogli” da un PC.');
  const summary = await applySyncSnapshot(snapshot, { direction: 'IMPORT_CLOUD', allowSameDevice: true });
  const revision = data.cloudRevision || data.revision || snapshot.cloudRevision || snapshot.generatedAt || '';
  if (revision) await setConfigValue(db, 'sync.last_cloud_revision', revision);
  await setConfigValue(db, 'sync.last_pull_at', nowIso());
  await setConfigValue(db, 'sync.last_sync_at', nowIso());
  return {
    ok: true,
    cloudRevision: revision,
    revision,
    summary,
    message: `Pull completato: ${summary.inserted} inseriti, ${summary.updated} aggiornati, ${summary.skipped} saltati.`
  };
}

