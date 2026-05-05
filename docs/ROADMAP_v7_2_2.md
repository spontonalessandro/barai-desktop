# BarAI Desktop v7.2.2

Versione di stabilizzazione sync.

## Correzioni

- Corretto errore Tauri alla chiusura app: aggiunto permesso `core:window:allow-destroy` nella capability principale.
- Corrette icone Push/Pull nella pagina Sync: upload/download cloud distinti.
- Aggiornate diciture Sync a v7.2.2.
- Sistemata una chiusura `div` extra nella tabella log sync.

## Note

- Database locale invariato: `~/Library/Application Support/it.baraidesktop.app/barai.sqlite`.
- Identifier app invariato: `it.baraidesktop.app`.
- Nessuna migrazione distruttiva.
