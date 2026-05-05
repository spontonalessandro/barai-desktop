import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Cloud, CloudDownload, CloudUpload, Copy, Database, Download, FolderOpen, HardDrive, RefreshCw, ShieldCheck, Upload } from 'lucide-react';

function fmtDateTime(value) {
  if (!value) return 'Mai';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

function mask(value) {
  if (!value) return 'Non impostato';
  if (value.length <= 10) return '••••••';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function totalCounts(counts = {}) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

const OP_LABELS = {
  config: 'salvataggio configurazione',
  check: 'controllo cloud',
  pushSheets: 'push JSON + aggiornamento fogli Google',
  pullThenPush: 'pull cloud + push sicuro',
  forcePush: 'forza push JSON + fogli Google',
  checkSafety: 'controllo sicurezza push',
  push: 'push JSON',
  explode: 'aggiornamento fogli Google',
  pull: 'pull cloud + merge locale',
  export: 'generazione snapshot locale',
  import: 'import snapshot locale',
  backup: 'backup locale SQLite',
  openBackupFolder: 'apertura cartella backup',
  diagnostics: 'diagnostica database'
};

export default function SyncBackupPage({
  dbMode,
  data,
  onSaveConfig,
  onGenerateSnapshot,
  onApplySnapshot,
  onCheckCloud,
  onCheckPushSafety,
  onPushCloud,
  onPushCloudAndExplode,
  onPullThenPushCloud,
  onForcePushCloud,
  onExplodeSheets,
  onPullCloud,
  onCreateLocalBackup,
  onOpenBackupFolder,
  onRunDbDiagnostics,
  closeHookStatus = 'non_inizializzato'
}) {
  const config = data?.config || {};
  const stats = data?.stats || {};
  const counts = data?.counts || {};
  const recentLogs = data?.recentLogs || [];
  const snapshots = data?.snapshots || [];
  const backup = data?.backup || {};
  const localBackups = backup?.backups || [];

  const [form, setForm] = useState({
    device_name: config.device_name || 'BarAI Desktop',
    cloud_webapp_url: config.cloud_webapp_url || '',
    cloud_sheet_id: config.cloud_sheet_id || '',
    token: '',
    auto_check_on_start: Boolean(config.auto_check_on_start),
    close_mode: config.close_mode || 'ask',
    clear_token: false
  });
  const [exportJson, setExportJson] = useState('');
  const [importJson, setImportJson] = useState('');
  const [busy, setBusy] = useState('');
  const [cloudResult, setCloudResult] = useState(null);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      device_name: config.device_name || prev.device_name || 'BarAI Desktop',
      cloud_webapp_url: config.cloud_webapp_url || prev.cloud_webapp_url || '',
      cloud_sheet_id: config.cloud_sheet_id || prev.cloud_sheet_id || '',
      auto_check_on_start: Boolean(config.auto_check_on_start),
      close_mode: config.close_mode || prev.close_mode || 'ask'
    }));
  }, [config.device_name, config.cloud_webapp_url, config.cloud_sheet_id, config.auto_check_on_start, config.close_mode]);

  const rowsTotal = totalCounts(counts);
  const cloudNeedsPull = Boolean(
    config.last_cloud_status_revision
    && config.last_cloud_status_revision !== config.last_cloud_revision
    && (!config.last_cloud_status_device_id || config.last_cloud_status_device_id !== config.device_id)
  );

  async function runBusy(name, fn) {
    const label = OP_LABELS[name] || name;
    setBusy(name);
    setCloudResult({ ok: true, action: name, status: `Operazione avviata: ${label}...` });
    try {
      const result = await fn();
      setCloudResult({ ok: true, action: name, completed: true, ...(result || {}) });
      return result;
    } catch (err) {
      setCloudResult({ ok: false, error: String(err?.message || err), action: name });
      throw err;
    } finally {
      setBusy('');
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    await runBusy('config', () => onSaveConfig(form));
    setForm((prev) => ({ ...prev, token: '', clear_token: false }));
  }

  async function handleGenerate() {
    const result = await runBusy('export', () => onGenerateSnapshot({ includeLogs: true }));
    setExportJson(result?.json || '');
  }

  async function handleCopyExport() {
    if (!exportJson) return;
    await navigator.clipboard?.writeText(exportJson);
  }

  async function handleImport() {
    if (!importJson.trim()) return;
    const ok = window.confirm('Importo lo snapshot e unisco i dati nel database locale. I record locali più recenti vengono mantenuti. Procedo?');
    if (!ok) return;
    await runBusy('import', () => onApplySnapshot(importJson));
    setImportJson('');
  }

  async function handlePull() {
    await runBusy('pull', () => onPullCloud());
  }

  async function handlePushOnly() {
    await runBusy('push', () => onPushCloud());
  }

  async function handlePushSheets() {
    await runBusy('pushSheets', () => onPushCloudAndExplode());
  }

  async function handlePullThenPush() {
    await runBusy('pullThenPush', () => onPullThenPushCloud());
  }

  async function handleForcePush() {
    const ok = window.confirm('Forza push sovrascrive lo snapshot cloud con i dati di questo PC anche se il cloud risulta aggiornato da un altro computer. Usalo solo se sei sicuro. Procedo?');
    if (!ok) return;
    await runBusy('forcePush', () => onForcePushCloud());
  }

  async function handleCreateLocalBackup() {
    await runBusy('backup', () => onCreateLocalBackup());
  }

  async function handleOpenBackupFolder() {
    await runBusy('openBackupFolder', () => onOpenBackupFolder());
  }

  async function handleDiagnostics() {
    await runBusy('diagnostics', () => onRunDbDiagnostics());
  }

  return (
    <section className="page-section sync-page">
      <div className="section-header">
        <div>
          <p className="eyebrow">Sicurezza dati v9.1</p>
          <h1>Sync / Backup</h1>
          <p>Backup locale automatico, diagnostica database e sync multi-PC sicuro prima di passare alla Prima Nota automatica.</p>
        </div>
        <div className="hero-pill">{dbMode === 'tauri-sqlite' ? 'SQLite locale attivo' : 'Browser demo'}</div>
      </div>

      {cloudNeedsPull ? (
        <div className="sync-warning-box">
          Cloud più recente rilevato da <strong>{config.last_cloud_status_device_name || 'altro PC'}</strong>. Per sicurezza il Push viene bloccato finché non fai <strong>Pull cloud e unisci</strong>.
        </div>
      ) : null}

      <div className="kpi-grid small">
        <div className="kpi-card">
          <span>Dispositivo</span>
          <strong>{config.device_name || 'BarAI Desktop'}</strong>
          <em>{mask(config.device_id)}</em>
        </div>
        <div className="kpi-card warning">
          <span>Coda da sincronizzare</span>
          <strong>{stats.pending || 0}</strong>
          <em>Operazioni locali non marcate synced</em>
        </div>
        <div className="kpi-card success">
          <span>Record nello snapshot</span>
          <strong>{rowsTotal}</strong>
          <em>{Object.keys(counts).length} tabelle gestite</em>
        </div>
        <div className="kpi-card">
          <span>Ultima sync</span>
          <strong>{fmtDateTime(config.last_sync_at)}</strong>
          <em>Cloud rev: {config.last_cloud_revision || '—'}</em>
        </div>
      </div>

      <div className="cards-grid two">
        <form className="card sync-config-card" onSubmit={handleSave}>
          <div className="mini-header">
            <div>
              <h3>Configurazione cloud</h3>
              <p>Inserisci URL Web App Apps Script e token. Il token resta nel database locale, non nello snapshot esportato.</p>
            </div>
            <ShieldCheck size={22} />
          </div>
          <div className="form-grid sync-form-grid">
            <label>
              Nome PC
              <input value={form.device_name} onChange={(e) => setForm({ ...form, device_name: e.target.value })} placeholder="Mac Bar / PC Ufficio" />
            </label>
            <label>
              Google Sheet ID cloud
              <input value={form.cloud_sheet_id} onChange={(e) => setForm({ ...form, cloud_sheet_id: e.target.value })} placeholder="ID foglio sync" />
            </label>
            <label className="span-2">
              URL Web App Apps Script
              <input value={form.cloud_webapp_url} onChange={(e) => setForm({ ...form, cloud_webapp_url: e.target.value })} placeholder="https://script.google.com/macros/s/.../exec" />
            </label>
            <label>
              Token sync
              <input value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder={config.token_set ? 'Token già impostato' : 'Imposta token'} type="password" />
            </label>
            <label className="check-label sync-check">
              <input type="checkbox" checked={form.clear_token} onChange={(e) => setForm({ ...form, clear_token: e.target.checked })} />
              Cancella/sostituisci token
            </label>
            <label className="check-label span-2 sync-check">
              <input type="checkbox" checked={form.auto_check_on_start} onChange={(e) => setForm({ ...form, auto_check_on_start: e.target.checked })} />
              Controlla cloud all’apertura e avvisa se un altro PC ha aggiornato i dati
            </label>
            <label className="span-2">
              Sync alla chiusura app
              <select value={form.close_mode || 'ask'} onChange={(e) => setForm({ ...form, close_mode: e.target.value })}>
                <option value="off">Disattivato</option>
                <option value="ask">Chiedi conferma</option>
                <option value="auto">Automatico</option>
              </select>
            </label>
          </div>
          <div className="form-actions sync-actions">
            <button className="ghost-btn" type="button" onClick={() => runBusy('check', () => onCheckCloud())} disabled={Boolean(busy)}><RefreshCw size={15} /> Controlla cloud</button>
            <button className="primary-btn" type="submit" disabled={Boolean(busy)}>{busy === 'config' ? 'Salvo...' : 'Salva configurazione'}</button>
          </div>
        </form>

        <div className="card sync-status-card">
          <div className="mini-header">
            <div>
              <h3>Stato architettura</h3>
              <p>La v9.1 mantiene il sync sicuro e aggiunge le fonti dati necessarie al futuro Conto Economico.</p>
            </div>
            <Database size={22} />
          </div>
          <div className="sync-status-list">
            <div><span>Database vivo</span><strong>~/Library/Application Support/it.baraidesktop.app/barai.sqlite</strong></div>
            <div><span>Token</span><strong>{config.token_set ? 'Impostato' : 'Non impostato'}</strong></div>
            <div><span>Ultimo push</span><strong>{fmtDateTime(config.last_push_at)}</strong></div>
            <div><span>Ultimo pull</span><strong>{fmtDateTime(config.last_pull_at)}</strong></div>
            <div><span>Ultimo controllo cloud</span><strong>{fmtDateTime(config.last_cloud_checked_at)}</strong></div>
            <div><span>Ultima rev cloud verificata</span><strong>{config.last_cloud_status_revision || '—'}</strong></div>
            <div><span>Ultimo PC cloud</span><strong>{config.last_cloud_status_device_name || '—'}</strong></div>
            <div><span>Ultimo push rilevato</span><strong>{fmtDateTime(config.last_cloud_status_push_at)}</strong></div>
            <div><span>Ultimo aggiornamento fogli</span><strong>{fmtDateTime(config.last_sheet_explode_at)} · {config.last_sheet_explode_rows || 0} righe</strong></div>
            <div><span>Controllo all’apertura</span><strong>{config.auto_check_on_start ? 'Attivo' : 'Disattivato'}</strong></div>
            <div><span>Sync alla chiusura</span><strong>{config.close_mode === 'auto' ? 'Automatico' : config.close_mode === 'off' ? 'Disattivato' : 'Chiedi conferma'}</strong></div>
            <div><span>Listener chiusura</span><strong>{closeHookStatus === 'attivo' ? 'Attivo' : closeHookStatus === 'non_disponibile' ? 'Non disponibile' : 'Inizializzazione'}</strong></div>
            <div><span>Backup automatico</span><strong>{fmtDateTime(backup.last_auto_at)}</strong></div>
            <div><span>Diagnostica DB</span><strong>{backup.last_integrity_status || '—'} · {fmtDateTime(backup.last_integrity_at)}</strong></div>
          </div>
          {busy ? <div className="sync-inline-loader"><RefreshCw size={15} /> Operazione in corso: {OP_LABELS[busy] || busy}...</div> : null}
          {cloudResult ? <pre className="sync-result-box">{JSON.stringify(cloudResult, null, 2)}</pre> : null}
        </div>
      </div>

      <div className="cards-grid two">
        <div className="card sync-action-card">
          <div className="mini-header">
            <div>
              <h3>Backup locale SQLite</h3>
              <p>La v9.1 mantiene backup automatico giornaliero e copie manuali prima delle operazioni delicate.</p>
            </div>
            <HardDrive size={22} />
          </div>
          <div className="sync-status-list backup-mini-list">
            <div><span>Ultimo backup automatico</span><strong>{fmtDateTime(backup.last_auto_at)}</strong></div>
            <div><span>Ultimo backup manuale</span><strong>{fmtDateTime(backup.last_manual_at)}</strong></div>
            <div><span>Ultimo percorso</span><strong>{backup.last_path || '—'}</strong></div>
          </div>
          <div className="sync-big-actions">
            <button className="primary-btn" onClick={handleCreateLocalBackup} disabled={Boolean(busy)}><HardDrive size={16} /> Crea backup ora</button>
            <button className="ghost-btn" onClick={handleOpenBackupFolder} disabled={Boolean(busy)}><FolderOpen size={16} /> Apri cartella backup</button>
            <button className="ghost-btn" onClick={handleDiagnostics} disabled={Boolean(busy)}><Activity size={16} /> Diagnostica database</button>
          </div>
          <p className="muted-line">I backup sono salvati in Application Support / it.baraidesktop.app / backups. BarAI mantiene automaticamente gli ultimi 30 backup principali.</p>
        </div>

        <div className="card table-card sync-table-card">
          <div className="card-header-row">
            <div>
              <h3>Backup locali recenti</h3>
              <p>Ultime copie SQLite create su questo computer.</p>
            </div>
          </div>
          <table className="compact-table sync-log-table">
            <thead><tr><th>Data</th><th>File</th><th>Dimensione</th></tr></thead>
            <tbody>
              {localBackups.length ? localBackups.slice(0, 8).map((entry) => (
                <tr key={entry.path || entry.file_name}>
                  <td>{fmtDateTime(entry.modified_at)}</td>
                  <td>{entry.file_name}</td>
                  <td>{entry.size_label || entry.size_bytes}</td>
                </tr>
              )) : <tr><td colSpan="3" className="empty-cell">Nessun backup locale trovato</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cards-grid two">
        <div className="card sync-action-card">
          <div className="mini-header">
            <div>
              <h3>Sync cloud Apps Script</h3>
              <p>Push invia lo snapshot del PC al cloud. Pull scarica l’ultimo snapshot cloud e lo unisce al database locale senza cancellare record locali.</p>
            </div>
            <Cloud size={22} />
          </div>
          <div className="sync-big-actions">
            <button className="primary-btn" onClick={handlePushSheets} disabled={Boolean(busy)}><CloudUpload size={16} /> Push sicuro + aggiorna fogli</button>
            <button className="ghost-btn" onClick={handlePushOnly} disabled={Boolean(busy)}><CloudUpload size={16} /> Solo push sicuro JSON</button>
            <button className="ghost-btn" onClick={() => runBusy('checkSafety', () => onCheckPushSafety())} disabled={Boolean(busy)}><ShieldCheck size={16} /> Controlla sicurezza push</button>
            <button className="ghost-btn" onClick={handlePull} disabled={Boolean(busy)}><CloudDownload size={16} /> Pull cloud e unisci</button>
            <button className="ghost-btn" onClick={handlePullThenPush} disabled={Boolean(busy)}><RefreshCw size={16} /> Pull e poi Push</button>
            <button className="danger-btn" onClick={handleForcePush} disabled={Boolean(busy)}><AlertTriangle size={16} /> Forza push</button>
            <button className="ghost-btn" onClick={() => runBusy('explode', () => onExplodeSheets())} disabled={Boolean(busy)}><RefreshCw size={16} /> Aggiorna solo fogli</button>
          </div>
          <p className="muted-line">La v9.1 mantiene SQLite locale come database vivo. Se un altro PC ha pubblicato dati nuovi, il push viene bloccato finché non fai Pull.</p>
        </div>

        <div className="card sync-action-card">
          <div className="mini-header">
            <div>
              <h3>Snapshot locale manuale</h3>
              <p>Serve come backup immediato e come piano B prima del sync cloud completo.</p>
            </div>
            <Copy size={22} />
          </div>
          <div className="sync-big-actions">
            <button className="primary-btn" onClick={handleGenerate} disabled={Boolean(busy)}><Download size={16} /> Genera JSON</button>
            <button className="ghost-btn" onClick={handleCopyExport} disabled={!exportJson}><Copy size={16} /> Copia JSON</button>
          </div>
        </div>
      </div>

      <div className="cards-grid two">
        <div className="card sync-text-card">
          <h3>Export snapshot JSON</h3>
          <textarea value={exportJson} onChange={(e) => setExportJson(e.target.value)} placeholder="Qui comparirà lo snapshot generato..." />
        </div>
        <div className="card sync-text-card">
          <h3>Import snapshot JSON</h3>
          <textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder="Incolla qui uno snapshot generato da un altro PC..." />
          <div className="form-actions sync-actions">
            <button className="primary-btn" onClick={handleImport} disabled={!importJson.trim() || Boolean(busy)}><Upload size={16} /> Importa e unisci</button>
          </div>
        </div>
      </div>

      <div className="cards-grid two">
        <div className="card table-card sync-table-card">
          <div className="card-header-row">
            <div>
              <h3>Coda sync recente</h3>
              <p>Operazioni locali registrate da BarAI.</p>
            </div>
          </div>
          <table className="compact-table sync-log-table">
            <thead><tr><th>Data</th><th>Tabella</th><th>Record</th><th>Operazione</th><th>Stato</th></tr></thead>
            <tbody>
              {recentLogs.length ? recentLogs.slice(0, 12).map((log) => (
                <tr key={log.id}>
                  <td>{fmtDateTime(log.created_at)}</td>
                  <td>{log.tabella}</td>
                  <td>{log.record_id}</td>
                  <td>{log.operazione}</td>
                  <td><span className={`badge ${log.stato === 'SYNCED' ? 'badge-pagato' : log.stato === 'ERRORE' ? 'badge-da-verificare' : 'badge-aperto'}`}>{log.stato}</span></td>
                </tr>
              )) : <tr><td colSpan="5" className="empty-cell">Nessuna operazione sync registrata</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card table-card sync-table-card">
          <div className="card-header-row">
            <div>
              <h3>Snapshot recenti</h3>
              <p>Storico export/import effettuati.</p>
            </div>
          </div>
          <table className="compact-table sync-log-table">
            <thead><tr><th>Data</th><th>Tipo</th><th>Righe</th><th>Rev</th><th>Esito</th></tr></thead>
            <tbody>
              {snapshots.length ? snapshots.slice(0, 12).map((snap) => (
                <tr key={snap.id}>
                  <td>{fmtDateTime(snap.created_at)}</td>
                  <td>{snap.direction}</td>
                  <td>{snap.rows_total}</td>
                  <td>{snap.cloud_revision || '—'}</td>
                  <td><span className="badge badge-pagato">{snap.status}</span></td>
                </tr>
              )) : <tr><td colSpan="5" className="empty-cell">Nessuno snapshot ancora generato</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
