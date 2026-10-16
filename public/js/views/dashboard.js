'use strict';

/* IIFE : un script classique partage la portée lexicale globale, deux vues
   qui déclarent `toast` ou `e` casseraient le chargement. */
(function () {
  const { escapeHtml: e, toast, pairLabel, masteryBar, relativeTime } = App.util;

  const SETTINGS_KEY = 'jv2.session';

  const state = {
    decks: [],
    selected: new Set(),
    direction: 'mixed',
    size: 20,
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      state.direction = saved.direction || 'mixed';
      state.size = saved.size || 20;
      if (Array.isArray(saved.selected)) state.selected = new Set(saved.selected);
    } catch {
      /* réglages absents : valeurs par défaut */
    }
  }

  function saveSettings() {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ direction: state.direction, size: state.size, selected: [...state.selected] })
    );
  }

  function totalDue() {
    return state.decks.filter((d) => state.selected.has(d.name)).reduce((n, d) => n + d.due, 0);
  }

  function renderSetup() {
    const chips = state.decks
      .map((deck) => {
        const on = state.selected.has(deck.name);
        return `<button type="button" class="chip ${on ? 'on' : ''}" data-deck="${e(deck.name)}">
          ${e(deck.name.replace(/\.csv$/i, ''))}
          ${deck.due ? `<span class="chip-due">${deck.due}</span>` : ''}
        </button>`;
      })
      .join('');

    return `
      <section class="card stack">
        <div>
          <strong>Nouvelle session</strong>
          <p class="muted small" style="margin:4px 0 0">
            ${totalDue()} carte${totalDue() > 1 ? 's' : ''} à réviser dans la sélection.
            Les cartes dues ou jamais vues remontent en priorité.
          </p>
        </div>
        <div class="row" id="deck-chips">${chips || '<span class="muted small">Aucun deck pour l’instant.</span>'}</div>
        <div class="grid-2">
          <label class="field">
            <span>Sens de la traduction</span>
            <select id="opt-direction">
              <option value="mixed" ${state.direction === 'mixed' ? 'selected' : ''}>Alterné (recommandé)</option>
              <option value="forward" ${state.direction === 'forward' ? 'selected' : ''}>Langue source → cible</option>
              <option value="reverse" ${state.direction === 'reverse' ? 'selected' : ''}>Langue cible → source</option>
            </select>
          </label>
          <label class="field">
            <span>Nombre de cartes</span>
            <select id="opt-size">
              ${[10, 20, 30, 50, 100].map((n) => `<option value="${n}" ${state.size === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="row-end">
          <button class="btn-primary" id="play-btn">Lancer la session</button>
        </div>
      </section>`;
  }

  function renderDeck(deck) {
    const due = deck.due > 0;
    return `
      <article class="deck">
        <div>
          <h3>${e(deck.name.replace(/\.csv$/i, ''))} <span class="pair-pill">${e(pairLabel(deck.source, deck.target))}</span></h3>
          <p class="pair">
            ${deck.count} carte${deck.count > 1 ? 's' : ''}
            ${deck.accuracy !== null ? ` · ${deck.accuracy} % de réussite` : ''}
            ${deck.averageScore !== null ? ` · score moyen ${deck.averageScore}/100` : ''}
          </p>
          <div style="margin-top:10px;max-width:320px">${masteryBar(deck.levels, deck.count)}</div>
          <p class="small muted" style="margin:8px 0 0">
            ${deck.levels.new} nouvelles · ${deck.levels.mastered} acquises
            ${due ? ` · <strong style="color:var(--bad)">${deck.due} à réviser</strong>` : ''}
          </p>
        </div>
        <div class="actions">
          <a class="btn btn-sm" href="#/deck/${encodeURIComponent(deck.name)}">Éditer</a>
          <a class="btn btn-sm" href="#/stats/${encodeURIComponent(deck.name)}">Stats</a>
          <button class="btn-primary btn-sm" data-play-one="${e(deck.name)}">Jouer</button>
        </div>
      </article>`;
  }

  App.views.dashboard = {
    async render(root) {
      loadSettings();
      state.decks = await App.api.decks();

      if (!state.selected.size) {
        state.decks.forEach((d) => state.selected.add(d.name));
      }
      // les decks supprimés ne doivent pas rester dans la sélection
      [...state.selected].forEach((name) => {
        if (!state.decks.some((d) => d.name === name)) state.selected.delete(name);
      });
      saveSettings();

      root.innerHTML = `
        <div class="page-head">
          <div>
            <h1>Decks</h1>
            <p>${state.decks.length} deck${state.decks.length > 1 ? 's' : ''} · ${state.decks.reduce((n, d) => n + d.count, 0)} cartes au total</p>
          </div>
          <div class="row">
            <button id="new-deck">Nouveau deck</button>
          </div>
        </div>
        <div class="stack">
          ${renderSetup()}
          <div class="deck-list">${state.decks.map(renderDeck).join('') || '<div class="empty"><h3>Aucun deck</h3><p>Créez un deck ou importez un fichier CSV pour commencer.</p></div>'}</div>
        </div>`;

      App.util.once(root, 'click', (ev) => {
        const chip = ev.target.closest('.chip');
        if (chip) {
          const name = chip.dataset.deck;
          if (state.selected.has(name)) state.selected.delete(name);
          else state.selected.add(name);
          saveSettings();
          App.views.dashboard.render(root);
          return;
        }

        const one = ev.target.closest('[data-play-one]');
        if (one) {
          startSession({ decks: [one.dataset.playOne], direction: state.direction, size: state.size });
          return;
        }

        if (ev.target.closest('#play-btn')) {
          if (!state.selected.size) return toast('Sélectionnez au moins un deck.', 'error');
          startSession({ decks: [...state.selected], direction: state.direction, size: state.size });
          return;
        }

        if (ev.target.closest('#new-deck')) openNewDeckDialog(root);
      });

      root.querySelector('#opt-direction').addEventListener('change', (ev) => {
        state.direction = ev.target.value;
        saveSettings();
      });
      root.querySelector('#opt-size').addEventListener('change', (ev) => {
        state.size = Number(ev.target.value);
        saveSettings();
      });
    },
  };

  function startSession(payload) {
    location.hash = `#/play?${new URLSearchParams({
      decks: payload.decks.join(','),
      direction: payload.direction,
      size: String(payload.size),
    })}`;
  }

  function openNewDeckDialog(root) {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <form method="dialog" class="stack" id="new-deck-form">
        <strong>Nouveau deck</strong>
        <label class="field">
          <span>Nom du fichier</span>
          <input type="text" name="name" placeholder="ex : japonais.csv" required>
        </label>
        <div class="grid-2">
          <label class="field"><span>Langue source</span><input type="text" name="source" placeholder="JA" maxlength="8"></label>
          <label class="field"><span>Langue cible</span><input type="text" name="target" placeholder="FR" maxlength="8"></label>
        </div>
        <label class="field">
          <span>Coller un CSV (optionnel)</span>
          <textarea name="csv" placeholder="question,response,alt&#10;こんにちは,bonjour"></textarea>
        </label>
        <p class="small muted">Le nom peut contenir la paire de langues : <code>fr-en.csv</code> les détectera automatiquement.</p>
        <div class="row-end">
          <button type="button" class="btn-ghost" data-close>Annuler</button>
          <button class="btn-primary" type="submit">Créer</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    const form = dialog.querySelector('form');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      if (!name.toLowerCase().endsWith('.csv')) form.elements.name.value = `${name}.csv`;
      try {
        await App.api.createDeck({
          name: form.elements.name.value,
          source: data.get('source'),
          target: data.get('target'),
          csv: data.get('csv'),
        });
        dialog.close();
        location.hash = `#/deck/${encodeURIComponent(form.elements.name.value)}`;
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
    dialog.querySelector('input[name=name]').focus();
  }
})();
