import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultScenarios } from '../src/data/scenarios.js';
import { createOptionOrders, getTimerSeconds } from '../src/lib/scenarioRun.js';
import { validateRun } from '../lib/validateRun.js';

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
  assert.equal(validateRun(['nac-failover'], history, defaultScenarios).valid, false);
});

test('question timers match scenario difficulty', () => {
  assert.deepEqual(
    ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'].map(getTimerSeconds),
    [45, 40, 35, 30],
  );
});
