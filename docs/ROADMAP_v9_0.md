# BarAI Desktop v9.1 - Fonti dati Controllo di Gestione

Questa versione prepara il Controllo di Gestione senza calcolare ancora il CE completo.

## Nuove fonti dati

- Incassi cassa / chiusure giornata
  - inserimento manuale
  - import XLSX registro corrispettivi
  - generazione automatica Prima Nota per contanti/POS/carte/ticket/delivery

- Buste paga / costo personale
  - inserimento manuale
  - import JSON da futura lettura PDF
  - generazione automatica Prima Nota del costo azienda

- F24 / versamenti fiscali
  - inserimento manuale
  - import JSON da futura lettura PDF F24
  - generazione automatica Prima Nota

## Tabelle nuove

- incassi_cassa
- buste_paga
- versamenti_f24

## Sync

Le nuove tabelle entrano nello snapshot cloud e nei fogli leggibili tramite:

- docs/AppsScript_Sync_v9_0.gs

## Note

Il Conto Economico vero arriva nella v9.1. Questa v9.1 serve a raccogliere dati affidabili di input.
