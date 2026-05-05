# BarAI Desktop v5.3

Versione di stabilizzazione tecnica prima di Food Cost e Controllo di Gestione.

## Obiettivo

Mantenere le funzioni della v5.2.2 ma rendere il codice più manutenibile:

- `App.jsx` non contiene più tutte le pagine.
- Pagine principali spostate in `src/pages/`.
- Badge, toast e componenti comuni spostati in `src/components/`.
- Utility di formato spostate in `src/utils/format.js`.
- Logica di guessing prodotti spostata in `src/utils/productGuess.js`.
- Import database centralizzato in `src/db/index.js`.
- Repository placeholder creati in `src/db/repositories/` per il prossimo split reale del layer dati.
- Primo sistema di log errori persistente lato app con `src/utils/errorLog.js`.
- Test base in `tests/` per funzioni pure.

## Funzioni applicative

La v5.3 non cambia volutamente il database rispetto alla v5.2.2. Restano attivi:

- Scadenziario.
- Import XML fatture acquisto.
- Pagamento con data e metodo.
- Controllo prezzi.
- Mappatura prodotti.
- Pezzi per cartone/confezione.

## Prossimo step

Dopo conferma della v5.3:

- v5.4: mappatura prodotti finale e categorie/unità più robuste.
- v6: Food Cost.
- v7: sync multi-PC base.
