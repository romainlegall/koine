'use strict';

/* IIFE : un script classique partage la portée lexicale globale, deux vues
   qui déclarent `toast` ou `e` casseraient le chargement. */
(function () {
  const { escapeHtml: e, toast, pairLabel, VERDICTS } = App.util;

  let active = null; // { sessionId, ... }

  function langLabel(code) {
    if (!code) return '';
    try {
      return new Intl.DisplayNames(['fr'], { type: 'language' }).of(code.toLowerCase()) || code;
    } catch {
      return code;
    }
  }

  function directionText(deck, meta) {
    const from = deck.direction === 'forward' ? meta[deck.deck]?.source : meta[deck.deck]?.target;
    const to = deck.direction === 'forward' ? meta[deck.deck]?.target : meta[deck.deck]?.source;
    return `${langLabel(from) || from || '?'} → ${langLabel(to) || to || '?'}`;
  }

  function renderDiff(diff) {
    const words = diff.tokens
      .map((t) => `<span class="diff-word ${t.ok ? '' : 'miss'}">${e(t.text)}</span>`)
      .join('');
    const extras = diff.extra.map((t) => `<span class="diff-extra">+${e(t)}</span>`).join('');
    return `<div class="diff">${words}${extras}</div>`;
  }

  function renderFeedback(result, requeued) {
    const note = requeued ? ' · cette carte reviendra avant la fin' : '';
    return `
      <div class="verdict ${result.verdict}">
        <div class="verdict-head">
          <span class="verdict-label">${e(VERDICTS[result.verdict] || result.verdict)}</span>
          <span class="score-chip ${result.verdict}">${Math.round(result.score)}<span class="muted small">/100</span></span>
        </div>
        <p class="small muted" style="margin:0">${e(result.reason)}${note}</p>
        <div>
          <div class="small muted" style="margin-bottom:6px">Attendu</div>
          ${renderDiff(result.diff)}
        </div>
        ${
          result.matchedAlternative
            ? '<p class="hint-alts" style="margin:0">Réponse acceptée via une variante.</p>'
            : ''
        }
        <button class="btn-primary" id="next-btn">Continuer <kbd>Entrée</kbd></button>
      </div>`;
  }

  function renderPrompt(view, decks) {
    const { total, answered, card, done, summary } = view;
    const percent = total ? Math.round((answered / total) * 100) : 0;

    if (done) return renderSummary(view, decks);

    const meta = Object.fromEntries(decks.map((d) => [d.name, d]));

    return `
      <div class="progress-head">
        <span>${answered}/${total}</span>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        <button class="btn-sm btn-ghost" id="quit-btn">Quitter</button>
      </div>
      <div class="prompt-card">
        <div class="prompt-direction">${e(directionText(card, meta))}</div>
        <div class="prompt-text">${e(card.prompt)}</div>
      </div>
      <div class="answer-row">
        <input type="text" id="answer" placeholder="Votre traduction…" autocomplete="off"
               autocapitalize="off" autocorrect="off" spellcheck="false">
        <button class="btn-primary" id="send-btn">Valider</button>
      </div>
      <div class="row small muted">
        <span><kbd>Entrée</kbd> valider</span>
        <button class="btn-sm btn-ghost" id="skip-btn">Passer sans répondre</button>
        ${summary ? `<span style="margin-left:auto">Score moyen ${summary.average}/100</span>` : ''}
      </div>`;
  }

  function renderSummary(view, decks) {
    const s = view.summary || { answered: 0, correct: 0, close: 0, wrong: 0, average: 0, accuracy: 0 };
    const total = view.total || s.answered;
    return `
      <div class="prompt-card">
        <div class="prompt-direction">Session terminée</div>
        <div class="prompt-text">${s.accuracy} %</div>
        <p class="muted" style="margin:8px 0 0">${s.answered} carte${s.answered > 1 ? 's' : ''} vue${s.answered > 1 ? 's' : ''} · score moyen ${s.average}/100</p>
      </div>
      <div class="tiles">
        <div class="tile"><div class="value" style="color:var(--good)">${s.correct}</div><div class="label">Correct</div></div>
        <div class="tile"><div class="value" style="color:var(--close)">${s.close}</div><div class="label">Presque</div></div>
        <div class="tile"><div class="value" style="color:var(--bad)">${s.wrong}</div><div class="label">À retravailler</div></div>
        <div class="tile"><div class="value">${total}</div><div class="label">Cartes tirées</div></div>
      </div>
      <div class="row-end">
        <button id="replay-btn">Rejouer</button>
        <a class="btn btn-primary" href="#/">Retour aux decks</a>
      </div>`;
  }

  App.views.play = {
    async render(root, params) {
      const decks = await App.api.decks();
      const metaByName = Object.fromEntries(decks.map((d) => [d.name, d]));
      let view;

      try {
        view = await App.api.startSession({
          decks: params.decks ? params.decks.split(',').filter(Boolean) : [],
          direction: params.direction || 'mixed',
          size: params.size || 20,
        });
      } catch (err) {
        root.innerHTML = `<div class="empty"><h3>Impossible de démarrer</h3><p>${e(err.message)}</p></div>`;
        return;
      }

      active = { id: view.id, params, busy: false };
      draw(root, view);

      async function draw(container, state) {
        container.innerHTML = `<div class="play">${renderPrompt(state, decks)}</div>`;
        const input = container.querySelector('#answer');
        if (input) input.focus();

        const onAnswer = () => submit(container);
        const inputEl = container.querySelector('#answer');
        const sendBtn = container.querySelector('#send-btn');
        if (sendBtn) sendBtn.addEventListener('click', onAnswer);
        if (inputEl) {
          inputEl.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              onAnswer();
            }
          });
        }

        const skip = container.querySelector('#skip-btn');
        if (skip) {
          skip.addEventListener('click', async () => {
            if (active.busy) return;
            active.busy = true;
            try {
              const res = await App.api.skip(view.id);
              showFeedback(container, res);
            } catch (err) {
              toast(err.message, 'error');
            } finally {
              active.busy = false;
            }
          });
        }

        const quit = container.querySelector('#quit-btn');
        if (quit) {
          quit.addEventListener('click', async () => {
            await App.api.abandon(view.id).catch(() => {});
            location.hash = '#/';
          });
        }

        const replay = container.querySelector('#replay-btn');
        if (replay) replay.addEventListener('click', () => App.views.play.render(root, params));
      }

      function showFeedback(container, res) {
        view = res;
        if (res.done) {
          draw(container, res);
          return;
        }
        container.querySelector('.play').insertAdjacentHTML('beforeend', renderFeedback(res.result, res.requeued));
        // La carte est notée : tout ce qui agirait dessus est gelé jusqu'au
        // clic sur « Continuer ». Sans ça, un second clic sur « Passer » note la
        // carte suivante en blanc et finit par dépasser la fin de session.
        ['#answer', '#send-btn', '#skip-btn'].forEach((sel) => {
          const control = container.querySelector(sel);
          if (control) control.disabled = true;
        });

        const next = container.querySelector('#next-btn');
        const go = async () => {
          if (active.busy) return;
          active.busy = true;
          try {
            const nextView = await App.api.session(view.id);
            draw(container, nextView);
          } catch (err) {
            toast(err.message, 'error');
          } finally {
            active.busy = false;
          }
        };
        next.addEventListener('click', go);
        next.focus();
      }

      async function submit(container) {
        if (active.busy) return;
        const input = container.querySelector('#answer');
        if (!input) return;
        const given = input.value;
        if (!given.trim()) {
          input.focus();
          return;
        }
        active.busy = true;
        try {
          const res = await App.api.answer(view.id, given);
          showFeedback(container, res);
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          active.busy = false;
        }
      }
    },
  };
})();
