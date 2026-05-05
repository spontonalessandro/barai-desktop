# BarAI Desktop v8.1.3

Versione correttiva:

- `rigeneraPrimaNotaDaPagamenti()` non dipende più da `s.*` e da `row.id` ambiguo.
- La query pagamenti usa `s.id AS scadenza_id` e il codice usa `row.scadenza_id`.
- CSV centralizzato in `src/utils/csv.js`.
- Rimosse le funzioni duplicate `csvEscape` / `downloadCsv` da Controllo Prezzi e Prima Nota.
- Aggiornato test di guardia sorgente.

Invariati:

- identifier: `it.baraidesktop.app`
- database: `~/Library/Application Support/it.baraidesktop.app/barai.sqlite`
