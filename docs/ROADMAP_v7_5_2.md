# BarAI Desktop v7.5.2 - Prezzo scontato per comparazioni

## Obiettivo
Usare il costo reale pagato per Controllo Prezzi e Food Cost.

## Regola
Per ogni riga XML:

```text
prezzo_unitario_xml_originale = PrezzoUnitario
prezzo_unitario_scontato = PrezzoTotale / Quantità
prezzo_base_calcolo = prezzo_unitario_scontato / pezzi_per_cartone / quantita_per_unita
```

Il prezzo usato per ultimo prezzo, prezzo medio, min/max, delta percentuale e food cost è `prezzo_base_calcolo`.

## Note
- Nessuna migrazione distruttiva.
- I dati già importati vengono ricalcolati al volo usando `totale_riga` e `quantita`.
- Aggiornare Apps Script con `docs/AppsScript_Sync_v7_5_2.gs` solo se si vuole allineare anche il foglio cloud `Controllo_Prezzi`.


## Fix tecnico v7.5.2

La mappatura prodotti usa ora un ID stabile con hash su `fornitore_id + descrizione_originale`.
Questo evita collisioni su descrizioni XML lunghe o molto simili che prima venivano troncate nello slug e potevano generare l'errore `UNIQUE constraint failed: prodotti_mapping.id`.
