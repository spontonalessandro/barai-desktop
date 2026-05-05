export const DEFAULT_REGOLE = [
  {
    id: 'reg_immediato',
    nome: 'Pagamento immediato',
    giorni: 0,
    fine_mese: 0,
    giorni_extra: 0,
    metodo_pagamento: 'CONTANTI / POS',
    auto_pagato: 0,
    note: 'Fatture da pagare subito o già saldate manualmente.'
  },
  {
    id: 'reg_30',
    nome: '30 giorni',
    giorni: 30,
    fine_mese: 0,
    giorni_extra: 0,
    metodo_pagamento: 'BONIFICO',
    auto_pagato: 0,
    note: 'Scadenza a 30 giorni dalla data fattura.'
  },
  {
    id: 'reg_30fm',
    nome: '30 giorni fine mese',
    giorni: 30,
    fine_mese: 1,
    giorni_extra: 0,
    metodo_pagamento: 'BONIFICO',
    auto_pagato: 0,
    note: 'Aggiunge 30 giorni e porta la scadenza a fine mese.'
  },
  {
    id: 'reg_30fm5',
    nome: '30 giorni fine mese + 5',
    giorni: 30,
    fine_mese: 1,
    giorni_extra: 5,
    metodo_pagamento: 'BONIFICO',
    auto_pagato: 0,
    note: 'Esempio: fattura 10/01 -> scadenza 05/03.'
  },
  {
    id: 'reg_60',
    nome: '60 giorni',
    giorni: 60,
    fine_mese: 0,
    giorni_extra: 0,
    metodo_pagamento: 'BONIFICO',
    auto_pagato: 0,
    note: 'Scadenza a 60 giorni dalla data fattura.'
  },
  {
    id: 'reg_60fm',
    nome: '60 giorni fine mese',
    giorni: 60,
    fine_mese: 1,
    giorni_extra: 0,
    metodo_pagamento: 'BONIFICO',
    auto_pagato: 0,
    note: 'Aggiunge 60 giorni e porta la scadenza a fine mese.'
  },
  {
    id: 'reg_rid_auto',
    nome: 'RID / RIBA automatico',
    giorni: 30,
    fine_mese: 1,
    giorni_extra: 0,
    metodo_pagamento: 'RID / RIBA',
    auto_pagato: 1,
    note: 'Da considerare pagata automaticamente salvo controllo.'
  },
  {
    id: 'reg_da_verificare',
    nome: 'Da verificare',
    giorni: 0,
    fine_mese: 0,
    giorni_extra: 0,
    metodo_pagamento: 'DA VERIFICARE',
    auto_pagato: 0,
    note: 'Usala quando sulla fattura non è chiara la scadenza o il metodo di pagamento.'
  }
];

export const DEMO_REGOLE = DEFAULT_REGOLE;

export const DEMO_FATTURE = [
  {
    id: 'fa_demo_001',
    fornitore_id: 'for_demo_001',
    fornitore_nome: 'Fornitore Demo Bevande',
    numero: 'A-101',
    data_fattura: '2026-04-10',
    imponibile: 420.0,
    iva: 92.4,
    totale: 512.4,
    metodo_pagamento: 'BONIFICO',
    regola_pagamento_id: 'reg_30fm5'
  },
  {
    id: 'fa_demo_002',
    fornitore_id: 'for_demo_002',
    fornitore_nome: 'Fornitore Demo Food',
    numero: 'F-882',
    data_fattura: '2026-04-15',
    imponibile: 185.5,
    iva: 18.55,
    totale: 204.05,
    metodo_pagamento: 'RID / RIBA',
    regola_pagamento_id: 'reg_rid_auto'
  },
  {
    id: 'fa_demo_003',
    fornitore_id: 'for_demo_003',
    fornitore_nome: 'Fornitore Demo Varie',
    numero: '22/PA',
    data_fattura: '2026-04-20',
    imponibile: 90.0,
    iva: 19.8,
    totale: 109.8,
    metodo_pagamento: 'CONTANTI / POS',
    regola_pagamento_id: 'reg_immediato'
  },
  {
    id: 'fa_demo_004',
    fornitore_id: 'for_demo_004',
    fornitore_nome: 'Fornitore Demo Da Controllare',
    numero: '99/26',
    data_fattura: '2026-04-25',
    imponibile: 300.0,
    iva: 30.0,
    totale: 330.0,
    metodo_pagamento: 'DA VERIFICARE',
    regola_pagamento_id: 'reg_da_verificare'
  }
];
