import { useMemo, useState } from 'react';
import { euro, percent } from '../utils/format.js';
import { buildContoEconomicoConfronto, buildTrendMensile } from '../logic/contoEconomico.js';

const monthISO = () => new Date().toISOString().slice(0, 7);

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

// --- Semaforo ---

function semaforo(value, { verde, giallo, maggiore = false }) {
  if (maggiore) {
    if (value >= verde) return 'verde';
    if (value >= giallo) return 'giallo';
    return 'rosso';
  }
  if (value <= verde) return 'verde';
  if (value <= giallo) return 'giallo';
  return 'rosso';
}

function SemaforoCard({ label, value, display, soglia, hint }) {
  const stato = semaforo(value, soglia);
  return (
    <div className={`semaforo-card semaforo-${stato}`}>
      <div className={`semaforo-dot semaforo-dot-${stato}`} />
      <span className="semaforo-label">{label}</span>
      <strong className="semaforo-value">{display}</strong>
      <em className="semaforo-hint">{hint}</em>
    </div>
  );
}

// --- Trend chart ---

function TrendChart({ mesi }) {
  const maxRicavi = Math.max(...mesi.map((m) => m.ricavi), 1);
  return (
    <div className="trend-chart-wrap">
      <div className="trend-chart">
        {mesi.map((m) => {
          const h = Math.max((m.ricavi / maxRicavi) * 100, m.ricavi > 0 ? 4 : 0);
          const ebitdaStato = m.percentuali.ebitda >= 15 ? 'verde' : m.percentuali.ebitda >= 10 ? 'giallo' : 'rosso';
          return (
            <div key={m.mese} className="trend-col">
              <div className="trend-bar-wrap">
                <div className="trend-bar" style={{ height: `${h}%` }} />
              </div>
              <div className={`trend-ebitda trend-ebitda-${ebitdaStato}`}>
                {m.ricavi > 0 ? percent(m.percentuali.ebitda) : '—'}
              </div>
              <div className="trend-month-label">{m.mese.slice(5)}</div>
              <div className="trend-ricavi-label">{m.ricavi > 0 ? euro(m.ricavi) : '—'}</div>
            </div>
          );
        })}
      </div>
      <div className="trend-legend">
        <span className="trend-legend-bar" /> Ricavi &nbsp;&nbsp;
        <span className="trend-legend-dot trend-ebitda-verde" />  EBITDA % (verde ≥15%, giallo ≥10%)
      </div>
    </div>
  );
}

// --- CE helpers ---

function delta(current, previous) {
  return numberValue(current) - numberValue(previous);
}

function Delta({ value }) {
  const n = numberValue(value);
  if (!n) return <span className="muted-line">—</span>;
  return <span className={n >= 0 ? 'positive-text' : 'negative-text'}>{n >= 0 ? '+' : ''}{euro(n)}</span>;
}

