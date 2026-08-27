const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');

async function server() {
  process.env.MOCK_AI = 'true';
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mila-test-'));
  const app = createApp({ dataDir });
  const instance = app.listen(0, '127.0.0.1');
  await new Promise(resolve => instance.once('listening', resolve));
  const base = `http://127.0.0.1:${instance.address().port}`;
  return { app, base, db: app.locals.db, close: () => new Promise(resolve => instance.close(() => { app.locals.db.close(); fs.rmSync(dataDir, { recursive: true, force: true }); resolve(); })) };
}
async function json(base, url, options = {}) { const response = await fetch(base + url, { headers: { 'content-type': 'application/json' }, ...options }); return { response, body: await response.json() }; }
module.exports = { server, json };
