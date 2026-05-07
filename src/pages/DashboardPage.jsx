import { useMemo } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import { euro, formatDate, percent } from '../utils/format.js';
import { buildContoEconomico, currentMonthKey } from '../logic/contoEconomico.js';

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

function CeKpi({ label, value, hint, stato }) {
  return (
    <div className={`kpi-card${stato ? ' kpi-ce-' + stato : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

export default function DashboardPage({ dashboard, scadenze, gestioneData, liquidita = 0, scadenzeAperte = 0 }) {
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  const tra7 = new Date(oggi); tra7.setDate(tra7.getDate() + 7);

  const prossime = useMemo(
    () => scadenze.filter((s) => ['APERTO', 'DA_VERIFICARE'].includes(s.stato)).slice(0, 6),
    [scadenze]
  );

  const scadenzeUrgenti = useMemo(() => {
    return scadenze.filter((s) => {
      if (!['APERTO', 'DA_VERIFICARE'].includes(s.stato)) return false;
      if (!s.data_scadenza) return false;
      const d = new Date(s.data_scadenza);
      return d <= tra7;
    });
  }, [scadenze]);

  const ce = useMemo(() => {
    if (!gestioneData) return null;
    return buildContoEconomico({
      mese: currentMonthKey(),
      incassi: gestioneData.incassi || [],
      buste: gestioneData.buste || [],
      f24: gestioneData.f24 || [],
      fatture: gestioneData.fatture || [],
      fattureVendita: gestioneData.fattureVendita || [],
      movimenti: gestioneData.movimenti || [],
    });
  }, [gestioneData]);

  const posizioneNetta = liquidita - scadenzeAperte;

  return (
    <section className="page-section">
      <div className="hero-card">
        <div>
          <p className="eyebrow">BarAI Desktop v9.3</p>
          <h1>Gestionale locale per il bar</h1>
          <p>Controllo prezzi, food cost reale, conto economico e analisi fornitori.</p>
        </div>
        <div className="hero-pill">SQLite locale · {new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</div>
      </div>

      {ce && ce.ricavi > 0 && (
        <div className="kpi-grid">
          <CeKpi
            label="Ricavi mese"
            value={euro(ce.ricavi)}
            hint={`Incassi ${euro(ce.ricaviIncassi)}`}
          />
          <CeKpi
            label="Margine lordo"
            value={percent(ce.percentuali.margineLordo)}
            hint={euro(ce.margineLordo)}
            stato={semaforo(ce.percentuali.margineLordo, { verde: 50, giallo: 35, maggiore: true })}
          />
          <CeKpi
            label="EBITDA"
            value={percent(ce.percentuali.ebitda)}
            hint={euro(ce.ebitda)}
            stato={semaforo(ce.percentuali.ebitda, { verde: 15, giallo: 10, maggiore: true })}
          />
          <CeKpi
            label="Posizione netta"
            value={euro(posizioneNetta)}
            hint={`Cassa ${euro(liquidita)} − Fatture aperte ${euro(scadenzeAperte)}`}
            stato={semaforo(posizioneNetta, { verde: 5000, giallo: 0, maggiore: true })}
          />
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>Fatture acquisto</span>
          <strong>{dashboard?.fatture ?? 0}</strong>
        </div>
        <div className={`kpi-card${scadenzeUrgenti.length > 0 ? ' kpi-ce-rosso' : ''}`}>
          <span>Scade entro 7 giorni</span>
          <strong>{scadenzeUrgenti.length}</strong>
          <em>{euro(scadenzeUrgenti.reduce((a, s) => a + Number(s.importo || 0), 0))}</em>
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
              <th>Scadenza</th><th>Fornitore</th><th>Fattura</th><th>Importo</th><th>Stato</th>
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
