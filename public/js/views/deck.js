'use strict';

/* IIFE : un script classique partage la portée lexicale globale, deux vues
   qui déclarent `toast` ou `e` casseraient le chargement. */
(function () {
  const { escapeHtml: e, toast, pairLabel, relativeTime } = App.util;

  const state = { name: '', entries: [], meta: {}, filter: '', editing: null };

  function rowHtml(entry) {
    if (state.editing === entry.id) {
      return `
        <tr>
          <td><input type="text" data-f="source" value="${e(entry.source)}"></td>
          <td><input type="text" data-f="target" value="${e(entry.target)}"></td>
          <td><input type="text" data-f="alternatives" value="${e((entry.alternatives || []).join(' | '))}" placeholder="a | b"></td>
          <td>
            <div class="row-actions">
              <button class="btn-sm btn-primary" data-save="${e(entry.id)}">Enregistrer</button>
              <button class="btn-sm btn-ghost" data-cancel>Annuler</button>
            </div>
          </td>
        </tr>`;
    }
    return `
      <tr>
        <td>${e(entry.source)}</td>
        <td>${e(entry.target)}</td>
        <td class="muted small">${e((entry.alternatives || []).join(' | ')) || '—'}</td>
        <td>
          <div class="row-actions">
            <button class="btn-sm btn-ghost" data-edit="${e(entry.id)}">Éditer</button>
            <button class="btn-sm btn-ghost btn-danger" data-del="${e(entry.id)}">Supprimer</button>
          </div>
        </td>
      </tr>`;
  }

  function visibleEntries() {
    const q = state.filter.trim().toLowerCase();
    if (!q) return state.entries;
    return state.entries.filter((en) => `${en.source} ${en.target} ${(en.alternatives || []).join(' ')}`.toLowerCase().includes(q));
  }

  function metaForm() {
    return `
      <section class="card stack">
        <div class="row" style="justify-content:space-between">
          <strong>Langues</strong>
          <span class="pair-pill">${e(pairLabel(state.meta.source, state.meta.target))}</span>
        </div>
        <div class="grid-2">
          <label class="field"><span>Langue source (code)</span><input type="text" id="meta-source" value="${e(state.meta.source || '')}" placeholder="EN" maxlength="8"></label>
          <label class="field"><span>Langue cible (code)</span><input type="text" id="meta-target" value="${e(state.meta.target || '')}" placeholder="FR" maxlength="8"></label>
        </div>
        <div class="row-end"><button id="save-meta">Enregistrer les langues</button></div>
      </section>`;
  }

  function addForm() {
    return `
      <section class="card stack">
        <strong>Ajouter une carte</strong>
        <div class="grid-3">
          <label class="field"><span>Source</span><input type="text" id="new-source" autocomplete="off"></label>
          <label class="field"><span>Cible</span><input type="text" id="new-target" autocomplete="off"></label>
          <label class="field"><span>Variantes acceptées</span><input type="text" id="new-alts" placeholder="séparées par |" autocomplete="off"></label>
        </div>
        <div class="row-end"><button class="btn-primary" id="add-btn">Ajouter</button></div>
      </section>`;
  }

  function render(root) {
    const rows = visibleEntries();
    root.innerHTML = `
      <div class="page-head">
        <div>
          <h1><a href="#/" style="color:var(--muted)">Decks</a> / ${e(state.name.replace(/\.csv$/i, ''))}</h1>
          <p>${state.entries.length} carte${state.entries.length > 1 ? 's' : ''}</p>
        </div>
        <div class="row">
          <button class="btn-sm" id="import-btn">Importer un CSV</button>
          <a class="btn btn-sm" href="${App.api.downloadUrl(state.name)}" download>Télécharger</a>
          <button class="btn-sm btn-ghost" id="reset-btn">Réinitialiser la progression</button>
          <button class="btn-sm btn-danger" id="delete-deck">Supprimer le deck</button>
        </div>
      </div>
      <div class="stack">
        ${metaForm()}
        ${addForm()}
        <input type="text" id="filter" placeholder="Filtrer…" value="${e(state.filter)}">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Source</th><th>Cible</th><th>Variantes acceptées</th><th></th></tr></thead>
            <tbody>${rows.map(rowHtml).join('') || '<tr><td colspan="4" class="muted">Aucune carte.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;

    root.querySelector('#save-meta').addEventListener('click', async () => {
      try {
        await App.api.setDeckMeta(state.name, {
          source: root.querySelector('#meta-source').value,
          target: root.querySelector('#meta-target').value,
        });
        toast('Langues enregistrées.');
        reload(root);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    root.querySelector('#add-btn').addEventListener('click', async () => {
      const source = root.querySelector('#new-source').value.trim();
      const target = root.querySelector('#new-target').value.trim();
      if (!source || !target) return toast('Source et cible sont obligatoires.', 'error');
      try {
        await App.api.addEntry(state.name, { source, target, alternatives: root.querySelector('#new-alts').value });
        toast('Carte ajoutée.');
        reload(root);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    root.querySelector('#filter').addEventListener('input', (ev) => {
      state.filter = ev.target.value;
      const tbody = root.querySelector('tbody');
      const rows = visibleEntries();
      tbody.innerHTML = rows.map(rowHtml).join('') || '<tr><td colspan="4" class="muted">Aucune carte.</td></tr>';
    });

    root.querySelector('#reset-btn').addEventListener('click', async () => {
      if (!confirm('Effacer toute la progression de ce deck ?')) return;
      await App.api.resetProgress(state.name);
      toast('Progression réinitialisée.');
      reload(root);
    });

    root.querySelector('#delete-deck').addEventListener('click', async () => {
      if (!confirm(`Supprimer définitivement « ${state.name} » et sa progression ?`)) return;
      try {
        await App.api.deleteDeck(state.name);
        location.hash = '#/';
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    root.querySelector('#import-btn').addEventListener('click', () => openImport(root));

    App.util.once(root, 'click', (ev) => {
      const edit = ev.target.closest('[data-edit]');
      if (edit) {
        state.editing = edit.dataset.edit;
        render(root);
        return;
      }
      const cancel = ev.target.closest('[data-cancel]');
      if (cancel) {
        state.editing = null;
        render(root);
        return;
      }
      const save = ev.target.closest('[data-save]');
      if (save) {
        const tr = save.closest('tr');
        const payload = {
          source: tr.querySelector('[data-f=source]').value.trim(),
          target: tr.querySelector('[data-f=target]').value.trim(),
          alternatives: tr.querySelector('[data-f=alternatives]').value,
        };
        App.api
          .updateEntry(state.name, save.dataset.save, payload)
          .then(() => {
            state.editing = null;
            toast('Carte mise à jour.');
            reload(root);
          })
          .catch((err) => toast(err.message, 'error'));
        return;
      }
      const del = ev.target.closest('[data-del]');
      if (del) {
        const entry = state.entries.find((x) => x.id === del.dataset.del);
        if (!confirm(`Supprimer « ${entry.source} » ?`)) return;
        App.api
          .deleteEntry(state.name, del.dataset.del)
          .then(() => {
            toast('Carte supprimée.');
            reload(root);
          })
          .catch((err) => toast(err.message, 'error'));
      }
    });
  }

  async function reload(root) {
    const [entries, decks] = await Promise.all([App.api.entries(state.name), App.api.decks()]);
    state.entries = entries.entries;
    state.meta = decks.find((d) => d.name === state.name) || {};
    render(root);
  }

  function openImport(root) {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <form method="dialog" class="stack">
        <strong>Remplacer le contenu du deck</strong>
        <label class="field"><span>Fichier CSV</span><input type="file" name="file" accept=".csv,text/csv"></label>
        <label class="field"><span>ou contenu collé</span><textarea name="csv" placeholder="question,response,alt"></textarea></label>
        <p class="small muted">Colonnes reconnues : <code>question</code>/<code>source</code> et <code>response</code>/<code>target</code>, plus <code>alt</code> pour les variantes. Sans en-tête, les deux premières colonnes sont utilisées.</p>
        <div class="row-end">
          <button type="button" class="btn-ghost" data-close>Annuler</button>
          <button type="button" class="btn-danger" data-clear>Tout effacer</button>
          <button class="btn-primary" type="submit">Importer</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);

    const form = dialog.querySelector('form');
    form.querySelector('[name=file]').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      form.querySelector('[name=csv]').value = await file.text();
    });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const csv = form.querySelector('[name=csv]').value;
      if (!csv.trim()) return toast('Aucun contenu à importer.', 'error');
      try {
        await App.api.replaceEntries(state.name, csv);
        dialog.close();
        toast('CSV importé.');
        reload(root);
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    form.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    form.querySelector('[data-clear]').addEventListener('click', async () => {
      if (!confirm('Effacer toutes les cartes de ce deck ?')) return;
      await App.api.replaceEntries(state.name, 'question,response');
      dialog.close();
      toast('Deck vidé.');
      reload(root);
    });
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  }

  App.views.deck = {
    async render(root, params) {
      state.name = params.name;
      state.editing = null;
      state.filter = '';
      await reload(root);
    },
  };
})();
