import assert from 'node:assert/strict';
import { buildContoEconomico, buildContoEconomicoConfronto, shiftMonth } from '../src/logic/contoEconomico.js';

const sample = {
  mese: '2026-03',
  incassi: [{ data_incasso: '2026-03-01', totale: 1000 }, { data_incasso: '2026-02-28', totale: 500 }],
  fatture: [{ data_fattura: '2026-03-10', totale: 300, fornitore_nome: 'Food' }],
  buste: [{ mese: '2026-03', dipendente: 'Mario', costo_azienda: 200 }],
  f24: [{ periodo_competenza: '2026-03', tipo: 'INPS', importo: 50 }],
  movimenti: [
    { data_movimento: '2026-03-04', tipo: 'USCITA', categoria: 'Affitto', importo: 100, origine: 'Manuale' },
    { data_movimento: '2026-03-04', tipo: 'USCITA', categoria: 'Fornitori', importo: 300, origine: 'Scadenziario' },
    { data_movimento: '2026-03-05', tipo: 'ENTRATA', categoria: 'Altri ricavi', importo: 25, origine: 'Manuale' }
  ]
};

const ce = buildContoEconomico(sample);
assert.equal(ce.ricavi, 1025);
assert.equal(ce.costiAcquisto, 300);
assert.equal(ce.costiOperativi, 100);
assert.equal(ce.costoPersonale, 200);
assert.equal(ce.tributi, 50);
assert.equal(ce.margineLordo, 725);
assert.equal(ce.ebitda, 425);
assert.equal(ce.risultatoGestionale, 375);
assert.equal(ce.counts.fatture, 1);
assert.equal(shiftMonth('2026-01', -1), '2025-12');

const confronto = buildContoEconomicoConfronto(sample);
assert.equal(confronto.corrente.mese, '2026-03');
assert.equal(confronto.precedente.mese, '2026-02');
assert.equal(confronto.annoPrecedente.mese, '2025-03');

console.log('contoEconomico.test.mjs OK');
