require('dotenv').config();
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createDatabase } = require('./src/db');
const { createSessionService } = require('./src/sessions');
const { validUserId, validSessionId, validTopic, validMessage } = require('./src/validation');
const kie = require('./src/kie');
const { topics } = require('./src/prompts');
const { getExercise, validateAnswer } = require('./src/lessons');

const positiveMessages = ['Yes! ⭐ Great job!', "That's right! 🌟", 'Perfect! 😊', 'Well done! ⭐'];

function completionMessage(topic, sticker) {
  const label = topics[topic].label;
  return `Great job! 🌟\nYou finished your ${label} practice!\n${sticker ? 'You earned a new sticker! 🎁' : 'You collected every sticker here! 🎉'}`;
}

function createApp(options = {}) {
  const db = options.db || createDatabase(options.dataDir);
  const sessions = createSessionService(db);
  const app = express();
  // Bothost forwards the public client address through one trusted reverse proxy.
  // This must be configured before express-rate-limit creates its request key.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'], styleSrc: ["'self'"], scriptSrc: ["'self'"] } } }));
  app.use(express.json({ limit: '4kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Please wait a little before trying again.' } });
  const fail = (res, status, error) => res.status(status).json({ error });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/init', (req, res) => validUserId(req.body.userId) ? res.json(sessions.profile(req.body.userId)) : fail(res, 400, 'A valid user ID is required.'));
  app.get('/api/profile', (req, res) => validUserId(req.query.userId) ? res.json(sessions.profile(req.query.userId)) : fail(res, 400, 'A valid user ID is required.'));
  app.post('/api/session/start', (req, res) => {
    if (!validUserId(req.body.userId)) return fail(res, 400, 'A valid user ID is required.');
    if (!validTopic(req.body.topic)) return fail(res, 400, 'Please choose School, Family or Food.');
    res.status(201).json(sessions.start(req.body.userId, req.body.topic));
  });
  app.post('/api/session/reset', (req, res) => {
    if (!validUserId(req.body.userId) || !validTopic(req.body.topic)) return fail(res, 400, 'The practice details are not valid.');
    res.status(201).json(sessions.start(req.body.userId, req.body.topic));
  });
  app.get('/api/stickers', (req, res) => validUserId(req.query.userId) ? res.json({ stickers: sessions.stickers(req.query.userId) }) : fail(res, 400, 'A valid user ID is required.'));
  app.post('/api/chat', limiter, async (req, res) => {
    const { userId, sessionId, message } = req.body;
    if (!validUserId(userId) || !validSessionId(sessionId) || !validMessage(message)) return fail(res, 400, 'Please write a short answer.');
    const session = sessions.getOwned(Number(sessionId), userId);
    if (!session) return fail(res, 404, 'Practice session not found.');
    if (session.status !== 'active' || session.turn_count >= 6) return fail(res, 409, 'This practice is already complete.');
    const exercise = getExercise(session.topic, session.current_exercise);
    const validation = validateAnswer(exercise, message);
    const incorrectAttempts = validation.correct === false ? session.attempts + 1 : 0;
    const advancesExercise = exercise.type === 'open' || validation.correct === true || incorrectAttempts >= 2;
    const turn = sessions.recordAnswer(session, message.trim(), advancesExercise);
    if (turn === null) return fail(res, 409, 'This practice is already complete.');

    let feedback;
    let suggestions;
    let exerciseType = exercise.type;
    if (exercise.type === 'choice' && validation.correct) {
      feedback = `${positiveMessages[turn % positiveMessages.length]} ${exercise.correction}`;
      suggestions = [];
    } else if (exercise.type === 'choice' && incorrectAttempts < 2) {
      feedback = `Almost! ⭐ ${exercise.correction}\nCan you say: '${exercise.correction}'?`;
      suggestions = [exercise.correction];
      exerciseType = 'repeat';
    } else if (exercise.type === 'choice') {
      feedback = `Good try! ⭐ ${exercise.correction}\nLet's try the next one.`;
      suggestions = [];
    }

    const nextExerciseIndex = advancesExercise ? session.current_exercise + 1 : session.current_exercise;
    sessions.updateLessonState(session.id, {
      currentExercise: nextExerciseIndex,
      attempts: advancesExercise ? 0 : incorrectAttempts,
      correctIncrement: validation.correct === true ? 1 : 0
    });

    if (turn === 6) {
      const sticker = sessions.complete(session);
      const finalFeedback = feedback || 'Thanks for sharing! ⭐';
      return res.json({ complete: true, correct: validation.correct, exerciseId: exercise.id, exerciseType, progress: 6, total: 6, message: `${finalFeedback}\n\n${completionMessage(session.topic, sticker)}`, suggestions: [], sticker });
    }

    const nextExercise = getExercise(session.topic, nextExerciseIndex);
    if (exercise.type === 'choice') {
      if (advancesExercise) {
        feedback = `${feedback}\n\n${nextExercise.prompt}`;
        suggestions = nextExercise.suggestions;
      }
      sessions.saveReply(session.id, feedback);
      return res.json({ message: feedback, suggestions, correct: validation.correct, exerciseId: exercise.id, exerciseType, complete: false, progress: turn, total: 6 });
    }

    try {
      const answer = await kie.reply({ topic: session.topic, turn, history: sessions.recentMessages(session.id) });
      const responseMessage = `${answer.message}\n\n${nextExercise.prompt}`;
      sessions.saveReply(session.id, responseMessage);
      res.json({ message: responseMessage, suggestions: nextExercise.suggestions, correct: null, exerciseId: exercise.id, exerciseType, complete: false, progress: turn, total: 6 });
    } catch (error) {
      console.error(`[Kie] ${error.message}`);
      const fallback = `Oops! My notebook needs a tiny break. 📚\nPlease try again in a moment!\n\n${nextExercise.prompt}`;
      sessions.saveReply(session.id, fallback);
      res.json({ message: fallback, suggestions: nextExercise.suggestions, correct: null, exerciseId: exercise.id, exerciseType, complete: false, progress: turn, total: 6, fallback: true });
    }
  });
  app.use('/api', (_req, res) => fail(res, 404, 'Page not found.'));
  app.use((error, _req, res, _next) => { console.error(error.message); fail(res, 500, 'Oops! Something went wrong. Please try again.'); });
  app.locals.db = db;
  return app;
}

if (require.main === module) {
  if (process.env.MOCK_AI !== 'true' && !process.env.KIE_API_KEY) console.warn('[Config] KIE_API_KEY is missing. The website will load, but chat uses its friendly fallback.');
  const PORT = process.env.PORT || 3000;
  createApp().listen(PORT, '0.0.0.0', () => console.log(`Mila's English Fun is listening on 0.0.0.0:${PORT}`));
}
module.exports = { createApp };
