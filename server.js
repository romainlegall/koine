'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const store = require('./src/store');
const srs = require('./src/srs');
const scoring = require('./src/scoring');
const jeuPays = require('./src/game/countries');

const app = express();
const PORT = process.env.PORT || 4100;
const HISTORY_FILE = path.join(store.DATA_DIR, 'history.json');
const MAX_HISTORY = 400;

app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readHistory() {
  try {
    const raw = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function pushHistory(event) {
  const history = readHistory();
  history.push(event);
  fs.mkdirSync(store.DATA_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-MAX_HISTORY)));
}

/** Résumé de progression d'un deck, pour le tableau de bord. */
function summarize(deckName, entries, progress, now = Date.now()) {
  const buckets = { new: 0, learning: 0, known: 0, mastered: 0 };
  let due = 0;
  let attempts = 0;
  let correct = 0;
  let scoreSum = 0;

  for (const entry of entries) {
    const p = progress[store.progressKey(deckName, entry)];
    buckets[srs.levelOf(p)] += 1;
    if (srs.isDue(p, now)) due += 1;
    if (p && p.attempts) {
      attempts += p.attempts;
      correct += p.correct;
      scoreSum += p.scoreSum;
    }
  }

  return {
    count: entries.length,
    levels: buckets,
    due,
    attempts,
    correct,
    averageScore: attempts ? Math.round(scoreSum / attempts) : null,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Decks                                                               */
/* ------------------------------------------------------------------ */

app.get('/api/decks', (req, res) => {
  const progress = store.readProgress();
  const now = Date.now();
  const decks = store.listDeckNames().map((name) => {
    const meta = store.getDeckMeta(name);
    const entries = store.readDeck(name);
    return { name, ...meta, ...summarize(name, entries, progress, now) };
  });
  res.json(decks);
});

app.get('/api/decks/:name/entries', (req, res) => {
  const name = store.assertDeckName(req.params.name);
  res.json({ name, entries: store.readDeck(name) });
});

app.post('/api/decks', (req, res) => {
  const { name, source, target, csv } = req.body || {};
  const created = store.createDeck(name, { source, target, csv });
  res.status(201).json({ name: created });
});

app.delete('/api/decks/:name', (req, res) => {
  const name = store.assertDeckName(req.params.name);
  store.deleteDeck(name);
  res.status(204).end();
});

app.put('/api/decks/:name/meta', (req, res) => {
  const name = store.assertDeckName(req.params.name);
  const { source, target, label } = req.body || {};
  res.json(store.setDeckMeta(name, { source, target, label }));
});

app.get('/api/decks/:name/download', (req, res) => {
  const name = store.assertDeckName(req.params.name);
  res.download(store.DECK_DIR + '/' + name, name);
});

app.post('/api/decks/:name/entries', (req, res) => {
  const name = store.assertDeckName(req.params.name);
  const entries = store.readDeck(name).map(({ id, ...rest }) => rest);
  const entry = {
    source: String(req.body?.source || '').trim(),
    target: String(req.body?.target || '').trim(),
    alternatives: Array.isArray(req.body?.alternatives)
      ? req.body.alternatives.map((a) => String(a).trim()).filter(Boolean)
      : scoring.parseAlternatives(req.body?.alternatives),
  };
  if (!entry.source || !entry.target) throw new HttpError(400, 'Source et cible sont obligatoires.');
  entries.push(entry);
  store.writeDeck(name, entries);
  res.status(201).json({ entry: { ...entry, id: store.cardId(entry) } });
});

app.put('/api/decks/:name/entries', (req, res) => {
  const name = store.assertDeckName(req.params.name);
  const entries = store.rowsToEntries(store.parseCsv(String(req.body?.csv ?? '')));
  store.writeDeck(name, entries);
  res.json({ name, count: entries.length });
});

app.put('/api/decks/:name/entries/:id', (req, res) => {
  const name = store.assertDeckName(req.params.name);
  const entries = store.readDeck(name);
  const index = entries.findIndex((e) => e.id === req.params.id);
  if (index === -1) throw new HttpError(404, 'Entrée introuvable.');
  const source = String(req.body?.source ?? entries[index].source).trim();
  const target = String(req.body?.target ?? entries[index].target).trim();
  const alternatives = Array.isArray(req.body?.alternatives)
    ? req.body.alternatives.map((a) => String(a).trim()).filter(Boolean)
    : scoring.parseAlternatives(req.body?.alternatives ?? entries[index].alternatives.join(' | '));
  if (!source || !target) throw new HttpError(400, 'Source et cible sont obligatoires.');
  entries[index] = { id: store.cardId({ source, target, alternatives }), source, target, alternatives };
  store.writeDeck(
    name,
    entries.map(({ id, ...rest }) => rest)
  );
  res.json({ entry: entries[index] });
});

app.delete('/api/decks/:name/entries/:id', (req, res) => {
  const name = store.assertDeckName(req.params.name);
  const entries = store.readDeck(name);
  const index = entries.findIndex((e) => e.id === req.params.id);
  if (index === -1) throw new HttpError(404, 'Entrée introuvable.');
  entries.splice(index, 1);
  store.writeDeck(
    name,
    entries.map(({ id, ...rest }) => rest)
  );
  const progress = store.readProgress();
  delete progress[`${name}::${req.params.id}`];
  store.saveProgress(progress);
  res.status(204).end();
});

/* ------------------------------------------------------------------ */
/* Sessions de jeu                                                    */
/* ------------------------------------------------------------------ */

const sessions = new Map();
const SESSION_TTL = 6 * 60 * 60 * 1000;

function getSession(id) {
  const session = sessions.get(id);
  if (!session) throw new HttpError(404, 'Session expirée, relancez une partie.');
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(id);
    throw new HttpError(404, 'Session expirée, relancez une partie.');
  }
  return session;
}

function pickDirection(pref, i) {
  if (pref === 'forward') return 'forward';
  if (pref === 'reverse') return 'reverse';
  return i % 2 === 0 ? 'forward' : 'reverse';
}

function buildQueue(deckNames, size) {
  const progress = store.readProgress();
  const now = Date.now();
  const due = [];
  const rest = [];

  for (const deckName of deckNames) {
    let entries;
    try {
      entries = store.readDeck(deckName);
    } catch (err) {
      throw new HttpError(404, `Deck "${deckName}" introuvable.`);
    }
    for (const entry of entries) {
      const p = progress[store.progressKey(deckName, entry)];
      const card = {
        deck: deckName,
        id: entry.id,
        source: entry.source,
        target: entry.target,
        alternatives: entry.alternatives,
        direction: '',
        answered: false,
      };
      if (srs.isDue(p, now)) {
        card.lastSeen = p?.lastReviewedAt ?? 0;
        due.push(card);
      } else {
        card.lastSeen = p?.lastReviewedAt ?? Infinity;
        rest.push(card);
      }
    }
  }

  // les plus oubliées d'abord
  due.sort((a, b) => a.lastSeen - b.lastSeen);
  rest.sort((a, b) => a.lastSeen - b.lastSeen);

  return due.concat(rest).slice(0, Math.max(1, size));
}

app.post('/api/session', (req, res) => {
  const body = req.body || {};
  const deckNames = Array.isArray(body.decks) ? body.decks.filter(Boolean) : [];
  if (!deckNames.length) throw new HttpError(400, 'Choisissez au moins un deck.');
  deckNames.forEach((n) => store.assertDeckName(n));

  const size = Math.min(Math.max(parseInt(body.size, 10) || 20, 1), 200);
  const directionPref = ['forward', 'reverse', 'mixed'].includes(body.direction) ? body.direction : 'mixed';

  const queue = buildQueue(deckNames, size);
  if (!queue.length) throw new HttpError(400, 'Ces decks sont vides.');

  queue.forEach((card, i) => {
    card.direction = pickDirection(directionPref, i);
  });

  const session = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    direction: directionPref,
    decks: deckNames,
    queue,
    cursor: 0,
    results: [],
    started: true,
  };
  sessions.set(session.id, session);

  res.json(presentSession(session));
});

