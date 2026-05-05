# BarAI Desktop v7.2

Obiettivo: rendere il cloud leggibile per la futura web app mobile solo consultazione.

## Implementato

- Push JSON cloud invariato e sicuro.
- Nuovo pulsante `Push + aggiorna fogli`.
- Nuovo Apps Script `docs/AppsScript_Sync_v7_2.gs`.
- Esplosione snapshot JSON in fogli Google leggibili:
  - Fornitori
  - Fatture_Acquisto
  - Fatture_Righe
  - Scadenze
  - Pagamenti
  - Prodotti_Normalizzati
  - Prodotti_Mapping
  - Controllo_Prezzi
  - Food_Cost_Ricette
  - Food_Cost_Ingredienti
  - Prima_Nota
  - Sync_Info
- Trigger Apps Script installabile 2 volte al giorno:
  - `installBarAiExplodeTriggers()`
- Impostazione `Sync alla chiusura app`:
  - disattivato
  - chiedi conferma
  - automatico

## Architettura confermata

SQLite locale = database operativo  
JSON cloud = backup/sync tecnico  
Google Sheet esploso = database lettura web/mobile  
Web app = solo consultazione

## Note

Il database locale resta in:

`~/Library/Application Support/it.baraidesktop.app/barai.sqlite`

L'identifier app resta:

`it.baraidesktop.app`
