# BarAI Desktop v7

## Obiettivo

Prima base reale per sincronizzazione multi-PC senza condividere SQLite su Google Drive.

## Cosa contiene

- Mantiene identifier app `it.baraidesktop.app`.
- Mantiene database vivo locale `~/Library/Application Support/it.baraidesktop.app/barai.sqlite`.
- Migrazioni additive su `sync_log` e nuova tabella `sync_snapshots`.
- Configurazione Sync / Backup in app:
  - nome dispositivo;
  - URL Web App Apps Script;
  - Google Sheet ID cloud;
  - token segreto locale;
  - flag predisposizione controllo cloud all'apertura.
- Snapshot JSON completo delle tabelle operative.
- Import snapshot con merge non distruttivo:
  - inserisce record mancanti;
  - aggiorna solo se lo snapshot è più recente;
  - salta i record locali più recenti.
- Push/Pull cloud via Apps Script.
- Script Apps Script base in `docs/AppsScript_Sync_v7.gs`.

## Limiti noti v7

- È una base sync snapshot, non ancora sync riga-per-riga bidirezionale con gestione conflitti avanzata.
- Le eliminazioni fisiche non vengono propagate perfettamente: preferire soft delete/attivo=0.
- Se la WebView blocca chiamate Apps Script/CORS, usare export/import JSON manuale e passare in v7.1 al plugin HTTP Tauri.

## Prossimo step consigliato

v7.1: stabilizzare cloud sync con plugin HTTP Tauri, controllo cloud all'apertura e tabella conflitti esplicita.
