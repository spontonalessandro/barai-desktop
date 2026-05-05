import { useMemo, useState } from 'react';
import { euro, formatDate, monthKey, todayISO } from '../utils/format.js';
import { norm } from '../utils/productGuess.js';
import { downloadCsv } from '../utils/csv.js';

const EMPTY_FORM = {
  id: '',
  data_movimento: '',
  tipo: 'USCITA',
  conto: 'Banca',
  conto_destinazione: '',
  categoria: 'Spese varie',
  sottocategoria: '',
  descrizione: '',
  importo: '',
  metodo_pagamento: '',
  note: ''
};

function freshForm() {
  return { ...EMPTY_FORM, data_movimento: todayISO() };
}



export default function PrimaNotaPage({ data, onSaveMovement, onDeleteMovement, onRegenerateAutomatic }) {
  const movimenti = data?.movimenti || [];
  const conti = data?.conti || [];
  const categorie = data?.categorie || [];
  const totals = data?.totals || { entrate: 0, uscite: 0, saldo: 0, perConto: [] };
  const monthly = data?.monthly || [];
  const byCategory = data?.byCategory || [];
  const [form, setForm] = useState(() => freshForm());
  const [filters, setFilters] = useState({ search: '', tipo: 'Tutti', conto: 'Tutti', categoria: 'Tutte', mese: 'Tutti', origine: 'Tutte' });
  const [regen, setRegen] = useState({ working: false, result: null, error: '' });

  const months = useMemo(() => {
    return Array.from(new Set(movimenti.map((m) => monthKey(m.data_movimento)).filter(Boolean))).sort().reverse();
  }, [movimenti]);

  const filtered = useMemo(() => {
    const q = norm(filters.search);
    return movimenti.filter((m) => {
      if (filters.tipo !== 'Tutti' && m.tipo !== filters.tipo) return false;
      if (filters.conto !== 'Tutti') {
        const matchOrigine = (m.conto || 'Altro') === filters.conto;
        const matchDest = m.tipo === 'GIROCONTO' && (m.conto_destinazione || 'Altro') === filters.conto;
        if (!matchOrigine && !matchDest) return false;
      }
      if (filters.categoria !== 'Tutte' && (m.categoria || '') !== filters.categoria) return false;
      if (filters.origine !== 'Tutte' && (m.origine || 'Manuale') !== filters.origine) return false;
      if (filters.mese !== 'Tutti' && monthKey(m.data_movimento) !== filters.mese) return false;
      if (q) {
        const hay = `${m.descrizione || ''} ${m.categoria || ''} ${m.sottocategoria || ''} ${m.conto || ''} ${m.conto_destinazione || ''} ${m.fornitore_nome || ''} ${m.note || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [movimenti, filters]);

  const filteredTotals = useMemo(() => {
    const entrate = filtered.filter((m) => m.tipo === 'ENTRATA').reduce((a, m) => a + Number(m.importo || 0), 0);
    const uscite = filtered.filter((m) => m.tipo === 'USCITA').reduce((a, m) => a + Number(m.importo || 0), 0);
    const giroconti = filtered.filter((m) => m.tipo === 'GIROCONTO').reduce((a, m) => a + Number(m.importo || 0), 0);
    return { entrate, uscite, giroconti, saldo: entrate - uscite };
  }, [filtered]);

  function update(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'tipo' && value === 'GIROCONTO') {
        next.categoria = next.categoria || 'Giroconti';
        next.metodo_pagamento = '';
        if (!next.conto_destinazione) next.conto_destinazione = conti.find((c) => c !== next.conto) || 'Altro';
      }
      return next;
    });
  }

  function resetForm() {
    setForm(freshForm());
  }

  function editMovement(m) {
    setForm({
      id: m.id || '',
      data_movimento: m.data_movimento || todayISO(),
      tipo: m.tipo || 'USCITA',
      conto: m.conto || 'Altro',
      conto_destinazione: m.conto_destinazione || '',
      categoria: m.categoria || 'Spese varie',
      sottocategoria: m.sottocategoria || '',
      descrizione: m.descrizione || '',
      importo: String(m.importo || ''),
      metodo_pagamento: m.metodo_pagamento || '',
      note: m.note || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e) {
    e.preventDefault();
    await onSaveMovement(form);
    resetForm();
  }

  async function remove(id) {
    const ok = window.confirm('Eliminare questo movimento manuale dalla Prima Nota?');
    if (!ok) return;
    await onDeleteMovement(id);
  }

  async function regenerateAutomatic() {
    const ok = window.confirm('Rigenero i movimenti automatici da pagamenti/scadenze già pagate. I movimenti manuali non vengono toccati. Procedo?');
    if (!ok) return;
    setRegen({ working: true, result: null, error: '' });
    try {
      const result = await onRegenerateAutomatic();
      setRegen({ working: false, result, error: '' });
    } catch (err) {
      setRegen({ working: false, result: null, error: err?.message || String(err) });
    }
  }

  function exportCsv() {
    const headers = ['Data','Tipo','Conto origine','Conto destinazione','Categoria','Sottocategoria','Descrizione','Origine','Importo','Metodo','Fornitore','Note'];
    const rows = filtered.map((m) => [
      m.data_movimento || '',
      m.tipo || '',
      m.conto || '',
      m.conto_destinazione || '',
      m.categoria || '',
      m.sottocategoria || '',
      m.descrizione || '',
      m.origine || '',
      Number(m.importo || 0).toFixed(2).replace('.', ','),
      m.metodo_pagamento || '',
      m.fornitore_nome || '',
      m.note || ''
    ]);
    downloadCsv(`prima_nota_${todayISO()}.csv`, [headers, ...rows], { mode: 'rows' });
  }

  return (
    <section className="page-section prima-nota-page">
      <div className="section-header">
        <div>
          <p className="eyebrow">Prima Nota gestionale v9.1</p>
          <h1>Prima Nota</h1>
          <p>Registro unico di entrate, uscite, giroconti, movimenti manuali e pagamenti generati dallo Scadenziario.</p>
        </div>
        <div className="hero-actions">
          <button className="ghost-btn" type="button" onClick={regenerateAutomatic} disabled={regen.working}>
            {regen.working ? 'Rigenerazione...' : 'Rigenera automatici'}
          </button>
          <button className="primary-btn" type="button" onClick={exportCsv}>Esporta CSV</button>
        </div>
      </div>

      {(regen.working || regen.result || regen.error) && (
        <div className={`card inline-result ${regen.error ? 'error' : 'success'}`}>
          {regen.working ? (
            <p><strong>Rigenerazione in corso...</strong> Controllo pagamenti e scadenze pagate.</p>
          ) : regen.error ? (
            <p><strong>Rigenerazione non riuscita.</strong> {regen.error}</p>
          ) : (
            <p>
              <strong>Rigenerazione completata.</strong>{' '}
              Creati: {regen.result?.created || 0} · Aggiornati: {regen.result?.updated || 0} ·
              Da pagamenti: {regen.result?.fromPagamenti || 0} · Da scadenze: {regen.result?.fromScadenze || 0} ·
              Orfani rimossi: {regen.result?.removedOrphans || 0} · Saltati: {regen.result?.skipped || 0}
            </p>
          )}
        </div>
      )}

      <div className="kpi-grid small">
        <div className="kpi-card success"><span>Entrate filtrate</span><strong>{euro(filteredTotals.entrate)}</strong><em>Totale movimenti entrata</em></div>
        <div className="kpi-card warning"><span>Uscite filtrate</span><strong>{euro(filteredTotals.uscite)}</strong><em>Totale movimenti uscita</em></div>
        <div className="kpi-card"><span>Saldo filtrato</span><strong>{euro(filteredTotals.saldo)}</strong><em>Entrate - uscite</em></div>
        <div className="kpi-card"><span>Giroconti filtrati</span><strong>{euro(filteredTotals.giroconti)}</strong><em>Trasferimenti tra conti</em></div>
      </div>

      <div className="card prima-form-card">
        <div className="card-header-row compact-header">
          <div>
            <h2>{form.id ? 'Modifica movimento manuale' : 'Nuovo movimento manuale'}</h2>
            <p>Per fatture pagate, BarAI crea il movimento automatico dallo Scadenziario.</p>
          </div>
          {form.id ? <button className="ghost-btn" type="button" onClick={resetForm}>Nuovo</button> : null}
        </div>
        <form className="prima-form-grid" onSubmit={submit}>
          <label>Data<input type="date" value={form.data_movimento} onChange={(e) => update('data_movimento', e.target.value)} /></label>
          <label>Tipo<select value={form.tipo} onChange={(e) => update('tipo', e.target.value)}><option>ENTRATA</option><option>USCITA</option><option>GIROCONTO</option></select></label>
          <label>{form.tipo === 'GIROCONTO' ? 'Da conto' : 'Conto'}<input list="prima-conti" value={form.conto} onChange={(e) => update('conto', e.target.value)} /></label>
          {form.tipo === 'GIROCONTO' ? <label>A conto<input list="prima-conti" value={form.conto_destinazione} onChange={(e) => update('conto_destinazione', e.target.value)} /></label> : null}
          <label>Categoria<input list="prima-categorie" value={form.categoria} onChange={(e) => update('categoria', e.target.value)} /></label>
          <label>Sottocategoria<input value={form.sottocategoria} onChange={(e) => update('sottocategoria', e.target.value)} placeholder="es. affitto maggio" /></label>
          {form.tipo !== 'GIROCONTO' ? <label>Metodo<input value={form.metodo_pagamento} onChange={(e) => update('metodo_pagamento', e.target.value)} placeholder="Bonifico, contanti..." /></label> : null}
          <label className="span-2">Descrizione<input value={form.descrizione} onChange={(e) => update('descrizione', e.target.value)} placeholder="Es. Assicurazione locale" /></label>
          <label>Importo<input type="number" step="0.01" min="0" value={form.importo} onChange={(e) => update('importo', e.target.value)} /></label>
          <label className="span-2">Note<input value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Opzionale" /></label>
          <div className="prima-form-actions"><button className="primary-btn" type="submit">{form.id ? 'Salva modifica' : 'Aggiungi movimento'}</button></div>
          <datalist id="prima-conti">{conti.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="prima-categorie">{categorie.map((c) => <option key={c} value={c} />)}</datalist>
        </form>
      </div>

      <div className="card toolbar prima-toolbar">
        <input placeholder="Cerca descrizione, categoria, fornitore..." value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
        <select value={filters.tipo} onChange={(e) => setFilters((p) => ({ ...p, tipo: e.target.value }))}><option>Tutti</option><option>ENTRATA</option><option>USCITA</option><option>GIROCONTO</option></select>
        <select value={filters.conto} onChange={(e) => setFilters((p) => ({ ...p, conto: e.target.value }))}><option>Tutti</option>{conti.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={filters.categoria} onChange={(e) => setFilters((p) => ({ ...p, categoria: e.target.value }))}><option>Tutte</option>{categorie.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={filters.mese} onChange={(e) => setFilters((p) => ({ ...p, mese: e.target.value }))}><option>Tutti</option>{months.map((m) => <option key={m}>{m}</option>)}</select>
        <select value={filters.origine} onChange={(e) => setFilters((p) => ({ ...p, origine: e.target.value }))}><option>Tutte</option><option>Manuale</option><option>Scadenziario</option></select>
        <button className="ghost-btn" type="button" onClick={() => setFilters({ search: '', tipo: 'Tutti', conto: 'Tutti', categoria: 'Tutte', mese: 'Tutti', origine: 'Tutte' })}>Pulisci</button>
      </div>

      <div className="card table-card">
        <div className="card-header-row compact-header">
          <div>
            <h2>Movimenti</h2>
            <p>Gli automatici da fattura non si modificano qui: si aggiornano riaprendo/pagando la scadenza.</p>
          </div>
          <span className="muted-line">{filtered.length} movimenti visualizzati</span>
        </div>
        <table className="compact-table prima-table">
          <thead>
            <tr>
              <th className="date-col">Data</th>
              <th>Tipo</th>
              <th>Conti</th>
              <th>Categoria</th>
              <th>Descrizione</th>
              <th>Origine</th>
              <th className="amount-col">Importo</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan="8" className="empty-cell">Nessun movimento trovato.</td></tr> : null}
            {filtered.map((m) => (
              <tr key={m.id}>
                <td>{formatDate(m.data_movimento)}</td>
                <td><span className={`badge badge-${String(m.tipo || '').toLowerCase()}`}>{m.tipo}</span></td>
                <td>
                  <strong>{m.conto || '-'}</strong>
                  {m.tipo === 'GIROCONTO' ? <><br /><span className="muted-line">→ {m.conto_destinazione || '-'}</span></> : null}
                </td>
                <td><strong>{m.categoria || '-'}</strong><br /><span className="muted-line">{m.sottocategoria || m.fornitore_nome || ''}</span></td>
                <td className="supplier-cell"><strong>{m.descrizione}</strong>{m.note ? <><br /><span className="muted-line">{m.note}</span></> : null}</td>
                <td>{m.origine || 'Manuale'}{Number(m.auto_generato || 0) === 1 ? <><br /><span className="muted-line">automatico</span></> : null}</td>
                <td className="right"><strong>{euro(m.importo)}</strong></td>
                <td className="action-cell">
                  {Number(m.auto_generato || 0) === 1 ? <span className="muted-line">Da scadenza</span> : (
                    <>
                      <button className="small-btn muted" type="button" onClick={() => editMovement(m)}>Modifica</button>
                      <button className="small-btn muted" type="button" onClick={() => remove(m.id)}>Elimina</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cards-grid two">
        <div className="card soft">
          <h2>Saldo per conto</h2>
          <div className="conto-grid">
            {(totals.perConto || []).map((c) => (
              <div className="conto-chip" key={c.conto}>
                <span>{c.conto}</span>
                <strong>{euro(c.saldo)}</strong>
                <em>Entrate {euro(c.entrate)} · Uscite {euro(c.uscite)} · Giroconti {euro(c.giroconti || 0)}</em>
              </div>
            ))}
            {(totals.perConto || []).length === 0 ? <p>Nessun conto movimentato.</p> : null}
          </div>
        </div>

        <div className="card soft">
          <h2>Riepilogo mensile</h2>
          <table className="compact-table mini-summary-table">
            <thead><tr><th>Mese</th><th>Entrate</th><th>Uscite</th><th>Saldo</th></tr></thead>
            <tbody>
              {monthly.slice(0, 8).map((m) => <tr key={m.mese}><td>{m.mese}</td><td>{euro(m.entrate)}</td><td>{euro(m.uscite)}</td><td><strong>{euro(m.saldo)}</strong></td></tr>)}
              {monthly.length === 0 ? <tr><td colSpan="4" className="empty-cell">Nessun dato mensile.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card soft">
        <h2>Uscite / entrate per categoria</h2>
        <div className="category-summary-grid">
          {byCategory.slice(0, 12).map((c) => (
            <div className="category-summary-chip" key={c.categoria}>
              <span>{c.categoria}</span>
              <strong>{euro(c.saldo)}</strong>
              <em>Entrate {euro(c.entrate)} · Uscite {euro(c.uscite)} · {c.movimenti} mov.</em>
            </div>
          ))}
          {byCategory.length === 0 ? <p>Nessuna categoria movimentata.</p> : null}
        </div>
      </div>
    </section>
  );
}
