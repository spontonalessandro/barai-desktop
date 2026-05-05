# BarAI Desktop v4

## Correzioni principali

- Pagamento guidato da Scadenziario.
- Quando una fattura viene segnata come pagata, l'app chiede:
  - metodo pagamento: Contanti, Bancomat, Bonifico, Assegno, Carta di credito;
  - data pagamento, precompilata con la data corrente ma modificabile.
- Il metodo scelto viene salvato su:
  - scadenza;
  - fattura acquisto;
  - registro pagamenti.
- Prima di registrare un nuovo pagamento, eventuali pagamenti precedenti sulla stessa scadenza vengono rimossi per evitare duplicati.

## Prossimo step

Controllo Prezzi: usare le righe XML importate per creare storico prezzi, prodotti non mappati e variazioni.
