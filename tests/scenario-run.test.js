import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultScenarios } from '../src/data/scenarios.js';
import {
  createOptionOrders,
  createRun,
  getDecisionTransition,
  getDecisionProfile,
  getRecommendedTrajectory,
  getTimerSeconds,
  getTotalQuestionCount,
} from '../src/lib/scenarioRun.js';
import { validateProgress, validateRun } from '../lib/validateRun.js';

function createHistory(scenarios, chooseOption = (_scenario, step) => step.options.find((option) => option.recommended)) {
  return scenarios.flatMap((scenario) => {
    const history = [];
    let step = scenario.steps[0];
    let recovery = null;
    while (step) {
      const option = chooseOption(scenario, step);
      const transition = getDecisionTransition(scenario, step, option, recovery, true);
      history.push({
        scenarioId: scenario.id,
        stepId: step.id,
        isRecovery: Boolean(step.recovery),
        optionId: option.id,
        recommendedOptionId: step.options.find((item) => item.recommended).id,
        recoveryAttempt: step.recovery ? transition.attempts : undefined,
      });
      recovery = transition.recovery;
      step = transition.nextStepId
        ? scenario.steps.find((item) => item.id === transition.nextStepId)
        : null;
    }
    return history;
  });
}

test('the full shared run contains sixteen decision questions', () => {
  assert.equal(defaultScenarios.length, 4);
  assert.equal(getTotalQuestionCount(defaultScenarios), 16);
  assert.equal(createRun(defaultScenarios).totalQuestions, 16);
});

test('recommended choices are shuffled into a balanced position', () => {
  const orders = createOptionOrders(defaultScenarios);
  const steps = defaultScenarios.flatMap((scenario) => scenario.steps);
  const positions = steps.map((step) => {
    const recommended = step.options.find((option) => option.recommended);
    assert.ok(recommended, `${step.id} must have a recommended answer`);
    assert.deepEqual(new Set(orders[step.id]), new Set(step.options.map((option) => option.id)));
    return orders[step.id].indexOf(recommended.id);
  });

  for (let index = 0; index + 3 <= positions.length; index += 3) {
    assert.deepEqual([...positions.slice(index, index + 3)].sort(), [0, 1, 2]);
  }
  assert.deepEqual([...new Set(positions)].sort(), [0, 1, 2]);
});

test('four-choice questions use the D position in the balanced answer order', () => {
  const scenario = {
    id: 'four-choice',
    steps: Array.from({ length: 4 }, (_, index) => ({
      id: `four-choice-${index}`,
      options: Array.from({ length: 4 }, (_, optionIndex) => ({
        id: `choice-${index}-${optionIndex}`,
        recommended: optionIndex === 0,
      })),
    })),
  };
  const orders = createOptionOrders([scenario]);
  const positions = scenario.steps.map((step) => orders[step.id].indexOf(step.options[0].id));
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
});

test('server recomputes scores from the recorded answers', () => {
  const history = createHistory(defaultScenarios);
  const result = validateRun(defaultScenarios.map((scenario) => scenario.id), history, defaultScenarios);
  assert.equal(result.valid, true);
  assert.deepEqual(result.scores, { security: 100, availability: 100, logic: 100 });
  assert.equal(result.accuracyScore, 100);
  assert.equal(result.correctAnswers, 16);
  assert.equal(validateRun(['nac-failover'], history, defaultScenarios).valid, false);
});

test('the global score starts at zero and only correct answers raise it', () => {
  const run = createRun(defaultScenarios);
  assert.equal(run.accuracyScore, 0);
  assert.deepEqual(run.scores, { security: 0, availability: 0, logic: 0 });

  let answerIndex = 0;
  const history = createHistory(defaultScenarios, (scenario, step) => {
    const recommended = step.options.find((option) => option.recommended);
    const incorrect = step.options.find((option) => !option.recommended);
    answerIndex += 1;
    return answerIndex <= 8 ? recommended : incorrect;
  });
  const result = validateRun(defaultScenarios.map((scenario) => scenario.id), history, defaultScenarios);
  assert.equal(result.correctAnswers, 8);
  assert.equal(result.accuracyScore, 50);
});

test('every shared scenario has a validated recovery branch and keeps its main question count', () => {
  const history = createHistory(defaultScenarios, (scenario, step) => (
    step.id === scenario.steps[0].id
      ? step.options.find((option) => !option.recommended)
      : step.options.find((option) => option.recommended)
  ));
  const result = validateRun(defaultScenarios.map((scenario) => scenario.id), history, defaultScenarios);

  assert.equal(result.valid, true);
  for (const scenario of defaultScenarios) {
    const scenarioHistory = history.filter((entry) => entry.scenarioId === scenario.id);
    const firstStep = scenario.steps[0];
    const recommended = firstStep.options.find((option) => option.recommended);
    const alternative = firstStep.options.find((option) => !option.recommended);
    assert.notEqual(alternative.next, recommended.next, `${scenario.id} must branch after a non-recommended choice`);
    assert.equal(scenarioHistory[1].stepId, alternative.next);
    assert.equal(scenarioHistory.filter((entry) => !entry.isRecovery).length, scenario.questionCount);
    assert.equal(scenarioHistory[1].isRecovery, true);
  }

  const firstScenario = defaultScenarios[0];
  const invalidHistory = history.map((entry) => (
    entry.scenarioId === firstScenario.id && entry.stepId === history[1].stepId
      ? { ...entry, stepId: firstScenario.steps[1].id }
      : entry
  ));
  assert.equal(validateRun(defaultScenarios.map((scenario) => scenario.id), invalidHistory, defaultScenarios).valid, false);
});

