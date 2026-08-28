const test = require('node:test');
const assert = require('node:assert/strict');
const { lessons, normalizeAnswer, validateAnswer } = require('../src/lessons');

test('lesson catalogs contain the required deterministic content', () => {
  assert.ok(lessons.school.length >= 12);
  assert.ok(lessons.family.length >= 10);
  assert.ok(lessons.food.length >= 10);
  assert.ok(lessons.food.some(exercise => exercise.type === 'open'));
});

test('answer normalization handles case, punctuation, spacing and apostrophes', () => {
  assert.equal(normalizeAnswer('  IT’S A PENCIL!  '), "it's a pencil");
});

test('pencil identification accepts only explicit pencil variants', () => {
  const exercise = lessons.school[0];
  for (const answer of ['A pencil.', "It's a pencil.", 'PENCIL']) assert.equal(validateAnswer(exercise, answer).correct, true, answer);
  for (const answer of ['book', 'ruler', 'chair']) assert.equal(validateAnswer(exercise, answer).correct, false, answer);
});

test('Family choice and Food choice are deterministic while Food open is ungraded', () => {
  assert.equal(validateAnswer(lessons.family[0], "It's your mum.").correct, true);
  assert.equal(validateAnswer(lessons.family[0], "It's your grandma.").correct, false);
  assert.equal(validateAnswer(lessons.food[1], 'An apple.').correct, true);
  assert.equal(validateAnswer(lessons.food[1], 'A banana.').correct, false);
  assert.equal(validateAnswer(lessons.food[0], 'I like pizza.').correct, null);
});
