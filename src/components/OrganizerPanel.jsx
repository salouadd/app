import { useEffect, useState } from 'react';
import { formatElapsedTime, rankLeaderboardEntries } from '../lib/scenarioRun.js';

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

export default function OrganizerPanel({ onAuthorizationChange }) {
  const [code, setCode] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    const body = await organizerRequest('status', code);
    setSession(body.session);
    setParticipants(body.participants);
    setError('');
  }

  async function refreshLeaderboard(sessionId, isActive = () => true) {
    const response = await fetch(`/api/leaderboard?sessionId=${encodeURIComponent(sessionId)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Impossible de charger les résultats.');
    if (isActive()) setLeaderboard(rankLeaderboardEntries(body.leaderboard));
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
        await refreshLeaderboard(body.session.id, () => active);
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    }
    poll();
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
      onAuthorizationChange(true);
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
      if (action === 'reset') {
        setParticipants([]);
        setLeaderboard([]);
      }
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
          <section className="organizer-results" aria-live="polite">
            <div className="organizer-results-heading">
              <h3>Classement actuel</h3>
              <span>{leaderboard.filter((entry) => entry.status === 'terminé').length}/{leaderboard.length} terminé(s)</span>
            </div>
            {leaderboard.length === 0
              ? <p>Le classement apparaîtra dès qu’un participant aura répondu à une question.</p>
              : (
                <ol className="organizer-result-list">
                  {leaderboard.map((entry) => (
                    <li key={entry.username}>
                      <div><strong>#{entry.rank} {entry.username}</strong><b>{entry.score}%</b></div>
                      <small>{entry.status} · Temps total {formatElapsedTime(entry.elapsedMs)}</small>
                    </li>
                  ))}
                </ol>
              )}
          </section>
          {session?.status === 'waiting' ? (
            <button className="button button-primary" disabled={busy || participants.length === 0} onClick={() => performAction('start')} type="button">
              Démarrer pour tout le monde <span>→</span>
            </button>
          ) : (
            <button className="button button-secondary" disabled={busy} onClick={() => performAction('reset')} type="button">
              {busy ? 'Préparation…' : 'Créer une nouvelle session'}
            </button>
          )}
          <button className="organizer-logout" onClick={() => { setAuthorized(false); setCode(''); setSession(null); setLeaderboard([]); onAuthorizationChange(false); }} type="button">Fermer le panneau</button>
        </div>
      )}
      {error && <p className="check-in-error" role="alert">{error}</p>}
    </details>
  );
}
