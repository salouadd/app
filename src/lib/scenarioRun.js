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

export function getCurrentRunTime(run) {
  return new Date(Date.now() + (run.serverTimeOffsetMs || 0)).toISOString();
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
  return {
    scenarioIds: scenarios.map((scenario) => scenario.id),
    scenarioId: scenarios[0].id,
    scenarioIndex: 0,
    stepId: scenarios[0].steps[0].id,
    scores: { security: 55, availability: 55, logic: 55 },
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
