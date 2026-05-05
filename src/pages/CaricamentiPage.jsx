import { useMemo, useState } from 'react';
import { parseFatturaXml } from '../utils/xmlFatturaParser.js';
import { parseCorrispettiviXlsx } from '../utils/corrispettiviXlsxParser.js';
import { euro } from '../utils/format.js';

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthISO = () => new Date().toISOString().slice(0, 7);

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function readJsonFile(file) {
  return file.text().then((text) => JSON.parse(text));
}

function MiniTable({ empty, children }) {
  return <div className="table-scroll"><table>{children || <tbody><tr><td className="empty-cell">{empty || 'Nessun dato.'}</td></tr></tbody>}</table></div>;
}

export default function CaricamentiPage({
  data,
  gestioneData,
  onImportXmlAcquisto,
  onImportXmlVendita,
  onSaveIncasso,
  onImportIncassi,
  onDeleteIncasso,
  onSaveBusta,
  onImportBuste,
  onDeleteBusta,
  onSaveF24,
  onImportF24,
  onDeleteF24
}) {
  const [tab, setTab] = useState('acquisti');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [incassoForm, setIncassoForm] = useState(() => ({ data_incasso: todayISO(), contanti: '', pos: '', carta_credito: '', ticket: '', delivery: '', altro: '', non_riscosso: '', totale: '', iva_10: '', iva_22: '', note: '' }));
  const [bustaForm, setBustaForm] = useState(() => ({ mese: monthISO(), dipendente: '', lordo: '', netto: '', contributi_inps: '', irpef: '', tfr: '', costo_azienda: '', data_pagamento: '', metodo_pagamento: 'Bonifico', note: '' }));
  const [f24Form, setF24Form] = useState(() => ({ data_pagamento: todayISO(), periodo_competenza: monthISO(), tipo: 'IVA', importo: '', metodo_pagamento: 'Bonifico', note: '' }));

  const importLog = data?.importLog || [];
  const incassi = gestioneData?.incassi || [];
  const buste = gestioneData?.buste || [];
  const f24 = gestioneData?.f24 || [];
  const fattureVendita = gestioneData?.fattureVendita || [];

  const incassoTotaleCalcolato = useMemo(() => {
    return ['contanti', 'pos', 'carta_credito', 'ticket', 'delivery', 'altro', 'non_riscosso'].reduce((sum, key) => sum + numberValue(incassoForm[key]), 0);
  }, [incassoForm]);

  async function handleXmlFiles(event, tipo) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setBusy(true);
    setMessage('');
    const output = [];
    const importer = tipo === 'vendita' ? onImportXmlVendita : onImportXmlAcquisto;
    for (const file of files) {
      try {
        const text = await file.text();
        const parsed = parseFatturaXml(text, file.name);
        const result = await importer(parsed);
        output.push({ file: file.name, ok: true, message: `${result?.duplicatoAggiornato ? 'Aggiornata' : 'Importata'} fattura ${tipo} con ${result?.righeImportate || 0} righe.` });
      } catch (err) {
        output.push({ file: file.name, ok: false, message: err.message || String(err) });
      }
    }
    setResults(output);
    setBusy(false);
    event.target.value = '';
  }

  async function submitIncasso(event) {
    event.preventDefault();
    const payload = { ...incassoForm, totale: numberValue(incassoForm.totale) || incassoTotaleCalcolato };
    await onSaveIncasso(payload);
    setIncassoForm({ data_incasso: todayISO(), contanti: '', pos: '', carta_credito: '', ticket: '', delivery: '', altro: '', non_riscosso: '', totale: '', iva_10: '', iva_22: '', note: '' });
  }

  async function handleXlsx(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const rows = await parseCorrispettiviXlsx(file);
      const result = await onImportIncassi(rows);
      setMessage(`Import corrispettivi completato: ${result?.imported || 0} giornate importate, ${result?.skipped || 0} saltate.`);
    } catch (err) {
      setMessage('Errore import XLSX: ' + String(err?.message || err));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function submitBusta(event) {
    event.preventDefault();
    await onSaveBusta(bustaForm);
    setBustaForm({ mese: monthISO(), dipendente: '', lordo: '', netto: '', contributi_inps: '', irpef: '', tfr: '', costo_azienda: '', data_pagamento: '', metodo_pagamento: 'Bonifico', note: '' });
  }

  async function handleBusteJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const json = await readJsonFile(file);
      const result = await onImportBuste(json);
      setMessage(`Import buste paga completato: ${result?.imported || 0} importate, ${result?.skipped || 0} saltate.`);
    } catch (err) {
      setMessage('Errore import JSON buste: ' + String(err?.message || err));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function submitF24(event) {
    event.preventDefault();
    await onSaveF24(f24Form);
    setF24Form({ data_pagamento: todayISO(), periodo_competenza: monthISO(), tipo: 'IVA', importo: '', metodo_pagamento: 'Bonifico', note: '' });
  }

  async function handleF24Json(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const json = await readJsonFile(file);
      const result = await onImportF24(json);
      setMessage(`Import F24 completato: ${result?.imported || 0} importati, ${result?.skipped || 0} saltati.`);
    } catch (err) {
      setMessage('Errore import JSON F24: ' + String(err?.message || err));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Caricamenti v9.1.1</p>
          <h1>Caricamento dati</h1>
          <p>Tutti gli import operativi sono qui: fatture, corrispettivi, buste paga e F24. Admin / CE resta dedicato all’analisi.</p>
        </div>
      </div>

      <div className="tab-bar">
        {[
          ['acquisti', 'Fatture acquisto'],
          ['vendite', 'Fatture vendita'],
          ['corrispettivi', 'Corrispettivi'],
          ['buste', 'Buste paga'],
          ['f24', 'F24'],
          ['log', 'Log import']
        ].map(([key, label]) => <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
      </div>

      {message ? <div className="result-item ok"><strong>Esito</strong><span>{message}</span></div> : null}

      {tab === 'acquisti' && (
        <div className="cards-grid two">
          <div className="card upload-card">
            <h2>Import XML fatture acquisto</h2>
            <p>Importa XML fornitori: crea fornitore, fattura, scadenza e righe prodotto per il controllo prezzi.</p>
            <label className="file-drop"><input type="file" accept=".xml,text/xml,application/xml" multiple onChange={(e) => handleXmlFiles(e, 'acquisto')} disabled={busy} /><span>{busy ? 'Import in corso...' : 'Scegli XML acquisto'}</span></label>
          </div>
          <div className="card"><h2>Risultato ultimo import</h2><ResultList results={results} /></div>
        </div>
      )}

      {tab === 'vendite' && (
        <div className="cards-grid two">
          <div className="card upload-card">
            <h2>Import XML fatture vendita</h2>
            <p>Importa XML fatture attive. I ricavi entrano nel Conto Economico per competenza, sulla data fattura.</p>
            <label className="file-drop"><input type="file" accept=".xml,text/xml,application/xml" multiple onChange={(e) => handleXmlFiles(e, 'vendita')} disabled={busy} /><span>{busy ? 'Import in corso...' : 'Scegli XML vendita'}</span></label>
          </div>
          <div className="card table-card">
            <h2>Ultime fatture vendita</h2>
            <MiniTable><thead><tr><th>Data</th><th>Cliente</th><th>Numero</th><th>Totale</th></tr></thead><tbody>{fattureVendita.slice(0, 12).map((f) => <tr key={f.id}><td>{f.data_fattura}</td><td>{f.cliente_nome}</td><td>{f.numero}</td><td className="right">{euro(f.totale)}</td></tr>)}{!fattureVendita.length && <tr><td colSpan="4" className="empty-cell">Nessuna fattura vendita importata.</td></tr>}</tbody></MiniTable>
          </div>
        </div>
      )}

      {tab === 'corrispettivi' && (
        <div className="cards-grid two">
          <div className="card">
            <h2>Chiusura giornata manuale</h2>
            <form className="form-grid" onSubmit={submitIncasso}>
              <label>Data<input type="date" value={incassoForm.data_incasso} onChange={(e) => setIncassoForm({ ...incassoForm, data_incasso: e.target.value })} required /></label>
              {['contanti','pos','carta_credito','ticket','delivery','altro','non_riscosso'].map((k) => <label key={k}>{k.replaceAll('_',' ')}<input type="number" step="0.01" value={incassoForm[k]} onChange={(e) => setIncassoForm({ ...incassoForm, [k]: e.target.value })} /></label>)}
              <label>Totale<input type="number" step="0.01" value={incassoForm.totale} placeholder={String(incassoTotaleCalcolato.toFixed(2))} onChange={(e) => setIncassoForm({ ...incassoForm, totale: e.target.value })} /></label>
              <label>IVA 10<input type="number" step="0.01" value={incassoForm.iva_10} onChange={(e) => setIncassoForm({ ...incassoForm, iva_10: e.target.value })} /></label>
              <label>IVA 22<input type="number" step="0.01" value={incassoForm.iva_22} onChange={(e) => setIncassoForm({ ...incassoForm, iva_22: e.target.value })} /></label>
              <label className="wide">Note<input value={incassoForm.note} onChange={(e) => setIncassoForm({ ...incassoForm, note: e.target.value })} /></label>
              <button className="primary-btn" type="submit">Salva chiusura</button>
            </form>
          </div>
          <div className="card upload-card">
            <h2>Import XLSX corrispettivi</h2>
            <p>Carica il file corrispettivi. Dopo l’import puoi correggere la ripartizione incassi, se serve.</p>
            <label className="file-drop"><input type="file" accept=".xlsx,.xls" onChange={handleXlsx} disabled={busy} /><span>{busy ? 'Import in corso...' : 'Scegli XLSX corrispettivi'}</span></label>
          </div>
          <div className="card table-card span-2">
            <h2>Chiusure caricate</h2>
            <MiniTable><thead><tr><th>Data</th><th>Contanti</th><th>POS</th><th>Delivery</th><th>Totale</th><th></th></tr></thead><tbody>{incassi.slice(0, 20).map((r) => <tr key={r.id}><td>{r.data_incasso}</td><td>{euro(r.contanti)}</td><td>{euro(r.pos)}</td><td>{euro(r.delivery)}</td><td>{euro(r.totale)}</td><td><button className="ghost-btn small" onClick={() => window.confirm('Eliminare chiusura?') && onDeleteIncasso(r.id)}>Elimina</button></td></tr>)}{!incassi.length && <tr><td colSpan="6" className="empty-cell">Nessun incasso caricato.</td></tr>}</tbody></MiniTable>
          </div>
        </div>
      )}

      {tab === 'buste' && (
        <div className="cards-grid two">
          <div className="card"><h2>Busta paga manuale</h2><form className="form-grid" onSubmit={submitBusta}>
            <label>Mese<input type="month" value={bustaForm.mese} onChange={(e) => setBustaForm({ ...bustaForm, mese: e.target.value })} required /></label>
            <label>Dipendente<input value={bustaForm.dipendente} onChange={(e) => setBustaForm({ ...bustaForm, dipendente: e.target.value })} required /></label>
            {['lordo','netto','contributi_inps','irpef','tfr','costo_azienda'].map((k) => <label key={k}>{k.replaceAll('_',' ')}<input type="number" step="0.01" value={bustaForm[k]} onChange={(e) => setBustaForm({ ...bustaForm, [k]: e.target.value })} /></label>)}
            <label>Data pagamento<input type="date" value={bustaForm.data_pagamento} onChange={(e) => setBustaForm({ ...bustaForm, data_pagamento: e.target.value })} /></label>
            <label>Metodo<input value={bustaForm.metodo_pagamento} onChange={(e) => setBustaForm({ ...bustaForm, metodo_pagamento: e.target.value })} /></label>
            <label className="wide">Note<input value={bustaForm.note} onChange={(e) => setBustaForm({ ...bustaForm, note: e.target.value })} /></label>
            <button className="primary-btn" type="submit">Salva busta</button>
          </form></div>
          <div className="card upload-card"><h2>Import JSON buste paga</h2><label className="file-drop"><input type="file" accept=".json,application/json" onChange={handleBusteJson} disabled={busy} /><span>{busy ? 'Import in corso...' : 'Scegli JSON buste'}</span></label></div>
          <div className="card table-card span-2"><h2>Buste caricate</h2><MiniTable><thead><tr><th>Mese</th><th>Dipendente</th><th>Netto</th><th>Costo azienda</th><th></th></tr></thead><tbody>{buste.slice(0, 24).map((r) => <tr key={r.id}><td>{r.mese}</td><td>{r.dipendente}</td><td>{euro(r.netto)}</td><td>{euro(r.costo_azienda)}</td><td><button className="ghost-btn small" onClick={() => window.confirm('Eliminare busta?') && onDeleteBusta(r.id)}>Elimina</button></td></tr>)}{!buste.length && <tr><td colSpan="5" className="empty-cell">Nessuna busta caricata.</td></tr>}</tbody></MiniTable></div>
        </div>
      )}

      {tab === 'f24' && (
        <div className="cards-grid two">
          <div className="card"><h2>F24 manuale</h2><form className="form-grid" onSubmit={submitF24}>
            <label>Data pagamento<input type="date" value={f24Form.data_pagamento} onChange={(e) => setF24Form({ ...f24Form, data_pagamento: e.target.value })} required /></label>
            <label>Periodo competenza<input type="month" value={f24Form.periodo_competenza} onChange={(e) => setF24Form({ ...f24Form, periodo_competenza: e.target.value })} /></label>
            <label>Tipo<select value={f24Form.tipo} onChange={(e) => setF24Form({ ...f24Form, tipo: e.target.value })}><option>IVA</option><option>INPS</option><option>IRPEF</option><option>ALTRO</option></select></label>
            <label>Importo<input type="number" step="0.01" value={f24Form.importo} onChange={(e) => setF24Form({ ...f24Form, importo: e.target.value })} required /></label>
            <label>Metodo<input value={f24Form.metodo_pagamento} onChange={(e) => setF24Form({ ...f24Form, metodo_pagamento: e.target.value })} /></label>
            <label className="wide">Note<input value={f24Form.note} onChange={(e) => setF24Form({ ...f24Form, note: e.target.value })} /></label>
            <button className="primary-btn" type="submit">Salva F24</button>
          </form></div>
          <div className="card upload-card"><h2>Import JSON F24</h2><label className="file-drop"><input type="file" accept=".json,application/json" onChange={handleF24Json} disabled={busy} /><span>{busy ? 'Import in corso...' : 'Scegli JSON F24'}</span></label></div>
          <div className="card table-card span-2"><h2>F24 caricati</h2><MiniTable><thead><tr><th>Data</th><th>Competenza</th><th>Tipo</th><th>Importo</th><th></th></tr></thead><tbody>{f24.slice(0, 24).map((r) => <tr key={r.id}><td>{r.data_pagamento}</td><td>{r.periodo_competenza}</td><td>{r.tipo}</td><td>{euro(r.importo)}</td><td><button className="ghost-btn small" onClick={() => window.confirm('Eliminare F24?') && onDeleteF24(r.id)}>Elimina</button></td></tr>)}{!f24.length && <tr><td colSpan="5" className="empty-cell">Nessun F24 caricato.</td></tr>}</tbody></MiniTable></div>
        </div>
      )}

      {tab === 'log' && <ImportLog importLog={importLog} />}
    </section>
  );
}

function ResultList({ results }) {
  return <div className="result-list">{results.length === 0 && <p>Nessun file caricato in questa sessione.</p>}{results.map((r) => <div className={`result-item ${r.ok ? 'ok' : 'ko'}`} key={r.file}><strong>{r.file}</strong><span>{r.message}</span></div>)}</div>;
}

function ImportLog({ importLog }) {
  return <div className="card table-card"><div className="card-header-row"><div><h2>Ultimi import</h2><p>Log salvato nel database locale.</p></div></div><MiniTable><thead><tr><th>Quando</th><th>File</th><th>Tipo</th><th>Esito</th><th>Messaggio</th></tr></thead><tbody>{importLog.map((l) => <tr key={l.id}><td>{String(l.created_at || '').slice(0, 19).replace('T', ' ')}</td><td>{l.nome_file}</td><td>{l.tipo}</td><td>{l.esito}</td><td>{l.messaggio || '-'}</td></tr>)}{importLog.length === 0 && <tr><td colSpan="5" className="empty-cell">Nessun import ancora registrato.</td></tr>}</tbody></MiniTable></div>;
}
