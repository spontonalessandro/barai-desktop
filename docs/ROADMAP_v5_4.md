# BarAI Desktop v5.4

Versione di rifinitura del Controllo Prezzi e della mappatura prodotti.

## Novità

- Categoria obbligatoria in mappatura prodotti.
- Categoria selezionabile da menu a tendina con categorie già esistenti e categorie comuni.
- Ricerca testuale su “usa prodotto già creato”.
- UM base fissa: LT, PZ, KG, CRT.
- Modifica prodotto già mappato direttamente dalla tab Storico prezzi.
- Validazione lato database per categoria e UM.

## Nota tecnica

La modifica prodotto aggiorna l’anagrafica `prodotti` e le righe collegate per la categoria. I prezzi storici continuano a essere ricalcolati dalle righe XML importate.
