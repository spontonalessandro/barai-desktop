import assert from 'node:assert/strict';
import { guessCategoria, guessPezziPerCartone, guessQuantitaPerUnita, guessUm } from '../src/utils/productGuess.js';

assert.equal(guessPezziPerCartone('Birra Moretti x9 bottiglie'), 9);
assert.equal(guessPezziPerCartone('cartone da 24 lattine'), 24);
assert.equal(guessPezziPerCartone('6 pz acqua naturale'), 6);
assert.equal(guessPezziPerCartone('prodotto singolo'), 1);
assert.equal(guessCategoria('Prosecco DOCG'), 'Vini');
assert.equal(guessCategoria('Detergente pavimenti'), 'Materiali e pulizie');
assert.equal(guessUm('pasta kg 5', ''), 'KG');
assert.equal(guessQuantitaPerUnita('POLPA DI POMODORO bag in box 5kg', 'KG'), 5);
assert.equal(guessQuantitaPerUnita('bottiglia vino 0,75 lt', 'LT'), 0.75);
assert.equal(guessQuantitaPerUnita('formaggio 500g', 'KG'), 0.5);
console.log('productGuess.test.mjs OK');
