'use strict';

/**
 * Jeu des pays.
 *
 * L'app tire une lettre. Chaque joueur à tour de rôle doit nommer un pays
 * commençant par cette lettre. Dès qu'un joueur n'a plus de réponse il est
 * éliminé de la manche, les autres continuent. La manche s'arrête quand il ne
 * reste personne, ou quand la lettre n'a plus de pays disponible ; une nouvelle
 * lettre est alors tirée et tout le monde rejoue.
 *
 * La partie s'arrête quand un seul joueur n'a jamais été éliminé : c'est le
 * vainqueur. Si personne ne survit à une manche, c'est une égalité.
 *
 * Un pays déjà cité n'est plus rejouable, même lors d'une manche suivante.
 */

const crypto = require('crypto');

const { LETTRES, trouver, paysPour, plusProche, FORME } = require('../countries');

const LETTRE_DU_JEU = (l) => FORME(l).charAt(0);

/** Pays encore disponibles pour une lettre. */
function disponiblesPour(lettre, used) {
  return paysPour(lettre).filter((p) => !used.includes(p));
}

/**
 * Tirage d'une lettre.
 *
 * Deux contraintes :
 *   - la lettre ne doit pas être celle de la manche précédente ;
 *   - il faut qu'il reste assez de pays pour que chacun ait une chance. Tirer
 *     Q (un seul pays au total) donnerait une manche d'un seul coup, sans jeu.
 *
 * Le tirage est pondéré par la racine carrée du nombre de pays disponibles :
 * les lettres riches sortent plus souvent, les rares restent possibles. Si
 * aucune lettre n'a assez de pays — en fin de partie, la liste se vide — on
 * prend la plus riche qui reste.
 *
 * @param {string[]} used pays déjà cités
 * @param {string[]} interdites lettres à exclure
 * @param {number} minimum nombre de joueurs à nourrir
 */
function tirerLettre(used, interdites = [], minimum = 2) {
  const candidats = [];
  const reste = [];

  for (const lettre of LETTRES) {
    if (interdites.includes(lettre)) continue;
    const dispo = disponiblesPour(lettre, used).length;
    if (!dispo) continue;
    reste.push({ lettre, dispo });
    if (dispo < minimum) continue;
    for (let i = 0; i < Math.round(Math.sqrt(dispo)); i++) candidats.push(lettre);
  }

  if (!candidats.length) {
    reste.sort((a, b) => b.dispo - a.dispo);
    return reste.length ? reste[0].lettre : null;
  }
  return candidats[Math.floor(Math.random() * candidats.length)];
}

function nouveauJoueur(nom, i) {
  return {
    id: `j${i}_${crypto.randomBytes(3).toString('hex')}`,
    nom: String(nom).trim().slice(0, 20) || `Joueur ${i + 1}`,
    eliminations: 0,
    survives: 0,
    trouves: 0,
    pays: [],
  };
}

function creer({ joueurs, manches = 5 }) {
  const liste = (joueurs || []).map((n, i) => nouveauJoueur(n, i));
  if (liste.length < 2) throw new Error('Il faut au moins deux joueurs.');

  const game = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    manchesMax: Math.min(Math.max(parseInt(manches,10)||5,1),20),
    joueurs: liste,
    manche: 1,
    lettre: null,
    tour: 0,
    used: [],
    coups: [], // { type: 'pays'|'passe', joueur, pays }
    historique: [],
    statut: 'playing',
    vainqueur: null,
  };
  game.lettre = tirerLettre(game.used, [], liste.length);
  if (!game.lettre) {
    game.statut = 'over';
    game.fin = 'Aucun pays disponible.';
  }
  return game;
}

function estActif(game, joueur) {
  return !game.coups.some((c) => c.type === 'passe' && c.joueur === joueur.id);
}

function joueurCourant(game) {
  for (let i = 0; i < game.joueurs.length; i++) {
    const idx = (game.tour + i) % game.joueurs.length;
    if (estActif(game, game.joueurs[idx])) return game.joueurs[idx];
  }
  return null;
}

/** Avance le curseur jusqu'au prochain joueur encore en lice. */
function tourner(game) {
  const courant = joueurCourant(game);
  game.tour = courant ? game.joueurs.indexOf(courant) : game.tour;
  return courant;
}

/**
 * Vérifie une réponse.
 * @returns {{ok: boolean, raison?: string, pays?: string, suggestion?: string}}
 */
