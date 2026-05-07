import { useMemo, useState } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import { euro, formatDate, todayISO, monthKey, normalizePaymentMethod } from '../utils/format.js';

const PAYMENT_METHODS = ['Contanti', 'Bancomat', 'Bonifico', 'Assegno', 'Carta di credito'];

function FatturaForm({ fattura, fornitori, regole, onCancel, onSave }) {
  const isEdit = Boolean(fattura?.id);
  const [useNewSupplier, setUseNewSupplier] = useState(!fattura?.fornitore_id);
  const [form, setForm] = useState({
    id: fattura?.id || '',
    fornitore_id: fattura?.fornitore_id || '',
    nuovo_fornitore_nome: fattura?.fornitore_nome || '',
    numero: fattura?.numero || '',
    data_fattura: fattura?.data_fattura || todayISO(),
    imponibile: fattura?.imponibile ?? '',
    iva: fattura?.iva ?? '',
    totale: fattura?.totale ?? '',
    metodo_pagamento: fattura?.metodo_pagamento || '',
    regola_pagamento_id: fattura?.regola_pagamento_id || 'reg_da_verificare',
    note: fattura?.note || ''
  });

  const selectedSupplier = fornitori.find((f) => f.id === form.fornitore_id);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function selectSupplier(value) {
    if (value === '__new') {
      setUseNewSupplier(true);
      setForm((prev) => ({ ...prev, fornitore_id: '', nuovo_fornitore_nome: '' }));
      return;
    }
    const supplier = fornitori.find((f) => f.id === value);
    setUseNewSupplier(false);
    setForm((prev) => ({
      ...prev,
      fornitore_id: value,
      nuovo_fornitore_nome: '',
      metodo_pagamento: supplier?.metodo_pagamento_default || prev.metodo_pagamento,
      regola_pagamento_id: supplier?.regola_pagamento_id || prev.regola_pagamento_id
    }));
  }

  function submit(e) {
    e.preventDefault();
    onSave({
      ...form,
      fornitore_nome: useNewSupplier ? form.nuovo_fornitore_nome : selectedSupplier?.ragione_sociale
    });
  }

  return (
    <div className="form-panel">
      <div className="form-title-row">
        <div>
          <p className="eyebrow">{isEdit ? 'Modifica fattura' : 'Nuova fattura'}</p>
          <h2>{isEdit ? fattura.numero : 'Inserimento manuale fattura acquisto'}</h2>
        </div>
        <button className="ghost-btn" onClick={onCancel}>Chiudi</button>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>
          Fornitore
          <select value={useNewSupplier ? '__new' : form.fornitore_id} onChange={(e) => selectSupplier(e.target.value)}>
            <option value="__new">+ Nuovo fornitore</option>
            {fornitori.map((f) => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
          </select>
        </label>
        {useNewSupplier && (
          <label>
            Nome nuovo fornitore
            <input value={form.nuovo_fornitore_nome} onChange={(e) => update('nuovo_fornitore_nome', e.target.value)} placeholder="Es. Fornitore Rossi" />
          </label>
        )}
        <label>
          Numero fattura
          <input value={form.numero} onChange={(e) => update('numero', e.target.value)} placeholder="Es. 123/PA" />
        </label>
        <label>
          Data fattura
          <input type="date" value={form.data_fattura} onChange={(e) => update('data_fattura', e.target.value)} />
        </label>
        <label>
          Imponibile
          <input inputMode="decimal" value={form.imponibile} onChange={(e) => update('imponibile', e.target.value)} placeholder="0,00" />
        </label>
        <label>
          IVA
          <input inputMode="decimal" value={form.iva} onChange={(e) => update('iva', e.target.value)} placeholder="0,00" />
        </label>
        <label>
          Totale
          <input inputMode="decimal" value={form.totale} onChange={(e) => update('totale', e.target.value)} placeholder="0,00" />
        </label>
        <label>
          Regola pagamento
          <select value={form.regola_pagamento_id} onChange={(e) => update('regola_pagamento_id', e.target.value)}>
            {regole.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <label>
          Metodo pagamento
          <input value={form.metodo_pagamento} onChange={(e) => update('metodo_pagamento', e.target.value)} placeholder="Bonifico, RID, contanti..." />
        </label>
        <label className="span-2">
          Note
          <textarea value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Note interne facoltative" />
        </label>
        <div className="form-actions span-2">
          <button type="button" className="ghost-btn" onClick={onCancel}>Annulla</button>
          <button type="submit" className="primary-btn">Salva fattura e scadenza</button>
        </div>
      </form>
    </div>
  );
}

function FornitoreForm({ fornitore, regole, onCancel, onSave }) {
  const [form, setForm] = useState({
    id: fornitore?.id || '',
    ragione_sociale: fornitore?.ragione_sociale || '',
    partita_iva: fornitore?.partita_iva || '',
    codice_fiscale: fornitore?.codice_fiscale || '',
    iban: fornitore?.iban || '',
    email: fornitore?.email || '',
    telefono: fornitore?.telefono || '',
    metodo_pagamento_default: fornitore?.metodo_pagamento_default || '',
    regola_pagamento_id: fornitore?.regola_pagamento_id || 'reg_da_verificare'
  });
  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  return (
    <div className="form-panel compact">
      <div className="form-title-row">
        <div>
          <p className="eyebrow">Anagrafica</p>
          <h2>{form.id ? 'Modifica fornitore' : 'Nuovo fornitore'}</h2>
        </div>
        <button className="ghost-btn" onClick={onCancel}>Chiudi</button>
      </div>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <label>
          Ragione sociale
          <input value={form.ragione_sociale} onChange={(e) => update('ragione_sociale', e.target.value)} />
        </label>
        <label>
          Partita IVA
          <input value={form.partita_iva} onChange={(e) => update('partita_iva', e.target.value)} />
        </label>
        <label>
          Metodo default
          <input value={form.metodo_pagamento_default} onChange={(e) => update('metodo_pagamento_default', e.target.value)} />
        </label>
        <label>
          Regola default
          <select value={form.regola_pagamento_id} onChange={(e) => update('regola_pagamento_id', e.target.value)}>
            {regole.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <label>
          Email
          <input value={form.email} onChange={(e) => update('email', e.target.value)} />
        </label>
        <label>
          Telefono
          <input value={form.telefono} onChange={(e) => update('telefono', e.target.value)} />
        </label>
        <label className="span-2">
          IBAN
          <input value={form.iban} onChange={(e) => update('iban', e.target.value)} />
        </label>
        <div className="form-actions span-2">
          <button type="button" className="ghost-btn" onClick={onCancel}>Annulla</button>
          <button type="submit" className="primary-btn">Salva fornitore</button>
        </div>
      </form>
    </div>
  );
}

function RegolaForm({ regola, onCancel, onSave }) {
  const [form, setForm] = useState({
    id: regola?.id || '',
    nome: regola?.nome || '',
    giorni: regola?.giorni ?? 0,
    fine_mese: Number(regola?.fine_mese || 0) === 1,
    giorni_extra: regola?.giorni_extra ?? 0,
    metodo_pagamento: regola?.metodo_pagamento || '',
    auto_pagato: Number(regola?.auto_pagato || 0) === 1,
    note: regola?.note || ''
  });
  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  return (
    <div className="form-panel compact">
      <div className="form-title-row">
        <div>
          <p className="eyebrow">Regola pagamento</p>
          <h2>{form.id ? 'Modifica regola' : 'Nuova regola'}</h2>
        </div>
        <button className="ghost-btn" onClick={onCancel}>Chiudi</button>
      </div>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <label>
          Nome regola
          <input value={form.nome} onChange={(e) => update('nome', e.target.value)} placeholder="Es. 30 giorni fine mese + 5" />
        </label>
        <label>
          Metodo pagamento
          <input value={form.metodo_pagamento} onChange={(e) => update('metodo_pagamento', e.target.value)} placeholder="Bonifico, RID, RIBA..." />
        </label>
        <label>
          Giorni
          <input type="number" value={form.giorni} onChange={(e) => update('giorni', e.target.value)} />
        </label>
        <label>
          Giorni extra
          <input type="number" value={form.giorni_extra} onChange={(e) => update('giorni_extra', e.target.value)} />
        </label>
        <label className="check-label">
          <input type="checkbox" checked={form.fine_mese} onChange={(e) => update('fine_mese', e.target.checked)} />
          Fine mese
        </label>
        <label className="check-label">
          <input type="checkbox" checked={form.auto_pagato} onChange={(e) => update('auto_pagato', e.target.checked)} />
          Pagato automatico
        </label>
        <label className="span-2">
          Note
          <textarea value={form.note} onChange={(e) => update('note', e.target.value)} />
        </label>
        <div className="form-actions span-2">
          <button type="button" className="ghost-btn" onClick={onCancel}>Annulla</button>
          <button type="submit" className="primary-btn">Salva regola</button>
        </div>
      </form>
    </div>
  );
}

function PaymentModal({ request, scadenze, onCancel, onConfirm }) {
  const selectedRows = (request?.ids || []).map((id) => scadenze.find((x) => x.id === id)).filter(Boolean);
  const total = selectedRows.reduce((sum, row) => sum + Number(row.importo || 0) - Number(row.importo_pagato || 0), 0);
  const first = selectedRows[0] || {};
  const [dataPagamento, setDataPagamento] = useState(request?.dataPagamento || todayISO());
  const [metodoPagamento, setMetodoPagamento] = useState(normalizePaymentMethod(request?.metodoPagamento || first.metodo_pagamento || 'Bonifico'));

  if (!request) return null;

  function submit(e) {
    e.preventDefault();
    onConfirm({ dataPagamento, metodoPagamento });
  }

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <form className="modal-card payment-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Registrazione pagamento</p>
            <h2>{selectedRows.length === 1 ? 'Segna fattura pagata' : `Segna ${selectedRows.length} fatture pagate`}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel}>×</button>
        </div>
        <div className="payment-summary">
          <span>Totale selezionato</span>
          <strong>{euro(total)}</strong>
        </div>
        {selectedRows.length === 1 && (
          <div className="mini-detail">
            <strong>{first.fornitore_nome}</strong>
            <span>Fattura {first.numero} · Scadenza {formatDate(first.data_scadenza)}</span>
          </div>
        )}
        <div className="form-grid two-cols">
          <label>
            Come hai pagato?
            <select value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)} autoFocus>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>
            Data pagamento
            <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>Annulla</button>
          <button type="submit" className="primary-btn">Conferma pagamento</button>
        </div>
      </form>
    </div>
  );
}

