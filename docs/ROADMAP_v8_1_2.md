# BarAI Desktop v8.1.2

## Obiettivo

Versione di stabilizzazione dopo v8.1.1: correggere i bug più urgenti segnalati su sync, Food Cost e Prima Nota prima di procedere con nuovi moduli grandi.

## Correzioni incluse

1. **Messaggi Apps Script corretti**
   - I messaggi runtime indicano `docs/AppsScript_Sync_v8_1.gs`.
   - Rimosso il riferimento errato a `AppsScript_Sync_v7_5_2.gs` dal codice runtime.

2. **Conferma eliminazione ricette Food Cost**
   - Il tasto elimina ora chiede conferma prima di cancellare una ricetta e i suoi ingredienti.

3. **Data default Prima Nota sempre fresca**
   - Il form usa `freshForm()` e chiama `todayISO()` a ogni nuovo movimento/reset.
   - Evita data congelata se l'app resta aperta oltre mezzanotte.

4. **Pull/import snapshot in transazione**
   - `applySyncSnapshot()` ora usa `BEGIN` / `COMMIT`.
   - In caso di errore esegue `ROLLBACK`, evitando import parziali.

5. **Test di guardia**
   - Aggiunto `tests/sourceQuality.test.mjs` per bloccare regressioni sui punti sopra.

## Apps Script

Non è necessario aggiornare Apps Script se il deployment usa già:

```text
docs/AppsScript_Sync_v8_1.gs
```

## Invariati

```text
identifier: it.baraidesktop.app
database: ~/Library/Application Support/it.baraidesktop.app/barai.sqlite
```

## Prossimo debito tecnico consigliato

- Estrarre da `baraiDb.js` almeno sync/cloud e Prima Nota.
- Centralizzare CSV helpers.
- Introdurre `reload([...moduli])` per non ricaricare tutta l'app dopo ogni azione.
- Aggiungere test mirati su Prima Nota, scadenze e merge snapshot.
