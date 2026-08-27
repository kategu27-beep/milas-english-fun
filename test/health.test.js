const test = require('node:test'); const assert = require('node:assert/strict'); const { server, json } = require('./helpers');
test('GET /health returns ok', async t => { const s = await server(); t.after(s.close); const { response, body } = await json(s.base, '/health'); assert.equal(response.status, 200); assert.deepEqual(body, { status: 'ok' }); });
test('app trusts exactly one reverse proxy', async t => { const s = await server(); t.after(s.close); assert.equal(s.app.get('trust proxy'), 1); });
