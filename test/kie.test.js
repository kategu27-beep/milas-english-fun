const test = require('node:test');
const assert = require('node:assert/strict');
const { outputText, parseSse, reply, requestPayload, sanitizeProviderBody } = require('../src/kie');

test('Kie request is minimal text-only Responses API input', () => {
  const oldModel = process.env.KIE_MODEL;
  delete process.env.KIE_MODEL;
  try {
    const payload = requestPayload('food', [{ role: 'user', content: 'I like pizza.' }]);
    assert.deepEqual(Object.keys(payload).sort(), ['input', 'model', 'reasoning', 'stream']);
    assert.equal(payload.model, 'gpt-5-5');
    assert.equal(payload.stream, false);
    assert.deepEqual(payload.reasoning, { effort: 'low' });
    assert.equal(payload.input.length, 1);
    assert.equal(payload.input[0].role, 'user');
    assert.equal(payload.input[0].content.length, 1);
    assert.equal(payload.input[0].content[0].type, 'input_text');
    assert.equal(typeof payload.input[0].content[0].text, 'string');
    assert.equal(payload.input.some(item => item.role === 'system'), false);
    assert.equal('tools' in payload, false);
  } finally {
    if (oldModel === undefined) delete process.env.KIE_MODEL; else process.env.KIE_MODEL = oldModel;
  }
});

test('malformed Mila JSON safely becomes plain text with local suggestions', () => {
  const { normalize } = require('../src/kie');
  const result = normalize('Great answer! Do you like fish?', ['Yes, I do.', "No, I don't."]);
  assert.equal(result.message, 'Great answer! Do you like fish?');
  assert.deepEqual(result.suggestions, ['Yes, I do.', "No, I don't."]);
});

test('Kie JSON and SSE response shapes extract final assistant text', () => {
  const response = { output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '{"message":"Great!","suggestions":[]}' }] }] };
  assert.equal(outputText(response), '{"message":"Great!","suggestions":[]}');
  const sse = `event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response })}\n\n`;
  assert.equal(parseSse(sse), '{"message":"Great!","suggestions":[]}');
});

test('provider diagnostics are short, single-line, and secret-redacted', () => {
  const oldKey = process.env.KIE_API_KEY;
  process.env.KIE_API_KEY = 'super-secret-value';
  try {
    const result = sanitizeProviderBody(`Internal error\nAuthorization: Bearer super-secret-value ${'x'.repeat(1200)}`);
    assert.equal(result.includes('super-secret-value'), false);
    assert.equal(result.includes('\n'), false);
    assert.ok(result.length <= 1000);
  } finally {
    if (oldKey === undefined) delete process.env.KIE_API_KEY; else process.env.KIE_API_KEY = oldKey;
  }
});

test('non-2xx Kie responses include sanitized provider diagnostics', async () => {
  const oldFetch = global.fetch;
  const oldKey = process.env.KIE_API_KEY;
  const oldMock = process.env.MOCK_AI;
  process.env.KIE_API_KEY = 'never-log-this-key';
  process.env.MOCK_AI = 'false';
  global.fetch = async () => new Response('{"error":"upstream failed","token":"never-log-this-key"}', { status: 500, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(
      reply({ topic: 'food', turn: 1, history: [{ role: 'user', content: 'I like pizza.' }] }),
      error => error.message.startsWith('HTTP error 500:') && error.message.includes('upstream failed') && !error.message.includes('never-log-this-key')
    );
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.KIE_API_KEY; else process.env.KIE_API_KEY = oldKey;
    if (oldMock === undefined) delete process.env.MOCK_AI; else process.env.MOCK_AI = oldMock;
  }
});
