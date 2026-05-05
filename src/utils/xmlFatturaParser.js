function lname(node) {
  return node?.localName || String(node?.nodeName || '').split(':').pop();
}

function descendants(parent, name) {
  if (!parent) return [];
  return Array.from(parent.getElementsByTagName('*')).filter((n) => lname(n) === name);
}

function first(parent, name) {
  return descendants(parent, name)[0] || null;
}

function firstPath(parent, names) {
  let current = parent;
  for (const name of names) {
    current = first(current, name);
    if (!current) return null;
  }
  return current;
}

function text(parent, pathOrName, fallback = '') {
  const node = Array.isArray(pathOrName) ? firstPath(parent, pathOrName) : first(parent, pathOrName);
  return node?.textContent?.trim() || fallback;
}

function all(parent, name) {
  return descendants(parent, name);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).trim().replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function simpleHash(textValue) {
  let hash = 0;
  const str = String(textValue || '');
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `xml_${Math.abs(hash).toString(16)}`;
}

function mapModalitaPagamento(code) {
  const map = {
    MP01: 'CONTANTI',
    MP02: 'ASSEGNO',
    MP03: 'ASSEGNO CIRCOLARE',
    MP04: 'CONTANTI PRESSO TESORERIA',
    MP05: 'BONIFICO',
    MP06: 'VAGLIA CAMBIARIO',
    MP07: 'BOLLETTINO BANCARIO',
    MP08: 'CARTA DI PAGAMENTO',
    MP09: 'RID',
    MP10: 'RID UTENZE',
    MP11: 'RID VELOCE',
    MP12: 'RIBA',
    MP13: 'MAV',
    MP14: 'QUIETANZA ERARIO',
    MP15: 'GIROCONTO',
    MP16: 'DOMICILIAZIONE BANCARIA',
    MP17: 'DOMICILIAZIONE POSTALE',
    MP18: 'BOLLETTINO POSTALE',
    MP19: 'SEPA DIRECT DEBIT',
    MP20: 'SEPA DIRECT DEBIT CORE',
    MP21: 'SEPA DIRECT DEBIT B2B',
    MP22: 'TRATTENUTA SU SOMME GIA RISCOSSE',
    MP23: 'PAGOPA'
  };
  return map[String(code || '').trim()] || String(code || '').trim() || 'DA VERIFICARE';
}

export function parseFatturaXml(xmlText, fileName = 'fattura.xml') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parseError = first(doc, 'parsererror');
  if (parseError) throw new Error('XML non valido o non leggibile.');

  const root = doc.documentElement;
  if (!root || !lname(root).toLowerCase().includes('fattura')) {
    throw new Error('Il file non sembra una fattura elettronica XML SDI.');
  }

  const header = first(doc, 'FatturaElettronicaHeader');
  const cedente = first(header, 'CedentePrestatore');
  const cessionario = first(header, 'CessionarioCommittente');
  const anag = first(cedente, 'DatiAnagrafici');
  const sede = first(cedente, 'Sede');
  const clienteAnag = first(cessionario, 'DatiAnagrafici');
  const clienteSede = first(cessionario, 'Sede');
  const body = first(doc, 'FatturaElettronicaBody');
  const datiGenerali = first(body, 'DatiGenerali');
  const docData = first(datiGenerali, 'DatiGeneraliDocumento');

  if (!body || !docData) throw new Error('Nel file XML mancano i dati documento della fattura.');

  const denominazione = text(anag, ['Anagrafica', 'Denominazione']) || [text(anag, ['Anagrafica', 'Nome']), text(anag, ['Anagrafica', 'Cognome'])].filter(Boolean).join(' ');
  const piva = text(anag, ['IdFiscaleIVA', 'IdCodice']);
  const cf = text(anag, 'CodiceFiscale');
  const clienteDenominazione = text(clienteAnag, ['Anagrafica', 'Denominazione']) || [text(clienteAnag, ['Anagrafica', 'Nome']), text(clienteAnag, ['Anagrafica', 'Cognome'])].filter(Boolean).join(' ');
  const clientePiva = text(clienteAnag, ['IdFiscaleIVA', 'IdCodice']);
  const clienteCf = text(clienteAnag, 'CodiceFiscale');

  const beniServizi = first(body, 'DatiBeniServizi');
  const riepiloghi = all(beniServizi, 'DatiRiepilogo');
  const imponibile = riepiloghi.reduce((sum, r) => sum + toNumber(text(r, 'ImponibileImporto')), 0);
  const iva = riepiloghi.reduce((sum, r) => sum + toNumber(text(r, 'Imposta')), 0);
  const totaleDocumento = toNumber(text(docData, 'ImportoTotaleDocumento'));

  const pagamenti = all(body, 'DettaglioPagamento').map((p) => ({
    modalita_codice: text(p, 'ModalitaPagamento'),
    modalita: mapModalitaPagamento(text(p, 'ModalitaPagamento')),
    data_scadenza: text(p, 'DataScadenzaPagamento'),
    importo: toNumber(text(p, 'ImportoPagamento'))
  }));

  const firstPayment = pagamenti[0] || null;
  const righe = all(beniServizi, 'DettaglioLinee').map((r, idx) => {
    const codici = all(r, 'CodiceValore').map((n) => n.textContent.trim()).filter(Boolean);
    return {
      numero_linea: Number(text(r, 'NumeroLinea', idx + 1)),
      codice_articolo: codici[0] || '',
      descrizione_originale: text(r, 'Descrizione') || 'Riga senza descrizione',
      quantita: toNumber(text(r, 'Quantita')),
      um: text(r, 'UnitaMisura'),
      prezzo_unitario: toNumber(text(r, 'PrezzoUnitario')),
      totale_riga: toNumber(text(r, 'PrezzoTotale')),
      aliquota_iva: toNumber(text(r, 'AliquotaIVA'))
    };
  });

  const dataFattura = text(docData, 'Data');
  const numero = text(docData, 'Numero');
  const hash = simpleHash(`${fileName}|${xmlText.length}|${piva}|${numero}|${dataFattura}|${totaleDocumento}`);

  return {
    fileName,
    hash,
    tipo_documento: text(docData, 'TipoDocumento'),
    valuta: text(docData, 'Divisa', 'EUR'),
    fornitore: {
      ragione_sociale: denominazione || 'Fornitore XML senza nome',
      partita_iva: piva,
      codice_fiscale: cf,
      indirizzo: [text(sede, 'Indirizzo'), text(sede, 'CAP'), text(sede, 'Comune'), text(sede, 'Provincia')].filter(Boolean).join(', ')
    },
    cliente: {
      ragione_sociale: clienteDenominazione || 'Cliente XML senza nome',
      partita_iva: clientePiva,
      codice_fiscale: clienteCf,
      indirizzo: [text(clienteSede, 'Indirizzo'), text(clienteSede, 'CAP'), text(clienteSede, 'Comune'), text(clienteSede, 'Provincia')].filter(Boolean).join(', ')
    },
    fattura: {
      numero,
      data_fattura: dataFattura,
      imponibile: imponibile || Math.max(totaleDocumento - iva, 0),
      iva,
      totale: totaleDocumento || imponibile + iva,
      valuta: text(docData, 'Divisa', 'EUR'),
      metodo_pagamento: firstPayment?.modalita || 'DA VERIFICARE',
      modalita_pagamento_codice: firstPayment?.modalita_codice || '',
      data_scadenza_xml: firstPayment?.data_scadenza || '',
      note: `Importata da XML: ${fileName}`
    },
    pagamenti,
    righe
  };
}
