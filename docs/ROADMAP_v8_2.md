# ROADMAP v8.2

## Obiettivo

Stabilizzazione tecnica prima della v9 Controllo di Gestione.

## Fatto

- Reload selettivo in `App.jsx`.
- Repository logici in `src/db/repositories`.
- `db/index.js` organizzato per repository.
- Utility duplicate ridotte in Prima Nota.
- Test sorgente ampliato.

## Note

`baraiDb.js` resta ancora il contenitore principale della logica database per evitare rischi prima della v9. La v8.2 prepara però il bordo esterno del refactor: la UI ora importa da `db/index.js`, che instrada le funzioni attraverso repository logici.

## Prossimi refactor possibili

- estrazione reale di sync/cloud da `baraiDb.js`;
- estrazione reale Prima Nota;
- estrazione reale Food Cost;
- estrazione reale Controllo Prezzi;
- test di dominio eseguibili su funzioni pure.
