const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { server, json } = require('./helpers');

async function completeSchool(base, userId) {
  const start = await json(base, '/api/session/start', { method: 'POST', body: JSON.stringify({ userId, topic: 'school' }) });
  const messages = ['School was good.', 'I like English.', 'A pencil.', 'I use it.', 'My bag is blue.', 'A book.'];
  let result;
  for (const message of messages) result = await json(base, '/api/chat', { method: 'POST', body: JSON.stringify({ userId, sessionId: start.body.sessionId, message }) });
  return result.body;
}

test('completion unlocks distinct stickers before duplicates', async t => {
  const s = await server(); t.after(s.close); const userId = crypto.randomUUID();
  const first = await completeSchool(s.base, userId); const second = await completeSchool(s.base, userId);
  assert.equal(first.complete, true); assert.equal(second.complete, true); assert.notEqual(first.sticker.id, second.sticker.id);
  const album = await json(s.base, `/api/stickers?userId=${userId}`);
  assert.equal(album.body.stickers.length, 18); assert.equal(album.body.stickers.filter(sticker => sticker.unlocked).length, 2);
});
