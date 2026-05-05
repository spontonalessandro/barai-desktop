-- BarAI Desktop DB v1
-- Schema iniziale SQLite per app unica: Admin, Scadenziario, Controllo Prezzi, Food Cost.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS config (
  chiave TEXT PRIMARY KEY,
  valore TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aziende (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  partita_iva TEXT,
  codice_fiscale TEXT,
  indirizzo TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fornitori (
  id TEXT PRIMARY KEY,
  ragione_sociale TEXT NOT NULL,
  partita_iva TEXT,
  codice_fiscale TEXT,
  iban TEXT,
  email TEXT,
  telefono TEXT,
  metodo_pagamento_default TEXT,
  regola_pagamento_id TEXT,
  attivo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS regole_pagamento (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  giorni INTEGER NOT NULL DEFAULT 0,
  fine_mese INTEGER NOT NULL DEFAULT 0,
  giorni_extra INTEGER NOT NULL DEFAULT 0,
  metodo_pagamento TEXT,
  auto_pagato INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fatture_acquisto (
  id TEXT PRIMARY KEY,
  fornitore_id TEXT,
  fornitore_nome TEXT NOT NULL,
  numero TEXT NOT NULL,
  data_fattura TEXT NOT NULL,
  imponibile REAL NOT NULL DEFAULT 0,
  iva REAL NOT NULL DEFAULT 0,
  totale REAL NOT NULL DEFAULT 0,
  valuta TEXT NOT NULL DEFAULT 'EUR',
  metodo_pagamento TEXT,
  stato TEXT NOT NULL DEFAULT 'DA_VERIFICARE',
  documento_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fornitore_nome, numero, data_fattura)
);

CREATE TABLE IF NOT EXISTS fatture_acquisto_righe (
  id TEXT PRIMARY KEY,
  fattura_id TEXT NOT NULL,
  codice_articolo TEXT,
  descrizione_originale TEXT NOT NULL,
  prodotto_id TEXT,
  categoria TEXT,
  quantita REAL NOT NULL DEFAULT 0,
  um TEXT,
  prezzo_unitario REAL NOT NULL DEFAULT 0,
  totale_riga REAL NOT NULL DEFAULT 0,
  aliquota_iva REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(fattura_id) REFERENCES fatture_acquisto(id)
);

CREATE TABLE IF NOT EXISTS scadenze (
  id TEXT PRIMARY KEY,
  fattura_id TEXT NOT NULL,
  fornitore_id TEXT,
  data_scadenza TEXT NOT NULL,
  importo REAL NOT NULL DEFAULT 0,
  importo_pagato REAL NOT NULL DEFAULT 0,
  stato TEXT NOT NULL DEFAULT 'APERTO',
  metodo_pagamento TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(fattura_id) REFERENCES fatture_acquisto(id)
);

CREATE TABLE IF NOT EXISTS pagamenti (
  id TEXT PRIMARY KEY,
  scadenza_id TEXT NOT NULL,
  fattura_id TEXT,
  data_pagamento TEXT NOT NULL,
  importo REAL NOT NULL DEFAULT 0,
  metodo_pagamento TEXT,
  conto TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(scadenza_id) REFERENCES scadenze(id)
);

CREATE TABLE IF NOT EXISTS prima_nota (
  id TEXT PRIMARY KEY,
  data_movimento TEXT NOT NULL,
  tipo TEXT NOT NULL,
  categoria TEXT,
  descrizione TEXT NOT NULL,
  importo REAL NOT NULL DEFAULT 0,
  metodo_pagamento TEXT,
  riferimento_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prodotti (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT,
  um_base TEXT,
  attivo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prodotti_mapping (
  id TEXT PRIMARY KEY,
  descrizione_originale TEXT NOT NULL,
  fornitore_id TEXT,
  prodotto_id TEXT,
  confidenza REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(descrizione_originale, fornitore_id)
);

CREATE TABLE IF NOT EXISTS ricette (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT,
  prezzo_vendita REAL NOT NULL DEFAULT 0,
  porzioni REAL NOT NULL DEFAULT 1,
  attiva INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ricette_ingredienti (
  id TEXT PRIMARY KEY,
  ricetta_id TEXT NOT NULL,
  prodotto_id TEXT NOT NULL,
  quantita REAL NOT NULL DEFAULT 0,
  um TEXT,
  costo_unitario_override REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(ricetta_id) REFERENCES ricette(id),
  FOREIGN KEY(prodotto_id) REFERENCES prodotti(id)
);

CREATE TABLE IF NOT EXISTS documenti (
  id TEXT PRIMARY KEY,
  nome_file TEXT NOT NULL,
  tipo TEXT,
  percorso_locale TEXT,
  percorso_drive TEXT,
  hash_file TEXT,
  stato_import TEXT NOT NULL DEFAULT 'DA_IMPORTARE',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  tabella TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operazione TEXT NOT NULL,
  payload_json TEXT,
  stato TEXT NOT NULL DEFAULT 'DA_SYNC',
  errore TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_fatture_acquisto_data ON fatture_acquisto(data_fattura);
CREATE INDEX IF NOT EXISTS idx_scadenze_data_stato ON scadenze(data_scadenza, stato);
CREATE INDEX IF NOT EXISTS idx_righe_prodotto ON fatture_acquisto_righe(prodotto_id);
CREATE INDEX IF NOT EXISTS idx_prima_nota_data ON prima_nota(data_movimento);
