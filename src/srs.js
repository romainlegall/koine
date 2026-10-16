'use strict';

/**
 * Répétition espacée.
 *
 * Chaque carte possède un "niveau" (box). Une bonne réponse fait monter,
 * une mauvaise réponse remet à zéro et la carte redevient due immédiatement
 * (donc réapparaît dans la même session). Les intervalles sont en jours.
 */

const DAY = 86400000;

const BOX_INTERVALS = [0, 1, 2, 4, 9, 21, 60];
const MAX_BOX = BOX_INTERVALS.length - 1;

const LEVELS = [
  { key: 'new', label: 'Nouveau' },
  { key: 'learning', label: 'En apprentissage' },
  { key: 'known', label: 'Connu' },
  { key: 'mastered', label: 'Acquis' },
];

/** Traduit un score /100 en qualité (échelle de Riemann). */
function qualityFromScore(score) {
  if (score >= 92) return 5;
  if (score >= 75) return 4;
  if (score >= 55) return 2;
  return 1;
}

function emptyProgress() {
  return {
    box: 0,
    reps: 0,
    lapses: 0,
    attempts: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    scoreSum: 0,
    lastScore: null,
    lastReviewedAt: null,
    dueAt: 0,
    intervalDays: 0,
  };
}

/** Applique une réponse à un enregistrement de progression. */
function review(progress, score, now = Date.now()) {
  const p = { ...emptyProgress(), ...(progress || {}) };
  const quality = qualityFromScore(score);

  p.attempts += 1;
  p.scoreSum += score;
  p.lastScore = score;
  p.lastReviewedAt = now;

  if (quality >= 3) {
    p.correct += 1;
    p.streak += 1;
    p.reps += 1;
    p.box = Math.min(p.box + 1, MAX_BOX);
  } else {
    p.lapses += 1;
    p.streak = 0;
    p.reps = 0;
    p.box = 0;
  }

  p.bestStreak = Math.max(p.bestStreak, p.streak);
  p.intervalDays = BOX_INTERVALS[p.box];
  p.dueAt = now + p.intervalDays * DAY;
  return p;
}

function isDue(progress, now = Date.now()) {
  if (!progress || !progress.lastReviewedAt) return true;
  return progress.dueAt <= now;
}

function levelOf(progress) {
  if (!progress || !progress.lastReviewedAt) return 'new';
  if (progress.box >= 4) return 'mastered';
  if (progress.box >= 2) return 'known';
  return 'learning';
}

function accuracy(progress) {
  if (!progress || !progress.attempts) return null;
  return Math.round((progress.correct / progress.attempts) * 100);
}

/** Ancienneté de la carte, en jours. */
function ageInDays(progress, now = Date.now()) {
  if (!progress || !progress.lastReviewedAt) return null;
  return Math.floor((now - progress.lastReviewedAt) / DAY);
}

module.exports = {
  DAY,
  BOX_INTERVALS,
  LEVELS,
  emptyProgress,
  qualityFromScore,
  review,
  isDue,
  levelOf,
  accuracy,
  ageInDays,
};