function Kpi({ label, value, hint }) {
  return (
    <div className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
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
          {(rows || []).slice(0, 8).map((row) => (
            <tr key={row.label}><td>{row.label}</td><td>{euro(row.importo)}</td></tr>
          ))}
          {!(rows || []).length ? <tr><td colSpan="2" className="empty-cell">Nessun dato.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

// --- Main page ---

export default function GestionePage({ data, liquidita = 0 }) {
  const [tab, setTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(monthISO());

  const incassi = data?.incassi || [];
  const buste = data?.buste || [];
  const f24 = data?.f24 || [];
  const fatture = data?.fatture || [];
  const fattureVendita = data?.fattureVendita || [];
  const movimenti = data?.movimenti || [];

  const ceData = useMemo(
    () => buildContoEconomicoConfronto({ mese: selectedMonth, incassi, buste, f24, fatture, fattureVendita, movimenti }),
    [selectedMonth, incassi, buste, f24, fatture, fattureVendita, movimenti]
  );
  const ce = ceData.corrente;
  const cePrev = ceData.precedente;
  const ceYear = ceData.annoPrecedente;

  const trend = useMemo(
    () => buildTrendMensile({ mese: selectedMonth, incassi, buste, f24, fatture, fattureVendita, movimenti }, 6),
    [selectedMonth, incassi, buste, f24, fatture, fattureVendita, movimenti]
  );

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Admin / CE v9.2</p>
          <h1>Controllo di gestione</h1>
        </div>
        <div className="header-actions">
          <label>Mese<input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} /></label>
        </div>
      </div>

      <div className="subnav">
        <button className={tab === 'dashboard' ? 'selected' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button className={tab === 'ce' ? 'selected' : ''} onClick={() => setTab('ce')}>Conto Economico</button>
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="semaforo-grid">
            <SemaforoCard
              label="Food Cost %"
              value={ce.percentuali.acquisti}
              display={percent(ce.percentuali.acquisti)}
              soglia={{ verde: 30, giallo: 35, maggiore: false }}
              hint="ottimale: < 30%"
            />
            <SemaforoCard
              label="Costo personale %"
              value={ce.percentuali.personale}
              display={percent(ce.percentuali.personale)}
              soglia={{ verde: 35, giallo: 40, maggiore: false }}
              hint="ottimale: < 35%"
            />
            <SemaforoCard
              label="EBITDA %"
              value={ce.percentuali.ebitda}
              display={percent(ce.percentuali.ebitda)}
              soglia={{ verde: 15, giallo: 10, maggiore: true }}
              hint="ottimale: > 15%"
            />
            <SemaforoCard
              label="ROS"
              value={ce.percentuali.risultato}
              display={percent(ce.percentuali.risultato)}
              soglia={{ verde: 10, giallo: 5, maggiore: true }}
              hint="ottimale: > 10%"
            />
            <SemaforoCard
              label="Liquidità (Prima Nota)"
              value={liquidita}
              display={euro(liquidita)}
              soglia={{ verde: 5000, giallo: 0, maggiore: true }}
              hint={liquidita >= 0 ? 'saldo positivo' : 'saldo negativo'}
            />
          </div>

          <div className="card">
            <h2>Ricavi ultimi 6 mesi</h2>
            <p>Barre: ricavi mensili. Etichetta colorata: EBITDA % del mese.</p>
            <TrendChart mesi={trend} />
          </div>
        </>
      )}

      {tab === 'ce' && (
        <>
          <div className="kpi-grid">
            <Kpi label="Ricavi" value={euro(ce.ricavi)} hint={`Incassi ${euro(ce.ricaviIncassi)} · Fatture ${euro(ce.ricaviFattureVendita || 0)}`} />
            <Kpi label="Margine lordo" value={euro(ce.margineLordo)} hint={percent(ce.percentuali.margineLordo)} />
            <Kpi label="EBITDA" value={euro(ce.ebitda)} hint={percent(ce.percentuali.ebitda)} />
            <Kpi label="Risultato stimato" value={euro(ce.risultatoGestionale)} hint={percent(ce.percentuali.risultato)} />
          </div>

          <div className="cards-grid three">
            <div className="card compact-card">
              <h3>Vs mese precedente</h3>
              <p>Ricavi <Delta value={delta(ce.ricavi, cePrev.ricavi)} /></p>
              <p>EBITDA <Delta value={delta(ce.ebitda, cePrev.ebitda)} /></p>
              <p>Risultato <Delta value={delta(ce.risultatoGestionale, cePrev.risultatoGestionale)} /></p>
            </div>
            <div className="card compact-card">
              <h3>Vs anno precedente</h3>
              <p>Ricavi <Delta value={delta(ce.ricavi, ceYear.ricavi)} /></p>
              <p>EBITDA <Delta value={delta(ce.ebitda, ceYear.ebitda)} /></p>
              <p>Risultato <Delta value={delta(ce.risultatoGestionale, ceYear.risultatoGestionale)} /></p>
            </div>
            <div className="card compact-card">
              <h3>Fonti dati mese</h3>
              <p>Incassi: {ce.counts.incassi}</p>
              <p>Fatture vendita: {ce.counts.fattureVendita || 0}</p>
              <p>Fatture acquisto: {ce.counts.fatture}</p>
              <p>Buste: {ce.counts.buste} · F24: {ce.counts.f24}</p>
            </div>
          </div>

          <div className="card table-card"><h2>Conto Economico</h2><CeTable ce={ce} /></div>

          <div className="cards-grid two">
            <DetailList title="Ricavi" rows={ce.dettaglio.ricavi} />
            <DetailList title="Acquisti per fornitore" rows={ce.dettaglio.acquisti} />
            <DetailList title="Costi operativi" rows={ce.dettaglio.costiOperativi} />
            <DetailList title="Costo personale" rows={ce.dettaglio.personale} />
            <DetailList title="F24 / tributi" rows={ce.dettaglio.f24} />
          </div>
        </>
      )}
    </section>
  );
}
