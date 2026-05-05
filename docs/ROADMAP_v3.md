# BarAI Desktop v3

## Novità

- Aggiunta data pagamento su scadenze e fatture.
- Quando una scadenza viene segnata pagata, viene salvata anche la data pagamento.
- Quando una scadenza viene riaperta, la data pagamento viene pulita.
- Aggiunto import XML fatture elettroniche acquisto.
- L'import XML crea/aggiorna:
  - fornitore;
  - fattura acquisto;
  - scadenza;
  - righe fattura;
  - log import.
- Aggiunte tab Scadenziario:
  - Righe XML;
  - Log import.
- Aggiunto modulo Caricamenti operativo.

## Note

L'import XML legge i campi principali SDI:

- CedentePrestatore;
- numero/data fattura;
- imponibile, IVA, totale;
- dati pagamento, se presenti;
- righe di dettaglio per il futuro controllo prezzi.

## Prossima versione consigliata

BarAI Desktop v4: Controllo Prezzi usando le righe XML già importate.
