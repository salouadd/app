import { getDecisionTransition } from '../src/lib/scenarioRun.js';

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
  if (!Array.isArray(history) || history.length > 500) {
    return { valid: false, error: 'L’historique de progression est incomplet ou trop long.' };
  }

  const scores = { security: 0, availability: 0, logic: 0 };
  let correctAnswers = 0;
  let mainQuestionCount = 0;
  let historyIndex = 0;
  for (const scenario of scenarios) {
    let step = scenario.steps[0];
    let recovery = null;
    while (step) {
      if (historyIndex >= history.length) {
        return {
          valid: true,
          scores,
          correctAnswers,
          mainQuestionCount,
          accuracyScore: Math.round((correctAnswers / totalQuestions) * 100),
          complete: false,
        };
      }

      const entry = history[historyIndex];
      if (entry?.scenarioId !== scenario.id || entry.stepId !== step.id) {
        return { valid: false, error: 'L’ordre des réponses ne correspond pas au parcours.' };
      }
      if (step.recovery !== Boolean(entry.isRecovery)) {
        return { valid: false, error: 'Le type de question ne correspond pas au parcours.' };
      }
      if (step.recovery !== Boolean(recovery)) {
        return { valid: false, error: 'La question de correction n’a pas été déclenchée par le parcours.' };
      }
      if (entry.optionId !== null && typeof entry.optionId !== 'string') {
        return { valid: false, error: 'Une réponse ne correspond pas aux choix proposés.' };
      }
      const answered = typeof entry.optionId === 'string';
      const selectedId = answered ? entry.optionId : entry.recommendedOptionId;
      const option = step.options.find((item) => item.id === selectedId);
      if (!option || (!answered && !option.recommended)) {
        return { valid: false, error: 'Une réponse ne correspond pas aux choix proposés.' };
      }
      const transition = getDecisionTransition(scenario, step, option, recovery, answered);
      if (step.recovery && entry.recoveryAttempt !== transition.attempts) {
        return { valid: false, error: 'Le nombre de tentatives de correction est invalide.' };
      }
      if (!step.recovery) mainQuestionCount += 1;
      if (answered) {
        if (!step.recovery && option.recommended) correctAnswers += 1;
        for (const key of Object.keys(scores)) {
          scores[key] = Math.max(0, Math.min(100, scores[key] + (option.impact[key] ?? 0)));
        }
      }

      historyIndex += 1;
      recovery = transition.recovery;
      step = transition.nextStepId
        ? scenario.steps.find((item) => item.id === transition.nextStepId)
        : null;
      if (transition.nextStepId && !step) {
        return { valid: false, error: 'Le parcours contient une destination de réponse inconnue.' };
      }
    }
    if (recovery) {
      return { valid: false, error: 'Le parcours s’est terminé avant la fin de la correction.' };
    }
  }
  if (historyIndex !== history.length) {
    return { valid: false, error: 'L’historique contient des décisions après la fin du parcours.' };
  }
  return {
    valid: true,
    scores,
    correctAnswers,
    mainQuestionCount,
    accuracyScore: Math.round((correctAnswers / totalQuestions) * 100),
    complete: true,
  };
}

export function validateRun(scenarioIds, history, scenarios) {
  const verification = validateProgress(scenarioIds, history, scenarios);
  if (!verification.valid) return verification;
  const expectedDecisionCount = getTotalQuestionCount(scenarios);
  if (!verification.complete || verification.mainQuestionCount !== expectedDecisionCount) {
    return { valid: false, error: 'Le parcours doit répondre à toutes les questions.' };
  }
  return verification;
}
