import { useState } from 'react';

export default function PinModal({ onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [errore, setErrore] = useState('');

  function submit(e) {
    e.preventDefault();
    onSuccess(pin);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: 340 }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Accesso admin</p>
            <h2>Inserisci PIN</h2>
          </div>
          <button className="icon-btn" onClick={onCancel}>×</button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          <input
            type="password"
            value={pin}
            onChange={e => { setPin(e.target.value); setErrore(''); }}
            placeholder="••••"
            autoFocus
            style={{
              border: '1px solid var(--line)', borderRadius: 12,
              padding: '12px', fontSize: 22, letterSpacing: '.25em',
              textAlign: 'center', background: 'rgba(255,255,255,.85)'
            }}
          />
          {errore && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0, fontWeight: 850 }}>{errore}</p>}
          <div className="form-actions">
            <button type="button" className="ghost-btn" onClick={onCancel}>Annulla</button>
            <button type="submit" className="primary-btn">Accedi</button>
          </div>
        </form>
      </div>
    </div>
  );
}
