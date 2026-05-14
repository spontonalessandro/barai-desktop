import { useMemo, useState, useRef } from 'react';
import { euro, formatDate } from '../utils/format.js';

export default function OrdineFornitore({ righe = [] }) {
  const [fornitore, setFornitore] = useState('');
  const [sort, setSort] = useState('data');       // 'data' | 'nome'
  const [soloOrdinati, setSoloOrdinati] = useState(false);
  const [cerca, setCerca] = useState('');
  const [quantities, setQuantities] = useState({});
  const printRef = useRef();

  // Lista fornitori unici
  const fornitori = useMemo(() => {
    const set = new Set(righe.map((r) => r.fornitore_nome).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'it'));
  }, [righe]);

  // Prodotti dell'ultimo acquisto per fornitore selezionato
  const products = useMemo(() => {
    if (!fornitore) return [];
    const fRighe = righe.filter((r) => r.fornitore_nome === fornitore);
    const map = new Map();
    for (const r of fRighe) {
      const key = r.descrizione_originale || '';
      const existing = map.get(key);
      const dataR = r.data_fattura || '';
      if (!existing || dataR > existing.data_ultimo) {
        map.set(key, {
          key,
          descrizione: r.descrizione_originale || '-',
          prodotto_nome: r.prodotto_nome && r.prodotto_nome !== r.descrizione_originale ? r.prodotto_nome : null,
          ultimo_prezzo: Number(r.prezzo_unitario_effettivo || r.prezzo_unitario_scontato || r.prezzo_unitario || 0),
          ultima_quantita: Number(r.quantita || 0),
          um: r.um || '',
          data_ultimo: dataR,
        });
      }
    }

    let items = Array.from(map.values());

    // Cerca
    const q = cerca.trim().toLowerCase();
    if (q) items = items.filter((p) => (p.prodotto_nome || p.descrizione).toLowerCase().includes(q));

    // Ordinamento
    if (sort === 'nome') {
      items.sort((a, b) => (a.prodotto_nome || a.descrizione).localeCompare(b.prodotto_nome || b.descrizione, 'it'));
    } else {
      items.sort((a, b) => b.data_ultimo.localeCompare(a.data_ultimo));
    }

    // Solo prodotti nell'ordine corrente
    if (soloOrdinati) items = items.filter((p) => Number(quantities[p.key] || 0) > 0);

    return items;
  }, [righe, fornitore, sort, soloOrdinati, cerca, quantities]);

  const righeOrdine = useMemo(() => products.filter((p) => Number(quantities[p.key] || 0) > 0), [products, quantities]);
  const totaleOrdine = useMemo(() => righeOrdine.reduce((sum, p) => sum + Number(quantities[p.key] || 0) * p.ultimo_prezzo, 0), [righeOrdine, quantities]);

  function setQty(key, value) {
    setQuantities((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setQuantities({});
    setSoloOrdinati(false);
  }

  function stampaPDF() {
    window.print();
  }

  return (
    <section className="page-section">

      {/* Header — nascosto in stampa */}
      <div className="section-header no-print">
        <div>
          <p className="eyebrow">Operativo v9.3</p>
          <h1>Ordine a fornitore</h1>
          <p>Seleziona fornitore, inserisci le quantità da ordinare, esporta PDF.</p>
        </div>
        <div className="header-actions">
          <button className="ghost-btn" onClick={reset}>Reset quantità</button>
          <button className="primary-btn" onClick={stampaPDF} disabled={righeOrdine.length === 0}>
            Stampa ordine PDF
          </button>
        </div>
      </div>

      {/* Filtri — nascosti in stampa */}
      <div className="card ordine-filters no-print">
        <label>
          Fornitore *
          <select value={fornitore} onChange={(e) => { setFornitore(e.target.value); setQuantities({}); }}>
            <option value="">— Seleziona fornitore —</option>
            {fornitori.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label>
          Cerca prodotto
          <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Scrivi per filtrare..." />
        </label>
        <label>
          Ordina per
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="data">Ultimi acquistati</option>
            <option value="nome">Alfabetico</option>
          </select>
        </label>
        <label className="check-label">
          <input type="checkbox" checked={soloOrdinati} onChange={(e) => setSoloOrdinati(e.target.checked)} />
          Solo prodotti nell'ordine
        </label>
      </div>

      {/* Riepilogo ordine corrente — nascosto in stampa se vuoto */}
      {fornitore && righeOrdine.length > 0 && (
        <div className="card ordine-summary no-print">
          <span>{righeOrdine.length} prodott{righeOrdine.length === 1 ? 'o' : 'i'} nell'ordine</span>
          <strong>Totale stimato: {euro(totaleOrdine)}</strong>
        </div>
      )}

      {/* Intestazione stampa — visibile solo in stampa */}
      <div className="print-only ordine-print-header">
        <h2>Ordine a: {fornitore}</h2>
        <p>Data: {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Tabella prodotti */}
      {fornitore ? (
        <div className="card table-card" ref={printRef}>
          <table className="compact-table ordine-table">
            <thead>
              <tr>
                <th>Descrizione</th>
                <th>UM</th>
                <th className="right">Ultimo prezzo</th>
                <th className="right">Ultima Q.tà</th>
                <th className="no-print">Data ultimo</th>
                <th className="right ordine-qty-col">Q.tà da ordinare</th>
                <th className="right">Totale riga</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const qty = Number(quantities[p.key] || 0);
                const totale = qty * p.ultimo_prezzo;
                return (
                  <tr key={p.key} className={qty > 0 ? 'ordine-row-active' : ''}>
                    <td className="supplier-cell">
                      <strong>{p.prodotto_nome || p.descrizione}</strong>
                      {p.prodotto_nome && <><br /><span className="muted-line">{p.descrizione}</span></>}
                    </td>
                    <td>{p.um || '-'}</td>
                    <td className="right">{euro(p.ultimo_prezzo)}</td>
                    <td className="right">{p.ultima_quantita > 0 ? p.ultima_quantita : '-'}</td>
                    <td className="no-print">{p.data_ultimo ? formatDate(p.data_ultimo) : '-'}</td>
                    <td className="right">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={quantities[p.key] ?? 0}
                        onChange={(e) => setQty(p.key, e.target.value)}
                        className="ordine-qty-input no-print"
                      />
                      <span className="print-only">{qty > 0 ? qty : ''}</span>
                    </td>
                    <td className="right">
                      {qty > 0 ? <strong>{euro(totale)}</strong> : <span className="muted-line">—</span>}
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan="7" className="empty-cell">Nessun prodotto trovato per i filtri selezionati.</td></tr>
              )}
            </tbody>
            {righeOrdine.length > 0 && (
              <tfoot>
                <tr className="ordine-totale-row">
                  <td colSpan="5"><strong>TOTALE ORDINE ({righeOrdine.length} prodotti)</strong></td>
                  <td className="right no-print"><strong>{righeOrdine.reduce((s, p) => s + Number(quantities[p.key] || 0), 0)}</strong></td>
                  <td className="right"><strong>{euro(totaleOrdine)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div className="card no-print" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontWeight: 850 }}>
          Seleziona un fornitore per iniziare l'ordine.
        </div>
      )}
    </section>
  );
}
