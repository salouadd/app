function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

const timerSecondsByDifficulty = {
  Débutant: 45,
  Intermédiaire: 40,
  Avancé: 35,
  Expert: 30,
};

export function getTimerSeconds(difficulty) {
  return timerSecondsByDifficulty[difficulty] ?? 40;
}

export function getScenarioQuestionCount(scenario) {
  return scenario.questionCount ?? scenario.steps.length;
}

export function getTotalQuestionCount(scenarios) {
  return scenarios.reduce((total, scenario) => total + getScenarioQuestionCount(scenario), 0);
}

export function getRecommendedTrajectory(scenarios) {
  const scores = { security: 0, availability: 0, logic: 0 };
  for (const scenario of scenarios) {
    let step = scenario.steps[0];
    while (step) {
      const option = step.options.find((item) => item.recommended);
      if (!option) break;
      for (const key of Object.keys(scores)) {
        scores[key] = Math.max(0, Math.min(100, scores[key] + (option.impact[key] ?? 0)));
      }
      step = option.next ? scenario.steps.find((item) => item.id === option.next) : null;
    }
  }
  return scores;
}

export function getDecisionProfile(scenarios, history) {
  const scores = { security: 0, availability: 0, logic: 0 };
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const responseTimes = [];

  for (const entry of history) {
    if (!entry.optionId) continue;
    const scenario = scenariosById.get(entry.scenarioId);
    const step = scenario?.steps.find((item) => item.id === entry.stepId);
    const option = step?.options.find((item) => item.id === entry.optionId);
    const recommended = step?.options.find((item) => item.recommended);
    if (!option || !recommended) continue;

    for (const key of Object.keys(scores)) {
      scores[key] += (option.impact[key] ?? 0) - (recommended.impact[key] ?? 0);
    }
    if (Number.isFinite(entry.responseTimeMs)) responseTimes.push(entry.responseTimeMs);
  }

  const dimensions = [
    { key: 'security', title: 'Sentinelle', subtitle: 'Tendance à privilégier la maîtrise du risque.', tone: 'cyan' },
    { key: 'availability', title: 'Garant de continuité', subtitle: 'Tendance à préserver les services et leur disponibilité.', tone: 'emerald' },
    { key: 'logic', title: 'Analyste méthodique', subtitle: 'Tendance à privilégier la vérification et la cohérence.', tone: 'amber' },
  ];
  const dominant = [...dimensions].sort((first, second) => scores[second.key] - scores[first.key])[0];
  const profile = Math.max(...Object.values(scores)) - Math.min(...Object.values(scores)) < 6
    ? { title: 'Arbitre équilibré', subtitle: 'Vos choix conseillés ou leurs compromis restent équilibrés.', tone: 'emerald' }
    : dominant;
  const averageResponseTime = responseTimes.length
    ? responseTimes.reduce((total, time) => total + time, 0) / responseTimes.length
    : null;
  const pace = averageResponseTime === null
    ? null
    : averageResponseTime < 12000
      ? 'Décisions rapides'
      : averageResponseTime > 24000
        ? 'Décisions réfléchies'
        : 'Tempo mesuré';

  return { ...profile, pace, averageResponseTime };
}

export function getCurrentRunTime(run) {
  return new Date(Date.now() + (run.serverTimeOffsetMs || 0)).toISOString();
}

export function calculateAccuracyScore(history, totalQuestions) {
  if (!totalQuestions) return 0;
  const correctAnswers = history.filter((entry) =>
    entry.optionId && entry.optionId === entry.recommendedOptionId).length;
  return Math.round((correctAnswers / totalQuestions) * 100);
}

export function compareLeaderboardEntries(first, second) {
  return second.score - first.score ||
    first.elapsedMs - second.elapsedMs ||
    Date.parse(first.completedAt) - Date.parse(second.completedAt);
}

export function rankLeaderboardEntries(entries) {
  const rankedEntries = [];
  entries.forEach((entry, index) => {
    const previous = rankedEntries[index - 1];
    const isTied = previous &&
      previous.score === entry.score &&
      previous.elapsedMs === entry.elapsedMs;
    rankedEntries.push({ ...entry, rank: isTied ? previous.rank : index + 1 });
  });
  return rankedEntries;
}

export function formatElapsedTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export function createOptionOrders(scenarios) {
  const positionCycles = new Map();
  return Object.fromEntries(scenarios.flatMap((scenario) => scenario.steps.map((step) => {
    const recommended = step.options.find((option) => option.recommended);
    if (!recommended) return [step.id, step.options.map((option) => option.id)];

    const count = step.options.length;
    let cycle = positionCycles.get(count);
    if (!cycle || cycle.index >= cycle.positions.length) {
      cycle = { positions: shuffle(Array.from({ length: count }, (_, index) => index)), index: 0 };
      positionCycles.set(count, cycle);
    }
    const recommendedPosition = cycle.positions[cycle.index];
    cycle.index += 1;
    const distractors = shuffle(step.options.filter((option) => option.id !== recommended.id));
    distractors.splice(recommendedPosition, 0, recommended);
    return [step.id, distractors.map((option) => option.id)];
  })));
}

export function createRun(scenarios, participant = null, startedAt = new Date().toISOString(), serverTimeOffsetMs = 0) {
  const totalQuestions = getTotalQuestionCount(scenarios);
  return {
    scenarioIds: scenarios.map((scenario) => scenario.id),
    scenarioId: scenarios[0].id,
    scenarioIndex: 0,
    stepId: scenarios[0].steps[0].id,
    scores: { security: 0, availability: 0, logic: 0 },
    accuracyScore: 0,
    correctAnswers: 0,
    totalQuestions,
    history: [],
    pendingNext: null,
    pendingOptionId: null,
    optionOrders: createOptionOrders(scenarios),
    participant,
    startedAt,
    stepStartedAt: startedAt,
    serverTimeOffsetMs,
  };
}
