'use strict';

/**
 * Notation d'une traduction.
 *
 * Principe : on ne demande plus une égalité parfaite. Une réponse est
 * d'abord normalisée (casse, accents, apostrophes typographiques,
 * ponctuation, espaces, articles), puis comparée à la cible sur deux axes :
 *
 *   - similarité de caractères (Levenshtein normalisé) : rattrape les fautes
 *     de frappe, les accents oubliés, un mot un peu différent ;
 *   - similarité de mots (alignement positionnel + sac de mots) : évite qu'une
 *     faute sur un seul mot d'une longue phrase soit noyée dans le score.
 *
 * Le meilleur des deux est retenu. On obtient un score /100, plus un diff
 * mot par mot qui dit *où* ça ne va pas.
 */

const THRESHOLDS = {
  correct: 92, // >= : réponse acceptée sans réserve
  close: 75, // >= : réponse comprise, à retravailler
  almost: 55, // >= : on sent l'intention, mais ce n'est pas la cible
};

// Apostrophes typographiques -> ASCII
const APOSTROPHES = /[\u2018\u2019\u201A\u201B\u02BC\u02B9\u2032]/g;
const QUOTES = /[\u201C\u201D\u00AB\u00BB\u2039\u203A]/g;
const DASHES = /[\u2010-\u2015\u2212]/g;
const PUNCT = /[.,;:!?"()\[\]{}<>*+=~^|\\/§¶]/g;
// Tout ce qui "flotte" autour d'un mot mais n'est pas un mot
const SPACES = /\s+/g;

// Déterminants uniquement : retirer les prépositions (« to », « de », « in »)
// déformerait le compte de mots et effacerait du sens.
const ARTICLES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'l',
  'the', 'a', 'an',
]);

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalise une chaîne pour comparaison.
 * @param {string} input
 * @param {{stripArticles?: boolean}} [options]
 * @returns {string}
 */
function normalize(input, options = {}) {
  const { stripArticles = false } = options;
  if (input === null || input === undefined) return '';
  let s = String(input).toLowerCase();
  s = s.replace(APOSTROPHES, "'").replace(QUOTES, ' ').replace(DASHES, '-');
  s = stripAccents(s);
  s = s.replace(PUNCT, ' ');
  s = s.replace(/\s*'\s*/g, "'");
  // apostrophes orphelines en début/fin de mot
  s = s.replace(/(^|\s)'|'(\s|$)/g, '$1$2');
  s = s.replace(SPACES, ' ').trim();
  if (!s) return '';
  if (stripArticles) {
    const kept = s.split(' ').filter((t) => t && !ARTICLES.has(t));
    // ne jamais vider complètement la chaîne ("a" -> "")
    if (kept.length) s = kept.join(' ');
  }
  return s;
}

/** Distance de Levenshtein (deux lignes, mémoire O(min)). */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

/** 1 - distance / longueur max. 1 = identique, 0 = rien en commun. */
function ratio(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/** Score des mots : positionnel quand c'est alignable, sac sinon. */
function tokenSimilarity(a, b) {
  if (!a.length || !b.length) return 0;
  const bag = new Map();
  for (const t of a) bag.set(t, (bag.get(t) || 0) + 1);
  let common = 0;
  for (const t of b) {
    const c = bag.get(t) || 0;
    if (c > 0) {
      common++;
      bag.set(t, c - 1);
    }
  }
  const f1 = (2 * common) / (a.length + b.length);
  if (a.length !== b.length) return f1;
  let hits = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) hits++;
  // l'ordre compte en traduction : on le pèse plus fort que le simple
  // multiensemble, mais un simple remaniement ne doit pas être un zéro.
  return 0.7 * (hits / a.length) + 0.3 * f1;
}

/** Similarité globale dans [0, 1]. */
function similarity(expected, given) {
  const eStrict = normalize(expected);
  const gStrict = normalize(given);
  if (!eStrict || !gStrict) return 0;
  if (eStrict === gStrict) return 1;

  const eLoose = normalize(expected, { stripArticles: true }) || eStrict;
  const gLoose = normalize(given, { stripArticles: true }) || gStrict;

  return Math.max(ratio(eLoose, gLoose), tokenSimilarity(eLoose.split(' '), gLoose.split(' ')));
}

/**
 * Diff mot à mot, pour afficher *où* la réponse diverge.
 * @returns {{tokens: {text: string, ok: boolean}[], extra: string[], missing: string[]}}
 */
function diff(expected, given) {
  const e = (normalize(expected, { stripArticles: true }) || normalize(expected)).split(' ').filter(Boolean);
  const g = (normalize(given, { stripArticles: true }) || normalize(given)).split(' ').filter(Boolean);

  if (e.length === g.length) {
    const tokens = [];
    const extra = [];
    for (let i = 0; i < e.length; i++) {
      const ok = e[i] === g[i];
      tokens.push({ text: e[i], ok });
      if (!ok) extra.push(g[i]);
    }
    return { tokens, extra, missing: [] };
  }

  const pool = new Map();
  for (const t of e) pool.set(t, (pool.get(t) || 0) + 1);
  const tokens = [];
  const extra = [];
  const missing = [];
  for (const t of e) {
    const c = pool.get(t) || 0;
    if (c > 0) {
      pool.set(t, c - 1);
      tokens.push({ text: t, ok: true });
    } else {
      tokens.push({ text: t, ok: false });
      missing.push(t);
    }
  }
  for (const t of g) {
    if (!e.includes(t)) extra.push(t);
  }
  return { tokens, extra, missing };
}

/** Découpe une cellule "réponses acceptées" : "a | b ; c" -> [a, b, c] */
function parseAlternatives(cell) {
  if (!cell) return [];
  return String(cell)
    .split(/[|;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Note une réponse contre la cible et ses variantes acceptées.
 *
 * @param {string} expected  réponse de référence
 * @param {string} given     saisie de l'utilisateur
 * @param {string[]} [alternatives] autres formulations acceptées
 * @returns {{score:number, verdict:string, expected:string, matchedAlternative:boolean, diff:object, reason:string}}
 */
function grade(expected, given, alternatives = []) {
  const answer = String(given ?? '').trim();
  if (!answer) {
    return {
      score: 0,
      verdict: 'skipped',
      reason: 'Question passée sous silence.',
      expected,
      matchedAlternative: false,
      diff: diff(expected, ''),
    };
  }

  const candidates = [expected, ...alternatives];
  let best = 0;
  let matchedAlternative = false;

  for (const candidate of candidates) {
    const s = similarity(candidate, answer) * 100;
    if (s > best) best = s;
    if (normalize(candidate) === normalize(answer)) {
      best = 100;
      matchedAlternative = candidate !== expected;
      break;
    }
  }

  const score = Math.round(best * 100) / 100;
  let verdict = 'wrong';
  let reason = '';
  if (score >= THRESHOLDS.correct) {
    verdict = 'correct';
    reason = 'Réponse acceptée.';
  } else if (score >= THRESHOLDS.close) {
    verdict = 'close';
    reason = 'Compris, mais la formulation attendue est plus précise.';
  } else if (score >= THRESHOLDS.almost) {
    verdict = 'almost';
    reason = "L'intention est là, mais ce n'est pas la traduction attendue.";
  } else {
    reason = 'Réponse très éloignée de la cible.';
  }

  return {
    score,
    verdict,
    reason,
    expected,
    matchedAlternative,
    diff: diff(expected, answer),
  };
}

module.exports = {
  THRESHOLDS,
  normalize,
  stripAccents,
  levenshtein,
  ratio,
  tokenSimilarity,
  similarity,
  diff,
  grade,
  parseAlternatives,
};