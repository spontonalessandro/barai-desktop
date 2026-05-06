import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { euro, percent, toNumber } from '../utils/format.js';

const EMPTY_FORM = {
  id: '',
  nome: '',
  categoria: 'MENU',
  prezzo_vendita: '',
  porzioni: 1,
  metodo_costo: 'ULTIMO',
  costi_fissi_percent: 40,
  note: '',
  ingredienti: []
};

function foodCostStatus(value) {
  const n = Number(value || 0);
  if (!n) return { label: 'DA CALCOLARE', cls: 'muted' };
  if (n <= 30) return { label: 'OK', cls: 'success' };
  if (n <= 35) return { label: 'ATTENZIONE', cls: 'warning' };
  return { label: 'CRITICO', cls: 'danger' };
}

function productCost(product, method) {
  if (!product) return 0;
  if (method === 'MEDIO') return toNumber(product.prezzo_medio);
  if (method === 'MAX') return toNumber(product.prezzo_max);
  return toNumber(product.ultimo_prezzo);
}

function defaultIngredient() {
  return { prodotto_id: '', quantita: '', um: '' };
}

function optionsForIngredient(products, selectedId, filter) {
  const q = filter.trim().toLowerCase();
  if (selectedId) {
    const selected = products.find((p) => p.id === selectedId);
    const filtered = q ? products.filter((p) => (p.nome + ' ' + p.categoria).toLowerCase().includes(q)) : products;
    const map = new Map();
    if (selected) map.set(selected.id, selected);
    for (const p of filtered) map.set(p.id, p);
    return Array.from(map.values()).slice(0, 120);
  }
  if (!q) return products.slice(0, 120);
  return products.filter((p) => (p.nome + ' ' + p.categoria).toLowerCase().includes(q)).slice(0, 120);
}