function presentSession(session) {
  const total = session.queue.length;
  const card = session.queue[session.cursor] || null;
  return {
    id: session.id,
    decks: session.decks,
    direction: session.direction,
    total,
    answered: session.results.length,
    remaining: Math.max(0, total - session.cursor),
    scores: session.results.map((r) => r.score),
    card: card
      ? {
          deck: card.deck,
          id: card.id,
          prompt: card.direction === 'forward' ? card.source : card.target,
          promptIs: card.direction === 'forward' ? 'source' : 'target',
          expected: card.direction === 'forward' ? card.target : card.source,
          alternatives: card.alternatives || [],
        }
      : null,
    done: !card,
    summary: summaryOf(session),
  };
}

function summaryOf(session) {
  const n = session.results.length;
  if (!n) return null;
  const good = session.results.filter((r) => r.verdict === 'correct').length;
  const close = session.results.filter((r) => r.verdict === 'close').length;
  const avg = Math.round(session.results.reduce((a, r) => a + r.score, 0) / n);
  return {
    answered: n,
    correct: good,
    close,
    wrong: n - good - close,
    average: avg,
    accuracy: Math.round(((good + close) / n) * 100),
  };
}

app.get('/api/session/:id', (req, res) => {
  res.json(presentSession(getSession(req.params.id)));
});

