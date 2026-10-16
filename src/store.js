'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { parseAlternatives, normalize } = require('./scoring');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DECK_DIR = path.join(DATA_DIR, 'decks');
const META_FILE = path.join(DATA_DIR, 'decks.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/** Parseur CSV : guillemets, doubles guillemets échappés, CRLF, lignes #. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let started = false;

  const src = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
      started = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
      started = true;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
      field = '';
      started = false;
    } else {
      field += c;
      started = true;
    }
  }
  row.push(field);
  if (started || row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

// Alias volontairement stricts : « a » / « b » comme en-tête sont ambigus avec
// de la donnée, on préfère lesintitulés explicites.
const SOURCE_HEADERS = ['question', 'source', 'src', 'word', 'term'];
const TARGET_HEADERS = ['response', 'target', 'translation', 'meaning', 'answer'];
const ALT_HEADERS = ['alt', 'alternatives', 'accepted', 'variants', 'also'];

const HEADER_ALIASES = new Map();
for (const h of SOURCE_HEADERS) HEADER_ALIASES.set(h, 'source');
for (const h of TARGET_HEADERS) HEADER_ALIASES.set(h, 'target');
for (const h of ALT_HEADERS) HEADER_ALIASES.set(h, 'alternatives');

function looksLikeHeader(row) {
  return row.some((cell) => HEADER_ALIASES.has(cell.trim().toLowerCase()));
}

/** Transforme des lignes brutes en entrées normalisées {source,target,alternatives}. */
function rowsToEntries(rows) {
  if (!rows.length) return [];
  let start = 0;
  let colSource = 0;
  let colTarget = 1;
  let colAlt = -1;

  if (looksLikeHeader(rows[0])) {
    const head = rows[0].map((c) => c.trim().toLowerCase());
    colSource = head.findIndex((h) => HEADER_ALIASES.get(h) === 'source');
    colTarget = head.findIndex((h) => HEADER_ALIASES.get(h) === 'target');
    colAlt = head.findIndex((h) => HEADER_ALIASES.get(h) === 'alternatives');
    if (colSource === -1) colSource = 0;
    if (colTarget === -1) colTarget = 1;
    start = 1;
  }

  const entries = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((c) => c.trim() === '')) continue;
    const source = (r[colSource] || '').trim();
    const target = (r[colTarget] || '').trim();
    if (!source || !target) continue;
    const alternatives = colAlt >= 0 ? parseAlternatives(r[colAlt]) : [];
    entries.push({ source, target, alternatives });
  }
  return entries;
}

/** Identifiant stable d'une carte : survives réordonnancement du CSV. */
function cardId(entry) {
  const basis = [normalize(entry.source), normalize(entry.target), ...(entry.alternatives || []).map(normalize)].join('\u0000');
  return crypto.createHash('sha1').update(basis).digest('hex').slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* Fichiers                                                            */
/* ------------------------------------------------------------------ */

function ensureDirs() {
  fs.mkdirSync(DECK_DIR, { recursive: true });
}

function assertDeckName(name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Nom de deck manquant.');
  const clean = name.trim();
  if (!/^[\wÀ-ÿ .()_-]+\.csv$/i.test(clean)) {
    throw new Error('Nom de deck invalide : lettres, chiffres, espace, . - _ ( ) uniquement.');
  }
  if (clean.includes('..')) throw new Error('Nom de deck invalide.');
  return clean;
}

function deckPath(name) {
  return path.join(DECK_DIR, assertDeckName(name));
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

/* ------------------------------------------------------------------ */
/* Métadonnées de decks                                                */
/* ------------------------------------------------------------------ */

/** Devine les langues depuis un nom du type "fr-en.csv" ou "en_fr.csv". */
function guessLanguages(name) {
  const m = name.replace(/\.csv$/i, '').match(/^([a-z]{2,3})[-_]([a-z]{2,3})$/i);
  if (m) return { source: m[1].toUpperCase(), target: m[2].toUpperCase() };
  return { source: '', target: '' };
}

function readMeta() {
  return readJson(META_FILE, {});
}

function writeMeta(meta) {
  writeJson(META_FILE, meta);
}

function getDeckMeta(name) {
  const meta = readMeta();
  const guess = guessLanguages(name);
  return {
    source: '',
    target: '',
    ...guess,
    ...(meta[name] || {}),
  };
}

function setDeckMeta(name, patch) {
  const meta = readMeta();
  const current = getDeckMeta(name);
  const next = { ...current };
  if (patch.source !== undefined) next.source = String(patch.source).trim().toUpperCase();
  if (patch.target !== undefined) next.target = String(patch.target).trim().toUpperCase();
  if (patch.label !== undefined) next.label = String(patch.label).trim();
  meta[name] = next;
  writeMeta(meta);
  return next;
}

/* ------------------------------------------------------------------ */
/* Decks                                                               */
/* ------------------------------------------------------------------ */

function listDeckNames() {
  ensureDirs();
  return fs
    .readdirSync(DECK_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .sort();
}

function readDeck(name) {
  const file = deckPath(name);
  const entries = rowsToEntries(parseCsv(fs.readFileSync(file, 'utf8')));
  return entries.map((e) => ({ ...e, id: cardId(e) }));
}

function writeDeck(name, entries) {
  const rows = [['question', 'response', 'alt']];
  for (const e of entries) {
    rows.push([e.source, e.target, (e.alternatives || []).join(' | ')]);
  }
  fs.writeFileSync(deckPath(name), toCsv(rows));
}

function createDeck(name, { source = '', target = '', csv = '' } = {}) {
  const file = deckPath(name);
  if (fs.existsSync(file)) throw new Error('Ce deck existe déjà.');
  const entries = csv ? rowsToEntries(parseCsv(csv)) : [];
  writeDeck(name, entries);
  setDeckMeta(name, { source, target });
  return name;
}

function deleteDeck(name) {
  const file = deckPath(name);
  if (!fs.existsSync(file)) throw new Error('Deck introuvable.');
  fs.unlinkSync(file);
  const meta = readMeta();
  delete meta[name];
  writeMeta(meta);
  const progress = readProgress();
  let touched = false;
  for (const key of Object.keys(progress)) {
    if (key.startsWith(`${name}::`)) {
      delete progress[key];
      touched = true;
    }
  }
  if (touched) saveProgress(progress);
}

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/* ------------------------------------------------------------------ */

function progressKey(deckName, entry) {
  return `${deckName}::${entry.id}`;
}

function readProgress() {
  return readJson(PROGRESS_FILE, {});
}

function saveProgress(value) {
  writeJson(PROGRESS_FILE, value);
}

module.exports = {
  DATA_DIR,
  DECK_DIR,
  parseCsv,
  toCsv,
  rowsToEntries,
  cardId,
  listDeckNames,
  readDeck,
  writeDeck,
  createDeck,
  deleteDeck,
  readMeta,
  writeMeta,
  getDeckMeta,
  setDeckMeta,
  readProgress,
  saveProgress,
  progressKey,
  guessLanguages,
  assertDeckName,
};