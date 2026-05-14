import { useState } from 'react';

export default function SetupDevice({ onSetup }) {
  const [step, setStep] = useState('scelta'); // 'scelta' | 'pin'
  const [pin, setPin] = useState('');
  const [pinConferma, setPinConferma] = useState('');
  const [errore, setErrore] = useState('');

  function scegliAdmin() {
    onSetup('admin', '');
  }

  function scegliDipendente() {
    setStep('pin');
  }

  function confermaPin() {
    if (pin.length < 4) { setErrore('Il PIN deve essere di almeno 4 cifre.'); return; }
    if (pin !== pinConferma) { setErrore('I PIN non coincidono.'); return; }
    onSetup('dipendente', pin);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #f8f1e8 0%, #efe4d5 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <div style={{
        width: 'min(480px, 100%)',
        background: 'rgba(255,250,242,.96)',
        border: '1px solid rgba(222,214,202,.8)',
        borderRadius: 28,
        boxShadow: '0 28px 90px rgba(26,23,20,.18)',
        padding: 36
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'linear-gradient(135deg, #e5a46f, #b86b3d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 950, color: '#1f1a16',
            margin: '0 auto 16px'
          }}>B</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, letterSpacing: '-.04em' }}>Benvenuto in BarAI</h1>
          {step === 'scelta' && <p style={{ margin: 0, color: '#796b5d', fontSize: 14 }}>Come si usa BarAI su questo PC?</p>}
          {step === 'pin' && <p style={{ margin: 0, color: '#796b5d', fontSize: 14 }}>Imposta un PIN per accedere alla modalità admin da questo PC.</p>}
        </div>

        {step === 'scelta' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={scegliAdmin} style={{
              border: '2px solid rgba(222,214,202,.8)',
              borderRadius: 18, padding: '20px 20px',
              background: 'rgba(255,255,255,.72)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'border-color .15s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#b86b3d'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(222,214,202,.8)'}
            >
              <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 4 }}>🔑 Modalità Admin</div>
              <div style={{ color: '#796b5d', fontSize: 13 }}>Accesso completo a tutte le funzioni: fatture, prima nota, conto economico, sync.</div>
            </button>

            <button onClick={scegliDipendente} style={{
              border: '2px solid rgba(222,214,202,.8)',
              borderRadius: 18, padding: '20px 20px',
              background: 'rgba(255,255,255,.72)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'border-color .15s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#b86b3d'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(222,214,202,.8)'}
            >
              <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 4 }}>👥 Modalità Dipendente</div>
              <div style={{ color: '#796b5d', fontSize: 13 }}>Accesso solo a Controllo Prezzi, Food Cost e Ordini Fornitore. Parte sempre in questa modalità.</div>
            </button>
          </div>
        )}

        {step === 'pin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.05em', color: '#796b5d' }}>
              PIN Admin (min. 4 cifre)
              <input
                type="password"
                value={pin}
                onChange={e => { setPin(e.target.value); setErrore(''); }}
                placeholder="••••"
                style={{ border: '1px solid #ded6ca', borderRadius: 12, padding: '10px 12px', fontSize: 18, letterSpacing: '.2em', textAlign: 'center' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.05em', color: '#796b5d' }}>
              Conferma PIN
              <input
                type="password"
                value={pinConferma}
                onChange={e => { setPinConferma(e.target.value); setErrore(''); }}
                placeholder="••••"
                style={{ border: '1px solid #ded6ca', borderRadius: 12, padding: '10px 12px', fontSize: 18, letterSpacing: '.2em', textAlign: 'center' }}
              />
            </label>
            {errore && <p style={{ color: '#9d3e32', fontSize: 13, margin: 0, fontWeight: 850 }}>{errore}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setStep('scelta')} style={{ flex: 1, border: '1px solid #ded6ca', borderRadius: 12, padding: '10px', background: 'rgba(255,255,255,.8)', cursor: 'pointer', fontWeight: 850 }}>Indietro</button>
              <button onClick={confermaPin} style={{ flex: 2, border: 0, borderRadius: 12, padding: '10px', background: '#b86b3d', color: '#fff', cursor: 'pointer', fontWeight: 950 }}>Imposta e continua</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