app.post('/api/session/:id/answer', (req, res) => {
  const session = getSession(req.params.id);
  const card = session.queue[session.cursor];
  if (!card) throw new HttpError(409, 'Cette session est terminée.');
  const given = String(req.body?.given ?? '');
  res.json({ ...gradeAnswer(session, card, given), ...presentSession(session) });
});

app.post('/api/session/:id/skip', (req, res) => {
  const session = getSession(req.params.id);
  const card = session.queue[session.cursor];
  if (!card) throw new HttpError(409, 'Cette session est terminée.');
  res.json({ ...gradeAnswer(session, card, ''), ...presentSession(session) });
});

/**
 * Note la carte courante, met à jour la répétition espacée, et la remet
 * en fin de queue si elle est en dessous du seuil "presque juste".
 */
function gradeAnswer(session, card, given) {
  const expected = card.direction === 'forward' ? card.target : card.source;
  // dans le sens inverse, les variantes acceptées valent aussi pour la source
  const alternatives = (card.alternatives || []).slice();
  if (card.direction === 'reverse' && card.target) alternatives.push(card.source);

  const result = scoring.grade(expected, given, alternatives);
  session.results.push(result);

  const progress = store.readProgress();
  const key = store.progressKey(card.deck, card);
  progress[key] = srs.review(progress[key], result.score);
  store.saveProgress(progress);

  pushHistory({
    ts: Date.now(),
    deck: card.deck,
    id: card.id,
    score: result.score,
    verdict: result.verdict,
    box: progress[key].box,
  });

  let requeued = false;
  if (result.score < scoring.THRESHOLDS.close && session.cursor < session.queue.length - 1) {
    session.queue.push({ ...card, answered: true });
    requeued = true;
  }
  session.cursor += 1;
  return { result, requeued };
}

app.post('/api/session/:id/abandon', (req, res) => {
  sessions.delete(req.params.id);
  res.status(204).end();
});

/* ------------------------------------------------------------------ */
/* Stats & progression                                                 */
/* ------------------------------------------------------------------ */

app.get('/api/stats/:name', (req, res) => {
  const name = store.assertDeckName(req.params.name);
  const entries = store.readDeck(name);
  const progress = store.readProgress();
  const now = Date.now();

  const cards = entries.map((entry) => {
    const p = progress[store.progressKey(name, entry)];
    return {
      id: entry.id,
      source: entry.source,
      target: entry.target,
      alternatives: entry.alternatives,
      level: srs.levelOf(p),
      due: srs.isDue(p, now),
      attempts: p?.attempts || 0,
      accuracy: srs.accuracy(p),
      lapses: p?.lapses || 0,
      streak: p?.streak || 0,
      box: p?.box || 0,
      lastScore: p?.lastScore ?? null,
      intervalDays: p?.intervalDays || 0,
      lastReviewedAt: p?.lastReviewedAt ?? null,
    };
  });

  const history = readHistory().filter((h) => h.deck === name);
  res.json({
    name,
    meta: store.getDeckMeta(name),
    summary: summarize(name, entries, progress, now),
    cards,
    history,
  });
});

