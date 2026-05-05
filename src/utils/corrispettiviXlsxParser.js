import ExcelJS from 'exceljs';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return 0;
  const raw = String(value).trim();
  const normalized = raw.includes(',') ? raw.replaceAll('.', '').replace(',', '.') : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function cellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text || '');
    if ('result' in value) return String(value.result || '');
    if ('richText' in value) return value.richText.map((x) => x.text || '').join('');
  }
  return String(value);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function inferMonthYear(sheetName, fileName) {
  const joined = `${sheetName || ''} ${fileName || ''}`;
  const direct = joined.match(/(\d{1,2})\s*[-_/]\s*(20\d{2})/);
  if (direct) return { month: Number(direct[1]), year: Number(direct[2]) };
  const months = {
    gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
    luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12
  };
  const lower = joined.toLowerCase();
  const yearMatch = lower.match(/20\d{2}/);
  for (const [name, month] of Object.entries(months)) {
    if (lower.includes(name)) return { month, year: Number(yearMatch?.[0] || new Date().getFullYear()) };
  }
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function normalizeRowValues(row) {
  const values = [];
  // ExcelJS usa indici 1-based; row.values[0] è vuoto.
  for (let i = 1; i <= Math.max(8, row.cellCount || 0); i += 1) {
    values.push(row.getCell(i).value);
  }
  return values;
}

export async function parseCorrispettiviXlsx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const sheet = workbook.worksheets?.[0];
  if (!sheet) throw new Error('Nessun foglio trovato nel file XLSX corrispettivi.');
  const { month, year } = inferMonthYear(sheet.name, file.name);
  const parsed = [];

  sheet.eachRow((row) => {
    const values = normalizeRowValues(row);
    const day = Number(values?.[0]);
    if (!Number.isInteger(day) || day < 1 || day > 31) return;
    const riscossi = toNumber(values[1]);
    const nonRiscossi = toNumber(values[2]);
    const totale = toNumber(values[3]) || riscossi + nonRiscossi;
    const iva10 = toNumber(values[4]);
    const iva22 = toNumber(values[5]);
    if (totale <= 0 && riscossi <= 0 && nonRiscossi <= 0) return;
    parsed.push({
      data_incasso: `${year}-${pad2(month)}-${pad2(day)}`,
      contanti: riscossi,
      pos: 0,
      carta_credito: 0,
      ticket: 0,
      delivery: 0,
      altro: 0,
      non_riscosso: nonRiscossi,
      totale,
      iva_10: iva10,
      iva_22: iva22,
      fatture_da: cellText(values[6]),
      fatture_a: cellText(values[7]),
      origine_import: 'XLSX corrispettivi',
      nome_file: file.name,
      note: 'Importato da registro corrispettivi XLSX. Colonna riscossi caricata su contanti; puoi modificare manualmente la ripartizione se necessario.'
    });
  });

  if (!parsed.length) throw new Error('Nel file XLSX non ho trovato righe giornaliere corrispettivi leggibili.');
  return parsed;
}
