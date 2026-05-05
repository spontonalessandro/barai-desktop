# BarAI Desktop v9.1 - Conto Economico gestionale

Questa versione aggiunge il primo Conto Economico gestionale mensile dentro Admin / CE.

## Logica

Il CE viene calcolato per competenza:

- ricavi da incassi cassa per data incasso;
- altri ricavi da Prima Nota manuale;
- acquisti da fatture fornitori per data fattura;
- costi operativi da Prima Nota manuale;
- costo personale da buste paga per mese;
- F24 da periodo di competenza.

La liquidità resta gestita dalla Prima Nota per data pagamento.

## Nuovi file

- `src/logic/contoEconomico.js`
- `tests/contoEconomico.test.mjs`

## UI

La pagina Admin / CE ora contiene:

- tab Conto Economico;
- selettore mese;
- ricavi, margine lordo, EBITDA, risultato gestionale stimato;
- confronto con mese precedente e stesso mese anno precedente;
- dettaglio acquisti per fornitore, costi operativi e personale.

## Prossimo step

v9.2: KPI e dashboard gestionale su base CE.
