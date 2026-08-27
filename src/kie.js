const { systemPrompt, mockReply } = require('./prompts');
const KIE_ENDPOINT = 'https://api.kie.ai/codex/v1/responses';
const MAX_PROVIDER_ERROR_LENGTH = 1000;

function outputText(value) {
  if (!value) return '';
  if (typeof value.output_text === 'string') return value.output_text;
  for (const item of value.output || []) for (const part of item.content || []) if (part.type === 'output_text' && part.text) return part.text;
  return '';
}

function parseSse(raw) {
  let final = '';
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter(line => line.startsWith('data:'));
    for (const line of lines) {
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (event.type === 'response.output_text.delta') final += event.delta || '';
        const extracted = outputText(event.response || event);
        if (extracted) final = extracted;
      } catch { /* Ignore malformed provider frames. */ }
    }
  }
  return final;
}

function sanitizeProviderBody(raw) {
  let clean = String(raw || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,"'}]+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token)\s*[:=]\s*["']?)[^\s,"'}]+/gi, '$1[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  const configuredKey = process.env.KIE_API_KEY;
  if (configuredKey) clean = clean.split(configuredKey).join('[REDACTED]');
  if (!clean) return '<empty response body>';
  return clean.slice(0, MAX_PROVIDER_ERROR_LENGTH);
}

function requestPayload(topic, history) {
  return {
    model: process.env.KIE_MODEL || 'gpt-5-6-luna',
    stream: false,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: systemPrompt(topic) }] },
      ...history.map(message => ({ role: message.role, content: [{ type: 'input_text', text: message.content }] }))
    ],
    reasoning: { effort: 'low' }
  };
}

function normalize(text, defaults) {
  const clean = String(text || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    const parsed = JSON.parse(clean);
    if (typeof parsed.message !== 'string' || !parsed.message.trim()) throw new Error('missing message');
    return { message: parsed.message.trim().slice(0, 500), suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(x => typeof x === 'string' && x.trim()).slice(0, 3).map(x => x.trim().slice(0, 80)) : defaults };
  } catch {
    return { message: clean.slice(0, 500) || "Oops! My notebook needs a tiny break. 📚\nPlease try again in a moment!", suggestions: defaults };
  }
}

async function reply({ topic, turn, history }) {
  if (process.env.MOCK_AI === 'true') return mockReply(topic, turn);
  if (!process.env.KIE_API_KEY) throw new Error('KIE_API_KEY is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(KIE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload(topic, history)),
      signal: controller.signal
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`HTTP error ${response.status}: ${sanitizeProviderBody(raw)}`);
    const text = (response.headers.get('content-type') || '').includes('text/event-stream') ? parseSse(raw) : outputText(JSON.parse(raw));
    if (!text) throw new Error('Kie response has no output text');
    return normalize(text, mockReply(topic, turn).suggestions);
  } finally { clearTimeout(timer); }
}
module.exports = { reply, parseSse, outputText, normalize, requestPayload, sanitizeProviderBody };
