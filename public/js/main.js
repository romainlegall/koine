'use strict';

/* IIFE : un script classique partage la portée lexicale globale, deux vues
   qui déclarent `toast` ou `e` casseraient le chargement. */
(function () {
const ROUTES = [
      { pattern: /^\/?$/, view: 'dashboard' },
      { pattern: /^\/play$/, view: 'play' },
      { pattern: /^\/pays$/, view: 'pays' },
      { pattern: /^\/pays\/([^/?]+)$/, view: 'pays', keys: ['id'] },
      { pattern: /^\/deck\/([^/?]+)$/, view: 'deck', keys: ['name'] },
      { pattern: /^\/stats$/, view: 'stats' },
      { pattern: /^\/stats\/([^/?]+)$/, view: 'stats', keys: ['name'] },
    ];

  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, query = ''] = raw.split('?');
    const params = Object.fromEntries(new URLSearchParams(query));
    for (const route of ROUTES) {
      const match = route.pattern.exec(path);
      if (!match) continue;
      const named = { ...params };
      (route.keys || []).forEach((key, i) => {
        named[key] = decodeURIComponent(match[i + 1]);
      });
      return { view: route.view, params: named };
    }
    return { view: 'dashboard', params: {} };
  }

function highlightNav(view) {
      // la vue par defaut s'appelle "dashboard" mais l'onglet s'appelle "home"
      const cible = view === 'dashboard' ? 'home' : view;
      App.util.$$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === cible));
    }

  async function route() {
    const { view, params } = parseHash();
    const root = document.getElementById('view');
    highlightNav(view);

    try {
      const target = App.views[view];
      if (!target) throw new Error('Vue inconnue');
      root.innerHTML = '<p class="muted">Chargement…</p>';
      await target.render(root, params);
    } catch (err) {
      console.error(err);
      root.innerHTML = `
        <div class="empty">
          <h3>Oups</h3>
          <p>${App.util.escapeHtml(err.message)}</p>
          <p><a href="#/">Retour aux decks</a></p>
        </div>`;
    }
  }

  function initTheme() {
    const saved = localStorage.getItem('jv2.theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    document.documentElement.dataset.theme = saved || (prefersLight ? 'light' : 'dark');

    document.getElementById('theme-toggle').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('jv2.theme', next);
    });
  }

  window.addEventListener('hashchange', route);

  initTheme();
  route();
})();
