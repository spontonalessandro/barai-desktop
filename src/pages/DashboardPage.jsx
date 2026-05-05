import { useMemo } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import { euro, formatDate } from '../utils/format.js';

export default function DashboardPage({ dashboard, scadenze }) {
  const prossime = useMemo(
    () => scadenze.filter((s) => ['APERTO', 'DA_VERIFICARE'].includes(s.stato)).slice(0, 6),
    [scadenze]
  );

  return (
    <section className="page-section">
      <div className="hero-card">
        <div>
          <p className="eyebrow">BarAI Desktop v9.1</p>
          <h1>Gestionale locale veloce per il bar</h1>
          <p>Versione v9.1: fonti dati per il Controllo di Gestione, con incassi cassa, buste paga e F24.</p>
        </div>
        <div className="hero-pill">SQLite locale: barai.sqlite</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>Fatture acquisto</span>
          <strong>{dashboard?.fatture ?? 0}</strong>
        </div>
        <div className="kpi-card">
          <span>Scadenze aperte</span>
          <strong>{dashboard?.scadenzeAperte ?? 0}</strong>
        </div>
        <div className="kpi-card warning">
          <span>Da verificare</span>
          <strong>{dashboard?.daVerificare ?? 0}</strong>
        </div>
        <div className="kpi-card">
          <span>Totale aperto</span>
          <strong>{euro(dashboard?.totaleAperto)}</strong>
        </div>
      </div>

      <div className="card table-card">
        <div className="card-header-row">
          <div>
            <h2>Prossime scadenze</h2>
            <p>Scadenze aperte o da verificare ordinate per data.</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Scadenza</th>
              <th>Fornitore</th>
              <th>Fattura</th>
              <th>Importo</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {prossime.map((s) => (
              <tr key={s.id}>
                <td>{formatDate(s.data_scadenza)}</td>
                <td>{s.fornitore_nome}</td>
                <td>{s.numero}</td>
                <td>{euro(s.importo)}</td>
                <td><StatusBadge stato={s.stato} /></td>
              </tr>
            ))}
            {prossime.length === 0 && (
              <tr><td colSpan="5" className="empty-cell">Nessuna scadenza aperta.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

