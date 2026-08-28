// Manual provider check. This file is intentionally excluded from `node --test` discovery.
require('dotenv').config();
const { outputText, parseSse, plainTextPayload } = require('../src/kie');

const endpoint = 'https://api.kie.ai/codex/v1/responses';

async function main() {
  if (!process.env.KIE_API_KEY) {
    console.error('KIE_API_KEY is not configured. Add it to your local .env file.');
    process.exitCode = 1;
    return;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(plainTextPayload('Say hello in one short sentence.'))
  });

  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let assistantText = '';
  try {
    assistantText = contentType.includes('text/event-stream') ? parseSse(raw) : outputText(JSON.parse(raw));
  } catch { /* The status still provides a safe manual diagnostic. */ }

  console.log(`HTTP status: ${response.status}`);
  console.log(`Assistant text: ${assistantText || '<no assistant text>'}`);
  if (!response.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(`Kie test failed: ${error.message}`);
  process.exitCode = 1;
});
