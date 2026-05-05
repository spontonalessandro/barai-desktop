# BarAI Desktop v7.5 - Sicurezza dati / Backup locale

Versione di stabilizzazione prima della Prima Nota automatica.

## Obiettivi

- Mantenere SQLite locale come database vivo.
- Non spostare il database e non cancellare dati.
- Aggiungere una rete di sicurezza locale prima di introdurre movimenti automatici.

## Novità

- Backup locale automatico giornaliero all'avvio dell'app.
- Backup manuale da Sync / Backup.
- Apertura cartella backup locale.
- Lista ultimi backup SQLite creati sul PC.
- Diagnostica SQLite con PRAGMA integrity_check, quick_check e foreign_key_check.
- Log backup/diagnostica dentro lo storico snapshot.
- Mantiene protezione anti-sovrascrittura cloud v7.4.

## Percorsi invariati

Database vivo:

```text
~/Library/Application Support/it.baraidesktop.app/barai.sqlite
```

Backup locali:

```text
~/Library/Application Support/it.baraidesktop.app/backups
```

Identifier app:

```text
it.baraidesktop.app
```

## Nota operativa

Prima di passare alla v8 Prima Nota automatica, verificare:

1. apertura app crea backup automatico una volta al giorno;
2. pulsante Crea backup ora genera file SQLite;
3. Apri cartella backup apre la cartella corretta;
4. Diagnostica database restituisce OK;
5. Sync cloud v7.4 continua a funzionare.
