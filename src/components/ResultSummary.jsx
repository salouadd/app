import {
  formatElapsedTime,
  getDecisionProfile,
  getRecommendedTrajectory,
  rankLeaderboardEntries,
} from '../lib/scenarioRun.js';

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

export default function ResultSummary({ scenarios, run, leaderboard, onReplay, onCatalog }) {
  const profile = getDecisionProfile(scenarios, run.history);
  const recommendedScores = getRecommendedTrajectory(scenarios);
  const cascadeDecision = findCascadeDecision(scenarios, run.history);
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const username = run.participant?.username;
  const rankedLeaderboard = rankLeaderboardEntries(leaderboard);
  const participantEntry = username
    ? rankedLeaderboard.find((entry) => entry.username.toLocaleLowerCase() === username.toLocaleLowerCase())
    : null;
  const participantRank = participantEntry?.rank || 0;
  const podium = rankedLeaderboard.filter((entry) => entry.rank <= 3);

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
            <div className="metric-number">{run.accuracyScore}<small>%</small></div>
            <div className="meter-track"><div className={`meter-fill ${metric.color}`} style={{ width: `${run.accuracyScore}%` }} /></div>
            <span className="metric-description">{metric.description}</span>
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

      <section className="trajectory-section">
        <div className="section-heading">
          <div><span className="eyebrow-mark">04</span><h2>Votre trajectoire et le parcours conseillé</h2></div>
          <span className="choice-count">INDICATEURS FINAUX</span>
        </div>
        <div className="trajectory-grid">
          {metricDetails.map((metric) => (
            <article className="trajectory-metric" key={metric.key}>
              <div><span>{metric.label}</span><strong>{run.scores[metric.key]} / {recommendedScores[metric.key]}</strong></div>
              <div className="trajectory-bars" aria-label={`${metric.label} : votre parcours ${run.scores[metric.key]}, parcours conseillé ${recommendedScores[metric.key]}`}>
                <span className={`trajectory-bar ${metric.color}`} style={{ width: `${run.scores[metric.key]}%` }} />
                <span className="trajectory-reference" style={{ left: `${recommendedScores[metric.key]}%` }} />
              </div>
              <small>Votre parcours / conseillé</small>
            </article>
          ))}
        </div>
        <p className="trajectory-note">La référence suit les réponses recommandées, y compris les embranchements qu’elles ouvrent.</p>
      </section>

      {cascadeDecision && (
        <section className="cascade-result-card">
          <span className="micro-label">CONSÉQUENCE EN CASCADE · {cascadeDecision.scenarioTitle}</span>
          <p>Votre choix « <strong>{cascadeDecision.choice}</strong> » a changé la suite du scénario : <strong>{cascadeDecision.nextStep?.title || 'fin du scénario'}</strong>.</p>
        </section>
      )}

      {username && (
        <section className="leaderboard-section">
          <div className="section-heading">
            <div><span className="eyebrow-mark">04</span><h2>Podium des participants</h2></div>
            <span className="choice-count">SCORE, PUIS TEMPS TOTAL</span>
          </div>
          {participantRank > 0 && <p className="leaderboard-rank">Votre rang : <strong>#{participantRank}</strong>. En cas d’égalité de score, le temps total le plus court passe devant.</p>}
          {podium.length === 0
            ? <p className="leaderboard-empty">Le classement apparaîtra après le premier parcours terminé.</p>
            : (
              <>
                <div className="podium-grid">
                  {podium.map((entry) => (
                    <article className={`podium-card podium-place-${Math.min(entry.rank, 3)}`} key={entry.username}>
                      <span className="podium-medal">{entry.rank === 1 ? '1er' : `${entry.rank}e`}</span>
                      <strong>{entry.username}</strong>
                      <span>{entry.score}%</span>
                      <small className="podium-time">{formatElapsedTime(entry.elapsedMs)}</small>
                    </article>
                  ))}
                </div>
                <ol className="leaderboard-list">
                  {rankedLeaderboard.map((entry) => (
                    <li className={entry.username.toLocaleLowerCase() === username.toLocaleLowerCase() ? 'leaderboard-self' : ''} key={entry.username}>
                      <span>{String(entry.rank).padStart(2, '0')}</span>
                      <strong>{entry.username}</strong>
                      <small>{entry.decisionCount} décisions · Temps {formatElapsedTime(entry.elapsedMs)}</small>
                      <b>{entry.score}%</b>
                    </li>
                  ))}
                </ol>
              </>
            )}
          <small className="leaderboard-disclaimer">Les pseudos et les réponses sont déclaratifs : ce podium ne vérifie pas l’identité et n’est pas un classement inviolable.</small>
        </section>
      )}

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
