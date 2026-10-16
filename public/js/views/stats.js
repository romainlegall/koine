'use strict';

/* IIFE : un script classique partage la portée lexicale globale, deux vues
   qui déclarent `toast` ou `e` casseraient le chargement. */
(function () {
  const { escapeHtml: e, levelTag, relativeTime, masteryBar, toast } = App.util;

  function tile(value, label) {
    return `<div class="tile"><div class="value">${e(value)}</div><div class="label">${e(label)}</div></div>`;
  }

  function legendRow(levels, total) {
    const order = ['new', 'learning', 'known', 'mastered'];
    const colors = {
      new: 'var(--muted)',
      learning: 'var(--close)',
      known: 'var(--accent)',
      mastered: 'var(--good)',
    };
    return `
      <div>${masteryBar(levels, total)}</div>
      <div class="legend">
        ${order
          .map(
            (k) =>
              `<span><i style="background:${colors[k]}"></i>${e(App.util.LEVEL_LABELS[k])} : ${levels[k]}</span>`
          )
          .join('')}
      </div>`;
  }

  function sparkline(history) {
    const recent = history.slice(-40);
    if (!recent.length) return '<p class="muted small">Pas encore d’historique.</p>';
    return `<div class="spark">${recent
      .map((h) => {
        const color =
          h.verdict === 'correct' ? 'var(--good)' : h.verdict === 'close' ? 'var(--close)' : 'var(--bad)';
        return `<div style="height:${Math.max(8, h.score)}%;background:${color}" title="${Math.round(h.score)} — ${relativeTime(h.ts)}"></div>`;
      })
      .join('')}</div>`;
  }

  function hardestTable(cards) {
    const ranked = cards
      .filter((c) => c.attempts > 0)
      .sort((a, b) => a.accuracy - b.accuracy || b.lapses - a.lapses)
      .slice(0, 12);
    if (!ranked.length) return '<p class="muted small">Aucune carte travaillée pour l’instant.</p>';
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Carte</th><th>Niveau</th><th>Réussite</th><th>Échecs</th><th>Intervalle</th><th></th></tr></thead>
          <tbody>
            ${ranked
              .map(
                (c) => `<tr>
                  <td>${e(c.source)} → ${e(c.target)}</td>
                  <td>${levelTag(c.level)}${c.due ? ' <span class="tag due">dû</span>' : ''}</td>
                  <td>${c.accuracy} %</td>
                  <td>${c.lapses}</td>
                  <td class="muted small">${c.intervalDays ? `${c.intervalDays} j` : '—'}</td>
                  <td class="muted small">${relativeTime(c.lastReviewedAt)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  }

  function overview(decks) {
    const totals = decks.reduce(
      (acc, d) => {
        acc.count += d.count;
        acc.due += d.due;
        acc.levels.new += d.levels.new;
        acc.levels.learning += d.levels.learning;
        acc.levels.known += d.levels.known;
        acc.levels.mastered += d.levels.mastered;
        acc.attempts += d.attempts;
        acc.correct += d.correct;
        return acc;
      },
      { count: 0, due: 0, levels: { new: 0, learning: 0, known: 0, mastered: 0 }, attempts: 0, correct: 0 }
    );
    const accuracy = totals.attempts ? Math.round((totals.correct / totals.attempts) * 100) : null;
    return `
      <div class="stack">
        <div class="tiles">
          ${tile(totals.count, 'cartes au total')}
          ${tile(totals.due, 'à réviser maintenant')}
          ${tile(totals.levels.mastered, 'acquises')}
          ${tile(accuracy === null ? '—' : `${accuracy} %`, 'réussite globale')}
        </div>
        <section class="card">
          <strong>Répartition de la maîtrise</strong>
          <div style="margin-top:12px">${legendRow(totals.levels, totals.count)}</div>
        </section>
        <section class="card stack">
          <div class="row" style="justify-content:space-between">
            <strong>Decks</strong>
            <span class="muted small">${decks.length} deck${decks.length > 1 ? 's' : ''}</span>
          </div>
          ${decks
            .map(
              (d) => `<div class="deck" style="grid-template-columns:1fr auto">
                <div>
                  <h3>${e(d.name.replace(/\.csv$/i, ''))} <span class="pair-pill">${e(App.util.pairLabel(d.source, d.target))}</span></h3>
                  <p class="pair">${d.count} cartes · ${d.due} à réviser · ${d.levels.mastered} acquises</p>
                </div>
                <div class="actions"><a class="btn btn-sm" href="#/stats/${encodeURIComponent(d.name)}">Détail</a></div>
              </div>`
            )
            .join('')}
        </section>
      </div>`;
  }

  function renderDetail(data) {
    const s = data.summary;
    return `
      <div class="stack">
        <div class="tiles">
          ${tile(s.count, 'cartes')}
          ${tile(s.due, 'à réviser')}
          ${tile(s.accuracy === null ? '—' : `${s.accuracy} %`, 'réussite')}
          ${tile(s.averageScore === null ? '—' : `${s.averageScore}/100`, 'score moyen')}
        </div>
        <section class="card">
          <strong>Maîtrise</strong>
          <div style="margin-top:12px">${legendRow(s.levels, s.count)}</div>
        </section>
        <section class="card">
          <strong>Activité récente</strong>
          <p class="muted small" style="margin:4px 0 12px">40 dernières réponses</p>
          ${sparkline(data.history)}
        </section>
        <section class="card stack">
          <strong>Cartes les plus difficiles</strong>
          ${hardestTable(data.cards)}
        </section>
      </div>`;
  }

  App.views.stats = {
    async render(root, params) {
      if (!params.name) {
        const decks = await App.api.decks();
        root.innerHTML = `
          <div class="page-head">
            <div><h1>Statistiques</h1><p>Vue d'ensemble de tous vos decks</p></div>
            <button id="reset-all">Tout réinitialiser</button>
          </div>
          ${decks.length ? overview(decks) : '<div class="empty"><h3>Aucun deck</h3><p>Créez d’abord un deck.</p></div>'}`;
        const btn = root.querySelector('#reset-all');
        if (btn) {
          btn.addEventListener('click', async () => {
            if (!confirm('Effacer toute la progression de tous les decks ?')) return;
            await App.api.resetProgress();
            toast('Progression réinitialisée.');
            App.views.stats.render(root, {});
          });
        }
        return;
      }

      const data = await App.api.stats(params.name);
      root.innerHTML = `
        <div class="page-head">
          <div>
            <h1><a href="#/stats" style="color:var(--muted)">Statistiques</a> / ${e(data.name.replace(/\.csv$/i, ''))}</h1>
            <p>${e(App.util.pairLabel(data.meta.source, data.meta.target))}</p>
          </div>
          <div class="row">
            <a class="btn btn-sm" href="#/deck/${encodeURIComponent(data.name)}">Éditer</a>
            <a class="btn btn-primary btn-sm" href="#/play?decks=${encodeURIComponent(data.name)}&direction=mixed&size=20">Jouer</a>
          </div>
        </div>
        ${renderDetail(data)}`;
    },
  };
})();