app.get('/api/progress', (req, res) => {
  res.json(store.readProgress());
});

app.post('/api/progress/reset', (req, res) => {
  const { deck } = req.body || {};
  const progress = store.readProgress();
  if (!deck) {
    store.saveProgress({});
  } else {
    const clean = store.assertDeckName(deck);
    for (const key of Object.keys(progress)) {
      if (key.startsWith(`${clean}::`)) delete progress[key];
    }
    store.saveProgress(progress);
  }
  res.status(204).end();
});

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Jeu des pays                                                        */
/* ------------------------------------------------------------------ */

const parties = new Map();
const PARTIE_TTL = 12 * 60 * 60 * 1000;

function getPartie(id) {
  const game = parties.get(id);
  if (!game) throw new HttpError(404, 'Partie introuvable ou expirée. Relancez une partie.');
  if (Date.now() - game.createdAt > PARTIE_TTL) {
    parties.delete(id);
    throw new HttpError(404, 'Partie expirée. Relancez une partie.');
  }
  return game;
}

app.post('/api/jeu/pays', (req, res) => {
  const joueurs = Array.isArray(req.body?.joueurs) ? req.body.joueurs : [];
  const nom = req.body?.nom;
  if (nom) joueurs.push(nom);
  const propres = joueurs.map((n) => String(n || '').trim()).filter(Boolean);
  if (propres.length < 2) throw new HttpError(400, 'Au moins deux joueurs sont nécessaires.');

  const game = jeuPays.creer({ joueurs: propres, manches: req.body?.manches });
  parties.set(game.id, game);
  res.status(201).json(jeuPays.vue(game));
});

app.get('/api/jeu/pays/:id', (req, res) => {
  res.json(jeuPays.vue(getPartie(req.params.id)));
});

app.post('/api/jeu/pays/:id/reponse', (req, res) => {
  const game = getPartie(req.params.id);
  const resultat = jeuPays.repondre(game, req.body?.pays);
  if (!resultat.ok) {
    return res.status(400).json({ error: resultat.raison, suggestion: resultat.suggestion, ...jeuPays.vue(game) });
  }
  res.json({ ...resultat, ...jeuPays.vue(game) });
});

app.post('/api/jeu/pays/:id/passer', (req, res) => {
  const game = getPartie(req.params.id);
  const resultat = jeuPays.passer(game);
  if (!resultat.ok) throw new HttpError(400, resultat.raison);
  res.json({ ...resultat, ...jeuPays.vue(game) });
});

app.post('/api/jeu/pays/:id/annuler', (req, res) => {
  const game = getPartie(req.params.id);
  const resultat = jeuPays.annuler(game);
  if (!resultat.ok) throw new HttpError(400, resultat.raison);
  res.json({ ...resultat, ...jeuPays.vue(game) });
});

app.delete('/api/jeu/pays/:id', (req, res) => {
  parties.delete(req.params.id);
  res.status(204).end();
});

app.get('/api/health', (req, res) => {
  let decks = 0;
  let entries = 0;
  try {
    const names = store.listDeckNames();
    decks = names.length;
    for (const name of names) entries += store.readDeck(name).length;
  } catch (err) {
    return res.status(503).json({ status: 'ko', error: err.message });
  }
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), decks, entries });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Erreur serveur' });
});

const server = app.listen(PORT, () => {
  console.log(`Koiné — jeux de mots et de langues, http://localhost:${PORT}`);
});

// docker compose down envoie SIGTERM puis SIGKILL. Sans arret propre, une
// note en cours d'ecriture peut etre coupee en plein milieu.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} recu, arret...`);
    server.close(() => {
      console.log('Connexions fermees, arret propre.');
      process.exit(0);
    });
    // filet de securite si une connexion traine
    setTimeout(() => process.exit(0), 5000).unref();
  });
}