# BarAI Desktop v7.3.1

Correzione mirata del sync alla chiusura.

## Fix
- Registrazione del listener di chiusura una sola volta, indipendente dal timing di caricamento configurazione.
- Uso di un ref con configurazione sync sempre aggiornata.
- Conferma sync alla chiusura più affidabile in modalità `ask`.
- Stato listener visibile nella pagina Sync / Backup.

## Invariati
- Identifier app: `it.baraidesktop.app`.
- Database locale: `~/Library/Application Support/it.baraidesktop.app/barai.sqlite`.
- Nessuna migrazione distruttiva.