export default function ScadenziarioPage({ data, onPaid, onPaidMany, onSetStatus, onSetStatusMany, onReopen, onSaveFattura, onSaveFornitore, onSaveRegola }) {
  const [subtab, setSubtab] = useState('scadenze');
  const [form, setForm] = useState(null);
  const [selected, setSelected] = useState([]);
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [filters, setFilters] = useState({ stato: 'APERTO', mese: 'TUTTI', fornitore: 'TUTTI', search: '' });

  const scadenze = data.scadenze || [];
  const fatture = data.fatture || [];
  const fornitori = data.fornitori || [];
  const regole = data.regole || [];
  const pagamenti = data.pagamenti || [];
  const righe = data.righe || [];
  const importLog = data.importLog || [];

  const mesi = useMemo(() => {
    const unique = Array.from(new Set(scadenze.map((s) => monthKey(s.data_scadenza)).filter(Boolean)));
    return unique.sort();
  }, [scadenze]);

  const filteredScadenze = useMemo(() => {
    const text = filters.search.trim().toLowerCase();
    return scadenze.filter((s) => {
      const statoOk = filters.stato === 'TUTTE' || s.stato === filters.stato;
      const meseOk = filters.mese === 'TUTTI' || monthKey(s.data_scadenza) === filters.mese;
      const fornitoreOk = filters.fornitore === 'TUTTI' || s.fornitore_id === filters.fornitore;
      const textOk = !text || [s.fornitore_nome, s.numero, s.metodo_pagamento, s.note].some((v) => String(v || '').toLowerCase().includes(text));
      return statoOk && meseOk && fornitoreOk && textOk;
    });
  }, [scadenze, filters]);

  const summary = useMemo(() => {
    const open = scadenze.filter((s) => s.stato === 'APERTO');
    const verify = scadenze.filter((s) => s.stato === 'DA_VERIFICARE');
    const paid = scadenze.filter((s) => s.stato === 'PAGATO' || s.stato === 'PAGATO_AUTO');
    return {
      openAmount: open.reduce((a, s) => a + Number(s.importo || 0) - Number(s.importo_pagato || 0), 0),
      verifyAmount: verify.reduce((a, s) => a + Number(s.importo || 0), 0),
      paidAmount: paid.reduce((a, s) => a + Number(s.importo || 0), 0),
      openCount: open.length,
      verifyCount: verify.length,
      paidCount: paid.length
    };
  }, [scadenze]);

  const selectedOpen = selected.filter((id) => {
    const s = scadenze.find((x) => x.id === id);
    return s && ['APERTO', 'DA_VERIFICARE'].includes(s.stato);
  });

  const selectedVerify = selected.filter((id) => {
    const s = scadenze.find((x) => x.id === id);
    return s && s.stato === 'DA_VERIFICARE';
  });

  function toggle(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleAllVisibleOpen() {
    const visibleOpen = filteredScadenze.filter((s) => ['APERTO', 'DA_VERIFICARE'].includes(s.stato)).map((s) => s.id);
    const allSelected = visibleOpen.every((id) => selected.includes(id));
    setSelected((prev) => allSelected ? prev.filter((id) => !visibleOpen.includes(id)) : Array.from(new Set([...prev, ...visibleOpen])));
  }

  function askPayment(ids) {
    const cleanIds = Array.from(new Set(ids || [])).filter(Boolean);
    if (!cleanIds.length) return;
    const first = scadenze.find((x) => x.id === cleanIds[0]);
    setPaymentRequest({
      ids: cleanIds,
      dataPagamento: todayISO(),
      metodoPagamento: normalizePaymentMethod(first?.metodo_pagamento || 'Bonifico')
    });
  }

  async function confirmPayment({ dataPagamento, metodoPagamento }) {
    const ids = paymentRequest?.ids || [];
    if (ids.length === 1) await onPaid(ids[0], dataPagamento, metodoPagamento);
    if (ids.length > 1) await onPaidMany(ids, dataPagamento, metodoPagamento);
    setPaymentDate(dataPagamento);
    setSelected([]);
    setPaymentRequest(null);
  }

  async function saveCurrentForm(payload) {
    if (form?.type === 'fattura') await onSaveFattura(payload);
    if (form?.type === 'fornitore') await onSaveFornitore(payload);
    if (form?.type === 'regola') await onSaveRegola(payload);
    setForm(null);
  }

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Modulo operativo v4</p>
          <h1>Scadenziario</h1>
          <p>Fornitori, regole pagamento, fatture manuali/XML, scadenze, metodo e data pagamento.</p>
        </div>
        <div className="header-actions">
          <button className="ghost-btn" onClick={() => setForm({ type: 'fornitore' })}>+ Fornitore</button>
          <button className="ghost-btn" onClick={() => setForm({ type: 'regola' })}>+ Regola</button>
          <button className="primary-btn" onClick={() => setForm({ type: 'fattura' })}>+ Fattura</button>
        </div>
      </div>

      <div className="kpi-grid small">
        <div className="kpi-card"><span>Aperte</span><strong>{summary.openCount}</strong><em>{euro(summary.openAmount)}</em></div>
        <div className="kpi-card warning"><span>Da verificare</span><strong>{summary.verifyCount}</strong><em>{euro(summary.verifyAmount)}</em></div>
        <div className="kpi-card success"><span>Pagate/auto</span><strong>{summary.paidCount}</strong><em>{euro(summary.paidAmount)}</em></div>
        <div className="kpi-card"><span>Fornitori</span><strong>{fornitori.length}</strong><em>{regole.length} regole</em></div>
      </div>

      <div className="subnav">
        {[
          ['scadenze', 'Scadenze'],
          ['fatture', 'Fatture'],
          ['fornitori', 'Fornitori'],
          ['regole', 'Regole'],
          ['pagamenti', 'Pagamenti'],
          ['righe', 'Righe XML'],
          ['import', 'Log import']
        ].map(([id, label]) => <button key={id} className={subtab === id ? 'selected' : ''} onClick={() => setSubtab(id)}>{label}</button>)}
      </div>

      {form?.type === 'fattura' && <FatturaForm fattura={form.record} fornitori={fornitori} regole={regole} onCancel={() => setForm(null)} onSave={saveCurrentForm} />}
      {form?.type === 'fornitore' && <FornitoreForm fornitore={form.record} regole={regole} onCancel={() => setForm(null)} onSave={saveCurrentForm} />}
      {form?.type === 'regola' && <RegolaForm regola={form.record} onCancel={() => setForm(null)} onSave={saveCurrentForm} />}
      {paymentRequest && <PaymentModal request={paymentRequest} scadenze={scadenze} onCancel={() => setPaymentRequest(null)} onConfirm={confirmPayment} />}

      {subtab === 'scadenze' && (
        <div className="card table-card">
          <div className="toolbar">
            <select value={filters.stato} onChange={(e) => setFilters((p) => ({ ...p, stato: e.target.value }))}>
              {['TUTTE', 'APERTO', 'DA_VERIFICARE', 'PAGATO', 'PAGATO_AUTO'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.mese} onChange={(e) => setFilters((p) => ({ ...p, mese: e.target.value }))}>
              <option value="TUTTI">Tutti i mesi</option>
              {mesi.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filters.fornitore} onChange={(e) => setFilters((p) => ({ ...p, fornitore: e.target.value }))}>
              <option value="TUTTI">Tutti i fornitori</option>
              {fornitori.map((f) => <option key={f.id} value={f.id}>{f.ragione_sociale}</option>)}
            </select>
            <input className="search-input" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Cerca fornitore, fattura, metodo..." />
            <div className="pay-many-box">
              <button className="ghost-btn compact-action" disabled={selectedVerify.length === 0} onClick={() => onSetStatusMany(selectedVerify, 'APERTO').then(() => setSelected([]))}>Verifica ({selectedVerify.length})</button>
              <button className="primary-btn compact-action" disabled={selectedOpen.length === 0} onClick={() => askPayment(selectedOpen)}>Pagate ({selectedOpen.length})</button>
            </div>
          </div>
          <table className="compact-table scadenze-table">
            <thead>
              <tr>
                <th className="check-col"><input type="checkbox" onChange={toggleAllVisibleOpen} checked={filteredScadenze.filter((s) => ['APERTO', 'DA_VERIFICARE'].includes(s.stato)).length > 0 && filteredScadenze.filter((s) => ['APERTO', 'DA_VERIFICARE'].includes(s.stato)).every((s) => selected.includes(s.id))} /></th>
                <th className="date-col">Scad.</th>
                <th className="supplier-col">Fornitore</th>
                <th className="num-col">N.</th>
                <th className="date-col">Data</th>
                <th className="method-col">Metodo</th>
                <th className="amount-col">Importo</th>
                <th className="date-col">Pag.</th>
                <th className="status-col">Stato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredScadenze.map((s) => {
                const selectable = ['APERTO', 'DA_VERIFICARE'].includes(s.stato);
                const oggi = new Date(); oggi.setHours(0,0,0,0);
                const scad = s.data_scadenza ? new Date(s.data_scadenza) : null;
                const giorniAllaScadenza = scad ? Math.ceil((scad - oggi) / 86400000) : null;
                const urgente = selectable && giorniAllaScadenza !== null && giorniAllaScadenza <= 7;
                const scaduta = selectable && giorniAllaScadenza !== null && giorniAllaScadenza < 0;
                return (
                  <tr key={s.id} className={scaduta ? 'row-scaduta' : urgente ? 'row-urgente' : ''}>
                    <td><input type="checkbox" disabled={!selectable} checked={selected.includes(s.id)} onChange={() => toggle(s.id)} /></td>
                    <td>
                      {formatDate(s.data_scadenza)}
                      {scaduta && <span className="scad-chip scad-chip-red">scaduta</span>}
                      {urgente && !scaduta && <span className="scad-chip scad-chip-orange">{giorniAllaScadenza === 0 ? 'oggi' : giorniAllaScadenza + 'gg'}</span>}
                    </td>
                    <td className="supplier-cell" title={s.fornitore_nome}>{s.fornitore_nome}</td>
                    <td title={s.numero}>{s.numero}</td>
                    <td>{formatDate(s.data_fattura)}</td>
                    <td>{s.metodo_pagamento}</td>
                    <td>{euro(s.importo)}</td>
                    <td>{s.data_pagamento ? formatDate(s.data_pagamento) : '-'}</td>
                    <td><StatusBadge stato={s.stato} /></td>
                    <td className="right action-cell">
                      {s.stato === 'DA_VERIFICARE' && <button className="small-btn muted" onClick={() => onSetStatus(s.id, 'APERTO')}>Verifica</button>}
                      {selectable && <button className="small-btn" onClick={() => askPayment([s.id])}>Pagata</button>}
                      {s.stato === 'PAGATO' && <button className="small-btn muted" onClick={() => onReopen(s.id)}>Riapri</button>}
                    </td>
                  </tr>
                );
              })}
              {filteredScadenze.length === 0 && <tr><td colSpan="10" className="empty-cell">Nessun dato per questi filtri.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subtab === 'fatture' && (
        <div className="card table-card">
          <div className="card-header-row"><div><h2>Fatture acquisto</h2><p>Inserimento manuale e import XML SDI. La data pagamento viene salvata sulla fattura e sulla scadenza.</p></div></div>
          <table className="compact-table fatture-table">
            <thead><tr><th className="date-col">Data</th><th className="supplier-col">Fornitore</th><th className="num-col">Numero</th><th>Imp.</th><th>IVA</th><th>Tot.</th><th className="date-col">Scad.</th><th className="date-col">Pag.</th><th>Orig.</th><th className="status-col">Stato</th><th></th></tr></thead>
            <tbody>
              {fatture.map((f) => (
                <tr key={f.id}>
                  <td>{formatDate(f.data_fattura)}</td>
                  <td className="supplier-cell" title={f.fornitore_nome}>{f.fornitore_nome}</td>
                  <td>{f.numero}</td>
                  <td>{euro(f.imponibile)}</td>
                  <td>{euro(f.iva)}</td>
                  <td>{euro(f.totale)}</td>
                  <td>{formatDate(f.data_scadenza)}</td>
                  <td>{f.data_pagamento || f.data_pagamento_scadenza ? formatDate(f.data_pagamento || f.data_pagamento_scadenza) : '-'}</td>
                  <td>{f.origine_import || 'MANUALE'}</td>
                  <td><StatusBadge stato={f.stato_scadenza} /></td>
                  <td className="right"><button className="small-btn muted" onClick={() => setForm({ type: 'fattura', record: f })}>Modifica</button></td>
                </tr>
              ))}
              {fatture.length === 0 && <tr><td colSpan="11" className="empty-cell">Nessuna fattura inserita.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subtab === 'fornitori' && (
        <div className="card table-card">
          <div className="card-header-row"><div><h2>Fornitori</h2><p>Anagrafica base con regola pagamento predefinita.</p></div></div>
          <table>
            <thead><tr><th>Ragione sociale</th><th>P.IVA</th><th>Metodo default</th><th>Regola default</th><th>Email</th><th>Telefono</th><th></th></tr></thead>
            <tbody>
              {fornitori.map((f) => {
                const regola = regole.find((r) => r.id === f.regola_pagamento_id);
                return (
                  <tr key={f.id}>
                    <td>{f.ragione_sociale}</td>
                    <td>{f.partita_iva || '-'}</td>
                    <td>{f.metodo_pagamento_default || '-'}</td>
                    <td>{regola?.nome || '-'}</td>
                    <td>{f.email || '-'}</td>
                    <td>{f.telefono || '-'}</td>
                    <td className="right"><button className="small-btn muted" onClick={() => setForm({ type: 'fornitore', record: f })}>Modifica</button></td>
                  </tr>
                );
              })}
              {fornitori.length === 0 && <tr><td colSpan="7" className="empty-cell">Nessun fornitore.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subtab === 'regole' && (
        <div className="card table-card">
          <div className="card-header-row"><div><h2>Regole pagamento</h2><p>La scadenza viene calcolata da data fattura + giorni, eventuale fine mese, eventuali giorni extra.</p></div></div>
          <table>
            <thead><tr><th>Nome</th><th>Giorni</th><th>Fine mese</th><th>Extra</th><th>Metodo</th><th>Auto pagato</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {regole.map((r) => (
                <tr key={r.id}>
                  <td>{r.nome}</td>
                  <td>{r.giorni}</td>
                  <td>{Number(r.fine_mese) === 1 ? 'Sì' : 'No'}</td>
                  <td>{r.giorni_extra}</td>
                  <td>{r.metodo_pagamento}</td>
                  <td>{Number(r.auto_pagato) === 1 ? 'Sì' : 'No'}</td>
                  <td>{r.note || '-'}</td>
                  <td className="right"><button className="small-btn muted" onClick={() => setForm({ type: 'regola', record: r })}>Modifica</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subtab === 'pagamenti' && (
        <div className="card table-card">
          <div className="card-header-row"><div><h2>Ultimi pagamenti</h2><p>Pagamenti manuali registrati da scadenze singole o multiple.</p></div></div>
          <table>
            <thead><tr><th>Data pagamento</th><th>Fornitore</th><th>Fattura</th><th>Importo</th><th>Metodo</th><th>Note</th></tr></thead>
            <tbody>
              {pagamenti.map((p) => (
                <tr key={p.id}><td>{formatDate(p.data_pagamento)}</td><td>{p.fornitore_nome || '-'}</td><td>{p.numero || '-'}</td><td>{euro(p.importo)}</td><td>{p.metodo_pagamento || '-'}</td><td>{p.note || '-'}</td></tr>
              ))}
              {pagamenti.length === 0 && <tr><td colSpan="6" className="empty-cell">Nessun pagamento manuale registrato.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subtab === 'righe' && (
        <div className="card table-card">
          <div className="card-header-row"><div><h2>Righe importate da XML</h2><p>Prime 300 righe salvate, già pronte per il futuro Controllo Prezzi.</p></div></div>
          <table>
            <thead><tr><th>Data fattura</th><th>Fornitore</th><th>Fattura</th><th>Codice</th><th>Descrizione</th><th>Qtà</th><th>UM</th><th>Prezzo unit.</th><th>Totale</th><th>IVA</th></tr></thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.data_fattura)}</td>
                  <td>{r.fornitore_nome || '-'}</td>
                  <td>{r.numero || '-'}</td>
                  <td>{r.codice_articolo || '-'}</td>
                  <td>{r.descrizione_originale}</td>
                  <td>{Number(r.quantita || 0).toLocaleString('it-IT')}</td>
                  <td>{r.um || '-'}</td>
                  <td>{euro(r.prezzo_unitario)}</td>
                  <td>{euro(r.totale_riga)}</td>
                  <td>{r.aliquota_iva ?? '-'}</td>
                </tr>
              ))}
              {righe.length === 0 && <tr><td colSpan="10" className="empty-cell">Nessuna riga XML importata.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {subtab === 'import' && (
        <div className="card table-card">
          <div className="card-header-row"><div><h2>Log import</h2><p>Storico degli XML caricati nella v3.2.</p></div></div>
          <table>
            <thead><tr><th>Quando</th><th>File</th><th>Tipo</th><th>Esito</th><th>Messaggio</th></tr></thead>
            <tbody>
              {importLog.map((l) => (
                <tr key={l.id}><td>{String(l.created_at || '').slice(0, 19).replace('T', ' ')}</td><td>{l.nome_file}</td><td>{l.tipo}</td><td>{l.esito}</td><td>{l.messaggio || '-'}</td></tr>
              ))}
              {importLog.length === 0 && <tr><td colSpan="5" className="empty-cell">Nessun import ancora registrato.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


