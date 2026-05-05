import { useEffect, useMemo, useState } from 'react';

function linesToArray(value) {
  return String(value || '')
    .split('\n')
    .map((x) => x.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter((value, index, arr) => arr.findIndex((x) => x.toLowerCase() === value.toLowerCase()) === index);
}

function arrayToLines(values = []) {
  return (values || []).join('\n');
}

export default function ConfigPage({ primaNotaConfig, onSavePrimaNotaConfig }) {
  const conti = useMemo(() => primaNotaConfig?.conti || [], [primaNotaConfig?.conti]);
  const categorie = useMemo(() => primaNotaConfig?.categorie || [], [primaNotaConfig?.categorie]);
  const [contiText, setContiText] = useState(arrayToLines(conti));
  const [categorieText, setCategorieText] = useState(arrayToLines(categorie));
  const [saving, setSaving] = useState(false);

  useEffect(() => setContiText(arrayToLines(conti)), [conti]);
  useEffect(() => setCategorieText(arrayToLines(categorie)), [categorie]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSavePrimaNotaConfig({ conti: linesToArray(contiText), categorie: linesToArray(categorieText) });
    } finally {
      setSaving(false);
    }
  }

  function addCommon(type, value) {
    if (type === 'conto') {
      const next = linesToArray(`${contiText}\n${value}`);
      setContiText(arrayToLines(next));
    } else {
      const next = linesToArray(`${categorieText}\n${value}`);
      setCategorieText(arrayToLines(next));
    }
  }

  return (
    <section className="page-section config-page">
      <div className="section-header">
        <div>
          <p className="eyebrow">Config v9.1</p>
          <h1>Config</h1>
          <p>Impostazioni operative della desktop. In questa versione gestiamo conti e categorie della Prima Nota.</p>
        </div>
        <div className="hero-pill">Prima Nota configurabile</div>
      </div>

      <div className="cards-grid two">
        <form className="card" onSubmit={submit}>
          <div className="card-header-row compact-header">
            <div>
              <h2>Prima Nota</h2>
              <p>Un valore per riga. Verranno usati nei menu a tendina di movimenti manuali, filtri e riepiloghi.</p>
            </div>
            <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Salvo...' : 'Salva configurazione'}</button>
          </div>

          <div className="config-grid">
            <label>
              Conti
              <textarea value={contiText} onChange={(e) => setContiText(e.target.value)} rows={12} />
            </label>
            <label>
              Categorie
              <textarea value={categorieText} onChange={(e) => setCategorieText(e.target.value)} rows={12} />
            </label>
          </div>
        </form>

        <div className="card soft">
          <h2>Suggerimenti rapidi</h2>
          <p>Aggiungi velocemente alcune voci tipiche. Puoi sempre modificarle nel riquadro a sinistra prima di salvare.</p>
          <div className="quick-chip-grid">
            {['Satispay', 'Ticket', 'Cassa cassaforte', 'Banca secondaria'].map((value) => (
              <button key={value} className="small-btn muted" type="button" onClick={() => addCommon('conto', value)}>+ {value}</button>
            ))}
          </div>
          <div className="quick-chip-grid">
            {['Utenze', 'Commercialista', 'Manutenzioni', 'Marketing', 'SIAE', 'TARI', 'Canoni software', 'Rimborsi'].map((value) => (
              <button key={value} className="small-btn muted" type="button" onClick={() => addCommon('categoria', value)}>+ {value}</button>
            ))}
          </div>
          <div className="sync-warning-box compact">
            Le categorie e i conti vengono salvati nel database locale e inclusi nello snapshot sync. Non contengono token o password.
          </div>
        </div>
      </div>
    </section>
  );
}
