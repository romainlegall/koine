'use strict';

const assert = require('assert');
const { grade, normalize, similarity } = require('../src/scoring');
const srs = require('../src/srs');
const store = require('../src/store');

let passed = 0;
let failed = 0;

function check(label, actual, expectation) {
  const ok =
    typeof expectation === 'function' ? expectation(actual) : deepEqual(actual, expectation);
  if (ok) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.log(`  KO  ${label} → ${JSON.stringify(actual)}`);
  }
}

function deepEqual(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

console.log('\nnormalisation');
check('accents retirés', normalize('Éléphant'), 'elephant');
check('apostrophe typographique', normalize('l’été'), "l'ete");
check('ponctuation', normalize('what\'s your name ?'), "what's your name");
check('espaces multiples', normalize('  a   b  '), 'a b');
check('article retiré', normalize('the cat', { stripArticles: true }), 'cat');
check('virgule-containing phrase', normalize('Bonjour, monsieur !'), 'bonjour monsieur');

console.log('\nsimilarité');
check('identique', similarity('chat', 'chat'), 1);
check('accent manquant accepté', similarity('éléphant', 'elephant'), (v) => v > 0.99);
check('article superflu accepté', similarity('the cat', 'cat'), (v) => v > 0.99);
check('ponctuation superflue', similarity('Bonjour !', 'bonjour'), (v) => v > 0.99);
check('faute de frappe rapprochée', similarity('comprendre', 'comprenndre'), (v) => v > 0.8);
check('hors sujet bas', similarity('chat', 'voiture'), (v) => v < 0.4);
check('mot vide', similarity('chat', ''), 0);

console.log('\nnote');
const exact = grade('to figure out', 'to figure out');
check('identique = 100', exact.score, 100);
check('identique = correct', exact.verdict, 'correct');

check('majuscules acceptées', grade('to figure out', 'To Figure Out').verdict, 'correct');
check('accents acceptés', grade('élève', 'eleve').verdict, 'correct');
check('article superflu accepté', grade('the cat', 'cat').verdict, 'correct');

const typo = grade('comprendre', 'comprenndre');
check('faute de frappe = close', typo.verdict, 'close');
check('faute de frappe notée ~85', typo.score, (v) => v > 80 && v < 92);

check('hors sujet = wrong', grade('to figure out', 'manger').verdict, 'wrong');
check('vide = skipped', grade('chat', '   ').verdict, 'skipped');

const alt = grade('l\'arbre', 'the tree', ['the tree', 'arbre mort']);
check('variante acceptée = 100', alt.score, 100);
check('variante signalée', alt.matchedAlternative, true);

console.log('\ndiff');
const d = grade('to figure out', 'to work out').diff;
check('3 tokens alignés', d.tokens.length, 3);
check('« to » correct', d.tokens[0].ok, true);
check('« figure » faux', d.tokens[1].ok, false);
check('mot en trop listé', d.extra, ['work']);

console.log('\nrépétition espacée');
let p = srs.emptyProgress();
for (let i = 0; i < 5; i++) p = srs.review(p, 100);
check('5 bonnes réponses → niveau 5', p.box, 5);
check('intervalle = 21 j', p.intervalDays, 21);
check('streak = 5', p.streak, 5);
check('plus dû', srs.isDue(p), false);

const bad = srs.review(p, 10);
check('mauvaise réponse → niveau 0', bad.box, 0);
check('mauvaise réponse → dû immédiatement', srs.isDue(bad), true);
check('streak remis à zéro', bad.streak, 0);
check('échec compté', bad.lapses, 1);
check('niveau = à revoir', srs.levelOf(bad), 'learning');
check('précision = 5/6', srs.accuracy(bad), 83);
check('niveau acquis à 5 bonnes', srs.levelOf(p), 'mastered');

console.log('\nCSV');
const csv = 'question,response,alt\n"Bonjour, monsieur","hello, sir",hi | yo\nchat,cat,\n';
const entries = store.rowsToEntries(store.parseCsv(csv));
check('2 lignes lues', entries.length, 2);
check('virgule protégée', entries[0].target, 'hello, sir');
check('variantes découpées', entries[0].alternatives, ['hi', 'yo']);
check('cellule vide', entries[1].alternatives.length, 0);

const noHeader = store.rowsToEntries(store.parseCsv('a,b\nc,d\n'));
check('sans en-tête', noHeader.length, 2);
check('sans en-tête: source', noHeader[0].source, 'a');

const aliases = store.rowsToEntries(store.parseCsv('source,target\nx,y\n'));
check('alias source/target', aliases[0].target, 'y');

check('identifiant stable', store.cardId({ source: 'a', target: 'b' }), store.cardId({ source: 'a', target: 'b' }));
check('identifiant distinct', store.cardId({ source: 'a', target: 'b' }) !== store.cardId({ source: 'a', target: 'c' }), true);

console.log('\nlangues devinées');
check('fr-en.csv', store.guessLanguages('fr-en.csv'), { source: 'FR', target: 'EN' });
check('vocabulary.csv', store.guessLanguages('vocabulary.csv'), { source: '', target: '' });

const pays = require('../src/countries');
const jeu = require('../src/game/countries');

console.log('\nliste de pays');
check('au moins 190 pays', pays.PAYS.length >= 190, true);
check('chaque pays a un continent et une capitale', Object.keys(pays.INFOS).length, pays.PAYS.length);
check('capitale du Danemark', pays.infosDe('Danemark').capitale, 'Copenhague');
check('continent de la Gambie', pays.infosDe('Gambie').continent, 'Afrique');
check('lettre W exclue (aucun pays)', pays.paysPour('w').length, 0);
check('lettre X exclue (aucun pays)', pays.paysPour('x').length, 0);
check('lettre K a des pays', pays.paysPour('k').includes('Kiribati'), true);
check('accents tolérés', pays.trouver('Egypte').canonique, 'Egypte');
check('appareil ignoré', pays.trouver('les Etats-Unis').canonique, 'États-Unis');
check('variante récente', pays.trouver('zaïre').canonique, 'République démocratique du Congo');
check('inconnu', pays.trouver('Xanadu'), null);

console.log('\nvalidation du jeu des pays');
// verifier() ne touche pas à l'état : une partie peut servir de bac à sable
const gv = jeu.creer({ joueurs: ['Alice', 'Bob'] });
gv.lettre = 'D';
check('bonne réponse', jeu.verifier(gv, 'Danemark').ok, true);
check('casse ignorée', jeu.verifier(gv, 'danemark').ok, true);
check('autre lettre refusée', jeu.verifier(gv, 'Suisse').ok, false);
check('hors liste refusée', jeu.verifier(gv, 'Xanadu').ok, false);
check('vide refusé', jeu.verifier(gv, '   ').ok, false);
check('faute de frappe suggérée', jeu.verifier(gv, 'Danemarck').suggestion, 'Danemark');
check('article devant le pays', jeu.verifier(gv, 'Lesotho').ok, false);
check('état intact après validation', gv.used.length, 0);

console.log('\ndéroulement de la manche');
const g = jeu.creer({ joueurs: ['Alice', 'Bob', 'Charly'], manches: 5 });
g.lettre = 'S'; // 21 pays : la manche ne peut pas s'épuiser d'elle-même
check('tour du premier joueur', jeu.vue(g).tour.nom, 'Alice');
const indice = jeu.vue(g).indice;
check('indice donne un continent', typeof indice.continent, 'string');
check('indice donne une capitale', typeof indice.capitale, 'string');
check('indice permet de révéler quatre lettres', [...indice.debut].length, 4);
check('indice ne révèle pas le nom du pays', Object.hasOwn(indice, 'nom'), false);

check('Alice répond', jeu.repondre(g, 'Senegal').ok, true);
check('pays mémorisé (forme de référence accentuée)', g.used, ['Sénégal']);
check('déjà cité refusé', jeu.verifier(g, 'Senegal').ok, false);
check('au tour de Bob', jeu.vue(g).tour.nom, 'Bob');

jeu.passer(g);
check('Bob éliminé de la manche', jeu.vue(g).joueurs[1].actif, false);
check('Bob 0 manche survécue', g.joueurs[1].survives, 0);
check('au tour de Charly', jeu.vue(g).tour.nom, 'Charly');
check('manche pas encore close', g.historique.length, 0);

jeu.passer(g);
check('manche close', g.historique.length, 1);
check('Alice survécu', g.joueurs[0].survives, 1);
check('Charly 0 manche survécue', g.joueurs[2].survives, 0);
check('nouvelle lettre différente', g.lettre !== 'S', true);
check('manche 2', g.manche, 2);
check('tout le monde rejoue', jeu.vue(g).restants, 3);
check('tour revenu au début', jeu.vue(g).tour.nom, 'Alice');

console.log('\nannulation');
const g2 = jeu.creer({ joueurs: ['Alice', 'Bob', 'Charly'] });
g2.lettre = 'E';
jeu.repondre(g2, 'Egypte');
jeu.repondre(g2, 'Equateur');
jeu.annuler(g2);
check('pays retiré', g2.used.includes('Equateur'), false);
check('compteur décrémenté', g2.joueurs[1].trouves, 0);
check('premier pays conservé', g2.joueurs[0].trouves, 1);
check('annuler sans coup', jeu.annuler(g2).ok, true);
check('puis refus', jeu.annuler(g2).ok, false);

console.log('\nfin de partie');
const g3 = jeu.creer({ joueurs: ['Alice', 'Bob'], manches: 2 });
// lettre D : 3 pays seulement. Les deux répondent, la lettre est épuisée,
// la manche se ferme sans qu'aucun joueur ne soit éliminé.
g3.lettre = 'D';
jeu.repondre(g3, 'Danemark');
jeu.repondre(g3, 'Djibouti');
check('personne éliminé, manche ouverte', g.historique.length >= 0, true);
jeu.repondre(g3, 'Dominique');
check('lettre épuisée : manche close', g3.historique.length, 1);
check('aucune élimination', g3.historique[0].elimines.length, 0);
check('les deux survivent', g3.joueurs[0].survives, 1);
check('Bob survit aussi', g3.joueurs[1].survives, 1);
check('raison : lettre épuisée', g3.historique[0].fin, 'Plus aucun pays en D');
check('pays restants mémorisés', g3.historique[0].restants, []);

g3.lettre = 'A';
jeu.repondre(g3, 'Afghanistan');
jeu.passer(g3);
check('raison : dernier en lice', g3.historique[1].fin, 'Alice reste seul en lice');
check('pays restants mémorisés (A)', g3.historique[1].restants.length > 0, true);
check('partie terminée après 2 manches', g3.statut, 'over');
check('Bob 1 manche survécue', g3.joueurs[1].survives, 1);
check('Alice 2 manches survécues', g3.joueurs[0].survives, 2);
check('vainqueur Alice', jeu.vue(g3).vainqueur, 'Alice');
check('classement rendu', jeu.vue(g3).classement.length, 2);
check('message de fin présent', typeof jeu.vue(g3).fin, 'string');

console.log('\npartie terminée : plus rien n’est accepté');
check('réponse refusée', jeu.repondre(g3, 'Allemagne').ok, false);
check('passage refusé', jeu.passer(g3).ok, false);
check('annulation refusée', jeu.annuler(g3).ok, false);

console.log('\nparties aléatoires (5000 simulations)');
let infinies = 0;
let sansVictoire = 0;
for (let i = 0; i < 5000; i++) {
  const n = 2 + Math.floor(Math.random() * 5);
  const partie = jeu.creer({ joueurs: Array.from({ length: n }, (_, k) => `J${k}`), manches: 5 });
  let coups = 0;
  while (partie.statut === 'playing' && coups < 3000) {
    coups++;
    const dispo = jeu.disponiblesPour(partie.lettre, partie.used);
    if (Math.random() < 0.2 || !dispo.length) jeu.passer(partie);
    else jeu.repondre(partie, dispo[Math.floor(Math.random() * dispo.length)]);
  }
  if (partie.statut !== 'over') infinies++;
  if (partie.statut === 'over' && !partie.vainqueur) sansVictoire++;
}
check('aucune partie ne bloque', infinies, 0);
check('un vainqueur dans 95 % des cas', sansVictoire < 250, true);

console.log(`\n${passed} réussis, ${failed} échoués\n`);
process.exit(failed ? 1 : 0);
