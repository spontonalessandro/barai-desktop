import { useMemo, useState } from 'react';
import { euro, percent } from '../utils/format.js';
import { buildContoEconomicoConfronto } from '../logic/contoEconomico.js';

const monthISO = () => new Date().toISOString().slice(0, 7);

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function Kpi({ label, value, hint }) {
  return <div className="kpi-card"><span>{label}</span><strong>{value}</strong>{hint ? <em>{hint}</em> : null}</div>;
}

function delta(current, previous) {
  return numberValue(current) - numberValue(previous);
}

function Delta({ value }) {
  const n = numberValue(value);
  if (!n) return <span className="muted-line">—</span>;
  return <span className={n >= 0 ? 'positive-text' : 'negative-text'}>{n >= 0 ? '+' : ''}{euro(n)}</span>;
}

function CeTable({ ce }) {
  const rows = ce?.righe || [];
  return (
    <table>
      <thead><tr><th>Sezione</th><th>Voce</th><th>Importo</th><th>% ricavi</th></tr></thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={`${row.label}-${idx}`} className={row.tipo === 'finale' || row.tipo === 'totale' ? 'highlight-row' : ''}>
            <td>{row.sezione}</td>
            <td>{row.label}</td>
            <td>{euro(row.importo)}</td>
            <td>{ce.ricavi ? percent((numberValue(row.importo) / ce.ricavi) * 100) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailList({ title, rows }) {
  return (
    <div className="card compact-card">
      <h3>{title}</h3>
      <table>
        <tbody>
          {(rows || []).slice(0, 8).map((row) => <tr key={row.label}><td>{row.label}</td><td>{euro(row.importo)}</td></tr>)}
          {!(rows || []).length ? <tr><td colSpan="2" className="empty-cell">Nessun dato.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

export default function GestionePage({ data }) {
  const [selectedMonth, setSelectedMonth] = useState(monthISO());
  const incassi = data?.incassi || [];
  const buste = data?.buste || [];
  const f24 = data?.f24 || [];
  const fatture = data?.fatture || [];
  const fattureVendita = data?.fattureVendita || [];
  const movimenti = data?.movimenti || [];

  const ceData = useMemo(() => buildContoEconomicoConfronto({ mese: selectedMonth, incassi, buste, f24, fatture, fattureVendita, movimenti }), [selectedMonth, incassi, buste, f24, fatture, fattureVendita, movimenti]);
  const ce = ceData.corrente;
  const cePrev = ceData.precedente;
  const ceYear = ceData.annoPrecedente;

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Admin / CE v9.1.1</p>
          <h1>Conto Economico gestionale</h1>
          <p>Qui trovi solo analisi e controllo di gestione. Gli import sono stati spostati nella tab Caricamenti.</p>
        </div>
        <div className="header-actions"><label>Mese<input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} /></label></div>
      </div>

      <div className="kpi-grid">
        <Kpi label="Ricavi" value={euro(ce.ricavi)} hint={`Incassi ${euro(ce.ricaviIncassi)} · Fatture ${euro(ce.ricaviFattureVendita || 0)}`} />
        <Kpi label="Margine lordo" value={euro(ce.margineLordo)} hint={percent(ce.percentuali.margineLordo)} />
        <Kpi label="EBITDA" value={euro(ce.ebitda)} hint={percent(ce.percentuali.ebitda)} />
        <Kpi label="Risultato stimato" value={euro(ce.risultatoGestionale)} hint={percent(ce.percentuali.risultato)} />
      </div>

      <div className="cards-grid three">
        <div className="card compact-card"><h3>Vs mese precedente</h3><p>Ricavi <Delta value={delta(ce.ricavi, cePrev.ricavi)} /></p><p>EBITDA <Delta value={delta(ce.ebitda, cePrev.ebitda)} /></p><p>Risultato <Delta value={delta(ce.risultatoGestionale, cePrev.risultatoGestionale)} /></p></div>
        <div className="card compact-card"><h3>Vs anno precedente</h3><p>Ricavi <Delta value={delta(ce.ricavi, ceYear.ricavi)} /></p><p>EBITDA <Delta value={delta(ce.ebitda, ceYear.ebitda)} /></p><p>Risultato <Delta value={delta(ce.risultatoGestionale, ceYear.risultatoGestionale)} /></p></div>
        <div className="card compact-card"><h3>Fonti dati mese</h3><p>Incassi: {ce.counts.incassi}</p><p>Fatture vendita: {ce.counts.fattureVendita || 0}</p><p>Fatture acquisto: {ce.counts.fatture}</p><p>Buste: {ce.counts.buste} · F24: {ce.counts.f24}</p></div>
      </div>

      <div className="card table-card"><h2>Conto Economico</h2><CeTable ce={ce} /></div>

      <div className="cards-grid two">
        <DetailList title="Ricavi" rows={ce.dettaglio.ricavi} />
        <DetailList title="Acquisti per fornitore" rows={ce.dettaglio.acquisti} />
        <DetailList title="Costi operativi" rows={ce.dettaglio.costiOperativi} />
        <DetailList title="Costo personale" rows={ce.dettaglio.personale} />
        <DetailList title="F24 / tributi" rows={ce.dettaglio.f24} />
      </div>
    </section>
  );
}
