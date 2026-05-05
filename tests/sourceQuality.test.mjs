import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const db = readFileSync('src/db/baraiDb.js', 'utf8');
const dbIndex = readFileSync('src/db/index.js', 'utf8');
const app = readFileSync('src/App.jsx', 'utf8');
const primaNota = readFileSync('src/pages/PrimaNotaPage.jsx', 'utf8');
const controlloPrezzi = readFileSync('src/components/ControlloPrezzi.jsx', 'utf8');
const foodCost = readFileSync('src/pages/FoodCostPage.jsx', 'utf8');
const csvUtils = readFileSync('src/utils/csv.js', 'utf8');
const gestionePage = readFileSync('src/pages/GestionePage.jsx', 'utf8');
const caricamentiPage = readFileSync('src/pages/CaricamentiPage.jsx', 'utf8');
const contoEconomico = readFileSync('src/logic/contoEconomico.js', 'utf8');
const schema = readFileSync('src/db/schema.js', 'utf8');
const appsScript90 = readFileSync('docs/AppsScript_Sync_v9_0.gs', 'utf8');
const appsScript911 = readFileSync('docs/AppsScript_Sync_v9_1_1.gs', 'utf8');

const pkg = readFileSync('package.json', 'utf8');
const xlsxParser = readFileSync('src/utils/corrispettiviXlsxParser.js', 'utf8');

assert.equal(db.includes('AppsScript_Sync_v7_5_2.gs'), false, 'I messaggi runtime non devono puntare allo script v7.5.2');
assert.ok(db.includes("await db.execute('BEGIN')"), 'applySyncSnapshot deve aprire una transazione');
assert.ok(db.includes("await db.execute('COMMIT')"), 'applySyncSnapshot deve chiudere la transazione con COMMIT');
assert.ok(db.includes("await db.execute('ROLLBACK')"), 'applySyncSnapshot deve fare ROLLBACK in caso di errore');
assert.ok(primaNota.includes('function freshForm()'), 'Prima Nota deve rigenerare la data default a ogni nuovo movimento');
assert.ok(primaNota.includes('useState(() => freshForm())'), 'Prima Nota deve inizializzare il form con factory fresca');
assert.ok(foodCost.includes('confirmDeleteRecipe'), 'Food Cost deve chiedere conferma prima di eliminare una ricetta');
assert.ok(foodCost.includes('window.confirm'), 'Food Cost deve usare una conferma esplicita prima del delete');
assert.ok(db.includes('s.id AS scadenza_id'), 'La rigenerazione Prima Nota deve usare scadenza_id esplicito, non s.* ambiguo');
assert.ok(db.includes('row.scadenza_id || row.pagamento_scadenza_id'), 'La rigenerazione deve usare row.scadenza_id esplicito');
assert.equal(db.includes('s.*,\n      f.numero'), false, 'La query pagamenti non deve usare s.* prima delle colonne fattura');
assert.equal(db.includes('s.rata_numero'), false, 'La query pagamenti non deve selezionare colonne inesistenti da scadenze');
assert.ok(app.includes("'genera-snapshot',"), 'Genera snapshot deve passare da runAction');
assert.ok(app.includes("['sync']"), 'Genera snapshot deve usare reload selettivo sync');
assert.ok(csvUtils.includes('export function csvEscape'), 'csvEscape deve essere centralizzata in src/utils/csv.js');
assert.ok(csvUtils.includes('export function downloadCsv'), 'downloadCsv deve essere centralizzata in src/utils/csv.js');
assert.equal(controlloPrezzi.includes('function csvEscape'), false, 'ControlloPrezzi non deve duplicare csvEscape');
assert.equal(controlloPrezzi.includes('function downloadCsv'), false, 'ControlloPrezzi non deve duplicare downloadCsv');
assert.equal(primaNota.includes('function csvEscape'), false, 'PrimaNotaPage non deve duplicare csvEscape');
assert.equal(primaNota.includes('function downloadCsv'), false, 'PrimaNotaPage non deve duplicare downloadCsv');
assert.equal(primaNota.includes('function norm(value)'), false, 'PrimaNotaPage deve importare norm da utils/productGuess.js');
assert.equal(primaNota.includes('function monthKey(value)'), false, 'PrimaNotaPage deve importare monthKey da utils/format.js');
assert.ok(app.includes('async function runAction(module, action, successMessage, fn, reloadScopes'), 'runAction deve supportare reload selettivo');
assert.ok(app.includes("['dashboard', 'scadenze', 'scadenziario', 'primaNota', 'gestione', 'sync']"), 'Le azioni di pagamento devono ricaricare solo i moduli coinvolti');
assert.ok(dbIndex.includes("./repositories/primaNotaRepo.js"), 'db/index.js deve passare dal repository Prima Nota');
assert.ok(dbIndex.includes("./repositories/syncRepo.js"), 'db/index.js deve passare dal repository Sync');
assert.ok(dbIndex.includes("./repositories/foodCostRepo.js"), 'db/index.js deve passare dal repository Food Cost');

assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS incassi_cassa'), 'v9.0 deve creare la tabella incassi_cassa');
assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS buste_paga'), 'v9.0 deve creare la tabella buste_paga');
assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS versamenti_f24'), 'v9.0 deve creare la tabella versamenti_f24');
assert.ok(db.includes("'incassi_cassa'"), 'Le chiusure cassa devono essere incluse nello snapshot sync');
assert.ok(db.includes("'buste_paga'"), 'Le buste paga devono essere incluse nello snapshot sync');
assert.ok(db.includes("'versamenti_f24'"), 'Gli F24 devono essere inclusi nello snapshot sync');

assert.equal(pkg.includes('"xlsx"'), false, 'La dipendenza xlsx non deve rientrare per evitare audit high senza fix');
assert.ok(pkg.includes('"exceljs"'), 'Import XLSX deve usare exceljs al posto della vecchia dipendenza xlsx');
assert.equal(xlsxParser.includes("from 'xlsx'"), false, 'Il parser corrispettivi non deve importare xlsx');
assert.ok(xlsxParser.includes("from 'exceljs'"), 'Il parser corrispettivi deve importare exceljs');
assert.equal(db.includes('sp_incasso_'), false, 'saveIncassoCassa non deve usare savepoint manuali: Tauri SQLite può perderli in nested calls');
assert.equal(db.includes('sp_busta_'), false, 'saveBustaPaga non deve usare savepoint manuali');
assert.equal(db.includes('sp_f24_'), false, 'saveVersamentoF24 non deve usare savepoint manuali');

assert.ok(caricamentiPage.includes('parseCorrispettiviXlsx'), 'Caricamenti deve supportare import XLSX corrispettivi');
assert.ok(caricamentiPage.includes('JSON buste paga'), 'Caricamenti deve supportare import JSON buste paga');
assert.ok(caricamentiPage.includes('JSON F24'), 'Caricamenti deve supportare import JSON F24');
assert.equal(gestionePage.includes('parseCorrispettiviXlsx'), false, 'Admin / CE non deve più contenere import operativi');
assert.ok(appsScript90.includes('Incassi_Cassa'), 'Apps Script v9.0 deve esportare il foglio Incassi_Cassa');
assert.ok(appsScript90.includes('Buste_Paga'), 'Apps Script v9.0 deve esportare il foglio Buste_Paga');
assert.ok(appsScript90.includes('Versamenti_F24'), 'Apps Script v9.0 deve esportare il foglio Versamenti_F24');
assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS fatture_vendita'), 'v9.1.1 deve creare la tabella fatture_vendita');
assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS fatture_vendita_righe'), 'v9.1.1 deve creare la tabella fatture_vendita_righe');
assert.ok(db.includes('export async function importFatturaVenditaXml'), 'v9.1.1 deve importare XML fatture vendita');
assert.ok(db.includes("'fatture_vendita'"), 'Le fatture vendita devono essere incluse nello snapshot sync');
assert.ok(dbIndex.includes('importFatturaVenditaXml'), 'db/index.js deve esportare importFatturaVenditaXml');
assert.ok(caricamentiPage.includes('Fatture vendita'), 'Caricamenti deve avere la tab Fatture vendita');
assert.ok(appsScript911.includes('Fatture_Vendita'), 'Apps Script v9.1.1 deve esportare il foglio Fatture_Vendita');

console.log('sourceQuality.test.mjs OK');

assert.ok(contoEconomico.includes('export function buildContoEconomico'), 'v9.1 deve avere logica pura buildContoEconomico');
assert.ok(contoEconomico.includes('isExcludedManualeForCe'), 'Il CE deve evitare doppioni escludendo movimenti auto già coperti da fonti dedicate');
assert.ok(gestionePage.includes('Conto Economico'), 'Admin / CE deve esporre la tab Conto Economico');
assert.ok(gestionePage.includes('buildContoEconomicoConfronto'), 'La pagina gestione deve usare la logica CE pura');
assert.ok(db.includes('buildContoEconomicoConfronto'), 'Il repository gestione deve preparare anche il CE calcolato');