test('different incorrect choices open distinct recovery questions in every scenario', () => {
  for (const scenario of defaultScenarios) {
    const incorrectOptions = scenario.steps
      .filter((step) => !step.recovery)
      .flatMap((step) => step.options.filter((option) => !option.recommended));
    const recoveryQuestions = incorrectOptions.map((option) =>
      scenario.steps.find((step) => step.id === option.recoveryStepId));

    assert.equal(new Set(recoveryQuestions.map((step) => step.id)).size, incorrectOptions.length);
    assert.equal(new Set(recoveryQuestions.map((step) => step.title)).size, incorrectOptions.length);
    assert.equal(new Set(recoveryQuestions.map((step) => step.options.map((option) => option.label).join('|'))).size, incorrectOptions.length);
    assert.ok(recoveryQuestions.every((step) => step.recovery));
    assert.ok(recoveryQuestions.every((step) => step.options.filter((option) => option.recommended).length === 1));
  }
});

test('recovery questions repeat up to three times without inflating the main decision score', () => {
  const history = createHistory(defaultScenarios, (scenario, step) => (
    step.recovery
      ? step.options.find((option) => !option.recommended)
      : scenario.id === defaultScenarios[0].id && step.id === scenario.steps[0].id
        ? step.options.find((option) => !option.recommended)
        : step.options.find((option) => option.recommended)
  ));
  const result = validateRun(defaultScenarios.map((scenario) => scenario.id), history, defaultScenarios);
  const recoveryAttempts = history.filter((entry) => entry.scenarioId === defaultScenarios[0].id && entry.isRecovery);

  assert.equal(result.valid, true);
  assert.equal(recoveryAttempts.length, 3);
  assert.equal(result.correctAnswers, 15);
});

test('a recovery after the final main decision rejoins the next scenario instead of itself', () => {
  const scenario = defaultScenarios[0];
  const finalMainStep = [...scenario.steps].reverse().find((step) => !step.recovery);
  const wrongOption = finalMainStep.options.find((option) => !option.recommended);
  const branch = getDecisionTransition(scenario, finalMainStep, wrongOption, null, true);
  const recoveryStep = scenario.steps.find((step) => step.id === branch.nextStepId);
  const correction = getDecisionTransition(
    scenario,
    recoveryStep,
    recoveryStep.options.find((option) => option.recommended),
    branch.recovery,
    true,
  );

  assert.equal(branch.nextStepId, wrongOption.recoveryStepId);
  assert.equal(correction.nextStepId, null);
  assert.equal(correction.recovery, null);
});

test('the debrief identifies decision tendencies and computes the recommended trajectory', () => {
  const history = createHistory(defaultScenarios, (scenario, step) => (
    step.id === 'survival-existing'
      ? step.options.find((option) => option.id === 'survival-open-all')
      : step.options.find((option) => option.recommended)
  ));
  const profile = getDecisionProfile(defaultScenarios, history);

  assert.equal(profile.title, 'Garant de continuité');
  assert.deepEqual(getRecommendedTrajectory(defaultScenarios), {
    security: 100,
    availability: 100,
    logic: 100,
  });
});

test('partial progress is validated and scored against the complete run', () => {
  const [scenario] = defaultScenarios;
  const [firstStep, secondStep] = scenario.steps;
  const firstRecommended = firstStep.options.find((option) => option.recommended);
  const secondWrong = secondStep.options.find((option) => !option.recommended);
  const result = validateProgress(
    defaultScenarios.map((item) => item.id),
    [
      { scenarioId: scenario.id, stepId: firstStep.id, optionId: firstRecommended.id },
      { scenarioId: scenario.id, stepId: secondStep.id, optionId: secondWrong.id },
    ],
    defaultScenarios,
  );
  assert.equal(result.valid, true);
  assert.equal(result.correctAnswers, 1);
  assert.equal(result.accuracyScore, 6);
});

test('a timed-out main question opens its recovery branch without awarding accuracy points', () => {
  const [scenario] = defaultScenarios;
  const firstStep = scenario.steps[0];
  const recommended = firstStep.options.find((option) => option.recommended);
  const branch = getDecisionTransition(scenario, firstStep, recommended, null, false);
  const recoveryStep = scenario.steps.find((step) => step.id === branch.nextStepId);
  const correction = getDecisionTransition(
    scenario,
    recoveryStep,
    recoveryStep.options.find((option) => option.recommended),
    branch.recovery,
    true,
  );
  const result = validateProgress(
    defaultScenarios.map((item) => item.id),
    [
      {
        scenarioId: scenario.id,
        stepId: firstStep.id,
        isRecovery: false,
        optionId: null,
        recommendedOptionId: recommended.id,
      },
      {
        scenarioId: scenario.id,
        stepId: recoveryStep.id,
        isRecovery: true,
        optionId: recoveryStep.options.find((option) => option.recommended).id,
        recommendedOptionId: recoveryStep.options.find((option) => option.recommended).id,
        recoveryAttempt: correction.attempts,
      },
    ],
    defaultScenarios,
  );

  assert.equal(result.valid, true);
  assert.equal(result.correctAnswers, 0);
  assert.equal(result.mainQuestionCount, 1);
  assert.equal(result.accuracyScore, 0);
});

test('question timers match scenario difficulty', () => {
  assert.deepEqual(
    ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'].map(getTimerSeconds),
    [45, 40, 35, 30],
  );
});
