# BarAI Desktop v7.1

## Obiettivo

Stabilizzazione del primo sync cloud v7.

## Correzione principale

- Risolto il problema `Load failed` su chiamate Google Apps Script usando HTTP nativo Tauri invece del `fetch` della WebView.
- Aggiunte dipendenze:
  - `@tauri-apps/plugin-http`
  - `tauri-plugin-http`
- Aggiunti permessi capability per:
  - `https://script.google.com/**`
  - `https://script.googleusercontent.com/**`
  - `https://*.googleusercontent.com/**`

## Note operative

Dopo l'aggiornamento serve eseguire di nuovo:

```bash
npm install
npm run tauri:dev
```

Il database locale resta invariato in:

`~/Library/Application Support/it.baraidesktop.app/barai.sqlite`
