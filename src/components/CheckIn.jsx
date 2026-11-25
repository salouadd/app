import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import OrganizerPanel from './OrganizerPanel.jsx';

export default function CheckIn({ scenarioCount, questionCount, onRegister, onStart, onCancel }) {
  const [username, setUsername] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [participant, setParticipant] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('checkin', '1');
    QRCode.toDataURL(url.toString(), {
      width: 220,
      margin: 1,
      color: { dark: '#0b0f19', light: '#ffffff' },
    }).then((dataUrl) => {
      if (active) setQrCode(dataUrl);
    }).catch((qrError) => {
      console.error('Impossible de générer le QR code du check-in.', qrError);
      if (active) setError('Le QR code n’a pas pu être généré. Vérifiez que la dépendance QR est installée.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!participant) return undefined;
    let active = true;
    async function checkSession() {
      try {
        const response = await fetch('/api/session');
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Impossible de vérifier l’état du quiz.');
        if (!active) return;
        if (body.session.id !== participant.sessionId) {
          started.current = false;
          setParticipant(null);
          setError('L’organisateur a créé une nouvelle session. Scannez le QR code et inscrivez-vous de nouveau.');
          return;
        }
        if (body.session.status === 'running' && !started.current) {
          started.current = true;
          onStart(participant, body.session);
          return;
        }
        if (body.session.status === 'completed') {
          setError('Cette session est terminée. Attendez le nouveau QR code de l’organisateur.');
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    }
    checkSession();
    const timer = window.setInterval(checkSession, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [participant, onStart]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const registeredParticipant = await onRegister(username);
      setParticipant(registeredParticipant);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="check-in-view">
      <button className="back-link check-in-back" onClick={onCancel}>← Retour au catalogue</button>
      <div className="check-in-layout">
        <section className="check-in-card">
          <div className="eyebrow"><span className="eyebrow-mark">01</span> CHECK-IN PARTICIPANT</div>
          <h1>Rejoignez le <span>parcours.</span></h1>
          <p>Un seul check-in pour {scenarioCount} scénarios et {questionCount} décisions. L’organisateur donnera le départ à tous les participants présents.</p>
          {participant ? (
            <div className="waiting-message" role="status">
              <span className="live-dot" />
              <div><strong>{participant.username}, ton inscription est confirmée.</strong><p>En attente du départ de l’organisateur…</p><small>La page se lancera automatiquement quand le quiz sera ouvert.</small></div>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label className="field">Pseudo participant
                <input
                  autoComplete="nickname"
                  maxLength={24}
                  minLength={3}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Ex. Alex_01"
                  required
                  title="3 à 24 lettres, chiffres, points, tirets ou soulignés."
                  value={username}
                />
              </label>
              <small className="check-in-disclaimer">Le pseudo n’est pas vérifié : toute personne peut saisir le même nom. N’utilisez pas de données sensibles.</small>
              {error && <p className="check-in-error" role="alert">{error}</p>}
              <button className="button button-primary" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Inscription…' : 'Rejoindre la salle d’attente'} <span>→</span>
              </button>
            </form>
          )}
          {error && participant && <p className="check-in-error" role="alert">{error}</p>}
        </section>
        <aside className="qr-card">
          <span className="micro-label">SCANNER POUR REJOINDRE</span>
          {qrCode ? <img src={qrCode} alt="QR code pour ouvrir le check-in DecisionLab" /> : <div className="qr-placeholder">Génération du QR code…</div>}
          <p>Scannez avec le téléphone du participant, puis choisissez un pseudo.</p>
          <small>{window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'En local, les téléphones doivent utiliser l’adresse IP de l’ordinateur et le même Wi-Fi.'
            : 'Hébergé sur Vercel : le QR code est accessible depuis Internet.'}</small>
        </aside>
      </div>
      <OrganizerPanel />
    </main>
  );
}
