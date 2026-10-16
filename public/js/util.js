'use strict';

/* IIFE : un script classique partage la portée lexicale globale, deux vues
   qui déclarent `toast` ou `e` casseraient le chargement. */
(function () {
  // Installed before every other script: without it a throw in a view file leaves
  // the page stuck on "Chargement…" with nothing in the console.
  window.addEventListener('error', (ev) => reportFatal(ev.message, ev.filename, ev.lineno));
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason);
    reportFatal(reason);
  });

  function reportFatal(message, source, line) {
    console.error('[jv2]', message, source || '', line || '');
    const view = document.getElementById('view');
    if (!view || !/Chargement/.test(view.textContent)) return;
    const where = source ? `<p class="small muted">${source}${line ? ` (ligne ${line})` : ''}</p>` : '';
    view.innerHTML = `
      <div class="empty">
        <h3>Erreur de chargement</h3>
        <p>${(message || 'Erreur inconnue').replace(/[<&]/g, (c) => ({ '<': '&lt;', '&': '&amp;' })[c])}</p>
        ${where}
      </div>`;
  }

  const App = (window.App = window.App || {});

  // Les vues s'enregistrent avant que main.js ne s'exécute : le conteneur doit
  // exister dès le premier fichier de vue chargé.
  App.views = App.views || {};

  App.util = (() => {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    function escapeHtml(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const LEVEL_LABELS = {
      new: 'Nouveau',
      learning: 'En apprentissage',
      known: 'Connu',
      mastered: 'Acquis',
    };

    const VERDICTS = {
      correct: 'Correct !',
      close: 'Presque !',
      almost: 'Presque trouvé',
      wrong: 'Faux',
      skipped: 'Passé',
    };

    let toastTimer;
    function toast(message, kind = '') {
      const node = $('#toast');
      if (!node) return;
      node.textContent = message;
      node.className = `toast show ${kind}`.trim();
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        node.className = 'toast';
      }, 2600);
    }

    /**
     * Attache un listener délégué une seule fois par (nœud, type).
     * #view n'est jamais remplacé : sans ça les vues qui se re-rend themselves
     # empileraient le même handler à chaque rendu.
     */
    const boundTypes = new WeakMap();
    function once(root, type, handler) {
      if (!boundTypes.has(root)) boundTypes.set(root, new Set());
      const seen = boundTypes.get(root);
      if (seen.has(type)) return false;
      seen.add(type);
      root.addEventListener(type, handler);
      return true;
    }

    function pct(n) {
      return n === null || n === undefined ? '—' : `${n} %`;
    }

    function levelTag(level) {
      return `<span class="tag ${level}">${LEVEL_LABELS[level] || level}</span>`;
    }

    /** "anglais → français" à partir des codes langue, sinon les codes bruts. */
    function pairLabel(source, target) {
      if (!source && !target) return 'Langues non définies';
      if (!source || !target) return `${source || '?'} → ${target || '?'}`;
      return `${source} → ${target}`;
    }

    function relativeTime(ts) {
      if (!ts) return 'jamais';
      const diff = Date.now() - ts;
      const min = Math.round(diff / 60000);
      if (min < 1) return "à l'instant";
      if (min < 60) return `il y a ${min} min`;
      const h = Math.round(min / 60);
      if (h < 24) return `il y a ${h} h`;
      const d = Math.round(h / 24);
      if (d < 30) return `il y a ${d} j`;
      return new Date(ts).toLocaleDateString('fr-FR');
    }

    /** Barre de maîtrise segmentée. */
    function masteryBar(levels, total) {
      if (!total) return '';
      const order = ['new', 'learning', 'known', 'mastered'];
      const colors = {
        new: 'var(--muted)',
        learning: 'var(--close)',
        known: 'var(--accent)',
        mastered: 'var(--good)',
      };
      const segments = order
        .filter((k) => levels[k])
        .map((k) => `<span style="width:${(levels[k] / total) * 100}%;background:${colors[k]}" title="${LEVEL_LABELS[k]} : ${levels[k]}"></span>`)
        .join('');
      return `<div class="bar-stack">${segments}</div>`;
    }

    return {
      $,
      $$,
      escapeHtml,
      toast,
      once,
      pct,
      levelTag,
      pairLabel,
      relativeTime,
      masteryBar,
      LEVEL_LABELS,
      VERDICTS,
    };
  })();
})();
