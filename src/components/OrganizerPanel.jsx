import { useEffect, useState } from 'react';

async function organizerRequest(action, code) {
  const response = await fetch('/api/session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-organizer-code': code,
    },
    body: JSON.stringify({ action }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'La demande organisateur a échoué.');
  return body;
}

export default function OrganizerPanel() {
  const [code, setCode] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    const body = await organizerRequest('status', code);
    setSession(body.session);
    setParticipants(body.participants);
    setError('');
  }

  useEffect(() => {
    if (!authorized) return undefined;
    let active = true;
    async function poll() {
      try {
        const body = await organizerRequest('status', code);
        if (active) {
          setSession(body.session);
          setParticipants(body.participants);
          setError('');
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    }
    const timer = window.setInterval(poll, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [authorized, code]);

  async function connect(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await refreshStatus();
      setAuthorized(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function performAction(action) {
    setBusy(true);
    setError('');
    try {
      const body = await organizerRequest(action, code);
      setSession(body.session);
      if (action === 'reset') setParticipants([]);
      else await refreshStatus();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="organizer-panel">
      <summary>Accès organisateur</summary>
      {!authorized ? (
        <form className="organizer-form" onSubmit={connect}>
          <label className="field">Code privé organisateur
            <input
              autoComplete="current-password"
              onChange={(event) => setCode(event.target.value)}
              placeholder="Code configuré dans Vercel"
              required
              type="password"
              value={code}
            />
          </label>
          <button className="button button-secondary" disabled={busy || !code} type="submit">
            {busy ? 'Vérification…' : 'Ouvrir le panneau'}
          </button>
        </form>
      ) : (
        <div className="organizer-controls">
          <div className="organizer-session-status">
            <span>ÉTAT</span>
            <strong>{session?.status === 'waiting' ? 'En attente' : session?.status === 'running' ? 'Quiz en cours' : 'Session terminée'}</strong>
            <span>PARTICIPANTS</span>
            <strong>{participants.length}</strong>
          </div>
          {participants.length > 0 && (
            <ul className="organizer-participants">
              {participants.map((participant) => <li key={participant.id}>{participant.username}</li>)}
            </ul>
          )}
          {session?.status === 'waiting' ? (
            <button className="button button-primary" disabled={busy || participants.length === 0} onClick={() => performAction('start')} type="button">
              Démarrer pour tout le monde <span>→</span>
            </button>
          ) : (
            <button className="button button-secondary" disabled={busy} onClick={() => performAction('reset')} type="button">
              {busy ? 'Préparation…' : 'Créer une nouvelle session'}
            </button>
          )}
          <button className="organizer-logout" onClick={() => { setAuthorized(false); setCode(''); setSession(null); }} type="button">Fermer le panneau</button>
        </div>
      )}
      {error && <p className="check-in-error" role="alert">{error}</p>}
    </details>
  );
}
