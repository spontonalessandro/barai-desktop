# BarAI Desktop v8.1.2

Correzione mirata del pulsante **Rigenera automatici** in Prima Nota.

## Correzioni

- La rigenerazione ora usa come fonte primaria la tabella `pagamenti`.
- Le scadenze pagate senza riga in `pagamenti` vengono usate come fallback.
- I movimenti manuali non vengono modificati.
- I movimenti automatici orfani vengono rimossi solo se la scadenza non risulta più pagata.
- La pagina Prima Nota mostra un riepilogo visibile: creati, aggiornati, da pagamenti, da scadenze, orfani rimossi, saltati.

## Invariati

- Identifier: `it.baraidesktop.app`
- Database: `~/Library/Application Support/it.baraidesktop.app/barai.sqlite`
- Apps Script: invariato rispetto a v8.1
