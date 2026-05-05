# BarAI Desktop v9.1.1 - Caricamenti centralizzati + fatture vendita

## Obiettivo
Separare chiaramente input dati e analisi:

- **Caricamenti**: import/inserimento dati operativi.
- **Admin / CE**: solo Conto Economico e analisi.

## Novità

- Tab Caricamenti riorganizzata con sezioni:
  - Fatture acquisto
  - Fatture vendita
  - Corrispettivi
  - Buste paga
  - F24
  - Log import
- Aggiunto import XML fatture vendita.
- Nuove tabelle SQLite:
  - fatture_vendita
  - fatture_vendita_righe
- Conto Economico aggiornato con ricavi da fatture vendita per data fattura/competenza.
- Admin / CE pulito: rimane solo l’analisi CE.
- Snapshot sync aggiornato con fatture vendita.
- Apps Script aggiornato: docs/AppsScript_Sync_v9_1_1.gs.

## Regola CE

- Ricavi corrispettivi: data incasso.
- Ricavi fatture vendita: data fattura.
- Costi fatture acquisto: data fattura.
- Prima Nota / liquidità: data movimento/pagamento.
