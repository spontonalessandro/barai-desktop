# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack
- Tauri + React + SQLite locale
- Vite come bundler

## Database
`~/Library/Application Support/it.baraidesktop.app/barai.sqlite`

## Test
```bash
node tests/productGuess.test.mjs
node tests/format.test.mjs
node tests/sourceQuality.test.mjs
```

## Versioning
```bash
git add . && git commit -m "vX.X" && git push
```

## Architecture

**Entry point:** `src/App.jsx` — tutto lo stato React (useState), tutti gli handler, routing via stringa `activePage`.

**Layered structure:**
```
src/
  App.jsx              ← root: state, handlers, routing
  pages/               ← 9 pagine (ricevono props/callback da App.jsx)
  components/          ← UI condivisa
  db/
    baraiDb.js         ← connessione DB, helper (uid, fmtDate, calcolaScadenza…)
    schema.js          ← 18 CREATE TABLE
    repositories/      ← 11 repo, uno per dominio
  logic/
    contoEconomico.js  ← calcolo P&L puro (nessuna chiamata DB)
  utils/               ← parser XML fatture, XLSX, formattatori, errorLog
src-tauri/src/
  lib.rs               ← 3 comandi Tauri: backup locale (create, list, open folder)
```

**State & data flow:**
- Nessun Redux/Zustand — tutto in `App.jsx`.
- `reload(scopes[])` ricarica uno o più scope in parallelo dopo ogni mutazione.
- Pattern CRUD: `runAction(asyncFn) → reload → toast → error handling`.

**Repositories (`src/db/repositories/`):**
`dashboardRepo`, `scadenziarioRepo`, `fornitoriRepo`, `regolePagamentoRepo`, `fattureRepo`, `primaNotaRepo`, `controlloPrezziRepo`, `foodCostRepo`, `gestioneRepo`, `syncRepo`, `backupRepo`

**Note business logic:**
- *Conto Economico* usa data documento (competenza), non data pagamento.
- Import fatture: formato XML FatturaPA italiano (`src/utils/xmlFatturaParser.js`).
- Cloud sync: Google Sheets via HTTP POST ad Apps Script (token + URL in tabella `config`).
