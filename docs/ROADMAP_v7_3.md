# BarAI Desktop v7.3

## Obiettivo
Rendere operativo il sync multi-PC base con controlli automatici, senza cambiare la posizione del database locale e senza usare SQLite condiviso su Drive.

## Novità
- Controllo cloud all'apertura realmente attivo quando abilitato in Sync / Backup.
- Avviso se il cloud contiene una revisione diversa pubblicata da un altro PC.
- Possibilità di fare Pull cloud direttamente all'avvio dopo l'avviso.
- Check cloud non sovrascrive più la revisione locale sincronizzata: salva una revisione cloud verificata separata.
- Sync alla chiusura più guidato:
  - disattivato
  - chiedi conferma
  - automatico
- Alla chiusura, se configurato, esegue Push + aggiorna fogli Google prima di uscire.
- Se il sync alla chiusura fallisce, i dati locali restano salvi e l'utente può scegliere se chiudere comunque.
- Stato sync più leggibile nella pagina Sync / Backup.

## Note
- Identifier invariato: it.baraidesktop.app
- Database invariato: ~/Library/Application Support/it.baraidesktop.app/barai.sqlite
- Nessuna migrazione distruttiva.
- Non serve aggiornare Apps Script se è già installato lo script v7.2.1 funzionante.
