# BarAI Desktop v7.4

## Obiettivo

Rendere il sync multi-PC più sicuro prima di usare BarAI Desktop su due computer diversi.

## Implementato

- Controllo cloud automatico prima del Push.
- Blocco del Push se il cloud contiene una revisione diversa pubblicata da un altro PC.
- Messaggio operativo chiaro: fare Pull prima del Push.
- Pulsante `Controlla sicurezza push`.
- Pulsante `Pull e poi Push`.
- Pulsante `Forza push` con conferma forte.
- Protezione applicata anche al sync alla chiusura.
- Nessuna modifica distruttiva al database locale.
- Nessun cambio identifier app.

## Regola di sicurezza

Il Push normale è consentito solo se:

- il cloud è vuoto;
- oppure la revisione cloud è uguale all'ultima revisione sincronizzata localmente;
- oppure la revisione diversa risulta pubblicata dallo stesso dispositivo.

Se la revisione cloud è diversa e arriva da un altro dispositivo, BarAI blocca il Push.

## Prossimo step consigliato

Dopo test reale su due PC:

- v7.5: rifinitura fogli Google per web app mobile readonly;
- oppure Mobile ReadOnly v1: consultazione fatture, scadenze, pagamenti e controllo prezzi.
