# BarAI Desktop v7.3.2

Versione correttiva della chiusura app.

## Correzioni

- Modal interno per `Sync alla chiusura = Chiedi conferma`.
- Rimosso l’uso di `window.confirm()` nella chiusura, perché su macOS/Tauri poteva non mostrarsi in modo affidabile.
- Alla chiusura con modalità chiedi conferma ora l’app blocca la chiusura, mostra una finestra interna e permette:
  - Sincronizza e chiudi
  - Chiudi senza sync
  - Annulla
- La modalità automatica resta invariata.
- Nessuna modifica a identifier o posizione database.
