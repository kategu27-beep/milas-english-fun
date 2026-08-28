const crypto = require('node:crypto');
const { topics } = require('./prompts');

function createSessionService(db) {
  const ensureUser = db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)');
  const addMessage = db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)');

  function start(userId, topic) {
    ensureUser.run(userId);
    db.prepare("UPDATE sessions SET status='abandoned' WHERE user_id=? AND status='active'").run(userId);
    const result = db.prepare('INSERT INTO sessions (user_id, topic) VALUES (?, ?)').run(userId, topic);
    addMessage.run(result.lastInsertRowid, 'assistant', topics[topic].opening);
    return { sessionId: Number(result.lastInsertRowid), topic, message: topics[topic].opening, suggestions: topics[topic].suggestions, progress: 0, total: 6 };
  }

  function getOwned(sessionId, userId) {
    return db.prepare('SELECT * FROM sessions WHERE id=? AND user_id=?').get(sessionId, userId);
  }

  function recentMessages(sessionId) {
    return db.prepare('SELECT role, content FROM (SELECT id, role, content FROM messages WHERE session_id=? ORDER BY id DESC LIMIT 8) ORDER BY id').all(sessionId);
  }

  function recordAnswer(session, message, completesExercise = true) {
    return db.transaction(() => {
      const current = getOwned(session.id, session.user_id);
      if (!current || current.status !== 'active' || current.turn_count >= 6) return null;
      addMessage.run(current.id, 'user', message);
      if (completesExercise) db.prepare('UPDATE sessions SET turn_count=turn_count+1 WHERE id=?').run(current.id);
      return current.turn_count + (completesExercise ? 1 : 0);
    })();
  }

  function updateLessonState(sessionId, { currentExercise, attempts, correctIncrement = 0 }) {
    db.prepare('UPDATE sessions SET current_exercise=?, attempts=?, correct_answers=correct_answers+? WHERE id=?').run(currentExercise, attempts, correctIncrement, sessionId);
  }

  function unlock(userId, topic) {
    const available = db.prepare(`SELECT s.* FROM stickers s LEFT JOIN user_stickers us ON us.sticker_id=s.id AND us.user_id=? WHERE s.topic=? AND us.sticker_id IS NULL ORDER BY s.sort_order LIMIT 1`).get(userId, topic);
    if (!available) return null;
    db.prepare('INSERT INTO user_stickers (user_id, sticker_id) VALUES (?, ?)').run(userId, available.id);
    return available;
  }

  function complete(session) {
    db.prepare("UPDATE sessions SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id=?").run(session.id);
    return unlock(session.user_id, session.topic);
  }

  function saveReply(sessionId, text) { addMessage.run(sessionId, 'assistant', text); }

  function stickers(userId) {
    ensureUser.run(userId);
    return db.prepare(`SELECT s.id, s.topic, s.name, s.asset_path AS assetPath, CASE WHEN us.sticker_id IS NULL THEN 0 ELSE 1 END AS unlocked FROM stickers s LEFT JOIN user_stickers us ON us.sticker_id=s.id AND us.user_id=? ORDER BY s.topic, s.sort_order`).all(userId).map(s => ({ ...s, unlocked: Boolean(s.unlocked) }));
  }

  function profile(userId) {
    ensureUser.run(userId);
    const active = db.prepare("SELECT id AS sessionId, topic, turn_count AS progress FROM sessions WHERE user_id=? AND status='active' ORDER BY id DESC LIMIT 1").get(userId) || null;
    const count = db.prepare('SELECT COUNT(*) AS count FROM user_stickers WHERE user_id=?').get(userId).count;
    return { userId, activeSession: active, stickerCount: count };
  }
  return { start, getOwned, recentMessages, recordAnswer, updateLessonState, complete, saveReply, stickers, profile };
}
module.exports = { createSessionService };