function verifier(game, nom) {
  const lettre = LETTRE_DU_JEU(game.lettre);
  const saisie = String(nom || '').trim();

  if (!saisie) return { ok: false, raison: 'Aucun nom saisi.' };

  const trouve = trouver(saisie);
  if (!trouve) {
    // faute de frappe : on montre l'ecriture attendue plutot que de dire non
    const proche = plusProche(saisie, game.lettre);
    return {
      ok: false,
      raison: proche
        ? `« ${saisie} » n’est pas dans la liste. Voulez-vous dire « ${proche.canonique} » ?`
        : 'Ce n’est pas un pays de la liste.',
      suggestion: proche ? proche.canonique : undefined,
    };
  }
  if (trouve.lettre !== lettre) {
    return {
      ok: false,
      raison: `« ${saisie} » commence par « ${premierCaractere(saisie)} », pas par ${String(game.lettre).toUpperCase()}.`,
    };
  }
  if (game.used.includes(trouve.canonique)) {
    return { ok: false, raison: `« ${trouve.canonique} » a déjà été cité cette partie.` };
  }

  // proche mais pas exact : on montre la bonne écriture
  const proche = plusProche(saisie, game.lettre);
  return { ok: true, pays: trouve.canonique, suggestion: proche ? proche.canonique : undefined };
}

function premierCaractere(s) {
  return FORME(s).charAt(0).toUpperCase();
}

/**
 * Enregistre une réponse correcte.
 * @returns {{ok: boolean, raison?: string}}
 */
function repondre(game, nom) {
  if (game.statut !== 'playing') return { ok: false, raison: 'La partie est terminée.' };
  const verdict = verifier(game, nom);
  if (!verdict.ok) return verdict;

  const joueur = joueurCourant(game);
  if (!joueur) return { ok: false, raison: 'Plus personne ne joue.' };

  game.used.push(verdict.pays);
  game.coups.push({ type: 'pays', joueur: joueur.id, nom: joueur.nom, pays: verdict.pays });
  joueur.trouves += 1;
  joueur.pays.push(verdict.pays);

  game.tour = (game.tour + 1) % game.joueurs.length;
  return { ok: true, pays: verdict.pays, suggestion: verdict.suggestion, evenement: evenement(avancer(game)) };
}

/**
 * Traduit le retour d'avancer() en mot lisible par le client, qui peut ainsi
 * afficher le récapitulatif au lieu d'enchaîner directement sur la manche
 * suivante.
 * @returns {'manche'|'partie'|'tour'}
 */
function evenement(resultat) {
  if (!resultat) return 'tour';
  if (resultat.finPartie) return 'partie';
  if (resultat.finManche) return 'manche';
  return 'tour';
}

/** Le joueur passe son tour : il quitte la manche. */
function passer(game) {
  if (game.statut !== 'playing') return { ok: false, raison: 'La partie est terminée.' };
  const joueur = joueurCourant(game);
  if (!joueur) return { ok: false, raison: 'Plus personne ne joue.' };

  game.coups.push({ type: 'passe', joueur: joueur.id, nom: joueur.nom });
  joueur.eliminations += 1;

  game.tour = (game.tour + 1) % game.joueurs.length;
  return { ok: true, elimine: joueur.nom, evenement: evenement(avancer(game)) };
}

/** Annule le dernier coup joué (pays ou passage). */
function annuler(game) {
  if (game.statut !== 'playing') return { ok: false, raison: 'La partie est terminée.' };
  const coup = game.coups.pop();
  if (!coup) return { ok: false, raison: 'Rien à annuler.' };

  const joueur = game.joueurs.find((j) => j.id === coup.joueur);
  if (joueur) {
    if (coup.type === 'pays') {
      const i = game.used.lastIndexOf(coup.pays);
      if (i !== -1) game.used.splice(i, 1);
      joueur.trouves = Math.max(0, joueur.trouves - 1);
      joueur.pays = joueur.pays.filter((p) => p !== coup.pays);
    } else {
      joueur.eliminations = Math.max(0, joueur.eliminations - 1);
    }
  }
  game.tour = game.joueurs.indexOf(joueur) >= 0 ? game.joueurs.indexOf(joueur) : 0;
  return { ok: true, annule: coup.pays || `${coup.nom} passe` };
}

/**
 * Fait avancer la partie.
 *
 * Une manche s'arrête dans trois cas :
 *   - il ne reste qu'un joueur en lice ;
 *   - la lettre n'a plus aucun pays disponible ;
 *   - tout le monde a passé son tour.
 *
 * Les joueurs sortis reviennent à la manche suivante : c'est le nombre de
 * manches survécues qui départage, pas la dernière manche. La partie s'arrête
 * au bout de `manchesMax` manches — sans quoi elle ne finirait jamais.
 *
 * @returns {{finManche?: boolean, finPartie?: boolean}}
 */
