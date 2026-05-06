import { useMemo, useState } from 'react';
import { euro, percent, formatDate } from '../utils/format.js';
import { guessCategoria, guessPezziPerCartone, guessQuantitaPerUnita, guessUm, norm } from '../utils/productGuess.js';
import { downloadCsv } from '../utils/csv.js';

function deltaClass(value, soglia = 5) {
  const n = Number(value || 0);
  if (n >= Number(soglia || 0)) return 'delta-up';
  if (n <= -Number(soglia || 0)) return 'delta-down';
  return 'delta-flat';
}


function uniq(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'it'));
}


const FIXED_UM = ['LT', 'PZ', 'KG', 'CRT'];
const DEFAULT_CATEGORIES = ['ALIMENTARI', 'BEVANDE', 'VINI', 'BIRRE', 'CAFFETTERIA', 'PULIZIA', 'MATERIALE CONSUMO', 'AMMINISTRATIVO', 'ALTRO'];

function normalizeCategory(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function buildCategoryOptions(categorie, suggested) {
  return uniq([...(categorie || []), suggested, ...DEFAULT_CATEGORIES].map(normalizeCategory).filter(Boolean));
}

function MappingForm({ item, prodotti, categorie, onCancel, onSave }) {
  const suggestedCategoria = guessCategoria(item?.descrizione_originale);
  const suggestedPezzi = guessPezziPerCartone(item?.descrizione_originale);
  const suggestedUm = guessUm(item?.descrizione_originale, item?.um);
  const suggestedQuantita = guessQuantitaPerUnita(item?.descrizione_originale, suggestedUm);
  const categoryOptions = buildCategoryOptions(categorie, suggestedCategoria);
  const [productSearch, setProductSearch] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [localCategories, setLocalCategories] = useState(categoryOptions);
  const [form, setForm] = useState({
    prodotto_id: '',
    prodotto_nome: item?.descrizione_originale || '',
    categoria: normalizeCategory(item?.categoria || suggestedCategoria || ''),
    um_base: FIXED_UM.includes(String(suggestedUm || '').toUpperCase()) ? String(suggestedUm || '').toUpperCase() : 'PZ',
    pezzi_per_cartone: item?.pezzi_per_cartone || suggestedPezzi,
    quantita_per_unita: item?.quantita_per_unita || suggestedQuantita,
    um_acquisto_default: item?.um || '',
    note_conversione: suggestedPezzi > 1 ? `Prezzo XML diviso per ${suggestedPezzi} pezzi/cartone` : ''
  });

  const filteredProducts = useMemo(() => {
    const q = norm(productSearch);
    return (prodotti || [])
      .filter((p) => !q || norm(`${p.nome} ${p.categoria} ${p.um_base}`).includes(q))
      .slice(0, 80);
  }, [prodotti, productSearch]);

  function selectProduct(id) {
    const p = prodotti.find((x) => x.id === id);
    setForm((prev) => ({
      ...prev,
      prodotto_id: id,
      prodotto_nome: p?.nome || prev.prodotto_nome,
      categoria: normalizeCategory(p?.categoria || prev.categoria),
      um_base: FIXED_UM.includes(String(p?.um_base || '').toUpperCase()) ? String(p?.um_base).toUpperCase() : prev.um_base,
      pezzi_per_cartone: p?.pezzi_per_cartone || prev.pezzi_per_cartone,
      quantita_per_unita: p?.quantita_per_unita || prev.quantita_per_unita,
      um_acquisto_default: p?.um_acquisto_default || prev.um_acquisto_default,
      note_conversione: p?.note_conversione || prev.note_conversione
    }));
  }

  function addCategory() {
    const c = normalizeCategory(newCategory);
    if (!c) return;
    setLocalCategories((prev) => uniq([...prev, c]));
    setForm((prev) => ({ ...prev, categoria: c }));
    setNewCategory('');
  }

  function submit(e) {
    e.preventDefault();
    const categoria = normalizeCategory(form.categoria);
    if (!categoria) return;
    onSave({ ...item, ...form, categoria });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card price-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Mappatura prodotto</p>
            <h2>Prodotto non mappato</h2>
          </div>
          <button className="icon-btn" onClick={onCancel}>×</button>
        </div>
        <div className="mini-detail">
          <strong>{item.descrizione_originale}</strong>
          <span>{item.fornitore_nome || '-'} · ultimo prezzo {euro(item.ultimo_prezzo)} · {item.righe_count} righe</span>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label className="span-2">
            Cerca prodotto già creato
            <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Scrivi per filtrare i prodotti esistenti..." />
          </label>
          <label className="span-2">
            Usa prodotto già creato
            <select value={form.prodotto_id} onChange={(e) => selectProduct(e.target.value)}>
              <option value="">+ Crea nuovo prodotto standard</option>
              {filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.categoria || 'senza categoria'} · {p.um_base || '-'}</option>)}
            </select>
          </label>
          <label className="span-2">
            Nome prodotto standard
            <input value={form.prodotto_nome} onChange={(e) => setForm((prev) => ({ ...prev, prodotto_nome: e.target.value }))} required />
          </label>
          <label>
            Categoria *
            <select value={form.categoria} onChange={(e) => setForm((prev) => ({ ...prev, categoria: normalizeCategory(e.target.value) }))} required>
              <option value="">Seleziona categoria</option>
              {localCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="inline-create">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nuova categoria" />
              <button type="button" className="tiny-btn" onClick={addCategory}>+</button>
            </div>
          </label>
          <label>
            UM base *
            <select value={form.um_base} onChange={(e) => setForm((prev) => ({ ...prev, um_base: e.target.value }))} required>
              <option value="">Seleziona UM</option>
              <option value="LT">LT - Litro</option>
              <option value="PZ">PZ - Pezzo</option>
              <option value="KG">KG - Kilogrammo</option>
              <option value="CRT">CRT - Cartone</option>
            </select>
          </label>
          <label>
            Pezzi per cartone/conf.
            <input type="number" min="1" step="1" value={form.pezzi_per_cartone} onChange={(e) => setForm((prev) => ({ ...prev, pezzi_per_cartone: e.target.value }))} />
          </label>
          <label>
            Quantità per unità
            <input type="number" min="0.001" step="0.001" value={form.quantita_per_unita} onChange={(e) => setForm((prev) => ({ ...prev, quantita_per_unita: e.target.value }))} />
            <small>Es. sacco 5 KG: pezzi 1, quantità 5.</small>
          </label>
          <label>
            UM acquisto XML
            <input value={form.um_acquisto_default} onChange={(e) => setForm((prev) => ({ ...prev, um_acquisto_default: e.target.value }))} placeholder="CT, CART, CONF, PZ..." />
          </label>
          <label className="span-2">
            Note conversione
            <input value={form.note_conversione} onChange={(e) => setForm((prev) => ({ ...prev, note_conversione: e.target.value }))} placeholder="Esempio: cartone da 9 bottiglie" />
          </label>
          <div className="suggestion-box span-2">
            <strong>Suggerimento rapido</strong>
            <span>Categoria: {suggestedCategoria || 'da scegliere'} · UM: {suggestedUm || 'da scegliere'} · Pezzi/cartone: {suggestedPezzi > 1 ? suggestedPezzi : '1'} · Quantità/unità: {suggestedQuantita > 1 ? suggestedQuantita : '1'}</span>
          </div>
          <div className="form-actions span-2">
            <button type="button" className="ghost-btn" onClick={onCancel}>Annulla</button>
            <button className="primary-btn">Salva mappatura</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductEditForm({ product, categorie, onCancel, onSave }) {
  const categoryOptions = buildCategoryOptions(categorie, product?.categoria);
  const [newCategory, setNewCategory] = useState('');
  const [localCategories, setLocalCategories] = useState(categoryOptions);
  const [form, setForm] = useState({
    prodotto_id: product?.prodotto_id || product?.id || '',
    prodotto_nome: product?.nome || '',
    categoria: normalizeCategory(product?.categoria || ''),
    um_base: FIXED_UM.includes(String(product?.um || product?.um_base || '').toUpperCase()) ? String(product?.um || product?.um_base).toUpperCase() : 'PZ',
    pezzi_per_cartone: product?.pezzi_per_cartone || 1,
    quantita_per_unita: product?.quantita_per_unita || 1,
    um_acquisto_default: product?.um_acquisto_default || '',
    note_conversione: product?.note_conversione || ''
  });

  function addCategory() {
    const c = normalizeCategory(newCategory);
    if (!c) return;
    setLocalCategories((prev) => uniq([...prev, c]));
    setForm((prev) => ({ ...prev, categoria: c }));
    setNewCategory('');
  }

  function submit(e) {
    e.preventDefault();
    const categoria = normalizeCategory(form.categoria);
    if (!categoria) return;
    onSave({ ...form, categoria });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card price-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Prodotto mappato</p>
            <h2>Modifica prodotto</h2>
          </div>
          <button className="icon-btn" onClick={onCancel}>×</button>
        </div>
        <div className="mini-detail">
          <strong>{product.nome}</strong>
          <span>Le modifiche aggiornano anche il controllo prezzi collegato a questo prodotto.</span>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label className="span-2">
            Nome prodotto standard
            <input value={form.prodotto_nome} onChange={(e) => setForm((prev) => ({ ...prev, prodotto_nome: e.target.value }))} required />
          </label>
          <label>
            Categoria *
            <select value={form.categoria} onChange={(e) => setForm((prev) => ({ ...prev, categoria: normalizeCategory(e.target.value) }))} required>
              <option value="">Seleziona categoria</option>
              {localCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="inline-create">
              <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nuova categoria" />
              <button type="button" className="tiny-btn" onClick={addCategory}>+</button>
            </div>
          </label>
          <label>
            UM base *
            <select value={form.um_base} onChange={(e) => setForm((prev) => ({ ...prev, um_base: e.target.value }))} required>
              <option value="LT">LT - Litro</option>
              <option value="PZ">PZ - Pezzo</option>
              <option value="KG">KG - Kilogrammo</option>
              <option value="CRT">CRT - Cartone</option>
            </select>
          </label>
          <label>
            Pezzi per cartone/conf.
            <input type="number" min="1" step="1" value={form.pezzi_per_cartone} onChange={(e) => setForm((prev) => ({ ...prev, pezzi_per_cartone: e.target.value }))} />
          </label>
          <label>
            Quantità per unità
            <input type="number" min="0.001" step="0.001" value={form.quantita_per_unita} onChange={(e) => setForm((prev) => ({ ...prev, quantita_per_unita: e.target.value }))} />
            <small>Es. sacco 5 KG: pezzi 1, quantità 5.</small>
          </label>
          <label>
            UM acquisto XML
            <input value={form.um_acquisto_default} onChange={(e) => setForm((prev) => ({ ...prev, um_acquisto_default: e.target.value }))} placeholder="CT, CART, CONF, PZ..." />
          </label>
          <label className="span-2">
            Note conversione
            <input value={form.note_conversione} onChange={(e) => setForm((prev) => ({ ...prev, note_conversione: e.target.value }))} />
          </label>
          <div className="form-actions span-2">
            <button type="button" className="ghost-btn" onClick={onCancel}>Annulla</button>
            <button className="primary-btn">Salva modifiche</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductDetail({ product, onClose }) {
  if (!product) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-card price-modal wide">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Dettaglio prezzo</p>
            <h2>{product.nome}</h2>
            <p>{product.categoria || 'Senza categoria'} · {product.righe_count} righe · ultimo fornitore {product.fornitore_ultimo || '-'} · pezzi/cartone {product.pezzi_per_cartone || 1} · quantità/unità {product.quantita_per_unita || 1}</p>
          </div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="detail-kpis">
          <div><span>Ultimo base</span><strong>{euro(product.ultimo_prezzo)}</strong></div>
          <div><span>Precedente</span><strong>{product.prezzo_precedente ? euro(product.prezzo_precedente) : '-'}</strong></div>
          <div><span>Delta</span><strong className={deltaClass(product.delta_percent)}>{product.prezzo_precedente ? percent(product.delta_percent) : '-'}</strong></div>
          <div><span>Media</span><strong>{euro(product.prezzo_medio)}</strong></div>
          <div><span>Min / Max</span><strong>{euro(product.prezzo_min)} / {euro(product.prezzo_max)}</strong></div>
        </div>
        <table className="compact-table">
          <thead><tr><th>Data</th><th>Fornitore</th><th>Fattura</th><th>Descrizione</th><th>Q.tà</th><th>UM</th><th>Pz/cart.</th><th>Qt/unità</th><th>P.Unit XML</th><th>P.Unit scontato</th><th>Prezzo base</th><th>Totale</th></tr></thead>
          <tbody>
            {(product.righe || []).map((r) => (
              <tr key={r.id || `${r.fattura_id}_${r.numero_linea}`}>
                <td>{formatDate(r.data_fattura)}</td>
                <td className="supplier-cell">{r.fornitore_nome || '-'}</td>
                <td>{r.numero || '-'}</td>
                <td className="supplier-cell">{r.descrizione_originale || '-'}</td>
                <td className="right">{Number(r.quantita || 0).toLocaleString('it-IT')}</td>
                <td>{r.um || '-'}</td>
                <td className="right">{r.pezzi_per_cartone || 1}</td>
                <td className="right">{r.quantita_per_unita || 1}</td>
                <td className="right">{euro(r.prezzo_unitario_xml_originale || r.prezzo_unitario || 0)}</td>
                <td className="right">{euro(r.prezzo_unitario_scontato || r.prezzo_unitario_xml || r.prezzo_unitario || 0)}</td>
                <td className="right">{euro(r.prezzo_unitario_effettivo || r.prezzo_unitario_scontato || r.prezzo_unitario || 0)}</td>
                <td className="right">{euro(r.totale_riga)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkMappingModal({ selected, items, categorie, prodotti, onMap, onClose }) {
  const selectedItems = items.filter((p) => selected.has(p.key || p.descrizione_originale));
  const categoryOptions = buildCategoryOptions(categorie, '');

  const [bulkCategoria, setBulkCategoria] = useState('');
  const [nomeMode, setNomeMode] = useState('fattura');
  const [nomeUnificato, setNomeUnificato] = useState('');
  const [prodottoEsistente, setProdottoEsistente] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredProdottiEsistenti = useMemo(() => {
    const q = norm(productSearch);
    return (prodotti || [])
      .filter((p) => !q || norm(p.nome + ' ' + (p.categoria || '') + ' ' + (p.um_base || '')).includes(q))
      .slice(0, 80);
  }, [prodotti, productSearch]);

  function selectProdottoEsistente(id) {
    const p = (prodotti || []).find((x) => x.id === id);
    setProdottoEsistente(p || null);
    if (p) {
      setBulkCategoria(normalizeCategory(p.categoria || ''));
      setNomeMode('unificato');
      setNomeUnificato(p.nome || '');
    } else {
      setProdottoEsistente(null);
    }
  }

  const VALID_UM_BULK = ['LT', 'PZ', 'KG', 'CRT'];
  const initRow = (item) => {
    const guessed = (guessUm(item.descrizione_originale, item.um) || 'PZ').toUpperCase();
    return {
      nome: item.descrizione_originale,
      um: VALID_UM_BULK.includes(guessed) ? guessed : 'PZ',
      pezzi: guessPezziPerCartone(item.descrizione_originale) || 1,
      quantita: guessQuantitaPerUnita(item.descrizione_originale, guessUm(item.descrizione_originale, item.um)) || 1,
    };
  };

  const [rows, setRows] = useState(() => Object.fromEntries(selectedItems.map((item) => [item.key || item.descrizione_originale, initRow(item)])));

  function setRow(key, field, value) {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function saveBulk() {
    if (!bulkCategoria) return;
    setSaving(true);
    const payloads = selectedItems.map((item) => {
      const key = item.key || item.descrizione_originale;
      const row = rows[key] || initRow(item);
      const nomeProdotto = nomeMode === 'unificato' && nomeUnificato.trim() ? nomeUnificato.trim() : item.descrizione_originale;
      return {
        ...item,
        prodotto_id: prodottoEsistente?.id || '',
        prodotto_nome: nomeProdotto,
        categoria: normalizeCategory(bulkCategoria),
        um_base: String(row.um || prodottoEsistente?.um_base || 'PZ').toUpperCase(),
        pezzi_per_cartone: Number(row.pezzi) || 1,
        quantita_per_unita: Number(row.quantita) || 1,
        um_acquisto_default: item.um || '',
        note_conversione: Number(row.pezzi) > 1 ? `Prezzo XML diviso per ${row.pezzi} pezzi/cartone` : ''
      };
    });
    await onMap(payloads);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card bulk-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Mappatura multipla</p>
            <h2>{selectedItems.length} prodotti selezionati</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        {/* Impostazioni comuni */}
        <div className="bulk-common">
          <label>
            Cerca prodotto esistente
            <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Scrivi per filtrare..." />
          </label>
          <label>
            Collega a prodotto esistente
            <select value={prodottoEsistente?.id || ''} onChange={(e) => selectProdottoEsistente(e.target.value)}>
              <option value="">+ Crea nuovo prodotto</option>
              {filteredProdottiEsistenti.map((p) => (
                <option key={p.id} value={p.id}>{p.nome} · {p.categoria || '-'} · {p.um_base || '-'}</option>
              ))}
            </select>
          </label>
          {prodottoEsistente && (
            <div className="bulk-existing-badge">
              Collegato a: <strong>{prodottoEsistente.nome}</strong> ({prodottoEsistente.categoria})
            </div>
          )}
          <label>
            Categoria (comune) *
            <select value={bulkCategoria} onChange={(e) => setBulkCategoria(e.target.value)}>
              <option value="">Scegli categoria...</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Nome prodotto
            <select value={nomeMode} onChange={(e) => setNomeMode(e.target.value)}>
              <option value="fattura">Usa nome fattura (uno per uno)</option>
              <option value="unificato">Nome unificato per tutti</option>
            </select>
          </label>
          {nomeMode === 'unificato' && (
            <label className="bulk-nome-input">
              Nome unificato
              <input value={nomeUnificato} onChange={(e) => setNomeUnificato(e.target.value)} placeholder="Es. Energia elettrica" />
            </label>
          )}
        </div>

        {/* Tabella righe con pezzi/qt individuali */}
        <div className="bulk-table-wrap">
          <table className="compact-table bulk-rows-table">
            <thead>
              <tr>
                <th>Descrizione originale</th>
                <th>Fornitore</th>
                <th className="right">P.Unit XML</th>
                <th>UM</th>
                <th>Pz/cartone</th>
                <th>Qt/unità</th>
                <th className="right">Prezzo base calc.</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.map((item) => {
                const key = item.key || item.descrizione_originale;
                const row = rows[key] || initRow(item);
                const pezzi = Number(row.pezzi) || 1;
                const quantita = Number(row.quantita) || 1;
                const prezzoBase = (item.ultimo_prezzo || 0) / pezzi / quantita;
                return (
                  <tr key={key}>
                    <td className="supplier-cell">
                      <strong>{nomeMode === 'unificato' && nomeUnificato.trim() ? nomeUnificato.trim() : item.descrizione_originale}</strong>
                      <br /><span className="muted-line">{item.descrizione_originale}</span>
                    </td>
                    <td className="supplier-cell">{item.fornitore_nome || '-'}</td>
                    <td className="right">{euro(item.ultimo_prezzo)}</td>
                    <td>
                      <select className="bulk-inline-select" value={row.um} onChange={(e) => setRow(key, 'um', e.target.value)}>
                        <option value="PZ">PZ</option>
                        <option value="LT">LT</option>
                        <option value="KG">KG</option>
                        <option value="CRT">CRT</option>
                      </select>
                    </td>
                    <td>
                      <input className="bulk-inline-input" type="number" min="1" step="1" value={row.pezzi} onChange={(e) => setRow(key, 'pezzi', e.target.value)} />
                    </td>
                    <td>
                      <input className="bulk-inline-input" type="number" min="0.001" step="0.001" value={row.quantita} onChange={(e) => setRow(key, 'quantita', e.target.value)} />
                    </td>
                    <td className="right"><strong>{euro(prezzoBase)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="form-actions" style={{ marginTop: 14 }}>
          <button className="ghost-btn" onClick={onClose} disabled={saving}>Annulla</button>
          <button className="primary-btn" onClick={saveBulk} disabled={saving || !bulkCategoria}>
            {saving ? 'Mappatura in corso...' : `Mappa ${selectedItems.length} prodotti`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ControlloPrezzi({ data, onMap, onMapMany, onSaveProduct }) {
  const [tab, setTab] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('');
  const [fornitore, setFornitore] = useState('');
  const [deltaFilter, setDeltaFilter] = useState('all');
  const [soglia, setSoglia] = useState(5);
  const [mapItem, setMapItem] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const prodotti = data?.prodotti || [];
  const nonMappati = data?.nonMappati || [];
  const righe = data?.righe || [];
  const anagrafica = data?.anagraficaProdotti || [];

  const categorie = useMemo(() => buildCategoryOptions([...prodotti.map((p) => p.categoria), ...nonMappati.map((p) => p.categoria), ...righe.map((r) => r.prodotto_categoria || r.categoria), ...anagrafica.map((p) => p.categoria)], ''), [prodotti, nonMappati, righe, anagrafica]);
  const fornitori = useMemo(() => uniq([...prodotti.map((p) => p.fornitore_ultimo), ...nonMappati.map((p) => p.fornitore_nome), ...righe.map((r) => r.fornitore_nome)]), [prodotti, nonMappati, righe]);

  const kpi = useMemo(() => {
    const aumenti = prodotti.filter((p) => Number(p.delta_percent || 0) >= soglia).length;
    const ribassi = prodotti.filter((p) => Number(p.delta_percent || 0) <= -soglia).length;
    const alertMax = prodotti.reduce((max, p) => Math.max(max, Number(p.delta_percent || 0)), 0);
    return { prodotti: prodotti.length, righe: righe.length, nonMappati: nonMappati.length, aumenti, ribassi, alertMax };
  }, [prodotti, righe, nonMappati, soglia]);

  function matchesCommon(item, textParts = []) {
    const q = norm(query);
    const text = textParts.join(' ').toLowerCase();
    return !q || text.includes(q);
  }

  function matchesDelta(p) {
    const d = Number(p.delta_percent || 0);
    if (deltaFilter === 'up') return d >= Number(soglia || 0);
    if (deltaFilter === 'down') return d <= -Number(soglia || 0);
    if (deltaFilter === 'changed') return Math.abs(d) >= Number(soglia || 0);
    return true;
  }

  const filteredProdotti = useMemo(() => {
    return prodotti
      .filter((p) => !categoria || p.categoria === categoria)
      .filter((p) => !fornitore || p.fornitore_ultimo === fornitore)
      .filter((p) => matchesDelta(p))
      .filter((p) => matchesCommon(p, [p.nome, p.categoria, p.fornitore_ultimo, p.descrizione_originale]))
      .slice(0, 250);
  }, [prodotti, query, categoria, fornitore, deltaFilter, soglia]);

  const filteredNonMappati = useMemo(() => {
    return nonMappati
      .filter((p) => !categoria || p.categoria === categoria)
      .filter((p) => !fornitore || p.fornitore_nome === fornitore)
      .filter((p) => matchesCommon(p, [p.descrizione_originale, p.fornitore_nome, p.um, p.esempio_fattura]))
      .slice(0, 250);
  }, [nonMappati, query, categoria, fornitore]);

  const filteredRighe = useMemo(() => {
    return righe
      .filter((r) => !categoria || (r.prodotto_categoria || r.categoria) === categoria)
      .filter((r) => !fornitore || r.fornitore_nome === fornitore)
      .filter((r) => matchesCommon(r, [r.descrizione_originale, r.fornitore_nome, r.numero, r.prodotto_nome]))
      .slice(0, 400);
  }, [righe, query, categoria, fornitore]);

  const analisiForni = useMemo(() => {
    const meseCorrente = new Date().toISOString().slice(0, 7);
    const mesePrecedente = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.toISOString().slice(0, 7);
    })();
    const map = new Map();
    for (const r of righe) {
      const nome = r.fornitore_nome || 'Sconosciuto';
      const totale = Number(r.totale_riga || 0);
      const mese = (r.data_fattura || '').slice(0, 7);
      const prodId = r.prodotto_id || '';
      const fatId = r.fattura_id || '';
      if (!map.has(nome)) map.set(nome, { nome, totale: 0, corrente: 0, precedente: 0, prodotti: new Set(), fatture: new Set(), dataUltimo: '' });
      const f = map.get(nome);
      f.totale += totale;
      if (mese === meseCorrente) f.corrente += totale;
      if (mese === mesePrecedente) f.precedente += totale;
      if (prodId) f.prodotti.add(prodId);
      if (fatId) f.fatture.add(fatId);
      if (!f.dataUltimo || mese > f.dataUltimo) f.dataUltimo = mese;
    }
    return Array.from(map.values())
      .map((f) => ({
        ...f,
        prodotti: f.prodotti.size,
        fatture: f.fatture.size,
        delta: f.precedente > 0 ? ((f.corrente - f.precedente) / f.precedente) * 100 : null
      }))
      .filter((f) => !query || f.nome.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.totale - a.totale);
  }, [righe, query]);

  function toggleSelect(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    if (filteredNonMappati.every((p) => selected.has(p.key || p.descrizione_originale))) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredNonMappati.forEach((p) => next.delete(p.key || p.descrizione_originale));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredNonMappati.forEach((p) => next.add(p.key || p.descrizione_originale));
        return next;
      });
    }
  }

  async function saveMapping(payload) {
    await onMap(payload);
    setMapItem(null);
  }

  async function saveProduct(payload) {
    if (!onSaveProduct) return;
    await onSaveProduct(payload);
    setEditProduct(null);
  }

  async function saveBulk(payloads) {
    if (onMapMany) await onMapMany(payloads);
    setSelected(new Set());
    setBulkOpen(false);
  }

  async function quickMap(item) {
    await onMap({
      ...item,
      prodotto_id: '',
      prodotto_nome: item.descrizione_originale,
      categoria: normalizeCategory(item.categoria || guessCategoria(item.descrizione_originale) || 'ALTRO'),
      um_base: guessUm(item.descrizione_originale, item.um) || 'PZ',
      pezzi_per_cartone: guessPezziPerCartone(item.descrizione_originale),
      quantita_per_unita: guessQuantitaPerUnita(item.descrizione_originale, guessUm(item.descrizione_originale, item.um) || 'PZ'),
      um_acquisto_default: item.um || '',
      note_conversione: guessPezziPerCartone(item.descrizione_originale) > 1 ? `Auto: prezzo XML diviso per ${guessPezziPerCartone(item.descrizione_originale)} pezzi/cartone` : ''
    });
  }

  function resetFilters() {
    setQuery('');
    setCategoria('');
    setFornitore('');
    setDeltaFilter('all');
  }

  function exportCurrent() {
    if (tab === 'mapping') {
      downloadCsv('barai_prodotti_non_mappati.csv', filteredNonMappati.map((p) => ({
        descrizione_originale: p.descrizione_originale,
        fornitore: p.fornitore_nome,
        um: p.um,
        ultimo_prezzo: p.ultimo_prezzo,
        data_ultimo: p.data_ultimo,
        righe: p.righe_count
      })));
      return;
    }
    if (tab === 'righe') {
      downloadCsv('barai_righe_xml_prezzi.csv', filteredRighe.map((r) => ({
        data: r.data_fattura,
        fornitore: r.fornitore_nome,
        fattura: r.numero,
        descrizione: r.descrizione_originale,
        quantita: r.quantita,
        um: r.um,
        pezzi_per_cartone: r.pezzi_per_cartone || 1,
        quantita_per_unita: r.quantita_per_unita || 1,
        prezzo_unitario_xml_originale: r.prezzo_unitario_xml_originale || r.prezzo_unitario,
        prezzo_unitario_scontato: r.prezzo_unitario_scontato || r.prezzo_unitario_xml || r.prezzo_unitario,
        prezzo_base_calcolo: r.prezzo_unitario_effettivo || r.prezzo_unitario_scontato || r.prezzo_unitario,
        totale: r.totale_riga,
        prodotto: r.prodotto_nome || 'NON MAPPATO'
      })));
      return;
    }
    downloadCsv('barai_controllo_prezzi.csv', filteredProdotti.map((p) => ({
      prodotto: p.nome,
      categoria: p.categoria,
      ultimo_prezzo: p.ultimo_prezzo,
      prezzo_precedente: p.prezzo_precedente,
      delta_percent: p.delta_percent,
      prezzo_medio: p.prezzo_medio,
      prezzo_min: p.prezzo_min,
      prezzo_max: p.prezzo_max,
      pezzi_per_cartone: p.pezzi_per_cartone || 1,
      quantita_per_unita: p.quantita_per_unita || 1,
      fornitore_ultimo: p.fornitore_ultimo,
      data_ultimo: p.data_ultimo,
      righe: p.righe_count
    })));
  }

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Modulo operativo v7</p>
          <h1>Controllo Prezzi</h1>
          <p>Analisi prezzi con conversione pezzi/cartone. Le comparazioni usano il prezzo unitario scontato reale: PrezzoTotale / Quantità.</p>
        </div>
        <div className="header-actions">
          <button className="ghost-btn" onClick={exportCurrent}>Esporta CSV</button>
        </div>
      </div>

      <div className="kpi-grid small">
        <div className="kpi-card"><span>Prodotti analizzati</span><strong>{kpi.prodotti}</strong><em>{kpi.righe} righe</em></div>
        <div className="kpi-card warning"><span>Non mappati</span><strong>{kpi.nonMappati}</strong><em>da sistemare</em></div>
        <div className="kpi-card warning"><span>Aumenti ≥ {soglia}%</span><strong>{kpi.aumenti}</strong><em>max {percent(kpi.alertMax)}</em></div>
        <div className="kpi-card success"><span>Ribassi ≥ {soglia}%</span><strong>{kpi.ribassi}</strong><em>prezzi migliorati</em></div>
      </div>

      <div className="subnav">
        <button className={tab === 'dashboard' ? 'selected' : ''} onClick={() => setTab('dashboard')}>Storico prezzi</button>
        <button className={tab === 'mapping' ? 'selected' : ''} onClick={() => setTab('mapping')}>Non mappati</button>
        <button className={tab === 'fornitori' ? 'selected' : ''} onClick={() => setTab('fornitori')}>Fornitori</button>
        <button className={tab === 'righe' ? 'selected' : ''} onClick={() => setTab('righe')}>Righe XML</button>
      </div>

      <div className="card price-filter-card">
        <div className="price-filters">
          <label>
            Cerca
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Prodotto, fornitore, fattura..." />
          </label>
          <label>
            Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Tutte</option>
              {categorie.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Fornitore
            <select value={fornitore} onChange={(e) => setFornitore(e.target.value)}>
              <option value="">Tutti</option>
              {fornitori.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label>
            Variazione
            <select value={deltaFilter} onChange={(e) => setDeltaFilter(e.target.value)} disabled={tab !== 'dashboard'}>
              <option value="all">Tutte</option>
              <option value="up">Solo aumenti</option>
              <option value="down">Solo ribassi</option>
              <option value="changed">Aumenti/ribassi</option>
            </select>
          </label>
          <label>
            Soglia %
            <input type="number" min="1" max="100" value={soglia} onChange={(e) => setSoglia(Number(e.target.value || 5))} />
          </label>
          <button className="small-btn muted filter-reset" onClick={resetFilters}>Pulisci</button>
        </div>
      </div>

      <div className="card table-card price-card">
        <div className="toolbar price-toolbar compact-toolbar">
          <span>{tab === 'mapping' ? filteredNonMappati.length + ' risultati' : tab === 'righe' ? filteredRighe.length + ' righe' : filteredProdotti.length + ' prodotti'}</span>
          {tab === 'mapping' && selected.size > 0 ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="muted-line">{selected.size} selezionati</span>
              <button className="small-btn muted" onClick={() => setSelected(new Set())}>Deseleziona</button>
              <button className="primary-btn" onClick={() => setBulkOpen(true)}>Mappa {selected.size} selezionati →</button>
            </div>
          ) : (
            <span className="muted-line">{tab === 'mapping' ? 'Seleziona prodotti per mapparli in gruppo' : 'Suggerimento: usa "Solo aumenti" per vedere subito gli aumenti oltre soglia.'}</span>
          )}
        </div>

        {tab === 'dashboard' && (
          <table className="compact-table price-table">
            <thead><tr><th>Prodotto</th><th>Cat.</th><th>Pz/c.</th><th>Qt/u.</th><th>Ultimo base</th><th>Preced.</th><th>Delta</th><th>Media</th><th>Min/Max</th><th>Fornitore ultimo</th><th>Data</th><th>Righe</th></tr></thead>
            <tbody>
              {filteredProdotti.map((p) => (
                <tr key={p.key} className={Number(p.delta_percent || 0) >= soglia ? 'row-alert' : ''}>
                  <td className="supplier-cell"><strong>{p.nome}</strong><br /><span className="muted-line">{p.mappato ? 'mappato' : 'non mappato'}</span><div className="inline-actions"><button className="small-btn muted" onClick={() => setDetailProduct(p)}>Dettaglio</button>{p.mappato && <button className="small-btn" onClick={() => setEditProduct(p)}>Modifica</button>}</div></td>
                  <td>{p.categoria || '-'}</td>
                  <td className="right">{p.pezzi_per_cartone || 1}</td>
                  <td className="right">{p.quantita_per_unita || 1}</td>
                  <td className="right"><strong>{euro(p.ultimo_prezzo)}</strong></td>
                  <td className="right">{p.prezzo_precedente ? euro(p.prezzo_precedente) : '-'}</td>
                  <td><span className={`delta-badge ${deltaClass(p.delta_percent, soglia)}`}>{p.prezzo_precedente ? percent(p.delta_percent) : '-'}</span></td>
                  <td className="right">{euro(p.prezzo_medio)}</td>
                  <td className="right">{euro(p.prezzo_min)} / {euro(p.prezzo_max)}</td>
                  <td className="supplier-cell">{p.fornitore_ultimo || '-'}</td>
                  <td>{formatDate(p.data_ultimo)}</td>
                  <td>{p.righe_count}</td>
                </tr>
              ))}
              {filteredProdotti.length === 0 && <tr><td colSpan="12" className="empty-cell">Nessun prezzo ancora disponibile. Importa XML fatture acquisto.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'mapping' && (
          <table className="compact-table mapping-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  <input
                    type="checkbox"
                    checked={filteredNonMappati.length > 0 && filteredNonMappati.every((p) => selected.has(p.key || p.descrizione_originale))}
                    onChange={toggleSelectAll}
                    title="Seleziona/deseleziona tutti i filtrati"
                  />
                </th>
                <th>Descrizione originale</th>
                <th>Fornitore</th>
                <th>UM</th>
                <th>Categoria suggerita</th>
                <th className="right">Ultimo prezzo</th>
                <th>Data</th>
                <th className="right">Righe</th>
                <th>Azione</th>
              </tr>
            </thead>
            <tbody>
              {filteredNonMappati.map((p) => {
                const key = p.key || p.descrizione_originale;
                const isSelected = selected.has(key);
                return (
                  <tr key={key} className={isSelected ? 'row-selected' : ''}>
                    <td>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(key)} />
                    </td>
                    <td className="supplier-cell"><strong>{p.descrizione_originale}</strong></td>
                    <td className="supplier-cell">{p.fornitore_nome || '-'}</td>
                    <td>{p.um || '-'}</td>
                    <td><span className="mini-chip">{guessCategoria(p.descrizione_originale) || '?'}</span></td>
                    <td className="right">{euro(p.ultimo_prezzo)}</td>
                    <td>{formatDate(p.data_ultimo)}</td>
                    <td className="right">{p.righe_count}</td>
                    <td className="row-actions">
                      <button className="small-btn" onClick={() => setMapItem(p)}>Mappa</button>
                      <button className="small-btn muted" onClick={() => quickMap(p)}>Rapida</button>
                    </td>
                  </tr>
                );
              })}
              {filteredNonMappati.length === 0 && <tr><td colSpan="9" className="empty-cell">Tutti i prodotti risultano mappati.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'fornitori' && (
          <table className="compact-table">
            <thead>
              <tr>
                <th>Fornitore</th>
                <th className="right">Spesa totale</th>
                <th className="right">Mese corrente</th>
                <th className="right">Mese prec.</th>
                <th className="right">Δ mese</th>
                <th className="right">Prodotti</th>
                <th className="right">Fatture</th>
                <th>Ultimo acquisto</th>
              </tr>
            </thead>
            <tbody>
              {analisiForni.map((f) => {
                const deltaPos = f.delta !== null && f.delta > 5;
                const deltaNeg = f.delta !== null && f.delta < -5;
                return (
                  <tr key={f.nome}>
                    <td><strong>{f.nome}</strong></td>
                    <td className="right"><strong>{euro(f.totale)}</strong></td>
                    <td className="right">{f.corrente > 0 ? euro(f.corrente) : <span className="muted-line">—</span>}</td>
                    <td className="right">{f.precedente > 0 ? euro(f.precedente) : <span className="muted-line">—</span>}</td>
                    <td className="right">
                      {f.delta !== null
                        ? <span className={`delta-badge ${deltaPos ? 'delta-up' : deltaNeg ? 'delta-down' : 'delta-flat'}`}>{f.delta >= 0 ? '+' : ''}{f.delta.toFixed(1)}%</span>
                        : <span className="muted-line">—</span>}
                    </td>
                    <td className="right">{f.prodotti}</td>
                    <td className="right">{f.fatture}</td>
                    <td>{f.dataUltimo || '-'}</td>
                  </tr>
                );
              })}
              {analisiForni.length === 0 && <tr><td colSpan="8" className="empty-cell">Nessun dato fornitore disponibile.</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'righe' && (
          <table className="compact-table righe-prezzi-table">
            <thead><tr><th>Data</th><th>Fornitore</th><th>Fattura</th><th>Descrizione</th><th>Q.tà</th><th>UM</th><th>Pz/cart.</th><th>Qt/unità</th><th>P.Unit XML</th><th>P.Unit scontato</th><th>Prezzo base</th><th>Totale</th><th>Prodotto</th></tr></thead>
            <tbody>
              {filteredRighe.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.data_fattura)}</td>
                  <td className="supplier-cell">{r.fornitore_nome}</td>
                  <td>{r.numero}</td>
                  <td className="supplier-cell">{r.descrizione_originale}</td>
                  <td className="right">{Number(r.quantita || 0).toLocaleString('it-IT')}</td>
                  <td>{r.um || '-'}</td>
                  <td className="right">{r.pezzi_per_cartone || 1}</td>
                  <td className="right">{r.quantita_per_unita || 1}</td>
                  <td className="right">{euro(r.prezzo_unitario_xml_originale || r.prezzo_unitario || 0)}</td>
                  <td className="right">{euro(r.prezzo_unitario_scontato || r.prezzo_unitario_xml || r.prezzo_unitario || 0)}</td>
                  <td className="right">{euro(r.prezzo_unitario_effettivo || r.prezzo_unitario_scontato || r.prezzo_unitario || 0)}</td>
                  <td className="right">{euro(r.totale_riga || 0)}</td>
                  <td>{r.prodotto_nome || <span className="badge badge-da-verificare">NON MAPPATO</span>}</td>
                </tr>
              ))}
              {filteredRighe.length === 0 && <tr><td colSpan="13" className="empty-cell">Nessuna riga trovata.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {mapItem && <MappingForm item={mapItem} prodotti={anagrafica} categorie={categorie} onCancel={() => setMapItem(null)} onSave={saveMapping} />}
      {editProduct && <ProductEditForm product={editProduct} categorie={categorie} onCancel={() => setEditProduct(null)} onSave={saveProduct} />}
      {detailProduct && <ProductDetail product={detailProduct} onClose={() => setDetailProduct(null)} />}
      {bulkOpen && (
        <BulkMappingModal
          selected={selected}
          items={nonMappati}
          categorie={categorie}
          prodotti={anagrafica}
          onMap={saveBulk}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </section>
  );
}
