const STORAGE_KEY = 'barai_error_log_v1';

export function normalizeError(error) {
  if (!error) return 'Errore sconosciuto';
  if (error instanceof Error) return error.message || String(error);
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch { return String(error); }
}

export function writeErrorLog({ module = 'app', action = 'unknown', error }) {
  const entry = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    created_at: new Date().toISOString(),
    module,
    action,
    message: normalizeError(error)
  };
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...current].slice(0, 200)));
  } catch {
    // Se localStorage non è disponibile, almeno non blocchiamo l'app.
  }
  return entry;
}

export function readErrorLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
