export function validateProgress(scenarioIds, history, scenarios) {
  const expectedScenarioIds = scenarios.map((scenario) => scenario.id);
  if (!Array.isArray(scenarioIds) ||
      scenarioIds.length !== expectedScenarioIds.length ||
      scenarioIds.some((id, index) => id !== expectedScenarioIds[index])) {
    return { valid: false, error: 'Le parcours ne contient pas les scénarios attendus.' };
  }
  const expectedSteps = scenarios.flatMap((scenario) =>
    scenario.steps.map((step) => ({ scenarioId: scenario.id, step })));
  if (!Array.isArray(history) || history.length > expectedSteps.length) {
    return { valid: false, error: 'L’historique de progression est incomplet ou trop long.' };
  }

  const scores = { security: 0, availability: 0, logic: 0 };
  let correctAnswers = 0;
  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    const expected = expectedSteps[index];
    if (entry?.scenarioId !== expected.scenarioId || entry.stepId !== expected.step.id) {
      return { valid: false, error: 'L’ordre des réponses ne correspond pas au parcours.' };
    }
    if (entry.optionId === null) continue;

    const option = expected.step.options.find((item) => item.id === entry.optionId);
    if (!option) return { valid: false, error: 'Une réponse ne correspond pas aux choix proposés.' };
    if (option.recommended) correctAnswers += 1;
    for (const key of Object.keys(scores)) {
      scores[key] = Math.max(0, Math.min(100, scores[key] + (option.impact[key] ?? 0)));
    }
  }
  return {
    valid: true,
    scores,
    correctAnswers,
    accuracyScore: Math.round((correctAnswers / expectedSteps.length) * 100),
  };
}

export function validateRun(scenarioIds, history, scenarios) {
  const verification = validateProgress(scenarioIds, history, scenarios);
  if (!verification.valid) return verification;
  const expectedDecisionCount = scenarios.reduce((total, scenario) => total + scenario.steps.length, 0);
  if (history.length !== expectedDecisionCount) {
    return { valid: false, error: 'Le parcours doit répondre à toutes les questions.' };
  }
  return verification;
}
