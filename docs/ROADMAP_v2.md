# BarAI Desktop v2 - Roadmap

## Stato attuale

Questa versione conferma la base desktop Tauri + React + SQLite e rende operativo il primo modulo reale: lo Scadenziario.

## Funzioni presenti in v2

- Dashboard locale con KPI base.
- Scadenziario con filtri per stato, mese, fornitore e ricerca libera.
- Inserimento manuale fatture acquisto.
- Creazione automatica della scadenza dalla regola pagamento.
- Pagamento singolo.
- Pagamento multiplo delle scadenze selezionate.
- Riapertura di una scadenza pagata manualmente.
- Anagrafica fornitori.
- Regole pagamento modificabili da app.
- Storico ultimi pagamenti manuali.

## Regole pagamento iniziali

- Pagamento immediato.
- 30 giorni.
- 30 giorni fine mese.
- 30 giorni fine mese + 5.
- 60 giorni.
- 60 giorni fine mese.
- RID / RIBA automatico.
- Da verificare.

## Prossima versione consigliata: v3

Import XML fatture acquisto:

1. selezione file XML SDI;
2. lettura dati fornitore, numero, data, imponibile, IVA, totale;
3. lettura righe fattura;
4. creazione automatica fornitore se non esiste;
5. applicazione regola pagamento default del fornitore;
6. creazione scadenza;
7. popolamento righe per Controllo Prezzi.

## Versione successiva: v4

Controllo Prezzi:

- righe fattura;
- prodotti non mappati;
- mappatura prodotto standard;
- storico prezzi;
- alert aumenti prezzo;
- prezzo medio/min/max.
