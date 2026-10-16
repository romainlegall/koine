'use strict';

/* IIFE : scope local, cf. les autres vues. */
(function () {
  const App = window.App;
  const { escapeHtml: e, toast } = App.util;

  let state = { game: null, busy: false, joueurs: ['', '', ''], manches: 5 };

  /* ------------------------------------------------------------------ */
  /* Mise en place                                                       */
  /* ------------------------------------------------------------------ */

  function setupHtml() {
    const lignes = state.joueurs
      .map(
        (nom, i) => `
        <div class="row" data-ligne="${i}" style="gap:8px">
          <span class="seat-num">${i + 1}</span>
          <input type="text" data-joueur="${i}" value="${e(nom)}" placeholder="Joueur ${i + 1}"
                 autocomplete="off" maxlength="20" style="flex:1">
          ${state.joueurs.length > 2 ? `<button class="btn-sm btn-ghost btn-danger" data-remove="${i}" aria-label="Retirer">✕</button>` : ''}
        </div>`
      )
      .join('');

    return `
      <section class="card stack">
        <div>
          <strong>Qui joue ?</strong>
          <p class="muted small" style="margin:4px 0 0">
            Un seul écran : on passe l'appareil. Chacun son tour, l'app affiche la lettre.
          </p>
        </div>
        <div class="stack" id="joueurs" style="gap:8px">${lignes}</div>
        <div class="row">
          <button class="btn-sm" id="add-joueur">+ Ajouter un joueur</button>
          <span class="muted small" id="nb-joueurs"></span>
        </div>
        <label class="field" style="margin:0">
          <span>Nombre de manches</span>
          <select id="manches">
            ${[3, 5, 8, 12].map((n) => `<option value="${n}" ${state.manches === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
        <div class="row-end">
          <button class="btn-primary" id="start-btn">Commencer la partie</button>
        </div>
      </section>
      <section class="card">
        <strong>Les règles</strong>
        <ul class="rules small muted">
          <li>L'app tire une lettre. Chacun à son tour nomme un <strong>pays</strong> qui commence par cette lettre.</li>
          <li>Celui qui n'a plus de réponse est <strong>éliminé de la manche</strong> ; les autres continuent.</li>
          <li>Une manche se termine quand il ne reste qu'un joueur, quand la lettre n'a plus de pays, ou quand tout le monde a passé.</li>
          <li>Tout le monde rejoue à la manche suivante. Gagne celui qui survit au plus de manches.</li>
          <li>Un pays déjà cité ne peut pas être rejoué, même plus tard.</li>
          <li>Indices à 30, 60, 90, 120 et 150 secondes : continent, capitale, puis de 2 à 4 lettres.</li>
          <li>Le tour dure 3 minutes ; à la fin, l'app propose de passer ou de continuer.</li>
        </ul>
      </section>`;
  }

  /* ------------------------------------------------------------------ */
  /* Plateau                                                             */
  /* ------------------------------------------------------------------ */

  function playersHtml(game) {
    const parId = Object.fromEntries(game.joueurs.map((j) => [j.id, j]));
    return game.joueurs
      .map((j) => {
        const auTour = game.statut === 'playing' && game.tour && game.tour.id === j.id;
        return `
        <div class="seat ${j.actif ? '' : 'out'} ${auTour ? 'turn' : ''}">
          <div class="seat-name">${e(j.nom)}</div>
          <div class="seat-score">
            <span class="pill">${j.survives} ${j.survives > 1 ? 'manches' : 'manche'}</span>
            <span class="pill">${j.trouves} ${j.trouves > 1 ? 'pays' : 'pays'}</span>
          </div>
          ${j.pays.length ? `<div class="seat-pays">${j.pays.map((p) => `<span>${e(p)}</span>`).join('')}</div>` : ''}
        </div>`;
      })
      .join('');
  }

  function logHtml(game) {
    if (!game.coups.length) return '<p class="muted small">Personne n’a encore répondu.</p>';
    return game.coups
      .map((c) =>
        c.type === 'pays'
          ? `<li><strong>${e(c.nom)}</strong> — ${e(c.pays)}</li>`
          : `<li class="out"><strong>${e(c.nom)}</strong> — plus de pays en ${e(game.lettre)}</li>`
      )
      .join('');
  }

  function tableHtml(game) {
    if (!game.historique.length) return '';
    return `
      <details class="card">
        <summary>Manches précédentes (${game.historique.length})</summary>
        <div class="table-wrap" style="margin-top:12px">
          <table>
<thead><tr><th>Manche</th><th>Lettre</th><th>Pays</th><th>Éliminés</th><th>Restaient</th></tr></thead>
          <tbody>
            ${game.historique
              .map(
                (h) => `<tr>
                  <td>${h.manche}</td>
                  <td><strong>${e(h.lettre)}</strong></td>
                  <td class="small">${h.pays.map((p) => `${e(p.nom)} : ${e(p.pays)}`).join('<br>') || '—'}</td>
                  <td class="small muted">${h.elimines.map(e).join(', ') || 'personne'}</td>
                  <td class="small muted">${
                    h.restants ? e(h.restants.join(', ')) || '—' : '—'
                  }</td>
                </tr>`
              )
              .join('')}
          </tbody>
          </table>
        </div>
      </details>`;
  }

  function endHtml(game) {
    return `
      <section class="prompt-card">
        <div class="prompt-direction">Partie terminée — ${game.manches} manches</div>
        <div class="prompt-text">${e(game.vainqueur || 'Égalité')}</div>
        <p class="muted" style="margin:10px 0 0">${e(game.fin || '')}</p>
      </section>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Joueur</th><th>Manches survécues</th><th>Pays trouvés</th></tr></thead>
          <tbody>
            ${(game.classement.length ? game.classement : game.joueurs)
              .map(
                (j, i) => `<tr>
                  <td>${i + 1}</td>
                  <td>${e(j.nom)}</td>
                  <td>${j.survives}</td>
                  <td>${j.trouves}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="row-end">
        <button id="restart-btn">Rejouer</button>
        <a class="btn btn-primary" href="#/">Retour</a>
      </div>
      ${tableHtml(game)}`;
  }

  /* ------------------------------------------------------------------ */
  /* Indices progressifs                                                 */
  /* ------------------------------------------------------------------ */

  // Secondes avant les indices : continent, capitale, puis 2, 3 et 4 lettres.
  const DELAI_INDICES = [30, 60, 90, 120, 150];
  const DUREE_TOUR = 180;

  const minuterie = {
    cle: null,
    depart: 0,
    reveles: 0,
    tempsEcoule: false,
    continuerApresTemps: false,
    handle: null,
  };

function arreterMinuterie() {
  if (minuterie.handle) {
    clearInterval(minuterie.handle);
    minuterie.handle = null;
  }
}

/**
 * Reprend ou relance la minuterie. La clé renvoyée par le serveur change dès
 * que le joueur, la lettre ou le nombre de pays disponibles change : c'est ce
 * qui permet de ne pas repartir de zéro sur un simple re-rendu.
 */
function armerIndices(root, game) {
  arreterMinuterie();
  if (game.statut !== 'playing' || !game.indice) return;

  if (minuterie.cle !== game.indiceCle) {
    minuterie.cle = game.indiceCle;
    minuterie.depart = Date.now();
    minuterie.reveles = 0;
    minuterie.tempsEcoule = false;
    minuterie.continuerApresTemps = false;
  }
  peindreIndices(root, game);

  minuterie.handle = setInterval(() => {
    const ecoulees = Math.floor((Date.now() - minuterie.depart) / 1000);
    const dus = DELAI_INDICES.filter((d) => ecoulees >= d).length;
    let changement = false;
    if (dus > minuterie.reveles) {
      minuterie.reveles = dus;
      changement = true;
    }
    if (ecoulees >= DUREE_TOUR && !minuterie.tempsEcoule) {
      minuterie.tempsEcoule = true;
      changement = true;
    }
    if (changement) peindreIndices(root, game);
    else actualiserCompteARebours(root);
    if (ecoulees >= DUREE_TOUR) arreterMinuterie();
  }, 1000);
}

function peindreIndices(root, game) {
  const zone = root.querySelector('#indices');
  if (!zone) return;
  const i = game.indice;
  const reveles = minuterie.reveles;

  const lignes = [];
  if (reveles >= 1) lignes.push(['Continent', i.continent]);
  if (reveles >= 2) lignes.push(['Capitale', i.capitale]);
  if (reveles >= 3) {
    const nbLettres = reveles - 1;
    const debut = [...i.debut].slice(0, nbLettres).join('');
    lignes.push([`${nbLettres} premières lettres`, `${debut}…`]);
  }

  zone.innerHTML = `
    <p class="hints-note">Ces indices concernent un pays encore disponible. Vous pouvez aussi en proposer un autre de la même lettre.</p>
    ${
      lignes.length
        ? `<div class="hints-liste">${lignes
            .map(([label, valeur]) => `<span class="hint"><b>${e(label)}</b> ${e(valeur)}</span>`)
            .join('')}</div>`
        : ''
    }
    <div class="hints-attente">
      <span id="hint-countdown"></span>
      ${
        reveles < DELAI_INDICES.length && !minuterie.tempsEcoule
          ? `<button class="btn-sm btn-ghost" id="donner-indice">Révéler maintenant</button>`
          : ''
      }
    </div>
    <div id="tour-expire" class="tour-expire"></div>`;

  const bouton = zone.querySelector('#donner-indice');
  if (bouton) {
    bouton.addEventListener('click', () => {
      if (minuterie.reveles < DELAI_INDICES.length) {
        minuterie.reveles += 1;
        peindreIndices(root, game);
      }
    });
  }
  actualiserCompteARebours(root);
}

function actualiserCompteARebours(root) {
  const node = root.querySelector('#hint-countdown');
  if (!node) return;
  const ecoulees = Math.floor((Date.now() - minuterie.depart) / 1000);
  const tempsRestant = Math.max(0, DUREE_TOUR - ecoulees);
  const minutes = Math.floor(tempsRestant / 60);
  const secondes = String(tempsRestant % 60).padStart(2, '0');
  const prochainPalier = DELAI_INDICES.find((d) => d > ecoulees);
  const indiceTexte =
    minuterie.reveles < DELAI_INDICES.length && prochainPalier
      ? `Prochain indice dans <b>${Math.max(0, prochainPalier - ecoulees)} s</b>`
      : 'Tous les indices sont donnés.';
  node.innerHTML = `${indiceTexte} <span class="hints-separator">·</span> Temps restant <b>${minutes}:${secondes}</b>`;

  const alerte = root.querySelector('#tour-expire');
  if (!alerte) return;
  if (!minuterie.tempsEcoule) {
    alerte.innerHTML = '';
  } else if (minuterie.continuerApresTemps) {
    alerte.innerHTML = '<p class="small muted">Temps écoulé — tu peux continuer à chercher.</p>';
  } else {
    alerte.innerHTML = `
      <div class="timeout-prompt">
        <strong>Temps écoulé !</strong>
        <span>Tu veux passer ton tour ?</span>
        <div class="row">
          <button class="btn-sm btn-primary" id="passer-temps">Passer mon tour</button>
          <button class="btn-sm btn-ghost" id="continuer-temps">Continuer à chercher</button>
        </div>
      </div>`;
    alerte.querySelector('#passer-temps').addEventListener('click', () => root.querySelector('#passer-btn')?.click());
    alerte.querySelector('#continuer-temps').addEventListener('click', () => {
      minuterie.continuerApresTemps = true;
      actualiserCompteARebours(root);
    });
  }
}

function boardHtml(game) {
    if (game.statut === 'over') return endHtml(game);

    return `
      <div class="progress-head">
        <span>Manche ${game.manche}/${game.manchesMax}</span>
        <div class="progress-track">
          <div class="progress-fill" style="width:${(game.manche / game.manchesMax) * 100}%"></div>
        </div>
        <button class="btn-sm btn-ghost" id="quit-pays">Quitter</button>
      </div>

      <div class="letter-card">
        <div class="prompt-direction">Trouve un pays commençant par</div>
        <div class="letter">${e(game.lettre)}</div>
      <div class="turn-line">Au tour de <strong>${e(game.tour ? game.tour.nom : '—')}</strong></div>
      </div>

      <section class="card hints-card" id="indices" aria-live="polite" aria-label="Indices"></section>

      <div class="seat-grid">${playersHtml(game)}</div>

      <div class="answer-row">
        <input type="text" id="pays-saisie" placeholder="Pays commençant par ${e(game.lettre)}…"
               autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="btn-primary" id="valider-pays">Valider</button>
      </div>
      <p id="pays-message" class="pays-message"></p>

      <div class="row">
        <button class="btn-sm btn-ghost" id="passer-btn">Je n’ai plus de pays</button>
        <button class="btn-sm btn-ghost" id="annuler-btn">Annuler le dernier coup</button>
        <span class="muted small" style="margin-left:auto">${game.disponibles} pays encore disponibles pour ${e(game.lettre)}</span>
      </div>

      <section class="card">
        <strong>Cette manche</strong>
        <ul class="log">${logHtml(game)}</ul>
      </section>
      ${tableHtml(game)}`;
  }

  /* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Récapitulatif de fin de manche                                       */
/* ------------------------------------------------------------------ */

function recapHtml(game) {
  const h = game.historique[game.historique.length - 1];
  if (!h) return '';
  // la raison est celle figee a la cloture de la manche
  const raison =
    h.fin ||
    (h.elimines.length === game.joueurs.length
      ? 'Tout le monde a passé'
      : h.restants && !h.restants.length
      ? `Plus aucun pays en ${String(h.lettre).toUpperCase()}`
      : 'Manche terminée'); // filet de securite : la raison est toujours presente

  return `
    <section class="prompt-card">
      <div class="prompt-direction">Fin de la manche ${h.manche}</div>
      <div class="prompt-text">${e(h.lettre)}</div>
      <p class="muted" style="margin:8px 0 0">${e(raison)}</p>
    </section>

    <section class="card stack">
      <div>
        <strong>Trouvés cette manche</strong>
        ${
          h.pays.length
            ? `<ul class="log" style="margin-top:8px">${h.pays
                .map((p) => `<li><strong>${e(p.nom)}</strong> — ${e(p.pays)}</li>`)
                .join('')}</ul>`
            : '<p class="muted small" style="margin:6px 0 0">Personne n’a rien trouvé.</p>'
        }
      </div>
      ${
        h.elimines.length
          ? `<div class="small" style="color:var(--bad)">Éliminés : ${h.elimines.map(e).join(', ')}</div>`
          : ''
      }
    </section>

    <section class="card restants-card">
      <div>
        <strong>Restaient à trouver</strong>
        ${
          h.restants && h.restants.length
            ? `<p class="muted small" style="margin:4px 0 10px">
                 ${h.restants.length} pays en ${e(h.lettre)} que personne n’a cités :
               </p>
               <div class="restants">${h.restants.map((p) => `<span>${e(p)}</span>`).join('')}</div>`
            : `<p class="muted small" style="margin:6px 0 0">${
                h.restants
                  ? 'Personne ne restait : la lettre a été épuisée.'
                  : 'Information indisponible pour cette manche.'
              }</p>`
        }
      </div>
    </section>

    <div class="row-end">
      <button class="btn-primary" id="suivante-btn">Manche ${game.manche} <kbd>Entrée</kbd></button>
    </div>`;
}

function bindRecap(root, game) {
  const suivant = async () => {
    if (state.busy) return;
    state.busy = true;
    try {
      render(root, await App.api.countries(game.id));
    } catch (err) {
      state.busy = false;
      toast(err.message, 'error');
    }
  };
  const btn = root.querySelector('#suivante-btn');
  btn.addEventListener('click', suivant);
  btn.focus();
}

/* ------------------------------------------------------------------ */

function render(root, game, evenement) {
  arreterMinuterie();
  state.game = game;
  // le verrou sert a empiler deux appels avant reponse ; une fois l'ecran
  // reconstruit il doit etre libere, sinon les boutons suivants ne font rien
  state.busy = false;
  // l'identifiant reste dans l'URL : un rafraichissement ne perd pas la partie
  if (game && game.statut !== 'over' && location.hash !== `#/pays/${game.id}`) {
    history.replaceState(null, '', `#/pays/${game.id}`);
  }

  // fin de manche : on montre le recap avant d'enchainer
  if (game.statut === 'playing' && evenement === 'manche' && game.historique.length) {
    root.innerHTML = `<div class="play play-pays">${recapHtml(game)}</div>`;
    bindRecap(root, game);
    return;
  }

  const focus = game.statut === 'playing' && !state.busy;
  root.innerHTML = `<div class="play play-pays">${boardHtml(game)}</div>`;
  armerIndices(root, game);
  if (focus) {
    const input = root.querySelector('#pays-saisie');
    if (input) input.focus();
  }
  bind(root, game);
}

  function bind(root, game) {
    if (game.statut === 'over') {
root.querySelector('#restart-btn').addEventListener('click', async () => {
      await App.api.abandonCountries(game.id).catch(() => {});
      state.joueurs = game.joueurs.map((j) => j.nom);
      state.game = null;
      location.hash = '#/pays';
      startScreen(root);
    });
    return;
  }

    const input = root.querySelector('#pays-saisie');
    const message = root.querySelector('#pays-message');

    root.querySelector('#valider-pays').addEventListener('click', () => valider());
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        valider();
      }
    });

    async function valider() {
      if (state.busy) return;
      const nom = input.value.trim();
      if (!nom) return;
      state.busy = true;
      input.disabled = true;
      try {
        // le coup est accepte : le journal affiche la forme de reference exacte,
        // ce qui signale aussi une faute de frappe corrigee
        const res = await App.api.countriesAnswer(game.id, nom);
        render(root, res, res.evenement);
      } catch (err) {
        state.busy = false;
        input.disabled = false;
        input.focus();
        message.textContent = err.message;
        message.className = `pays-message ko ${err.suggestion ? 'hint' : ''}`;
        if (err.suggestion) {
          const btn = document.createElement('button');
          btn.className = 'btn-sm';
          btn.textContent = err.suggestion;
          btn.addEventListener('click', () => {
            input.value = err.suggestion;
            valider();
          });
          message.append(' ', btn);
        }
      }
    }

    root.querySelector('#passer-btn').addEventListener('click', async () => {
      if (state.busy) return;
      state.busy = true;
      try {
        const res = await App.api.countriesPass(game.id);
        render(root, res, res.evenement);
      } catch (err) {
        state.busy = false;
        toast(err.message, 'error');
      }
    });

    root.querySelector('#annuler-btn').addEventListener('click', async () => {
      if (state.busy) return;
      state.busy = true;
      try {
        render(root, await App.api.countriesUndo(game.id));
      } catch (err) {
        state.busy = false;
        toast(err.message, 'error');
      }
    });

root.querySelector('#quit-pays').addEventListener('click', async () => {
    await App.api.abandonCountries(game.id).catch(() => {});
    state.game = null;
    location.hash = '#/pays';
    startScreen(root);
  });
}

  function startScreen(root) {
    root.innerHTML = `
      <div class="page-head">
        <div><h1>Jeu des pays</h1><p>Un joueur restant à la fin d’une manche l’emporte</p></div>
      </div>
      <div class="stack" id="setup">${setupHtml()}</div>`;

    const maj = () => {
      root.querySelector('#setup').innerHTML = setupHtml();
      wire(root);
    };

    function wire(root) {
      const compte = root.querySelectorAll('[data-joueur]').length;
      const nb = root.querySelector('#nb-joueurs');
      if (nb) nb.textContent = `${compte} joueurs`;

      root.querySelectorAll('[data-joueur]').forEach((input) => {
        input.addEventListener('input', (ev) => {
          state.joueurs[Number(ev.target.dataset.joueur)] = ev.target.value;
        });
      });

      root.querySelector('#add-joueur').addEventListener('click', () => {
        if (state.joueurs.length >= 8) return toast('Huit joueurs au maximum.', 'error');
        state.joueurs.push('');
        maj();
        const inputs = root.querySelectorAll('[data-joueur]');
        if (inputs.length) inputs[inputs.length - 1].focus();
      });

      root.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.joueurs.splice(Number(btn.dataset.remove), 1);
          maj();
        });
      });

      root.querySelector('#manches').addEventListener('change', (ev) => {
        state.manches = Number(ev.target.value);
      });

      root.querySelector('#start-btn').addEventListener('click', async () => {
        const noms = state.joueurs.map((n) => n.trim()).filter(Boolean);
        if (noms.length < 2) return toast('Au moins deux joueurs, avec un nom chacun.', 'error');
        try {
          const game = await App.api.startCountries({ joueurs: noms, manches: state.manches });
          state.busy = false;
          render(root, game);
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }

    wire(root);
  }

App.views.pays = {
    async render(root, params) {
    // #/pays/<id> : on reprend la partie même apres un rafraichissement
    if (params && params.id) {
      try {
        const game = await App.api.countries(params.id);
        state.busy = false;
        render(root, game);
        return;
      } catch {
        state.game = null;
        toast('Partie introuvable ou expirée : on recommence.', 'error');
      }
    }
    if (state.game) {
      try {
        render(root, await App.api.countries(state.game.id));
        return;
      } catch {
        state.game = null;
      }
    }
    startScreen(root);
  },
};
})();
