const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOPICS = new Set(['school', 'family', 'food']);

function validUserId(value) { return typeof value === 'string' && UUID.test(value); }
function validSessionId(value) { return Number.isSafeInteger(Number(value)) && Number(value) > 0; }
function validTopic(value) { return TOPICS.has(value); }
function validMessage(value) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 200; }

module.exports = { validUserId, validSessionId, validTopic, validMessage };
