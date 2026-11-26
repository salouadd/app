import { useEffect, useState } from 'react';
import {
  formatElapsedTime,
  getDecisionProfile,
} from '../lib/scenarioRun.js';
import { rankCompletedParticipants } from '../lib/leaderboard.js';

const metricDetails = [
  { key: 'security', label: 'Sécurité / contrôle', color: 'cyan' },
  { key: 'availability', label: 'Disponibilité', color: 'emerald' },
  { key: 'logic', label: 'Rigueur logique', color: 'amber' },
];

function findCascadeDecision(scenarios, history) {
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  for (const entry of history) {
    const scenario = scenariosById.get(entry.scenarioId);
    const step = scenario?.steps.find((item) => item.id === entry.stepId);
    const chosen = step?.options.find((item) => item.id === entry.optionId);
    const recommended = step?.options.find((item) => item.recommended);
    if (!chosen || !recommended || chosen.next === recommended.next) continue;
    return {
      choice: chosen.label,
      nextStep: scenario.steps.find((item) => item.id === chosen.next),
      scenarioTitle: scenario.title,
    };
  }
  return null;
}

export default function ResultSummary({ scenarios, run, onReplay, onCatalog }) {
  const [report, setReport] = useState(run.aiReport || null);
  const [reportError, setReportError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportConsent, setReportConsent] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [ranking, setRanking] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(Boolean(run.participant?.sessionId));
  const [rankingError, setRankingError] = useState('');
  const [rankingRefresh, setRankingRefresh] = useState(0);
  const profile = getDecisionProfile(scenarios, run.history);
  const cascadeDecision = findCascadeDecision(scenarios, run.history);
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const username = run.participant?.username;
  const sessionId = run.participant?.sessionId;

  useEffect(() => {
    if (!sessionId) return undefined;
    let active = true;
    async function loadRanking() {
      setRankingLoading(true);
      setRankingError('');
      try {
        const response = await fetch(`/api/progress-summary?sessionId=${encodeURIComponent(sessionId)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Impossible de charger le classement final.');
        if (!Array.isArray(body.progress)) throw new Error('Le classement reçu est invalide.');
        if (active) setRanking(rankCompletedParticipants(body.progress));
      } catch (error) {
        if (active) setRankingError(error.message);
      } finally {
        if (active) setRankingLoading(false);
      }
    }
    loadRanking();
    return () => { active = false; };
  }, [rankingRefresh, sessionId]);

  async function generateReport() {
    if (!reportConsent || !run.participant?.checkInId || !run.participant?.sessionId) return;
    setReportLoading(true);
    setReportError('');
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          checkInId: run.participant.checkInId,
          sessionId: run.participant.sessionId,
          consent: reportConsent,
          scenarioIds: run.scenarioIds,
          history: run.history,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Impossible de générer le rapport.');
      setReport(body.report);
    } catch (error) {
      setReportError(error.message);
    } finally {
      setReportLoading(false);
    }
  }

  async function downloadPdf() {
    setPdfLoading(true);
    setPdfError('');
    try {
      const { downloadReportPdf } = await import('../lib/reportPdf.js');
      downloadReportPdf(report, run.accuracyScore);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Impossible de créer le rapport PDF.');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="results-view">
      <div className="results-topline"><span className="live-dot" /> SIMULATION TERMINÉE <span className="mono-muted">/ RAPPORT DE MISSION</span></div>
      <section className="results-hero">
        <div className="eyebrow"><span className="eyebrow-mark">03</span> BILAN ANALYTIQUE</div>
        <h1>Votre décision, <span>débriefée.</span></h1>
        <p>Score du parcours : <strong>{run.accuracyScore}%</strong> ({run.correctAnswers}/{run.totalQuestions} bonnes réponses) <span className="bullet-separator">·</span> {scenarios.length} scénarios{username && <> <span className="bullet-separator">·</span> Participant : {username}</>}</p>
        <div className="result-scenario-list">{scenarios.map((scenario) => <span key={scenario.id}>{scenario.title}</span>)}</div>
      </section>

      <section className="result-score-grid" aria-label="Scores finaux">
        {metricDetails.map((metric) => (
          <article className="result-metric panel" key={metric.key}>
            <div className="metric-topline"><span className={`status-dot ${metric.color}`} /><span>{metric.label}</span></div>
            <div className="metric-number">{run.scores[metric.key]}<small>%</small></div>
            <div className="meter-track"><div className={`meter-fill ${metric.color}`} style={{ width: `${run.scores[metric.key]}%` }} /></div>
          </article>
        ))}
      </section>

      <section className={`profile-card profile-${profile.tone}`}>
        <div className="profile-symbol">◈</div>
        <div className="profile-copy">
          <span className="micro-label">VOTRE TENDANCE DANS CETTE SIMULATION</span>
          <h2>{profile.title}</h2>
          <strong>{profile.subtitle}</strong>
          <p>Ce profil résume les compromis observés dans vos choix ; il décrit votre parcours, pas votre personnalité.</p>
          {profile.pace && <span className="profile-tempo">{profile.pace} · moyenne {formatElapsedTime(profile.averageResponseTime)}</span>}
        </div>
      </section>

      {sessionId && (
        <section className="organizer-results final-ranking-section" aria-live="polite">
          <div className="organizer-results-heading">
            <h2>Classement final du groupe</h2>
            <span>{ranking.length} participant(s)</span>
          </div>
          <p>Classement par score, puis par temps total. Les ex æquo partagent le même rang.</p>
          {rankingLoading && <p>Chargement du classement…</p>}
          {rankingError && (
            <div className="final-ranking-error" role="alert">
              <p>{rankingError}</p>
              <button className="button button-secondary" onClick={() => setRankingRefresh((current) => current + 1)} type="button">
                Réessayer
              </button>
            </div>
          )}
          {!rankingLoading && !rankingError && ranking.length > 0 && (
            <ol className="organizer-result-list final-ranking-list">
              {ranking.map((entry) => (
                <li key={entry.username}>
                  <div><strong>{entry.rank}. {entry.username}</strong><b>{entry.score}%</b></div>
                  <small>Temps total : {formatElapsedTime(entry.elapsedMs)}</small>
                </li>
              ))}
            </ol>
          )}
          {!rankingLoading && !rankingError && ranking.length === 0 && <p>Aucun résultat final n’est disponible pour cette session.</p>}
        </section>
      )}

      {cascadeDecision && (
        <section className="cascade-result-card">
          <span className="micro-label">CONSÉQUENCE EN CASCADE · {cascadeDecision.scenarioTitle}</span>
          <p>Votre choix « <strong>{cascadeDecision.choice}</strong> » a changé la suite du scénario : <strong>{cascadeDecision.nextStep?.title || 'fin du scénario'}</strong>.</p>
        </section>
      )}

      <section className="ai-report-section">
        <div className="section-heading">
          <div><span className="eyebrow-mark">04</span><h2>Votre rapport personnalisé</h2></div>
          <span className="choice-count">ANALYSE IA · GROQ</span>
        </div>
        {!report && (
          <div className="report-consent">
            <p>Le rapport analyse vos choix, leurs conséquences, votre rythme et les réflexions que vous avez écrites. Pour le générer, ces données sont envoyées à Groq, sans votre pseudo ni votre identifiant ; le rapport généré est conservé dans la base de l’application. N’écrivez aucune information personnelle ou sensible.</p>
            <label>
              <input checked={reportConsent} onChange={(event) => setReportConsent(event.target.checked)} type="checkbox" />
              J’accepte l’envoi de mes réponses et réflexions à Groq pour créer mon rapport.
            </label>
            <button className="button button-primary" disabled={!reportConsent || reportLoading} onClick={generateReport} type="button">
              {reportLoading ? 'Analyse de votre parcours…' : 'Générer mon rapport IA'} <span>→</span>
            </button>
            {reportError && <p className="report-error" role="alert">{reportError}</p>}
          </div>
        )}
        {report && (
          <div className="ai-report">
            <p className="ai-report-summary">{report.summary}</p>
            <div className="ai-report-columns">
              <section>
                <h3>Points forts</h3>
                {report.strengths.map((item, index) => <article key={`strength-${index}`}><strong>{item.title}</strong><p>{item.detail}</p></article>)}
              </section>
              <section>
                <h3>À améliorer</h3>
                {report.improvements.map((item, index) => <article key={`improvement-${index}`}><strong>{item.title}</strong><p>{item.detail}</p></article>)}
              </section>
            </div>
            <section className="ai-report-next">
              <h3>Prochaines étapes</h3>
              <ol>{report.nextSteps.map((item, index) => <li key={`next-${index}`}>{item}</li>)}</ol>
            </section>
            <button className="button button-primary" disabled={pdfLoading} onClick={downloadPdf} type="button">
              {pdfLoading ? 'Préparation du PDF…' : 'Télécharger le rapport PDF'} <span>↓</span>
            </button>
            {pdfError && <p className="report-error" role="alert">{pdfError}</p>}
          </div>
        )}
      </section>

      <section className="timeline-section">
        <div className="section-heading">
          <div><span className="eyebrow-mark">05</span><h2>Chronologie des décisions</h2></div>
          <span className="choice-count">VOTRE CHOIX / RECOMMANDATION</span>
        </div>
        <div className="timeline">
          {run.history.map((entry, index) => {
            const scenario = scenariosById.get(entry.scenarioId || run.scenarioId);
            const step = scenario?.steps.find((item) => item.id === entry.stepId);
            const chosen = entry.optionId ? step?.options.find((item) => item.id === entry.optionId) : null;
            const recommended = step?.options.find((item) => item.id === entry.recommendedOptionId);
            const matched = entry.optionId === entry.recommendedOptionId;
            if (!scenario || !step || !recommended) return null;
            return (
              <article className="timeline-item" key={`${scenario.id}-${entry.stepId}-${index}`}>
                <div className={`timeline-marker ${matched ? 'marker-good' : 'marker-review'}`}>{String(index + 1).padStart(2, '0')}</div>
                <div className="timeline-content">
                  <span className="micro-label">{scenario.title} · {step.title}</span>
                  <div className="decision-comparison">
                    <div className="decision-box"><span>VOTRE DÉCISION</span><strong>{chosen?.label || 'Aucune réponse (temps écoulé)'}</strong></div>
                    <div className={`decision-box ${matched ? 'recommended-match' : 'recommended-box'}`}><span>{matched ? '✓ RECOMMANDATION SUIVIE' : 'CHEMIN RECOMMANDÉ'}</span><strong>{recommended.label}</strong></div>
                  </div>
                  <p>{entry.consequence}</p>
                  <div className="bias-note timeline-bias"><span>↳</span>{entry.bias}</div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="results-actions">
        <button className="button button-secondary" onClick={onCatalog}>← Retour au catalogue</button>
        <button className="button button-primary" onClick={onReplay}>Rejouer les scénarios <span>↻</span></button>
      </div>
    </div>
  );
}
