import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ScadenziarioPage from './pages/ScadenziarioPage.jsx';
import CaricamentiPage from './pages/CaricamentiPage.jsx';
import ControlloPrezzi from './components/ControlloPrezzi.jsx';
import SyncBackupPage from './pages/SyncBackupPage.jsx';
import PrimaNotaPage from './pages/PrimaNotaPage.jsx';
import FoodCostPage from './pages/FoodCostPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import ConfigPage from './pages/ConfigPage.jsx';
import GestionePage from './pages/GestionePage.jsx';
import OrdineFornitore from './pages/OrdineFornitore.jsx';
import SetupDevice from './components/SetupDevice.jsx';
import PinModal from './components/PinModal.jsx';
import {
  getDashboardData,
  importFatturaAcquistoXml,
  importFatturaVenditaXml,
  aggiornaStatoScadenza,
  aggiornaStatoScadenze,
  getScadenze,
  getScadenziarioData,
  getPrimaNotaData,
  getPrimaNotaConfigData,
  savePrimaNotaConfig,
  savePrimaNotaMovimento,
  deletePrimaNotaMovimento,
  rigeneraPrimaNotaDaPagamenti,
  initDatabase,
  riapriScadenza,
  saveFatturaAcquisto,
  saveFornitore,
  saveRegolaPagamento,
  segnaScadenzaPagata,
  segnaScadenzePagate,
  getControlloPrezziData,
  saveProdottoMapping,
  saveProdottoAnagrafica,
  getFoodCostData,
  saveRicettaFoodCost,
  deleteRicettaFoodCost,
  getSyncBackupData,
  saveSyncConfig,
  generateSyncSnapshot,
  applySyncSnapshot,
  checkCloudSyncStatus,
  pushSyncSnapshotToCloud,
  pushSyncSnapshotToCloudAndExplode,
  explodeCloudSnapshotToSheets,
  pullSyncSnapshotFromCloud,
  getPushSafetyStatus,
  forcePushSyncSnapshotToCloudAndExplode,
  pullThenPushSyncSnapshotToCloudAndExplode,
  createLocalDbBackup,
  createAutomaticStartupBackupIfNeeded,
  openLocalBackupFolder,
  runDatabaseDiagnostics,
  getGestioneData,
  saveIncassoCassa,
  importIncassiCassa,
  deleteIncassoCassa,
  saveBustaPaga,
  importBustePagaJson,
  deleteBustaPaga,
  saveVersamentoF24,
  importF24Json,
  deleteVersamentoF24,
  getDeviceMode,
  setDeviceMode
} from './db/index.js';
import { writeErrorLog } from './utils/errorLog.js';

const EMPTY_SCADENZIARIO = { scadenze: [], fatture: [], fornitori: [], regole: [], pagamenti: [], righe: [], importLog: [] };
const EMPTY_PREZZI = { prodotti: [], nonMappati: [], righe: [], anagraficaProdotti: [] };
const EMPTY_FOOD_COST = { ricette: [], prodotti: [] };
const EMPTY_PRIMA_NOTA = { movimenti: [], conti: [], categorie: [], totals: { entrate: 0, uscite: 0, saldo: 0, perConto: [] }, monthly: [], byCategory: [] };
const EMPTY_PRIMA_NOTA_CONFIG = { conti: [], categorie: [] };
const EMPTY_GESTIONE = { incassi: [], buste: [], f24: [], fatture: [], fattureVendita: [], movimenti: [], totals: { ricavi: 0, personale: 0, f24: 0, nettoFonti: 0 }, ce: null };

const EMPTY_SYNC = {
  config: { device_id: '', device_name: '', cloud_webapp_url: '', cloud_sheet_id: '', token_set: false, auto_check_on_start: false, close_mode: 'ask', last_sheet_explode_at: '', last_sheet_explode_rows: '', last_sync_at: '', last_push_at: '', last_pull_at: '', last_cloud_revision: '', last_cloud_checked_at: '', last_cloud_status_revision: '', last_cloud_status_device_id: '', last_cloud_status_device_name: '', last_cloud_status_push_at: '' },
  backup: { auto_daily: true, last_auto_date: '', last_auto_at: '', last_manual_at: '', last_path: '', last_integrity_at: '', last_integrity_status: '', backups: [] },
  stats: { pending: 0, synced: 0, errors: 0, lastLocalChange: '', lastSnapshot: null },
  counts: {},
  recentLogs: [],
  snapshots: []
};

const PLACEHOLDER_PAGES = {};

