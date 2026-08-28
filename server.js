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
const { getChoiceExercise, validateAnswer, isConversationalMessage } = require('./src/lessons');

const positiveMessages = ['Yes! ⭐ Great job!', "That's right! 🌟", 'Perfect! 😊', 'Well done! ⭐'];

function completionMessage(topic, sticker) {
  const label = topics[topic].label;
  return `Great job! 🌟\nYou finished your ${label} practice!\n${sticker ? 'You earned a new sticker! 🎁' : 'You collected every sticker here! 🎉'}`;
}

const returnToChat = {
  school: { message: 'Do you use it at school?', suggestions: ['Yes, I do.', "No, I don't.", 'Sometimes.'] },
  family: { message: 'What do you like to do with your family?', suggestions: ['We play games.', 'We cook together.', 'We watch films.'] },
  food: { message: 'Do you like this food?', suggestions: ['Yes, I do.', "No, I don't.", 'A little.'] }
};

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
    if (session.status !== 'active') return fail(res, 409, 'This practice is already complete.');
    const choice = getChoiceExercise(session.topic, session.current_exercise);
    const divertedFromExercise = Boolean(session.awaiting_exercise) && isConversationalMessage(message, choice.exercise);
    const exerciseMode = Boolean(session.awaiting_exercise) && !divertedFromExercise;
    const turn = sessions.recordAnswer(session, message.trim());
    if (turn === null) return fail(res, 409, 'This practice is already complete.');

    if (exerciseMode) {
      const exercise = choice.exercise;
      const validation = validateAnswer(exercise, message);
      const attempts = validation.correct ? 0 : session.attempts + 1;
      const exerciseFinished = validation.correct || attempts >= 2;
      const completedCount = session.exercises_completed + (exerciseFinished ? 1 : 0);
      let feedback;
      let suggestions;
      let exerciseType = 'choice';
      if (validation.correct) {
        feedback = `${positiveMessages[turn % positiveMessages.length]} ${exercise.correction}`;
        suggestions = returnToChat[session.topic].suggestions;
      } else if (!exerciseFinished) {
        feedback = `Almost! ⭐ ${exercise.correction}\nCan you say: '${exercise.correction}'?`;
        suggestions = [exercise.correction];
        exerciseType = 'repeat';
      } else {
        feedback = `Good try! ⭐ ${exercise.correction}`;
        suggestions = returnToChat[session.topic].suggestions;
      }

      if (exerciseFinished) {
        const next = getChoiceExercise(session.topic, choice.index + 1);
        sessions.updateInteractionState(session.id, { awaitingExercise: 0, exercisePending: 0, chatSinceExercise: 0, exercisesCompleted: completedCount, attempts: 0, currentExercise: next.index, correctAnswers: session.correct_answers + (validation.correct ? 1 : 0) });
        if (turn >= 6 && completedCount >= 2) {
          const sticker = sessions.complete(session);
          return res.json({ mode: 'exercise', complete: true, correct: validation.correct, exerciseId: exercise.id, exerciseType, progress: 6, total: 6, message: `${feedback}\n\n${completionMessage(session.topic, sticker)}`, suggestions: [], sticker });
        }
        feedback = `${feedback}\n${returnToChat[session.topic].message}`;
      } else {
        sessions.updateInteractionState(session.id, { attempts, awaitingExercise: 1 });
      }
      sessions.saveReply(session.id, feedback);
      return res.json({ mode: 'exercise', message: feedback, suggestions, correct: validation.correct, exerciseId: exercise.id, exerciseType, complete: false, progress: Math.min(turn, 6), total: 6 });
    }

    if (divertedFromExercise) sessions.updateInteractionState(session.id, { awaitingExercise: 0, exercisePending: 1, chatSinceExercise: 0 });
    try {
      const answer = await kie.reply({ topic: session.topic, turn, history: sessions.recentMessages(session.id) });
      const shouldComplete = turn >= 6 && session.exercises_completed >= 2;
      if (shouldComplete) {
        const sticker = sessions.complete(session);
        const responseMessage = `${answer.message}\n\n${completionMessage(session.topic, sticker)}`;
        sessions.saveReply(session.id, responseMessage);
        return res.json({ mode: 'chat', message: responseMessage, suggestions: [], correct: null, complete: true, progress: 6, total: 6, sticker });
      }
      const chatCount = divertedFromExercise ? 0 : session.chat_since_exercise + 1;
      const introduceExercise = !divertedFromExercise && (Boolean(session.exercise_pending) || chatCount >= 2);
      let responseMessage = answer.message;
      let suggestions = answer.suggestions;
      if (introduceExercise) {
        responseMessage = `${responseMessage}\n\nLet's try a ${session.topic} word! ⭐\n${choice.exercise.prompt}`;
        suggestions = choice.exercise.suggestions;
        sessions.updateInteractionState(session.id, { awaitingExercise: 1, exercisePending: 0, chatSinceExercise: 0, currentExercise: choice.index });
      } else if (!divertedFromExercise) {
        sessions.updateInteractionState(session.id, { chatSinceExercise: chatCount });
      }
      sessions.saveReply(session.id, responseMessage);
      return res.json({ mode: 'chat', message: responseMessage, suggestions, correct: null, complete: false, progress: Math.min(turn, 6), total: 6 });
    } catch (error) {
      console.error(`[Kie] ${error.message}`);
      const fallback = "Oops! My notebook needs a tiny break. 📚\nPlease try again in a moment!";
      sessions.saveReply(session.id, fallback);
      return res.json({ mode: 'chat', message: fallback, suggestions: topics[session.topic].suggestions, correct: null, complete: false, progress: Math.min(turn, 6), total: 6, fallback: true });
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
