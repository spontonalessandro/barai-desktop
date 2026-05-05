# BarAI Desktop v8 - Prima Nota gestionale

La v8 introduce la Prima Nota gestionale interna, mantenendo SQLite locale, sync multi-PC sicuro e backup automatici della v7.5.2.

## Funzioni aggiunte

- Tab Prima Nota reale, non più placeholder.
- Inserimento movimenti manuali:
  - Entrata
  - Uscita
  - Giroconto
- Campi gestionali:
  - data movimento
  - conto
  - categoria
  - sottocategoria
  - descrizione
  - importo
  - metodo pagamento
  - note
- Filtri per ricerca, tipo, conto, categoria, mese e origine.
- Totali entrate, uscite, saldo e saldo per conto.
- Movimenti automatici da Scadenziario quando una fattura viene segnata pagata.
- Protezione anti-doppione: ogni scadenza pagata genera/aggiorna un solo movimento automatico.
- Riapertura scadenza: rimuove il movimento automatico collegato.
- Movimenti automatici non modificabili dalla Prima Nota: si aggiornano dal pagamento/scadenza.

## Regola principale

- BarAI Desktop resta il database operativo locale.
- Prima Nota è gestionale, non contabilità ufficiale.
- I dati vengono sincronizzati nel JSON e nei fogli Google tramite sync cloud esistente.

## Prossimo step indicativo

v8.1: incassi giornalieri, movimenti ricorrenti e import chiusure cassa.
