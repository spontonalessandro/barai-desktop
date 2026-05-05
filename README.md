# BarAI Desktop v9.1.1

App desktop per gestione bar basata su Tauri, React e SQLite locale.

## Novità v9.1.1

Aggiunto il primo **Conto Economico gestionale mensile** dentro Admin / CE.

Il CE viene calcolato per competenza usando le fonti già presenti:

- incassi cassa / chiusure giornata;
- fatture acquisto fornitori;
- Prima Nota manuale per costi e ricavi extra;
- buste paga / costo personale;
- F24 / tributi.

La pagina Admin / CE ora ha una tab **Conto Economico** con:

- selettore mese;
- ricavi;
- acquisti da fatture;
- margine lordo;
- costi operativi;
- costo personale;
- EBITDA;
- F24 / tributi;
- risultato gestionale stimato;
- confronto con mese precedente e stesso mese anno precedente.

## Regola contabile gestionale

```text
Conto Economico = competenza
Liquidità / Prima Nota = data pagamento
```

Esempio: una fattura di aprile pagata a maggio entra nel CE di aprile, ma nella liquidità di maggio.

## Database locale

Il database vivo resta sempre qui:

```text
~/Library/Application Support/it.baraidesktop.app/barai.sqlite
```

Identifier app invariato:

```text
it.baraidesktop.app
```

## Setup

```bash
npm install
npm run tauri:dev
```

## Apps Script

Per questa versione non è obbligatorio aggiornare Apps Script se hai già installato:

```text
docs/AppsScript_Sync_v9_0.gs
```

## Prossimo step indicativo

```text
v9.2 = KPI e dashboard gestionale
```
