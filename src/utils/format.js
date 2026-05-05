export function euro(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

export function percent(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1).replace('.', ',')}%`;
}

export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(`${value}T12:00:00`);
  return d.toLocaleDateString('it-IT');
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(value) {
  return value ? String(value).slice(0, 7) : '';
}

export function statusClass(stato) {
  return String(stato || '').toLowerCase().replaceAll('_', '-');
}

export function normalizePaymentMethod(value) {
  const text = String(value || '').trim();
  if (!text) return 'Bonifico';
  const lower = text.toLowerCase();
  if (lower.includes('contant')) return 'Contanti';
  if (lower.includes('bancomat') || lower.includes('pos')) return 'Bancomat';
  if (lower.includes('bonifico') || lower.includes('sepa')) return 'Bonifico';
  if (lower.includes('assegno')) return 'Assegno';
  if (lower.includes('carta') || lower.includes('credito')) return 'Carta di credito';
  return text;
}

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  const normalized = raw.includes(',') ? raw.replaceAll('.', '').replace(',', '.') : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