function RecipeModal({ data, onClose, onSave }) {
  const products = data.prodotti || [];
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...data.initial, ingredienti: data.initial?.ingredienti?.length ? data.initial.ingredienti.map((ing) => ({
    id: ing.id,
    prodotto_id: ing.prodotto_id || '',
    quantita: ing.quantita || '',
    um: ing.um || ing.um_base || '',
  })) : [defaultIngredient()] }));
  const [productFilter, setProductFilter] = useState('');

  const categories = useMemo(() => {
    const set = new Set(['MENU', 'CUCINA', 'BAR', 'CAFFETTERIA', 'COCKTAIL', 'VINI', 'EVENTI']);
    for (const r of data.ricette || []) if (r.categoria) set.add(String(r.categoria).toUpperCase());
    return Array.from(set).sort();
  }, [data.ricette]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateIngredient(index, field, value) {
    setForm((current) => {
      const ingredienti = [...current.ingredienti];
      const next = { ...ingredienti[index], [field]: value };
      if (field === 'prodotto_id') {
        const p = products.find((prod) => prod.id === value);
        next.um = p?.um_base || '';
      }
      ingredienti[index] = next;
      return { ...current, ingredienti };
    });
  }

  function removeIngredient(index) {
    setForm((current) => ({ ...current, ingredienti: current.ingredienti.filter((_, i) => i !== index) }));
  }

  function addIngredient() {
    setForm((current) => ({ ...current, ingredienti: [...current.ingredienti, defaultIngredient()] }));
  }

  const preview = useMemo(() => {
    const rows = form.ingredienti.map((ing) => {
      const p = products.find((prod) => prod.id === ing.prodotto_id);
      const unit = productCost(p, form.metodo_costo);
      const total = toNumber(ing.quantita) * unit;
      return { ...ing, product: p, unit, total };
    });
    const costoTotale = rows.reduce((sum, row) => sum + row.total, 0);
    const costoPorzione = costoTotale / Math.max(1, toNumber(form.porzioni || 1));
    const costiFissiPercent = Math.max(0, toNumber(form.costi_fissi_percent ?? 40));
    const quotaCostiFissi = costoPorzione * (costiFissiPercent / 100);
    const costoGestionale = costoPorzione + quotaCostiFissi;
    const prezzo = toNumber(form.prezzo_vendita);
    const fc = prezzo > 0 ? (costoPorzione / prezzo) * 100 : 0;
    const fcGestionale = prezzo > 0 ? (costoGestionale / prezzo) * 100 : 0;
    return { rows, costoTotale, costoPorzione, costiFissiPercent, quotaCostiFissi, costoGestionale, foodCost: fc, foodCostGestionale: fcGestionale, margine: prezzo - costoPorzione, margineGestionale: prezzo - costoGestionale };
  }, [form, products]);

  const missingPrices = preview.rows.filter((r) => r.prodotto_id && !r.unit);

  async function handleSubmit(event) {
    event.preventDefault();
    await onSave({
      ...form,
      categoria: String(form.categoria || '').toUpperCase(),
      ingredienti: form.ingredienti
        .filter((ing) => ing.prodotto_id && toNumber(ing.quantita) > 0)
        .map((ing) => ({ ...ing, costo_unitario_override: null }))
    });
    onClose();
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card food-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Food Cost</p>
            <h2>{form.id ? 'Modifica ricetta' : 'Nuova ricetta'}</h2>
            <p>Il costo ingredienti viene preso automaticamente dall'ultima fattura acquisto.</p>
          </div>
          <button className="small-btn muted" type="button" onClick={onClose}>×</button>
        </div>

        {missingPrices.length > 0 && (
          <div className="fc-alert">
            <AlertTriangle size={14} />
            {missingPrices.length} ingrediente/i senza prezzo in fattura: controlla il Controllo Prezzi.
          </div>
        )}

        <form onSubmit={handleSubmit} className="food-form">
          <div className="form-grid">
            <label>Nome ricetta / prodotto finito *
              <input value={form.nome} onChange={(e) => setField('nome', e.target.value)} placeholder="Es. Spritz, Pasta al ragù" required />
            </label>
            <label>Categoria
              <select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)}>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>
            <label>Prezzo vendita *
              <input type="number" step="0.01" min="0" value={form.prezzo_vendita} onChange={(e) => setField('prezzo_vendita', e.target.value)} required />
            </label>
            <label>Porzioni
              <input type="number" step="0.01" min="1" value={form.porzioni} onChange={(e) => setField('porzioni', e.target.value)} />
            </label>
            <label>Costo da usare
              <select value={form.metodo_costo} onChange={(e) => setField('metodo_costo', e.target.value)}>
                <option value="ULTIMO">Ultimo prezzo fattura</option>
                <option value="MEDIO">Prezzo medio fatture</option>
                <option value="MAX">Prezzo massimo fatture</option>
              </select>
            </label>
            <label>Costi fissi stimati %
              <input type="number" step="0.1" min="0" value={form.costi_fissi_percent ?? 40} onChange={(e) => setField('costi_fissi_percent', e.target.value)} />
            </label>
            <label>Ricerca prodotti
              <input value={productFilter} onChange={(e) => setProductFilter(e.target.value)} placeholder="Filtra prodotti..." />
            </label>
          </div>

          <div className="ingredient-panel">
            <div className="mini-header">
              <strong>Ingredienti</strong>
              <button className="small-btn muted" type="button" onClick={addIngredient}><Plus size={14} /> Aggiungi</button>
            </div>
            <div className="ingredient-list">
              {form.ingredienti.map((ing, index) => {
                const p = products.find((prod) => prod.id === ing.prodotto_id);
                const unit = productCost(p, form.metodo_costo);
                const total = unit * toNumber(ing.quantita);
                const productOptions = optionsForIngredient(products, ing.prodotto_id, productFilter);
                const noPrice = ing.prodotto_id && !unit;
                return (
                  <div className={`ingredient-row${noPrice ? ' ingredient-row-warn' : ''}`} key={`${ing.id || 'new'}_${index}`}>
                    <label>Prodotto
                      <select value={ing.prodotto_id} onChange={(e) => updateIngredient(index, 'prodotto_id', e.target.value)}>
                        <option value="">Seleziona prodotto</option>
                        {productOptions.map((prod) => <option key={prod.id} value={prod.id}>{prod.nome} · {prod.categoria} · {prod.um_base}</option>)}
                      </select>
                    </label>
                    <label>Quantità
                      <input type="number" step="0.001" min="0" value={ing.quantita} onChange={(e) => updateIngredient(index, 'quantita', e.target.value)} placeholder="0,000" />
                    </label>
                    <label>UM
                      <input value={ing.um || p?.um_base || ''} onChange={(e) => updateIngredient(index, 'um', e.target.value)} placeholder="KG/LT/PZ" />
                    </label>
                    <div className="ingredient-cost">
                      {noPrice
                        ? <span className="fc-no-price"><AlertTriangle size={12} /> nessun prezzo</span>
                        : <span>{euro(unit)} / {p?.um_base || ing.um || '-'}<br /><small style={{color:'var(--muted)', fontSize:10}}>{p?.fornitore_ultimo || ''} · {p?.data_ultimo ? p.data_ultimo.slice(0,10) : ''}</small></span>
                      }
                      <strong>{total > 0 ? euro(total) : '—'}</strong>
                    </div>
                    <button className="small-btn muted" type="button" onClick={() => removeIngredient(index)}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="food-preview">
            <div><span>Costo materie</span><strong>{euro(preview.costoPorzione)}</strong></div>
            <div><span>Costi fissi {preview.costiFissiPercent}%</span><strong>{euro(preview.quotaCostiFissi)}</strong></div>
            <div><span>Costo gestionale</span><strong>{euro(preview.costoGestionale)}</strong></div>
            <div><span>Food cost gestione</span><strong>{percent(preview.foodCostGestionale).replace('+', '')}</strong></div>
            <div><span>Margine dopo costi</span><strong>{euro(preview.margineGestionale)}</strong></div>
          </div>

          <div className="form-actions">
            <button className="ghost-btn" type="button" onClick={onClose}>Annulla</button>
            <button className="primary-btn" type="submit">Salva ricetta</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FoodCostPage({ data, onSaveRecipe, onDeleteRecipe }) {
  function confirmDeleteRecipe(recipe) {
    const ok = window.confirm(`Eliminare la ricetta "${recipe?.nome || 'selezionata'}" e tutti i relativi ingredienti?`);
    if (!ok) return;
    onDeleteRecipe(recipe.id);
  }
  const [modalData, setModalData] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('TUTTE');

  const ricette = data?.ricette || [];
  const prodotti = data?.prodotti || [];

  const categories = useMemo(() => {
    const set = new Set(['TUTTE']);
    for (const r of ricette) if (r.categoria) set.add(String(r.categoria).toUpperCase());
    return Array.from(set).sort();
  }, [ricette]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ricette.filter((r) => {
      const matchQ = !q || `${r.nome} ${r.categoria}`.toLowerCase().includes(q);
      const matchCat = category === 'TUTTE' || String(r.categoria || '').toUpperCase() === category;
      return matchQ && matchCat;
    });
  }, [ricette, query, category]);

  const stats = useMemo(() => {
    const avg = ricette.length ? ricette.reduce((sum, r) => sum + Number(r.food_cost_gestionale_percent || r.food_cost_percent || 0), 0) / ricette.length : 0;
    return {
      ricette: ricette.length,
      prodotti: prodotti.length,
      avg,
      critiche: ricette.filter((r) => Number(r.food_cost_gestionale_percent || r.food_cost_percent || 0) > 35).length
    };
  }, [ricette, prodotti]);

  function openNew() {
    setModalData({ initial: EMPTY_FORM, prodotti, ricette });
  }

  function openEdit(recipe) {
    setModalData({ initial: recipe, prodotti, ricette });
  }

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Modulo operativo v9.3</p>
          <h1>Food Cost</h1>
          <p>Costi ingredienti aggiornati automaticamente dall'ultima fattura acquisto. Nessun inserimento manuale.</p>
        </div>
        <div className="header-actions">
          <button className="primary-btn" type="button" onClick={openNew}><Plus size={16} /> Nuova ricetta</button>
        </div>
      </div>

      <div className="kpi-grid small">
        <div className="kpi-card"><span>Ricette</span><strong>{stats.ricette}</strong><em>prodotti finiti</em></div>
        <div className="kpi-card"><span>Prodotti disponibili</span><strong>{stats.prodotti}</strong><em>mappati con prezzo reale</em></div>
        <div className="kpi-card warning"><span>Food cost medio</span><strong>{percent(stats.avg).replace('+', '')}</strong><em>su ricette salvate</em></div>
        <div className="kpi-card"><span>Critiche</span><strong>{stats.critiche}</strong><em>oltre 35%</em></div>
      </div>

      <div className="card toolbar food-toolbar">
        <label>Cerca
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ricetta o categoria..." />
        </label>
        <label>Categoria
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </label>
        <div className="hint-inline">Il costo di ogni ingrediente viene preso dall'ultima fattura acquisto del prodotto mappato.</div>
      </div>

      <div className="card table-card">
        <div className="card-header-row">
          <div><h2>Ricette</h2><p>{filtered.length} ricette visualizzate.</p></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Ricetta</th><th>Categoria</th><th className="right">Prezzo</th><th className="right">Materie</th><th className="right">Costi fissi</th><th className="right">Costo gest.</th><th className="right">FC gest.</th><th className="right">Margine gest.</th><th>Stato</th><th>Ingredienti</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="11" className="empty-cell">Nessuna ricetta ancora creata.</td></tr>
            ) : filtered.map((r) => {
              const status = foodCostStatus(r.food_cost_gestionale_percent || r.food_cost_percent);
              const noPrice = (r.ingredienti || []).some((ing) => ing.prodotto_id && !ing.costo_unitario);
              return (
                <tr key={r.id}>
                  <td>
                    <strong>{r.nome}</strong>
                    {noPrice && <span className="fc-warn-chip"><AlertTriangle size={10} /> prezzi mancanti</span>}
                    <small className="row-subtitle">Metodo: {r.metodo_costo || 'ULTIMO'}</small>
                  </td>
                  <td>{r.categoria || '-'}</td>
                  <td className="right">{euro(r.prezzo_vendita)}</td>
                  <td className="right">{euro(r.costo_porzione)}</td>
                  <td className="right">{euro(r.quota_costi_fissi)}<small className="row-subtitle">{Number(r.costi_fissi_percent ?? 40)}%</small></td>
                  <td className="right">{euro(r.costo_gestionale)}</td>
                  <td className="right"><span className={`delta-pill ${status.cls}`}>{percent(r.food_cost_gestionale_percent || r.food_cost_percent).replace('+', '')}</span></td>
                  <td className="right">{euro(r.margine_gestionale)}</td>
                  <td><span className={`badge food-${status.cls}`}>{status.label}</span></td>
                  <td>{r.ingredienti?.length || 0}</td>
                  <td className="action-cell">
                    <button className="small-btn muted" type="button" onClick={() => openEdit(r)}><Pencil size={14} /> Modifica</button>
                    <button className="small-btn muted" type="button" onClick={() => confirmDeleteRecipe(r)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalData && <RecipeModal data={modalData} onClose={() => setModalData(null)} onSave={onSaveRecipe} />}
    </section>
  );
}
