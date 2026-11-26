function getTotalQuestionCount(scenarios) {
  return scenarios.reduce((total, scenario) => total + (scenario.questionCount ?? scenario.steps.length), 0);
}

export function validateProgress(scenarioIds, history, scenarios) {
  const expectedScenarioIds = scenarios.map((scenario) => scenario.id);
  if (!Array.isArray(scenarioIds) ||
      scenarioIds.length !== expectedScenarioIds.length ||
      scenarioIds.some((id, index) => id !== expectedScenarioIds[index])) {
    return { valid: false, error: 'Le parcours ne contient pas les scénarios attendus.' };
  }
  const totalQuestions = getTotalQuestionCount(scenarios);
  if (!Array.isArray(history) || history.length > totalQuestions) {
    return { valid: false, error: 'L’historique de progression est incomplet ou trop long.' };
  }

  const scores = { security: 0, availability: 0, logic: 0 };
  let correctAnswers = 0;
  let historyIndex = 0;
  for (const scenario of scenarios) {
    let step = scenario.steps[0];
    while (step) {
      if (historyIndex >= history.length) {
        return {
          valid: true,
          scores,
          correctAnswers,
          accuracyScore: Math.round((correctAnswers / totalQuestions) * 100),
        };
      }

      const entry = history[historyIndex];
      if (entry?.scenarioId !== scenario.id || entry.stepId !== step.id) {
        return { valid: false, error: 'L’ordre des réponses ne correspond pas au parcours.' };
      }
      const selectedId = entry.optionId ?? entry.recommendedOptionId;
      const option = step.options.find((item) => item.id === selectedId);
      if (!option || (entry.optionId === null && !option.recommended)) {
        return { valid: false, error: 'Une réponse ne correspond pas aux choix proposés.' };
      }
      if (entry.optionId !== null) {
        if (option.recommended) correctAnswers += 1;
        for (const key of Object.keys(scores)) {
          scores[key] = Math.max(0, Math.min(100, scores[key] + (option.impact[key] ?? 0)));
        }
      }

      historyIndex += 1;
      step = option.next ? scenario.steps.find((item) => item.id === option.next) : null;
      if (option.next && !step) {
        return { valid: false, error: 'Le parcours contient une destination de réponse inconnue.' };
      }
    }
  }
  if (historyIndex !== history.length) {
    return { valid: false, error: 'L’historique contient des décisions après la fin du parcours.' };
  }
  return {
    valid: true,
    scores,
    correctAnswers,
    accuracyScore: Math.round((correctAnswers / totalQuestions) * 100),
  };
}

export function validateRun(scenarioIds, history, scenarios) {
  const verification = validateProgress(scenarioIds, history, scenarios);
  if (!verification.valid) return verification;
  const expectedDecisionCount = getTotalQuestionCount(scenarios);
  if (history.length !== expectedDecisionCount) {
    return { valid: false, error: 'Le parcours doit répondre à toutes les questions.' };
  }
  return verification;
}
