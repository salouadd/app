const metricDetails = [
  { key: 'accuracyScore', label: 'Score global / bonnes réponses', color: 'cyan', description: 'Chaque bonne réponse augmente le score ; une erreur ne le diminue pas' },
  { key: 'security', label: 'Sécurité / contrôle', color: 'cyan', description: 'Maîtrise du risque et des accès' },
  { key: 'availability', label: 'Disponibilité / continuité', color: 'emerald', description: 'Maintien des services essentiels' },
  { key: 'logic', label: 'Rigueur logique', color: 'amber', description: 'Qualité du raisonnement et des preuves' },
];

function formatElapsedTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function getProfile(scores) {
  const { security, availability, logic } = scores;
  if (security >= 76 && availability >= 68 && logic >= 70) {
    return {
      title: 'Architecte résilient',
      subtitle: 'Équilibre sécurité / continuité',
      copy: 'Vous privilégiez des réponses ciblées, mesurables et réversibles. Vous conciliez le contrôle du risque avec la continuité des services.',
      tone: 'emerald',
    };
  }
  if (security >= 78 && availability < 58) {
    return {
      title: 'Tout-sécuritaire',
      subtitle: 'Risque de paralysie / fail-close',
      copy: 'Votre réflexe de protection est fort. Travaillez les mesures graduées et les critères de reprise pour limiter les interruptions évitables.',
      tone: 'amber',
    };
  }
  if (availability >= 75 && security < 58) {
    return {
      title: 'Pragmatique risqué',
      subtitle: 'Tendance au fail-open',
      copy: 'Vous rétablissez vite les services, parfois au détriment du contrôle. Borner les exceptions et vérifier la posture renforcera vos arbitrages.',
      tone: 'alert',
    };
  }
  if (logic >= 78 && Math.abs(security - availability) < 20) {
    return {
      title: 'Analyste méthodique',
      subtitle: 'Décisions guidées par les faits',
      copy: 'Vous gardez les signaux en perspective et formulez des décisions cohérentes. Continuez à expliciter les critères qui déclenchent une escalade.',
      tone: 'cyan',
    };
  }
  return {
    title: 'Décideur en progression',
    subtitle: 'Un arbitrage à consolider',
    copy: 'Vous avez exploré plusieurs compromis. Le bilan met en lumière les axes à renforcer avant de prendre une décision opérationnelle sous pression.',
    tone: 'amber',
  };
}

export default function ResultSummary({ scenarios, run, leaderboard, onReplay, onCatalog }) {
  const profile = getProfile(run.scores);
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const username = run.participant?.username;
  const rankedLeaderboard = [];
  leaderboard.forEach((entry, index) => {
    const previous = rankedLeaderboard[index - 1];
    const sameResult = previous &&
      previous.score === entry.score &&
      previous.elapsedMs === entry.elapsedMs;
    rankedLeaderboard.push({ ...entry, rank: sameResult ? previous.rank : index + 1 });
  });
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
            <div className="metric-number">{metric.key === 'accuracyScore' ? run.accuracyScore : run.scores[metric.key]}<small>%</small></div>
            <div className="meter-track"><div className={`meter-fill ${metric.color}`} style={{ width: `${metric.key === 'accuracyScore' ? run.accuracyScore : run.scores[metric.key]}%` }} /></div>
            <span className="metric-description">{metric.description}</span>
          </article>
        ))}
      </section>

      <section className={`profile-card profile-${profile.tone}`}>
        <div className="profile-symbol">◈</div>
        <div className="profile-copy">
          <span className="micro-label">VOTRE PROFIL DÉCISIONNEL</span>
          <h2>{profile.title}</h2>
          <strong>{profile.subtitle}</strong>
          <p>{profile.copy}</p>
        </div>
        <div className="profile-score"><span>LOGIQUE</span><strong>{run.scores.logic}<small>%</small></strong></div>
      </section>

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
