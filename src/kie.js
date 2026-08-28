const { topics, mockReply } = require('./prompts');
const KIE_ENDPOINT = 'https://api.kie.ai/codex/v1/responses';
const MAX_PROVIDER_ERROR_LENGTH = 1000;

function outputText(value) {
  if (!value) return '';
  const messageItem = value.output?.find(item => item.type === 'message');
  const textItem = messageItem?.content?.find(item => item.type === 'output_text');
  return typeof textItem?.text === 'string' ? textItem.text : '';
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

function combinedPrompt(topic, history) {
  const conversation = history.slice(-4).map(message => `${message.role === 'assistant' ? 'Mila' : 'Student'}: ${message.content}`).join('\n');
  return `You are Mila, a friendly English practice partner for a 3rd grade child.

Rules:
- Reply only in English.
- Use very easy A1 English.
- Use 1-3 short sentences.
- Do not ask a new question; the lesson code chooses the next task.
- Stay on the topic: ${topics[topic].label.toUpperCase()}.
- Respond kindly without grading or correcting the answer.
- Do not ask for personal information.

Conversation:
${conversation}

Reply as Mila in plain English text only.`;
}

function plainTextPayload(text) {
  return {
    model: process.env.KIE_MODEL || 'gpt-5-5',
    stream: false,
    input: [
      { role: 'user', content: [{ type: 'input_text', text }] }
    ]
  };
}

function requestPayload(topic, history) { return plainTextPayload(combinedPrompt(topic, history)); }

function localSuggestions(topic) {
  return {
    school: ['A pencil.', 'A book.', 'A ruler.'],
    family: ["It's your mum.", "It's your sister.", "It's your grandma."],
    food: ['Yes, I do.', "No, I don't.", 'I like pizza.']
  }[topic];
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
    const payload = requestPayload(topic, history);
    console.info(`[Kie] model=${payload.model}`);
    console.info(`[Kie] promptLength=${payload.input[0].content[0].text.length}`);
    const response = await fetch(KIE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`HTTP error ${response.status}: ${sanitizeProviderBody(raw)}`);
    const text = (response.headers.get('content-type') || '').includes('text/event-stream') ? parseSse(raw) : outputText(JSON.parse(raw));
    if (!text) throw new Error('Kie response has no output text');
    return { message: text.trim().slice(0, 500), suggestions: localSuggestions(topic) };
  } finally { clearTimeout(timer); }
}
module.exports = { reply, parseSse, outputText, normalize, combinedPrompt, plainTextPayload, requestPayload, localSuggestions, sanitizeProviderBody };
