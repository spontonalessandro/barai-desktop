import assert from 'node:assert/strict';
import { monthKey, normalizePaymentMethod, toNumber } from '../src/utils/format.js';

assert.equal(monthKey('2026-04-30'), '2026-04');
assert.equal(normalizePaymentMethod('Pagamento POS'), 'Bancomat');
assert.equal(normalizePaymentMethod('Bonifico SEPA'), 'Bonifico');
assert.equal(toNumber('1.234,56'), 1234.56);
assert.equal(toNumber(''), 0);
console.log('format.test.mjs OK');
