const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { server, json } = require('./helpers');

const startSession = (base, userId, topic) => json(base, '/api/session/start', { method: 'POST', body: JSON.stringify({ userId, topic }) });
const chat = (base, userId, sessionId, message) => json(base, '/api/chat', { method: 'POST', body: JSON.stringify({ userId, sessionId, message }) });

test('all topics start in friendly chat and invalid input is rejected', async t => {
  const s = await server(); t.after(s.close);
  for (const topic of ['school', 'family', 'food']) {
    const { response, body } = await startSession(s.base, crypto.randomUUID(), topic);
    assert.equal(response.status, 201); assert.equal(body.topic, topic); assert.equal(body.progress, 0); assert.ok(body.message.startsWith('Hi!'));
  }
  assert.equal((await startSession(s.base, crypto.randomUUID(), 'animals')).response.status, 400);
  assert.equal((await json(s.base, '/api/session/start', { method: 'POST', body: JSON.stringify({ topic: 'food' }) })).response.status, 400);
});

test('session rhythm contains chat, two exercises, and a reward around turn six', async t => {
  const s = await server(); t.after(s.close); const userId = crypto.randomUUID(); const started = await startSession(s.base, userId, 'school'); const id = started.body.sessionId;
  const firstChat = await chat(s.base, userId, id, 'School was fun.'); assert.equal(firstChat.body.mode, 'chat'); assert.equal(firstChat.body.correct, null);
  const secondChat = await chat(s.base, userId, id, 'My favourite subject is English.'); assert.equal(secondChat.body.mode, 'chat'); assert.match(secondChat.body.message, /What is this\? ✏️/);
  const firstExercise = await chat(s.base, userId, id, 'A pencil.'); assert.equal(firstExercise.body.mode, 'exercise'); assert.equal(firstExercise.body.correct, true);
  await chat(s.base, userId, id, 'Yes, I use it.');
  const nextChat = await chat(s.base, userId, id, 'My school bag is blue.'); assert.match(nextChat.body.message, /What is this\? 📘/);
  const completed = await chat(s.base, userId, id, 'A book.'); assert.equal(completed.body.complete, true); assert.equal(completed.body.sticker.name, 'Pencil');
});

test('wrong exercise answer is corrected and a correct retry returns to chat', async t => {
  const s = await server(); t.after(s.close); const userId = crypto.randomUUID(); const started = await startSession(s.base, userId, 'school');
  await chat(s.base, userId, started.body.sessionId, 'Hello Mila!'); await chat(s.base, userId, started.body.sessionId, 'School is fun.');
  const wrong = await chat(s.base, userId, started.body.sessionId, 'A book.');
  assert.equal(wrong.body.mode, 'exercise'); assert.equal(wrong.body.correct, false); assert.equal(wrong.body.exerciseType, 'repeat'); assert.equal(/yes, it is a book|great job/i.test(wrong.body.message), false); assert.match(wrong.body.message, /pencil/i);
  const retry = await chat(s.base, userId, started.body.sessionId, "It's a pencil."); assert.equal(retry.body.correct, true); assert.match(retry.body.message, /Do you use it at school/i);
});

test('a conversational question during the pen exercise is not marked wrong and the exercise returns later', async t => {
  const s = await server(); t.after(s.close); const userId = crypto.randomUUID(); const started = await startSession(s.base, userId, 'school');
  s.db.prepare('UPDATE sessions SET awaiting_exercise=1, current_exercise=3 WHERE id=?').run(started.body.sessionId);
  const question = await chat(s.base, userId, started.body.sessionId, 'What is your favourite subject?');
  assert.equal(question.body.mode, 'chat'); assert.equal(question.body.correct, null); assert.equal(/pen\.|almost/i.test(question.body.message), false); assert.match(question.body.message, /English/i);
  const deferred = s.db.prepare('SELECT awaiting_exercise, exercise_pending, current_exercise FROM sessions WHERE id=?').get(started.body.sessionId);
  assert.deepEqual(deferred, { awaiting_exercise: 0, exercise_pending: 1, current_exercise: 3 });
  const naturalReply = await chat(s.base, userId, started.body.sessionId, 'My favourite subject is Art.');
  assert.equal(naturalReply.body.mode, 'chat'); assert.match(naturalReply.body.message, /What is this\? 🖊️/);
  const state = s.db.prepare('SELECT awaiting_exercise, current_exercise FROM sessions WHERE id=?').get(started.body.sessionId);
  assert.deepEqual(state, { awaiting_exercise: 1, current_exercise: 3 });
  const answer = await chat(s.base, userId, started.body.sessionId, 'A pen.'); assert.equal(answer.body.mode, 'exercise'); assert.equal(answer.body.correct, true);
});

test('normal questions and open food comments stay conversational', async t => {
  const s = await server(); t.after(s.close); const userId = crypto.randomUUID(); const started = await startSession(s.base, userId, 'food');
  const response = await chat(s.base, userId, started.body.sessionId, 'Do you like pizza?');
  assert.equal(response.body.mode, 'chat'); assert.equal(response.body.correct, null); assert.match(response.body.message, /Yes, I do/i);
});
