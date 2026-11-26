import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateAccuracyScore,
  getCurrentRunTime,
  getDecisionTransition,
  getCompletedMainQuestionCount,
  getRunProgressPercent,
  getTimerSeconds,
} from '../lib/scenarioRun.js';

const scoreLabels = [
  { key: 'progressPercent', label: 'Progression du parcours', short: 'DÉCISIONS PRINCIPALES', color: 'cyan' },
];

function ScoreMeter({ label, short, value, color, impact, footerText }) {
  const delta = impact === undefined ? null : impact;
  return (
    <div className="score-card">
      <div className="score-card-heading">
        <span className={`status-dot ${color}`} />
        <span className="score-label">{label}</span>
        <span className="score-value">{value}<small>%</small></span>
      </div>
      <div className="meter-track" aria-label={`${label} : ${value} %`}>
        <div className={`meter-fill ${color}`} style={{ width: `${value}%` }} />
      </div>
      <div className="score-card-footer">
        <span>{short}</span>
        {footerText || (delta !== null && <span className={delta >= 0 ? 'delta-positive' : 'delta-negative'}>{delta >= 0 ? '+' : ''}{delta}</span>)}
      </div>
    </div>
  );
}

export default function Simulator({ scenario, run, onProgress, onRunChange, onFinish, onExit }) {
  const [selectedId, setSelectedId] = useState(run.pendingOptionId ?? null);
  const [now, setNow] = useState(Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState('');
  const timeoutKey = useRef('');
  const timeoutHandle = useRef(null);
  const step = useMemo(() => scenario.steps.find((item) => item.id === run.stepId), [scenario, run.stepId]);
  const displayedOptions = useMemo(() => {
    const optionIds = run.optionOrders?.[step?.id];
    if (!optionIds) return step?.options ?? [];
    const optionsById = new Map(step.options.map((option) => [option.id, option]));
    return optionIds.map((id) => optionsById.get(id)).filter(Boolean);
  }, [run.optionOrders, step]);
  const timerSeconds = getTimerSeconds(scenario.difficulty);
  const progressPercent = getRunProgressPercent(run);
  const parsedStart = Date.parse(run.stepStartedAt || run.startedAt || '');
  const stepStartedAt = Number.isFinite(parsedStart) ? parsedStart : now;
  const synchronizedNow = now + (run.serverTimeOffsetMs || 0);
  const secondsRemaining = Math.max(0, Math.ceil((stepStartedAt + timerSeconds * 1000 - synchronizedNow) / 1000));

  async function persistProgress(progressRun) {
    if (!progressRun.participant || !onProgress) return;
    setProgressSaving(true);
    setProgressError('');
    try {
      await onProgress(progressRun);
    } catch (error) {
      setProgressError(error.message);
    } finally {
      setProgressSaving(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (timeoutHandle.current) window.clearTimeout(timeoutHandle.current);
  }, []);

  useEffect(() => {
    if (!step || secondsRemaining > 0 || selectedId || timedOut) return;
    const currentTimeoutKey = `${scenario.id}:${step.id}:${run.history.length}`;
    if (timeoutKey.current === currentTimeoutKey) return;
    timeoutKey.current = currentTimeoutKey;
    setTimedOut(true);

    const recommended = step.options.find((option) => option.recommended) ?? step.options[0];
    const transition = getDecisionTransition(scenario, step, recommended, run.recovery, false);
    const expiredRun = {
      ...run,
      history: [...run.history, {
        scenarioId: scenario.id,
        stepId: step.id,
        isRecovery: Boolean(step.recovery),
        optionId: null,
        recommendedOptionId: recommended.id,
        impact: { security: 0, availability: 0, logic: 0 },
        responseTimeMs: timerSeconds * 1000,
        recoveryAttempt: step.recovery ? transition.attempts : undefined,
        reflection: run.pendingReflection || '',
        consequence: 'Aucune réponse n’a été sélectionnée avant la fin du temps imparti.',
        bias: 'Question expirée : aucun choix n’a été enregistré.',
      }],
      pendingNext: transition.nextStepId,
      pendingRecovery: transition.recovery,
      pendingOptionId: null,
      pendingReflection: '',
    };
    onRunChange(expiredRun);
    timeoutHandle.current = window.setTimeout(async () => {
      timeoutHandle.current = null;
      await persistProgress(expiredRun);
      setTimedOut(false);
      if (transition.nextStepId) {
        onRunChange({
          ...expiredRun,
          stepId: transition.nextStepId,
          recovery: transition.recovery,
          stepStartedAt: getCurrentRunTime(expiredRun),
          pendingNext: null,
          pendingRecovery: null,
        });
      } else {
        onFinish(expiredRun);
      }
    }, 1200);
  }, [now, onFinish, onProgress, onRunChange, run, scenario, secondsRemaining, selectedId, step, timedOut, timerSeconds]);

  if (!step) {
    return (
      <section className="panel error-panel">
        <p>Cette étape n’existe plus dans le scénario chargé.</p>
        <button className="button button-secondary" onClick={onExit}>Revenir au catalogue</button>
      </section>
    );
  }

  const selectedOption = step.options.find((option) => option.id === selectedId);
  const pathPosition = run.history.filter((entry) => entry.scenarioId === scenario.id && !entry.isRecovery).length + 1;
  const recoverySourceStep = run.recovery?.lastStepId
    ? scenario.steps.find((item) => item.id === run.recovery.lastStepId)
    : null;
  const recoverySourceOption = recoverySourceStep?.options.find((item) => item.id === run.recovery?.lastOptionId);
  const briefingContext = step.recovery && run.recovery
    ? `${recoverySourceOption
      ? `Votre choix « ${recoverySourceOption.label} » a entraîné cette conséquence : ${recoverySourceOption.consequence}`
      : 'Aucune réponse n’a été donnée à la question précédente.'} ${step.context}`
    : step.context;
  const scoreGain = selectedOption && !step.recovery
    ? run.accuracyScore - Math.round(((run.correctAnswers - Number(selectedOption.recommended)) / run.totalQuestions) * 100)
    : 0;
  function chooseOption(option) {
    if (selectedId) return;
    setSelectedId(option.id);
    const transition = getDecisionTransition(scenario, step, option, run.recovery, true);
    const startedAtMs = Date.parse(run.stepStartedAt || run.startedAt || '');
    const historyEntry = {
      scenarioId: scenario.id,
      stepId: step.id,
      isRecovery: Boolean(step.recovery),
      optionId: option.id,
      recommendedOptionId: step.options.find((item) => item.recommended)?.id ?? step.options[0]?.id,
      impact: option.impact,
      responseTimeMs: Number.isFinite(startedAtMs) ? Math.max(0, synchronizedNow - startedAtMs) : 0,
      recoveryAttempt: step.recovery ? transition.attempts : undefined,
      reflection: run.pendingReflection || '',
      consequence: option.consequence,
      bias: option.bias,
    };
    const history = [...run.history, historyEntry];
    const scores = Object.fromEntries(
      Object.keys(run.scores).map((key) => [
        key,
        Math.max(0, Math.min(100, run.scores[key] + (option.impact[key] ?? 0))),
      ]),
    );
    const correctAnswers = run.correctAnswers + Number(!step.recovery && option.recommended);
    const updatedRun = {
      ...run,
      scores,
      accuracyScore: calculateAccuracyScore(history, run.totalQuestions),
      correctAnswers,
      history,
      pendingNext: transition.nextStepId,
      pendingRecovery: transition.recovery,
      pendingOptionId: option.id,
      pendingReflection: '',
    };
    onRunChange(updatedRun);
    void persistProgress(updatedRun);
  }

  function continueScenario() {
    if (!selectedOption) return;
    setSelectedId(null);
    setNow(Date.now());
    if (!run.pendingNext) {
      onFinish();
      return;
    }
    onRunChange({
      ...run,
      stepId: run.pendingNext,
      recovery: run.pendingRecovery,
      stepStartedAt: getCurrentRunTime(run),
      pendingNext: null,
      pendingRecovery: null,
      pendingOptionId: null,
      pendingReflection: '',
    });
  }

  return (
    <div className="simulator-view">
      <div className="simulator-topbar">
        <button className="back-link" onClick={onExit}>← Catalogue</button>
        <div className="session-indicator"><span className="live-dot" /> SESSION EN COURS</div>
        <span className="mono-muted">DL / SIM-{scenario.id.slice(0, 4).toUpperCase()}</span>
      </div>

      {run.scenarioIds?.length > 1 && (
        <div className="scenario-run-progress">
          SCÉNARIO {run.scenarioIndex + 1} / {run.scenarioIds.length} <span>·</span> {scenario.title}
        </div>
      )}

      <section className="score-grid" aria-label="Scores de la simulation">
        {scoreLabels.map((item) => (
          <ScoreMeter
            key={item.key}
            label={item.label}
            short={item.short}
            color={item.color}
            value={progressPercent}
            footerText={`${getCompletedMainQuestionCount(run.history)}/${run.totalQuestions} DÉCISIONS`}
          />
        ))}
      </section>

      <div className="step-progress">
        <span>ÉTAPE {String(pathPosition).padStart(2, '0')}</span>
        <div className="step-progress-track"><div style={{ width: `${Math.min(100, (pathPosition - 1) / (scenario.questionCount ?? scenario.steps.length) * 100)}%` }} /></div>
        <span>{scenario.domain.toUpperCase()}</span>
        <strong className={`timer-countdown ${secondsRemaining <= 10 ? 'timer-warning' : ''}`} aria-label={`${secondsRemaining} secondes restantes`}>
          00:{String(secondsRemaining).padStart(2, '0')}
        </strong>
      </div>

      <div className="simulation-layout">
        <main className="simulation-main">
          <section className="briefing-card">
            <div className="eyebrow"><span className="eyebrow-mark">01</span> BRIEFING OPÉRATIONNEL</div>
            {step.routeLabel && <div className="branch-route-note">{step.routeLabel}</div>}
            <h1>{step.title}</h1>
            <p className="briefing-context">{briefingContext}</p>
            {step.recovery && run.recovery && (
              <div className="recovery-attempt-note">
                QUESTION DE CORRECTION {run.recovery.attempts + 1}/{3} · UNE BONNE RÉPONSE VOUS RAMÈNE AU PARCOURS
              </div>
            )}
            <div className="alert-strip"><span className="alert-icon">!</span><div><span className="micro-label">ALERTE SYSTÈME</span><strong>{step.alert}</strong></div></div>
            <div className="constraint-line"><span className="constraint-icon">◷</span><span>{step.constraint}</span></div>
          </section>

          <label className="reflection-field">
            Votre réflexion (facultative, 500 caractères maximum)
            <textarea
              disabled={Boolean(selectedId) || timedOut}
              maxLength={500}
              onChange={(event) => onRunChange({ ...run, pendingReflection: event.target.value })}
              placeholder="Pourquoi choisissez-vous cette action ?"
              value={run.pendingReflection || ''}
            />
          </label>

          <section className="choice-section">
            <div className="section-heading">
              <div><span className="eyebrow-mark">02</span><h2>Quelle est votre décision ?</h2></div>
              <span className="choice-count">SÉLECTIONNER UNE ACTION</span>
            </div>
            <div className="choice-list">
              {displayedOptions.map((option, index) => {
                const isSelected = selectedId === option.id;
                const isDimmed = selectedId && !isSelected;
                return (
                  <button
                    className={`choice-card ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}
                    key={option.id}
                    onClick={() => chooseOption(option)}
                    disabled={Boolean(selectedId) || timedOut}
                  >
                    <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
                    <span className="choice-content"><strong>{option.label}</strong><small>{option.detail}</small></span>
                    <span className="choice-arrow">{isSelected ? '✓' : '↗'}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {timedOut && (
            <div className="timer-expired" aria-live="assertive">
              Temps écoulé — aucune réponse enregistrée. Passage à la question suivante…
            </div>
          )}

          {selectedOption && (
            <section className={`consequence-card ${selectedOption.recommended ? 'consequence-good' : 'consequence-caution'}`} aria-live="polite">
              <div className="consequence-heading">
                <span className="consequence-icon">{selectedOption.recommended ? '✓' : '!'}</span>
                <div><span className="micro-label">ANALYSE DE DÉCISION</span><h3>Conséquence immédiate</h3></div>
              </div>
              <p>{selectedOption.consequence}</p>
              <div className="bias-note"><span>↳</span>{selectedOption.bias}</div>
              <div className="consequence-footer">
                <div className="impact-list">
                  <span className={step.recovery ? 'impact-neutral' : scoreGain > 0 ? 'impact-up' : 'impact-neutral'}>
                    SCORE GLOBAL {scoreGain > 0 ? '+' : ''}{scoreGain}%
                  </span>
                </div>
                <button className="button button-primary" disabled={progressSaving} onClick={continueScenario}>
                  {progressSaving ? 'Enregistrement…' : step.recovery
                    ? selectedOption.recommended || run.recovery?.attempts + 1 >= 3 ? 'Reprendre le parcours' : 'Question de correction suivante'
                    : selectedOption.recommended ? run.pendingNext ? 'Étape suivante' : 'Voir mon bilan' : 'Analyser la conséquence'} <span>→</span>
                </button>
              </div>
            </section>
          )}

          {progressSaving && <small className="progress-save-status">Enregistrement de votre progression…</small>}
          {progressError && <p className="progress-save-error" role="alert">Progression non enregistrée : {progressError}</p>}
        </main>

        <aside className="simulation-aside">
          <div className="aside-panel">
            <span className="micro-label">MISSION ACTIVE</span>
            <h3>{scenario.title}</h3>
            <p>{scenario.objective}</p>
            <div className="aside-divider" />
            <div className="aside-stat"><span>DIFFICULTÉ</span><strong>{scenario.difficulty}</strong></div>
            <div className="aside-stat"><span>TEMPS PAR QUESTION</span><strong>{timerSeconds} s</strong></div>
            <div className="aside-stat"><span>DURÉE ESTIMÉE</span><strong>{scenario.duration}</strong></div>
            <div className="aside-stat"><span>DÉCISIONS PRISES</span><strong>{pathPosition - 1} / {scenario.questionCount ?? scenario.steps.length}</strong></div>
          </div>
          <div className="aside-tip"><span>◎</span><p><strong>Conseil de méthode</strong><br />Distinguez les faits confirmés des hypothèses, puis choisissez une mesure proportionnée et vérifiable.</p></div>
        </aside>
      </div>
    </div>
  );
}
