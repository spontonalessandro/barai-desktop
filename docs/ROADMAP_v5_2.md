# BarAI Desktop v5.2

Focus: miglioramento mappatura prodotti per Controllo Prezzi.

## Aggiunto
- Campo pezzi per cartone/confezione nella mappatura prodotto.
- Lettura automatica suggerita da descrizioni tipo x9, cartone da 9, 9 pz, 9 bottiglie.
- Salvataggio campi di conversione su prodotti e prodotti_mapping.
- Prezzo XML separato da prezzo base normalizzato.
- Migrazioni SQLite automatiche per database già esistenti.

## Logica prezzo
Se pezzi_per_cartone > 1, il prezzo base usato dal Controllo Prezzi viene calcolato come prezzo XML / pezzi_per_cartone.
