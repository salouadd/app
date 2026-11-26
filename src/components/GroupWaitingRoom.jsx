import { useEffect, useState } from 'react';

export default function GroupWaitingRoom({ run, onComplete, onRetryResult }) {
  const [sessionStatus, setSessionStatus] = useState('running');
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const participant = run.participant;

  useEffect(() => {
    let active = true;
    let timer;

    async function checkSession() {
      try {
        const response = await fetch(`/api/session?sessionId=${encodeURIComponent(participant.sessionId)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Impossible de vérifier la fin de la session.');
        if (!active) return;
        if (body.session.id !== participant.sessionId) {
          setError('La session a été réinitialisée par l’organisateur. Contactez-le pour connaître la suite.');
          return;
        }
        setError('');
        setSessionStatus(body.session.status);
        if (body.session.status === 'completed') {
          onComplete();
          return;
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      }

      if (active) timer = window.setTimeout(checkSession, 2000);
    }

    checkSession();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [onComplete, participant.sessionId]);

  async function retryResult() {
    setRetrying(true);
    setError('');
    try {
      await onRetryResult(run);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="check-in-view">
      <section className="check-in-card group-waiting-card">
        <div className="eyebrow"><span className="eyebrow-mark">04</span> FIN DU PARCOURS</div>
        <h1>Votre test est <span>terminé.</span></h1>
        <p>{participant.username}, votre bilan apparaîtra lorsque tous les participants auront terminé.</p>
        <div className="waiting-message" role="status">
          <span className="live-dot" />
          <div>
            <strong>{sessionStatus === 'completed' ? 'Le groupe a terminé.' : 'Salle d’attente du groupe'}</strong>
            <p>Cette page se met à jour automatiquement. Vous pouvez la laisser ouverte.</p>
          </div>
        </div>
        {!run.resultSaved && (
          <div className="waiting-result-retry">
            <p>Votre résultat n’a pas encore été confirmé par le serveur.</p>
            <button className="button button-secondary" disabled={retrying} onClick={retryResult} type="button">
              {retrying ? 'Enregistrement…' : 'Réessayer l’enregistrement'}
            </button>
          </div>
        )}
        {error && <p className="check-in-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
