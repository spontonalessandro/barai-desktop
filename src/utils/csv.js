export function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('\"', '\"\"')}"`;
}

export function buildCsvFromObjects(rows, separator = ';') {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.join(separator),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(separator))
  ].join('\n');
}

export function buildCsvFromRows(rows, separator = ';') {
  if (!rows?.length) return '';
  return rows.map((row) => row.map(csvEscape).join(separator)).join('\n');
}

export function downloadCsv(filename, rows, options = {}) {
  if (!rows?.length) return;
  const mode = options.mode || (Array.isArray(rows[0]) ? 'rows' : 'objects');
  const separator = options.separator || ';';
  const csv = mode === 'rows' ? buildCsvFromRows(rows, separator) : buildCsvFromObjects(rows, separator);
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