export default function App() {
  const [active, setActive] = useState('prezzi');
  const [ready, setReady] = useState(false);
  const [dbMode, setDbMode] = useState('loading');
  const [deviceMode, setDeviceModeState] = useState(null); // null=non ancora letto, 'admin', 'dipendente'
  const [devicePin, setDevicePin] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [adminSessionActive, setAdminSessionActive] = useState(false); // unlock temporaneo
  const [dashboard, setDashboard] = useState(null);
  const [scadenze, setScadenze] = useState([]);
  const [scadenziarioData, setScadenziarioData] = useState(EMPTY_SCADENZIARIO);
  const [prezziData, setPrezziData] = useState(EMPTY_PREZZI);
  const [foodCostData, setFoodCostData] = useState(EMPTY_FOOD_COST);
  const [primaNotaData, setPrimaNotaData] = useState(EMPTY_PRIMA_NOTA);
  const [primaNotaConfig, setPrimaNotaConfig] = useState(EMPTY_PRIMA_NOTA_CONFIG);
  const [syncData, setSyncData] = useState(EMPTY_SYNC);
  const [gestioneData, setGestioneData] = useState(EMPTY_GESTIONE);
  const [notice, setNotice] = useState({ message: '', type: 'info' });
  const [bulkErrorReport, setBulkErrorReport] = useState(null);
  const startupCloudCheckedRef = useRef(false);
  const closingRef = useRef(false);
  const closeSyncRef = useRef({ ready: false, dbMode: 'loading', syncData: EMPTY_SYNC });
  const [closeHookStatus, setCloseHookStatus] = useState('non_inizializzato');
  const [closePrompt, setClosePrompt] = useState({ open: false, pending: 0, working: false, error: '' });

  const flash = useCallback((message, type = 'info') => {
    setNotice({ message, type });
    setTimeout(() => setNotice({ message: '', type: 'info' }), 2800);
  }, []);

  const reportError = useCallback((module, action, error) => {
    const entry = writeErrorLog({ module, action, error });
    console.error(`[${module}/${action}]`, error);
    flash(entry.message, 'error');
  }, [flash]);

  const reload = useCallback(async (scopes = 'all') => {
    const requested = scopes === 'all'
      ? new Set(['dashboard', 'scadenze', 'scadenziario', 'prezzi', 'foodCost', 'primaNota', 'primaNotaConfig', 'gestione', 'sync'])
      : new Set(Array.isArray(scopes) ? scopes : [scopes]);

    const tasks = [];

    if (requested.has('dashboard')) tasks.push(getDashboardData().then(setDashboard));
    if (requested.has('scadenze')) tasks.push(getScadenze().then(setScadenze));
    if (requested.has('scadenziario')) tasks.push(getScadenziarioData().then(setScadenziarioData));
    if (requested.has('prezzi')) tasks.push(getControlloPrezziData().then(setPrezziData));
    if (requested.has('foodCost')) tasks.push(getFoodCostData().then(setFoodCostData));
    if (requested.has('primaNota')) tasks.push(getPrimaNotaData().then(setPrimaNotaData));
    if (requested.has('primaNotaConfig')) tasks.push(getPrimaNotaConfigData().then(setPrimaNotaConfig));
    if (requested.has('gestione')) tasks.push(getGestioneData().then(setGestioneData));
    if (requested.has('sync')) tasks.push(getSyncBackupData().then(setSyncData));

    await Promise.all(tasks);
  }, []);

  useEffect(() => {
    initDatabase()
      .then((info) => {
        setDbMode(info.mode);
        return reload().then(async () => {
          if (info.mode === 'tauri-sqlite') {
            try {
              await createAutomaticStartupBackupIfNeeded();
            } catch (backupErr) {
              console.warn('Backup automatico iniziale non riuscito', backupErr);
            }
            await reload();
          }
        });
      })
      .then(() => setReady(true))
      .catch((err) => {
        reportError('database', 'inizializzazione', err);
        setReady(true);
      });
  }, [reload, reportError]);

  // Leggi device mode dopo l'init
  useEffect(() => {
    if (!ready || dbMode !== 'tauri-sqlite') return;
    getDeviceMode().then(({ mode, pin }) => {
      if (!mode) {
        setShowSetup(true);
      } else {
        setDeviceModeState(mode);
        setDevicePin(pin);
        if (mode === 'dipendente') setActive('prezzi');
        else setActive('dashboard');
      }
    }).catch(() => {
      setDeviceModeState('admin');
      setActive('dashboard');
    });
  }, [ready, dbMode]);

  async function handleSetupComplete(mode, pin) {
    await setDeviceMode(mode, pin);
    setDeviceModeState(mode);
    setDevicePin(pin);
    setShowSetup(false);
    if (mode === 'dipendente') setActive('prezzi');
    else setActive('dashboard');
  }

  function handleUnlockRequest() {
    setShowPinModal(true);
  }

  function handlePinSubmit(inputPin) {
    if (inputPin === devicePin) {
      setAdminSessionActive(true);
      setShowPinModal(false);
      setActive('dashboard');
    } else {
      // Restituisce errore al modal — gestiamo tramite callback
      setShowPinModal(false);
      flash('PIN non corretto.', 'error');
    }
  }

  const effectiveMode = adminSessionActive ? 'admin' : (deviceMode || 'admin');

  // Check aggiornamenti: confronta versione con latest.json su GitHub
  useEffect(() => {
    if (!ready || dbMode !== 'tauri-sqlite') return;
    const APP_VERSION = '1.0.0';
    const LATEST_URL = 'https://github.com/spontonalessandro/barai-desktop/releases/latest/download/latest.json';
    (async () => {
      try {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        const res = await tauriFetch(LATEST_URL, { method: 'GET' });
        const data = await res.json();
        const latest = data?.version || '';
        if (latest && latest !== APP_VERSION && latest > APP_VERSION) {
          const ok = window.confirm(
            `Aggiornamento disponibile: v${latest}\n\nVuoi scaricare la nuova versione?\n(Si aprirà la pagina di download)`
          );
          if (ok) {
            window.alert('Scarica il nuovo DMG da:\nhttps://github.com/spontonalessandro/barai-desktop/releases/latest\n\nInstallalo e sostituisci la versione attuale.');
          }
        }
      } catch (_) {
        // Non critico
      }
    })();
  }, [ready, dbMode]);

  useEffect(() => {
    if (!ready || dbMode !== 'tauri-sqlite') return undefined;
    if (!syncData?.config?.auto_check_on_start || startupCloudCheckedRef.current) return undefined;

    const cfg = { ...(syncData.config || {}) };
    startupCloudCheckedRef.current = true;

    (async () => {
      try {
        flash('Controllo cloud all’apertura...', 'info');
        const status = await checkCloudSyncStatus();
        await reload();

        const cloudRevision = status?.cloudRevision || status?.revision || '';
        const localRevision = cfg.last_cloud_revision || '';
        const lastDeviceId = status?.lastDeviceId || '';
        const lastDeviceName = status?.lastDeviceName || 'altro PC';
        const cloudFromOtherDevice = Boolean(lastDeviceId && lastDeviceId !== cfg.device_id);
        const cloudIsDifferent = Boolean(cloudRevision && cloudRevision !== localRevision);

        if (cloudIsDifferent && cloudFromOtherDevice) {
          setActive('sync');
          const message = 'Cloud più recente rilevato da ' + lastDeviceName + '. Vuoi scaricarlo e unirlo al database locale ora?';
          const shouldPull = window.confirm(message);
          if (shouldPull) {
            flash('Pull cloud all’apertura...', 'info');
            const pulled = await pullSyncSnapshotFromCloud();
            await reload();
            const summary = pulled?.summary;
            flash(summary ? 'Pull completato: ' + summary.inserted + ' inseriti, ' + summary.updated + ' aggiornati, ' + summary.skipped + ' saltati.' : 'Pull cloud completato.', 'success');
          } else {
            flash('Cloud più recente disponibile. Apri Sync / Backup quando vuoi scaricarlo.', 'warning');
          }
        } else {
          flash('Controllo cloud completato: nessun aggiornamento esterno da scaricare.', 'success');
        }
      } catch (err) {
        reportError('sync', 'controllo-apertura', err);
      }
    })();

    return undefined;
  }, [ready, dbMode, syncData?.config?.auto_check_on_start, reload, flash, reportError]);

  useEffect(() => {
    closeSyncRef.current = { ready, dbMode, syncData };
  }, [ready, dbMode, syncData]);

  useEffect(() => {
    let unlisten = null;
    let cancelled = false;

    async function registerCloseHandler() {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        if (cancelled) return;
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          const current = closeSyncRef.current || {};
          const cfg = current.syncData?.config || {};
          const stats = current.syncData?.stats || {};
          const mode = cfg.close_mode || 'ask';
          const canCloudSync = Boolean(cfg.cloud_webapp_url && cfg.token_set);

          if (!current.ready || current.dbMode !== 'tauri-sqlite' || mode === 'off' || !canCloudSync) {
            return;
          }
          if (closingRef.current) return;

          event.preventDefault();
          closingRef.current = true;

          const pending = Number(stats?.pending || 0);

          if (mode === 'ask') {
            setActive('sync');
            setClosePrompt({ open: true, pending, working: false, error: '' });
            return;
          }

          try {
            flash('Push cloud prima della chiusura...', 'info');
            await pushSyncSnapshotToCloud();
            await reload();
            await appWindow.destroy();
          } catch (err) {
            reportError('sync', 'chiusura-app', err);
            setActive('sync');
            setClosePrompt({
              open: true,
              pending,
              working: false,
              error: 'Sync non riuscito. I dati locali sono salvi: ' + String(err?.message || err)
            });
          }
        });
        setCloseHookStatus('attivo');
      } catch (err) {
        console.warn('Close sync non disponibile', err);
        setCloseHookStatus('non_disponibile');
      }
    }

    registerCloseHandler();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [flash, reload, reportError]);

  async function runAction(module, action, successMessage, fn, reloadScopes = 'all') {
    try {
      const result = await fn();
      await reload(reloadScopes);
      if (successMessage) flash(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      return result;
    } catch (err) {
      reportError(module, action, err);
      throw err;
    }
  }

  function handlePaid(scadenzaId, dataPagamento, metodoPagamento) {
    return runAction('scadenziario', 'pagamento-singolo', 'Pagamento registrato nel database locale.', () =>
      segnaScadenzaPagata(scadenzaId, dataPagamento, metodoPagamento)
    , ['dashboard', 'scadenze', 'scadenziario', 'primaNota', 'gestione', 'sync']);
  }

  function handlePaidMany(ids, dataPagamento, metodoPagamento) {
    return runAction('scadenziario', 'pagamento-multiplo', (count) => `${count} scadenze segnate come pagate.`, () =>
      segnaScadenzePagate(ids, dataPagamento, metodoPagamento)
    , ['dashboard', 'scadenze', 'scadenziario', 'primaNota', 'gestione', 'sync']);
  }

  function handleSetStatus(scadenzaId, stato) {
    return runAction('scadenziario', 'aggiorna-stato', stato === 'APERTO' ? 'Scadenza verificata e messa aperta.' : `Stato aggiornato: ${stato}.`, () =>
      aggiornaStatoScadenza(scadenzaId, stato)
    , ['dashboard', 'scadenze', 'scadenziario', 'sync']);
  }

  function handleSetStatusMany(ids, stato) {
    return runAction('scadenziario', 'aggiorna-stato-multiplo', (count) => stato === 'APERTO' ? `${count} scadenze verificate e messe aperte.` : `${count} scadenze aggiornate.`, () =>
      aggiornaStatoScadenze(ids, stato)
    , ['dashboard', 'scadenze', 'scadenziario', 'sync']);
  }

  function handleReopen(scadenzaId) {
    return runAction('scadenziario', 'riapri-scadenza', 'Scadenza riaperta.', () => riapriScadenza(scadenzaId), ['dashboard', 'scadenze', 'scadenziario', 'primaNota', 'gestione', 'sync']);
  }

  function handleSaveFattura(payload) {
    return runAction('scadenziario', 'salva-fattura', 'Fattura e scadenza salvate.', () => saveFatturaAcquisto(payload), ['dashboard', 'scadenze', 'scadenziario', 'prezzi', 'foodCost', 'gestione', 'sync']);
  }

  function handleSaveFornitore(payload) {
    return runAction('scadenziario', 'salva-fornitore', 'Fornitore salvato.', () => saveFornitore(payload), ['scadenziario', 'sync']);
  }

  function handleSaveRegola(payload) {
    return runAction('scadenziario', 'salva-regola', 'Regola pagamento salvata.', () => saveRegolaPagamento(payload), ['scadenziario', 'sync']);
  }

  async function handleImportXml(parsedXml) {
    const result = await runAction('caricamenti', 'import-xml-acquisto', 'XML acquisto importato: fattura, scadenza e righe salvate.', () => importFatturaAcquistoXml(parsedXml), ['dashboard', 'scadenze', 'scadenziario', 'prezzi', 'foodCost', 'gestione', 'sync']);
    return result;
  }

  async function handleImportXmlVendita(parsedXml) {
    const result = await runAction('caricamenti', 'import-xml-vendita', 'XML vendita importato: fattura vendita e righe salvate.', () => importFatturaVenditaXml(parsedXml), ['dashboard', 'gestione', 'sync']);
    return result;
  }

  function handleSaveProdottoMapping(payload) {
    return runAction('controllo-prezzi', 'mappatura-prodotto', (result) => `Prodotto mappato. Righe aggiornate: ${result?.updatedRows || 0}.`, () =>
      saveProdottoMapping(payload)
    , ['prezzi', 'foodCost', 'sync']);
  }

  async function handleSaveProdottoMappingBulk(payloads) {
    let totalUpdated = 0;
    let salvati = 0;
    const errori = [];
    for (const p of payloads) {
      try {
        const result = await saveProdottoMapping(p);
        totalUpdated += result?.updatedRows || 0;
        salvati++;
      } catch (err) {
        errori.push({ nome: p.descrizione_originale || '?', motivo: err?.message || String(err) });
        writeErrorLog({ module: 'controllo-prezzi', action: 'mappatura-bulk', error: err });
      }
    }
    await reload(['prezzi', 'foodCost', 'sync']);
    if (errori.length === 0) {
      flash(`${salvati} prodotti mappati. Righe aggiornate: ${totalUpdated}.`);
    } else {
      setBulkErrorReport({ salvati, totalUpdated, errori });
    }
  }

  function handleSaveProdotto(payload) {
    return runAction('controllo-prezzi', 'modifica-prodotto', (result) => `Prodotto aggiornato. Righe collegate: ${result?.updatedRows || 0}.`, () =>
      saveProdottoAnagrafica(payload)
    , ['prezzi', 'foodCost', 'sync']);
  }

  function handleSaveRicetta(payload) {
    return runAction('food-cost', 'salva-ricetta', 'Ricetta salvata.', () => saveRicettaFoodCost(payload), ['foodCost', 'sync']);
  }

  function handleDeleteRicetta(id) {
    return runAction('food-cost', 'elimina-ricetta', 'Ricetta eliminata.', () => deleteRicettaFoodCost(id), ['foodCost', 'sync']);
  }

  function handleSavePrimaNotaMovement(payload) {
    return runAction('prima-nota', 'salva-movimento', payload?.id ? 'Movimento Prima Nota aggiornato.' : 'Movimento Prima Nota inserito.', () => savePrimaNotaMovimento(payload), ['dashboard', 'primaNota', 'gestione', 'sync']);
  }

  function handleDeletePrimaNotaMovement(id) {
    return runAction('prima-nota', 'elimina-movimento', 'Movimento Prima Nota eliminato.', () => deletePrimaNotaMovimento(id), ['dashboard', 'primaNota', 'gestione', 'sync']);
  }

  function handleRegeneratePrimaNotaAutomatic() {
    return runAction(
      'prima-nota',
      'rigenera-automatici',
      (result) => `Rigenerazione completata: ${result?.created || 0} creati, ${result?.updated || 0} aggiornati, ${result?.removedOrphans || 0} orfani rimossi.`,
      () => rigeneraPrimaNotaDaPagamenti(),
      ['dashboard', 'primaNota', 'gestione', 'sync']
    );
  }

  function handleSavePrimaNotaConfig(payload) {
    return runAction('config', 'salva-prima-nota-config', 'Configurazione Prima Nota salvata.', () => savePrimaNotaConfig(payload), ['primaNota', 'primaNotaConfig', 'sync']);
  }


  function handleSaveIncassoCassa(payload) {
    return runAction('gestione', 'salva-incasso', 'Chiusura giornata salvata e Prima Nota aggiornata.', () => saveIncassoCassa(payload), ['dashboard', 'gestione', 'primaNota', 'sync']);
  }

  function handleImportIncassiCassa(rows) {
    return runAction('gestione', 'import-incassi-xlsx', (result) => `Import incassi completato: ${result?.imported || 0} giornate importate.`, () => importIncassiCassa(rows), ['dashboard', 'gestione', 'primaNota', 'sync']);
  }

  function handleDeleteIncassoCassa(id) {
    return runAction('gestione', 'elimina-incasso', 'Chiusura eliminata e movimenti automatici rimossi.', () => deleteIncassoCassa(id), ['dashboard', 'gestione', 'primaNota', 'sync']);
  }

  function handleSaveBustaPaga(payload) {
    return runAction('gestione', 'salva-busta-paga', 'Busta paga salvata e Prima Nota aggiornata.', () => saveBustaPaga(payload), ['dashboard', 'gestione', 'primaNota', 'sync']);
  }

  function handleImportBustePaga(json) {
    return runAction('gestione', 'import-buste-json', (result) => `Import buste paga completato: ${result?.imported || 0} importate.`, () => importBustePagaJson(json), ['dashboard', 'gestione', 'primaNota', 'sync']);
  }

  function handleDeleteBustaPaga(id) {
    return runAction('gestione', 'elimina-busta-paga', 'Busta paga eliminata e movimento automatico rimosso.', () => deleteBustaPaga(id), ['dashboard', 'gestione', 'primaNota', 'sync']);
  }

  function handleSaveVersamentoF24(payload) {
    return runAction('gestione', 'salva-f24', 'F24 salvato e Prima Nota aggiornata.', () => saveVersamentoF24(payload), ['dashboard', 'gestione', 'primaNota', 'sync']);
  }

  function handleImportF24(json) {
    return runAction('gestione', 'import-f24-json', (result) => `Import F24 completato: ${result?.imported || 0} importati.`, () => importF24Json(json), ['dashboard', 'gestione', 'primaNota', 'sync']);
  }

  function handleDeleteVersamentoF24(id) {
    return runAction('gestione', 'elimina-f24', 'F24 eliminato e movimento automatico rimosso.', () => deleteVersamentoF24(id), ['dashboard', 'gestione', 'primaNota', 'sync']);
  }

  function handleSaveSyncConfig(payload) {
    return runAction('sync', 'salva-config', 'Configurazione sync salvata.', () => saveSyncConfig(payload), ['sync']);
  }

  function handleGenerateSyncSnapshot(options) {
    return runAction(
      'sync',
      'genera-snapshot',
      (result) => `Snapshot generato: ${result?.rowsTotal || 0} righe esportate.`,
      () => generateSyncSnapshot(options),
      ['sync']
    );
  }

  function handleApplySyncSnapshot(json) {
    return runAction('sync', 'import-snapshot', (result) => `Import snapshot completato: ${result.inserted} inseriti, ${result.updated} aggiornati, ${result.skipped} saltati.`, () =>
      applySyncSnapshot(json)
    , 'all');
  }

  function handleCheckCloudSync() {
    return runAction('sync', 'check-cloud', 'Controllo cloud completato.', () => checkCloudSyncStatus(), ['sync']);
  }

  function handlePushSyncCloud() {
    return runAction('sync', 'push-cloud', (result) => `Snapshot inviato al cloud. Righe: ${result.rowsTotal || 0}.`, () => pushSyncSnapshotToCloud(), ['sync']);
  }

  function handlePushSyncCloudAndExplode() {
    return runAction('sync', 'push-cloud-sheets', (result) => {
      const rows = result?.explodeSummary?.rowsTotal || result?.rowsTotal || 0;
      return `Snapshot inviato e fogli Google aggiornati. Righe: ${rows}.`;
    }, () => pushSyncSnapshotToCloudAndExplode(), ['sync']);
  }

  function handleExplodeCloudSheets() {
    return runAction('sync', 'explode-sheets', (result) => `Fogli Google aggiornati. Righe: ${result?.explodeSummary?.rowsTotal || 0}.`, () => explodeCloudSnapshotToSheets(), ['sync']);
  }

  function handlePullSyncCloud() {
    return runAction('sync', 'pull-cloud', (result) => {
      const summary = result?.summary;
      return summary ? `Cloud importato: ${summary.inserted} inseriti, ${summary.updated} aggiornati, ${summary.skipped} saltati.` : 'Cloud importato.';
    }, () => pullSyncSnapshotFromCloud(), 'all');
  }

  function handleCheckPushSafety() {
    return runAction('sync', 'check-push-safety', (result) => result?.canPushSafely ? 'Push sicuro: cloud allineato o aggiornato dallo stesso PC.' : 'Attenzione: cloud diverso. Fai Pull prima del Push.', () => getPushSafetyStatus(), ['sync']);
  }

  function handlePullThenPushSyncCloud() {
    return runAction('sync', 'pull-then-push', (result) => {
      const pullSummary = result?.pull?.summary;
      const rows = result?.push?.explodeSummary?.rowsTotal || result?.push?.rowsTotal || 0;
      return pullSummary
        ? `Pull completato (${pullSummary.inserted} inseriti, ${pullSummary.updated} aggiornati) e nuovo push inviato. Righe fogli: ${rows}.`
        : `Pull + push completati. Righe fogli: ${rows}.`;
    }, () => pullThenPushSyncSnapshotToCloudAndExplode(), 'all');
  }

  function handleForcePushSyncCloud() {
    return runAction('sync', 'force-push-cloud-sheets', (result) => {
      const rows = result?.explodeSummary?.rowsTotal || result?.rowsTotal || 0;
      return `Forza push completato. Snapshot cloud sovrascritto e fogli aggiornati. Righe: ${rows}.`;
    }, () => forcePushSyncSnapshotToCloudAndExplode(), ['sync']);
  }

  function handleCreateLocalBackup() {
    return runAction('backup', 'crea-backup-locale', (result) => `Backup locale creato: ${result?.file_name || 'ok'} (${result?.size_label || ''}).`, () => createLocalDbBackup('manuale'), ['sync']);
  }

  function handleOpenBackupFolder() {
    return runAction('backup', 'apri-cartella-backup', 'Cartella backup aperta.', () => openLocalBackupFolder(), []);
  }

  function handleRunDbDiagnostics() {
    return runAction('backup', 'diagnostica-db', (result) => result?.ok ? 'Diagnostica database OK.' : 'Diagnostica completata con errori.', () => runDatabaseDiagnostics(), ['sync']);
  }

  function cancelClosePrompt() {
    closingRef.current = false;
    setClosePrompt({ open: false, pending: 0, working: false, error: '' });
  }

  async function destroyAppWindow() {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().destroy();
  }

  async function closeWithoutSync() {
    try {
      setClosePrompt((prev) => ({ ...prev, working: true }));
      await destroyAppWindow();
    } catch (err) {
      reportError('sync', 'chiudi-senza-sync', err);
      closingRef.current = false;
      setClosePrompt({ open: false, pending: 0, working: false, error: '' });
    }
  }

  async function syncAndClose() {
    try {
      setClosePrompt((prev) => ({ ...prev, working: true, error: '' }));
      flash('Push cloud prima della chiusura...', 'info');
      await pushSyncSnapshotToCloud();
      await reload();
      await destroyAppWindow();
    } catch (err) {
      reportError('sync', 'chiusura-app-confermata', err);
      setClosePrompt((prev) => ({
        ...prev,
        working: false,
        error: 'Sync non riuscito. I dati locali sono salvi: ' + String(err?.message || err)
      }));
    }
  }

  function renderPage() {
    if (!ready) return <div className="loading-card">Caricamento database locale...</div>;
    if (PLACEHOLDER_PAGES[active]) return <PlaceholderPage {...PLACEHOLDER_PAGES[active]} />;

    switch (active) {
      case 'dashboard':
        return <DashboardPage dashboard={dashboard} scadenze={scadenze} gestioneData={gestioneData} liquidita={primaNotaData?.totals?.saldo ?? 0} scadenzeAperte={dashboard?.totaleAperto ?? 0} />;
      case 'scadenziario':
        return <ScadenziarioPage data={scadenziarioData} fattureVendita={gestioneData?.fattureVendita || []} onPaid={handlePaid} onPaidMany={handlePaidMany} onSetStatus={handleSetStatus} onSetStatusMany={handleSetStatusMany} onReopen={handleReopen} onSaveFattura={handleSaveFattura} onSaveFornitore={handleSaveFornitore} onSaveRegola={handleSaveRegola} />;
      case 'prima-nota':
        return <PrimaNotaPage data={primaNotaData} onSaveMovement={handleSavePrimaNotaMovement} onDeleteMovement={handleDeletePrimaNotaMovement} onRegenerateAutomatic={handleRegeneratePrimaNotaAutomatic} />;
      case 'caricamenti':
        return <CaricamentiPage data={scadenziarioData} gestioneData={gestioneData} onImportXmlAcquisto={handleImportXml} onImportXmlVendita={handleImportXmlVendita} onSaveIncasso={handleSaveIncassoCassa} onImportIncassi={handleImportIncassiCassa} onDeleteIncasso={handleDeleteIncassoCassa} onSaveBusta={handleSaveBustaPaga} onImportBuste={handleImportBustePaga} onDeleteBusta={handleDeleteBustaPaga} onSaveF24={handleSaveVersamentoF24} onImportF24={handleImportF24} onDeleteF24={handleDeleteVersamentoF24} />;
      case 'prezzi':
        return <ControlloPrezzi data={prezziData} onMap={handleSaveProdottoMapping} onMapMany={handleSaveProdottoMappingBulk} onSaveProduct={handleSaveProdotto} />;
      case 'ordine':
        return <OrdineFornitore righe={prezziData?.righe || []} />;
      case 'food-cost':
        return <FoodCostPage data={foodCostData} onSaveRecipe={handleSaveRicetta} onDeleteRecipe={handleDeleteRicetta} />;
      case 'admin':
        return <GestionePage data={gestioneData} liquidita={primaNotaData?.totals?.saldo ?? 0} scadenzeAperte={dashboard?.totaleAperto ?? 0} />;
      case 'config':
        return <ConfigPage primaNotaConfig={primaNotaConfig} onSavePrimaNotaConfig={handleSavePrimaNotaConfig} />;
      case 'sync':
        return <SyncBackupPage dbMode={dbMode} data={syncData} closeHookStatus={closeHookStatus} onSaveConfig={handleSaveSyncConfig} onGenerateSnapshot={handleGenerateSyncSnapshot} onApplySnapshot={handleApplySyncSnapshot} onCheckCloud={handleCheckCloudSync} onCheckPushSafety={handleCheckPushSafety} onPushCloud={handlePushSyncCloud} onPushCloudAndExplode={handlePushSyncCloudAndExplode} onPullThenPushCloud={handlePullThenPushSyncCloud} onForcePushCloud={handleForcePushSyncCloud} onExplodeSheets={handleExplodeCloudSheets} onPullCloud={handlePullSyncCloud} onCreateLocalBackup={handleCreateLocalBackup} onOpenBackupFolder={handleOpenBackupFolder} onRunDbDiagnostics={handleRunDbDiagnostics} />;
      default:
        return null;
    }
  }

  return (
    <div className="app-shell">
      {showSetup && <SetupDevice onSetup={handleSetupComplete} />}
      {showPinModal && <PinModal onSuccess={handlePinSubmit} onCancel={() => setShowPinModal(false)} />}
      <Sidebar active={active} onChange={setActive} deviceMode={effectiveMode} onUnlock={handleUnlockRequest} />
      <main className="main-content">
        <Toast message={notice.message} type={notice.type} />
        {renderPage()}
      </main>
      {bulkErrorReport && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Mappatura completata con avvisi</p>
                <h2>{bulkErrorReport.salvati} salvati · {bulkErrorReport.errori.length} saltati</h2>
              </div>
              <button className="icon-btn" onClick={() => setBulkErrorReport(null)}>×</button>
            </div>
            {bulkErrorReport.salvati > 0 && (
              <p style={{ color: 'var(--green)', fontWeight: 850 }}>✓ {bulkErrorReport.salvati} prodotti mappati correttamente (righe aggiornate: {bulkErrorReport.totalUpdated}).</p>
            )}
            <p style={{ marginTop: 10, fontWeight: 850 }}>Prodotti non salvati ({bulkErrorReport.errori.length}):</p>
            <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8, border: '1px solid var(--line)', borderRadius: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr><th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>Prodotto</th><th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>Motivo</th></tr></thead>
                <tbody>
                  {bulkErrorReport.errori.map((e, i) => (
                    <tr key={i}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(222,214,202,.5)', fontWeight: 750 }}>{e.nome}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(222,214,202,.5)', color: 'var(--red)' }}>{e.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="primary-btn" onClick={() => setBulkErrorReport(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
      {closePrompt.open ? (
        <div className="close-sync-backdrop" role="dialog" aria-modal="true">
          <div className="close-sync-modal">
            <p className="eyebrow">Chiusura BarAI Desktop</p>
            <h2>Vuoi sincronizzare prima di chiudere?</h2>
            <p>
              {closePrompt.pending > 0
                ? `Ci sono ${closePrompt.pending} modifiche locali non ancora sincronizzate.`
                : 'Non risultano modifiche locali in coda, ma puoi comunque aggiornare il cloud con l’ultimo snapshot.'}
            </p>
            <p className="muted-line">
              Il database locale resta sempre salvo sul Mac. Il sync aggiorna JSON cloud e fogli Google leggibili per la web app.
            </p>
            {closePrompt.error ? <div className="close-sync-error">{closePrompt.error}</div> : null}
            <div className="close-sync-actions">
              <button className="primary-btn" type="button" onClick={syncAndClose} disabled={closePrompt.working}>
                {closePrompt.working ? 'Sincronizzo...' : 'Sincronizza e chiudi'}
              </button>
              <button className="ghost-btn" type="button" onClick={closeWithoutSync} disabled={closePrompt.working}>
                Chiudi senza sync
              </button>
              <button className="ghost-btn" type="button" onClick={cancelClosePrompt} disabled={closePrompt.working}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
