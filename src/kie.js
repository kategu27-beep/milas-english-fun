const { systemPrompt, mockReply } = require('./prompts');

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
    const input = [{ role: 'system', content: [{ type: 'input_text', text: systemPrompt(topic) }] }, ...history.map(m => ({ role: m.role, content: [{ type: 'input_text', text: m.content }] }))];
    const response = await fetch('https://api.kie.ai/codex/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.KIE_MODEL || 'gpt-5-6-luna', stream: false, input, reasoning: { effort: 'low' } }), signal: controller.signal });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Kie HTTP ${response.status}`);
    const text = (response.headers.get('content-type') || '').includes('text/event-stream') ? parseSse(raw) : outputText(JSON.parse(raw));
    if (!text) throw new Error('Kie response has no output text');
    return normalize(text, mockReply(topic, turn).suggestions);
  } finally { clearTimeout(timer); }
}
module.exports = { reply, parseSse, outputText, normalize };
