'use strict';

/* IIFE : un script classique partage la portée lexicale globale, deux vues
   qui déclarent `toast` ou `e` casseraient le chargement. */
(function () {
  App.api = (() => {
    async function request(method, url, body) {
      const options = { method, headers: {} };
      if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const res = await fetch(url, options);
      if (res.status === 204) return null;
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
if (!res.ok) {
      // les routes du jeu des pays renvoient aussi une suggestion de correction
      const message = (data && (data.error || data.erreur)) || `Erreur ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      if (data && data.suggestion) err.suggestion = data.suggestion;
      throw err;
    }
      return data;
    }

    const get = (url) => request('GET', url);
    const post = (url, body) => request('POST', url, body || {});
    const put = (url, body) => request('PUT', url, body || {});
    const del = (url) => request('DELETE', url);

    return {
      decks: () => get('/api/decks'),
      createDeck: (payload) => post('/api/decks', payload),
      deleteDeck: (name) => del(`/api/decks/${encodeURIComponent(name)}`),
      setDeckMeta: (name, payload) => put(`/api/decks/${encodeURIComponent(name)}/meta`, payload),
      entries: (name) => get(`/api/decks/${encodeURIComponent(name)}/entries`),
      addEntry: (name, entry) => post(`/api/decks/${encodeURIComponent(name)}/entries`, entry),
      replaceEntries: (name, csv) => put(`/api/decks/${encodeURIComponent(name)}/entries`, { csv }),
      updateEntry: (name, id, entry) => put(`/api/decks/${encodeURIComponent(name)}/entries/${id}`, entry),
      deleteEntry: (name, id) => del(`/api/decks/${encodeURIComponent(name)}/entries/${id}`),
      downloadUrl: (name) => `/api/decks/${encodeURIComponent(name)}/download`,

      startSession: (payload) => post('/api/session', payload),
      session: (id) => get(`/api/session/${id}`),
      answer: (id, given) => post(`/api/session/${id}/answer`, { given }),
      skip: (id) => post(`/api/session/${id}/skip`),
      abandon: (id) => del(`/api/session/${id}`),

stats: (name) => get(`/api/stats/${encodeURIComponent(name)}`),
    resetProgress: (deck) => post('/api/progress/reset', deck ? { deck } : {}),

    startCountries: (payload) => post('/api/jeu/pays', payload),
    countries: (id) => get(`/api/jeu/pays/${id}`),
    countriesAnswer: (id, pays) => post(`/api/jeu/pays/${id}/reponse`, { pays }),
    countriesPass: (id) => post(`/api/jeu/pays/${id}/passer`),
    countriesUndo: (id) => post(`/api/jeu/pays/${id}/annuler`),
    abandonCountries: (id) => del(`/api/jeu/pays/${id}`),
  };
  })();
})();
