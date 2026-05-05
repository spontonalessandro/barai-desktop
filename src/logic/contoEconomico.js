function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  const normalized = raw.includes(',') ? raw.replaceAll('.', '').replace(',', '.') : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function monthKey(value) {
  return value ? String(value).slice(0, 7) : '';
}

export function currentMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function shiftMonth(mese, delta) {
  const base = mese || currentMonthKey();
  const [year, month] = String(base).split('-').map((n) => Number(n));
  if (!year || !month) return currentMonthKey();
  const d = new Date(year, month - 1 + Number(delta || 0), 1, 12, 0, 0);
  return d.toISOString().slice(0, 7);
}

function rowsForMonth(rows, field, mese) {
  return (rows || []).filter((row) => monthKey(row?.[field]) === mese);
}

function sum(rows, getter) {
  return (rows || []).reduce((total, row) => total + toNumber(getter(row)), 0);
}

function groupBy(rows, labelGetter, valueGetter, limit = 20) {
  const map = new Map();
  for (const row of rows || []) {
    const label = String(labelGetter(row) || 'Altro').trim() || 'Altro';
    map.set(label, (map.get(label) || 0) + toNumber(valueGetter(row)));
  }
  return Array.from(map.entries())
    .map(([label, importo]) => ({ label, importo }))
    .sort((a, b) => Math.abs(b.importo) - Math.abs(a.importo))
    .slice(0, limit);
}

function ratio(value, base) {
  const b = toNumber(base);
  if (!b) return 0;
  return (toNumber(value) / b) * 100;
}

function isExcludedManualeForCe(row) {
  const origine = String(row?.origine || '').toLowerCase();
  if (origine.includes('incassi')) return true;
  if (origine.includes('scadenziario')) return true;
  if (origine.includes('buste')) return true;
  if (origine.includes('f24')) return true;
  return false;
}

export function buildContoEconomico(input = {}) {
  const mese = input.mese || currentMonthKey();
  const incassi = rowsForMonth(input.incassi || [], 'data_incasso', mese);
  const buste = (input.buste || []).filter((row) => monthKey(row.mese) === mese);
  const f24 = (input.f24 || []).filter((row) => monthKey(row.periodo_competenza || row.data_pagamento) === mese);
  const fatture = rowsForMonth(input.fatture || [], 'data_fattura', mese);
  const fattureVendita = rowsForMonth(input.fattureVendita || [], 'data_fattura', mese);
  const movimenti = rowsForMonth(input.movimenti || [], 'data_movimento', mese);

  const movimentiManuali = movimenti.filter((row) => !isExcludedManualeForCe(row));
  const altriRicaviRows = movimentiManuali.filter((row) => String(row.tipo || '').toUpperCase() === 'ENTRATA');
  const costiOperativiRows = movimentiManuali.filter((row) => String(row.tipo || '').toUpperCase() === 'USCITA');

  const ricaviIncassi = sum(incassi, (row) => row.totale);
  const ricaviFattureVendita = sum(fattureVendita, (row) => row.totale);
  const ricaviAltri = sum(altriRicaviRows, (row) => row.importo);
  const ricavi = ricaviIncassi + ricaviFattureVendita + ricaviAltri;

  const costiAcquisto = sum(fatture, (row) => row.totale);
  const costiOperativi = sum(costiOperativiRows, (row) => row.importo);
  const costoPersonale = sum(buste, (row) => row.costo_azienda);
  const tributi = sum(f24, (row) => row.importo);
  const ammortamenti = toNumber(input.ammortamenti);
  const oneriFinanziari = toNumber(input.oneriFinanziari);

  const margineLordo = ricavi - costiAcquisto;
  const ebitda = margineLordo - costiOperativi - costoPersonale;
  const ebit = ebitda - ammortamenti;
  const risultatoGestionale = ebit - oneriFinanziari - tributi;

  return {
    mese,
    ricavi,
    ricaviIncassi,
    ricaviAltri,
    ricaviFattureVendita,
    costiAcquisto,
    margineLordo,
    costiOperativi,
    costoPersonale,
    ebitda,
    ammortamenti,
    ebit,
    oneriFinanziari,
    tributi,
    risultatoGestionale,
    percentuali: {
      margineLordo: ratio(margineLordo, ricavi),
      acquisti: ratio(costiAcquisto, ricavi),
      costiOperativi: ratio(costiOperativi, ricavi),
      personale: ratio(costoPersonale, ricavi),
      ebitda: ratio(ebitda, ricavi),
      ebit: ratio(ebit, ricavi),
      risultato: ratio(risultatoGestionale, ricavi)
    },
    counts: {
      incassi: incassi.length,
      fatture: fatture.length,
      fattureVendita: fattureVendita.length,
      buste: buste.length,
      f24: f24.length,
      movimentiManuali: movimentiManuali.length
    },
    dettaglio: {
      ricavi: groupBy(incassi, () => 'Incassi cassa', (row) => row.totale)
        .concat(groupBy(fattureVendita, (row) => row.cliente_nome || 'Cliente', (row) => row.totale))
        .concat(groupBy(altriRicaviRows, (row) => row.categoria || row.descrizione || 'Altri ricavi', (row) => row.importo)),
      acquisti: groupBy(fatture, (row) => row.fornitore_nome || 'Fornitore', (row) => row.totale),
      costiOperativi: groupBy(costiOperativiRows, (row) => row.categoria || row.descrizione || 'Costi operativi', (row) => row.importo),
      personale: groupBy(buste, (row) => row.dipendente || 'Dipendente', (row) => row.costo_azienda),
      f24: groupBy(f24, (row) => row.tipo || 'F24', (row) => row.importo)
    },
    righe: [
      { sezione: 'Ricavi', label: 'Incassi cassa', importo: ricaviIncassi, tipo: 'ricavo' },
      { sezione: 'Ricavi', label: 'Fatture vendita', importo: ricaviFattureVendita, tipo: 'ricavo' },
      { sezione: 'Ricavi', label: 'Altri ricavi manuali', importo: ricaviAltri, tipo: 'ricavo' },
      { sezione: 'Ricavi', label: 'Totale ricavi', importo: ricavi, tipo: 'totale' },
      { sezione: 'Costi variabili', label: 'Acquisti da fatture fornitori', importo: -costiAcquisto, tipo: 'costo' },
      { sezione: 'Margine', label: 'Margine lordo', importo: margineLordo, tipo: 'totale' },
      { sezione: 'Costi operativi', label: 'Costi operativi manuali', importo: -costiOperativi, tipo: 'costo' },
      { sezione: 'Personale', label: 'Costo personale', importo: -costoPersonale, tipo: 'costo' },
      { sezione: 'Risultato', label: 'EBITDA', importo: ebitda, tipo: 'totale' },
      { sezione: 'Risultato', label: 'Ammortamenti', importo: -ammortamenti, tipo: 'costo' },
      { sezione: 'Risultato', label: 'EBIT', importo: ebit, tipo: 'totale' },
      { sezione: 'Tributi', label: 'F24 / tributi', importo: -tributi, tipo: 'costo' },
      { sezione: 'Risultato', label: 'Risultato gestionale stimato', importo: risultatoGestionale, tipo: 'finale' }
    ]
  };
}

export function buildContoEconomicoConfronto(input = {}) {
  const mese = input.mese || currentMonthKey();
  return {
    corrente: buildContoEconomico({ ...input, mese }),
    precedente: buildContoEconomico({ ...input, mese: shiftMonth(mese, -1) }),
    annoPrecedente: buildContoEconomico({ ...input, mese: shiftMonth(mese, -12) })
  };
}
