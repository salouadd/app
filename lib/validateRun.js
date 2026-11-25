export function validateRun(scenarioIds, history, scenarios) {
  const expectedScenarioIds = scenarios.map((scenario) => scenario.id);
  if (!Array.isArray(scenarioIds) ||
      scenarioIds.length !== expectedScenarioIds.length ||
      scenarioIds.some((id, index) => id !== expectedScenarioIds[index])) {
    return { valid: false, error: 'Le parcours ne contient pas les scénarios attendus.' };
  }
  const expectedDecisionCount = scenarios.reduce((total, scenario) => total + scenario.steps.length, 0);
  if (!Array.isArray(history) || history.length !== expectedDecisionCount) {
    return { valid: false, error: 'Le parcours doit répondre à toutes les questions.' };
  }

  const scores = { security: 55, availability: 55, logic: 55 };
  let historyIndex = 0;
  for (const scenario of scenarios) {
    for (const step of scenario.steps) {
      const entry = history[historyIndex];
      historyIndex += 1;
      if (entry?.scenarioId !== scenario.id || entry.stepId !== step.id) {
        return { valid: false, error: 'L’ordre des réponses ne correspond pas au parcours.' };
      }
      if (entry.optionId === null) continue;

      const option = step.options.find((item) => item.id === entry.optionId);
      if (!option) return { valid: false, error: 'Une réponse ne correspond pas aux choix proposés.' };
      for (const key of Object.keys(scores)) {
        scores[key] = Math.max(0, Math.min(100, scores[key] + (option.impact[key] ?? 0)));
      }
    }
  }
  return { valid: true, scores };
}