function avancer(game) {
  const restants = game.joueurs.filter((j) => estActif(game, j));
  const paysRestants = disponiblesPour(game.lettre, game.used).length;

  const finDeManche = restants.length <= 1 || paysRestants === 0;

  if (!finDeManche) {
    tourner(game);
    return {};
  }

  // La raison est figee ici : apres nouvelleManche() le tableau "actif" ne parle
  // plus de la manche qui vient de finir, on ne pourrait plus deduire qui etait
  // encore en lice.
  //
  // Deux issues. L'ordre compte : une lettre epuisee prime, meme si plusieurs
  // joueurs sont encore en lice. Sinon il ne reste qu'un joueur — il n'a donc
  // pas eu a passer son tour. "Tout le monde a passé" est inatteignable avec
  // deux joueurs minimum : la manche se ferme a un joueur restant.
  const raison =
    paysRestants === 0
      ? `Plus aucun pays en ${String(game.lettre).toUpperCase()}`
      : restants.length
      ? `${restants[0].nom} reste seul en lice`
      : 'Tout le monde a passé';

  const elimines = game.coups.filter((c) => c.type === 'passe').map((c) => c.joueur);
  cloreManche(game, elimines, raison);

  // un joueur qui n'a pas été éliminé marque une manche survécue
  for (const joueur of game.joueurs) {
    if (!elimines.includes(joueur.id)) joueur.survives += 1;
  }

  if (game.historique.length >= game.manchesMax) return terminer(game);

  game.manche += 1;
  const lettre = tirerLettre(game.used, [game.lettre], game.joueurs.length);
  if (!lettre) return terminer(game, 'Tous les pays de la liste ont été cités.');

  game.lettre = lettre;
  game.coups = [];
  game.tour = 0;
  return { finManche: true };
}

/** Départage final : manches survécues, puis pays trouvés. */
function terminer(game, raison) {
  game.statut = 'over';
  const rang = [...game.joueurs].sort((a, b) => b.survives - a.survives || b.trouves - a.trouves);
  const tete = rang.filter((j) => j.survives === rang[0].survives && j.trouves === rang[0].trouves);

  game.vainqueur = tete.length === 1 ? tete[0].id : null;
  game.classement = rang.map((j) => ({ id: j.id, nom: j.nom, survives: j.survives, trouves: j.trouves }));

  if (raison) {
    game.fin = `${raison} Départage au nombre de pays trouvés.`;
  } else if (tete.length === 1) {
    game.fin = `${tete[0].nom} remporte la partie : ${rang[0].survives} manche${rang[0].survives > 1 ? 's' : ''} survécue${rang[0].survives > 1 ? 's' : ''} sur ${game.manchesMax}, ${rang[0].trouves} pays trouvé${rang[0].trouves > 1 ? 's' : ''}.`;
  } else {
    game.fin = `Égalité : ${tete.map((j) => j.nom).join(', ')} ont le même score.`;
  }
  return { finManche: true, finPartie: true };
}

function cloreManche(game, elimines = [], raison = '') {
  game.historique.push({
    manche: game.manche,
    lettre: game.lettre,
    pays: game.coups.filter((c) => c.type === 'pays').map((c) => ({ nom: c.nom, pays: c.pays })),
    elimines: elimines.map((id) => (game.joueurs.find((j) => j.id === id) || {}).nom),
    // ce qu'il restait à trouver : c'est ce qui manquait pour tenir la manche
    restants: disponiblesPour(game.lettre, game.used),
    fin: raison,
  });
  game.coups = [];
}

/** Vue destinee au client : jamais d'etat interne inutile. */
function vue(game) {
  const courant = game.statut === 'playing' ? joueurCourant(game) : null;
  return {
    id: game.id,
    statut: game.statut,
    manche: game.manche,
    manchesMax: game.manchesMax,
    lettre: game.lettre,
    tour: courant ? { id: courant.id, nom: courant.nom } : null,
    restants: game.joueurs.filter((j) => estActif(game, j)).length,
    disponibles: game.lettre ? disponiblesPour(game.lettre, game.used).length : 0,
    joueurs: game.joueurs.map((j) => ({
      id: j.id,
      nom: j.nom,
      actif: estActif(game, j),
      trouves: j.trouves,
      survives: j.survives,
      eliminations: j.eliminations,
      pays: j.pays,
    })),
    coups: game.coups.map((c) => ({
      type: c.type,
      nom: c.nom,
      pays: c.pays || null,
    })),
    dejaCite: game.used,
    historique: game.historique,
    vainqueur: game.vainqueur
      ? (game.joueurs.find((j) => j.id === game.vainqueur) || {}).nom
      : null,
    classement: game.classement || [],
    fin: game.fin || null,
  };
}

module.exports = {
  creer,
  repondre,
  passer,
  annuler,
  verifier,
  vue,
  disponiblesPour,
  tirerLettre,
  joueurCourant,
};