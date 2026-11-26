import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultScenarios } from '../src/data/scenarios.js';
import { compareLeaderboardEntries, createOptionOrders, createRun, getTimerSeconds, rankLeaderboardEntries } from '../src/lib/scenarioRun.js';
import { validateProgress, validateRun } from '../lib/validateRun.js';

test('the full shared run contains sixteen decision questions', () => {
  assert.equal(defaultScenarios.length, 4);
  assert.equal(defaultScenarios.reduce((total, scenario) => total + scenario.steps.length, 0), 16);
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
  const history = defaultScenarios.flatMap((scenario) => scenario.steps.map((step) => ({
    scenarioId: scenario.id,
    stepId: step.id,
    optionId: step.options.find((option) => option.recommended).id,
  })));
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
  const history = defaultScenarios.flatMap((scenario) => scenario.steps.map((step) => {
    const recommended = step.options.find((option) => option.recommended);
    const incorrect = step.options.find((option) => !option.recommended);
    answerIndex += 1;
    return {
      scenarioId: scenario.id,
      stepId: step.id,
      optionId: answerIndex <= 8 ? recommended.id : incorrect.id,
    };
  }));
  const result = validateRun(defaultScenarios.map((scenario) => scenario.id), history, defaultScenarios);
  assert.equal(result.correctAnswers, 8);
  assert.equal(result.accuracyScore, 50);
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

test('leaderboard uses total completion time to break score ties', () => {
  const entries = [
    { username: 'Lina', score: 75, elapsedMs: 120000, completedAt: '2026-01-01T10:00:00Z' },
    { username: 'Noah', score: 100, elapsedMs: 240000, completedAt: '2026-01-01T10:00:00Z' },
    { username: 'Maya', score: 75, elapsedMs: 90000, completedAt: '2026-01-01T10:00:00Z' },
    { username: 'Maya 2', score: 75, elapsedMs: 90000, completedAt: '2026-01-01T10:00:00Z' },
  ];
  const ranked = rankLeaderboardEntries(entries.sort(compareLeaderboardEntries));
  assert.deepEqual(ranked.map((entry) => entry.username), ['Noah', 'Maya', 'Maya 2', 'Lina']);
  assert.deepEqual(ranked.map((entry) => entry.rank), [1, 2, 2, 4]);
});

test('question timers match scenario difficulty', () => {
  assert.deepEqual(
    ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'].map(getTimerSeconds),
    [45, 40, 35, 30],
  );
});
