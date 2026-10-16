# Koiné — jeux de mots et de langues

Deux jeux :

1. **L'entraînement à la traduction** — noter sur 100 plutôt que tout ou rien,
   avec répétition espacée et decks par paire de langues.
2. **Le jeu des pays** — pour jouer à plusieurs autour d'un écran.

```bash
npm install
npm start      # http://localhost:4100
npm test
```

Une seule dépendance : `express`. Pas de build, pas de bundler.

---

## Le jeu des pays

L'app tire une lettre. Chacun à son tour nomme un pays qui commence par cette
lettre. Dès qu'un joueur n'a plus de réponse, il est **éliminé de la manche** et
les autres continuent. Quand il ne reste qu'un joueur, quand la lettre n'a plus
de pays disponible, ou quand tout le monde a passé, la manche se ferme et tout
le monde rejoue à la manche suivante. Gagne celui qui survit au plus de manches.

Un seul écran : on passe l'appareil. L'identifiant de partie est dans l'URL
(`#/pays/<id>`), donc un rafraîchissement ne la perd pas.

### La liste

`src/countries.js` : 190 pays, 354 formes acceptées. Les variantes couvrent ce
qu'on dit à l'oral — « les Etats-Unis », « le Congo », « Zaïre », « Ceylan »…
Sans elles, un jeu de société se transforme en procès : la vraie difficulté,
c'est d'accepter ce que les gens disent.

La validation ignore la casse, les accents et la ponctuation. Un pays est
accepté pour une lettre si **la forme saisie** commence par elle, ce qui gère
naturellement les articles : « Le Salvador » est valide pour L, « Salvador » pour
S.

Un pays déjà cité ne peut plus être rejoué, même plusieurs manches plus tard.

### Le récapitulatif de fin de manche

La fin d'une manche était totalement muette : la nouvelle lettre apparaissait
sans que personne comprenne pourquoi. Il y a maintenant un écran entre les deux,
qui affiche :

- la lettre et la raison de l'arrêt — « X reste seul en lice » ou « Plus aucun
  pays en D » ;
- les pays trouvés et les joueurs éliminés ;
- **les pays qui restaient**, en pastilles.

C'est ce dernier point qui fait la valeur du jeu : quand tout le monde a perdu
en S, on voit d'un coup d'œil les 21 pays qu'on aurait pu trouver.

La raison est **figée à la clôture de la manche**. La lire après coup est un
piège : au moment de l'affichage, la manche suivante a déjà commencé et le
tableau des joueurs actifs ne parle plus de celle qui vient de finir. C'était
le cas au premier essai — l'écran annonçait « Plus aucun pays en R » alors que
les trois joueurs venaient de passer.

La colonne « Restaient » du tableau des manches précédentes reprend la même
liste, si on veut revoir ce qu'on a laissé passer.

### Le tirage des lettres

Deux règles, apprises à la simulation :

- **Assez de pays pour tout le monde.** Tirer Q (un seul pays au total : le
  Qatar) donnait une manche d'un seul coup. Une lettre n'est tirée que s'il
  reste au moins autant de pays que de joueurs. Sans cette contrainte, une
  manche sur trois n'était pas jouable.
- **Pondération par racine carrée.** Une lettre à 21 pays sort environ 4,5 fois
  plus souvent qu'une lettre à 3, sans jamais interdire les lettres rares. Le
  tirage uniforme rendait les manches très inégales.

Si aucune lettre n'a assez de pays — en fin de partie la liste se vide — on
prend la plus riche qui reste.

### La fin de partie

Ma première version déclarait le vainqueur « dernier joueur jamais éliminé ».
C'était **inatteignable** : 25 000 parties simulées ont donné zéro vainqueur et
44 % d'égalités. La règle est maintenant : manches survécues d'abord, pays
trouvés en départage. Toutes les parties se terminent, un vainqueur sort dans
95 % des cas (le reste est une égalité, affichée comme telle).

La partie s'arrête au bout du nombre de manches choisi (5 par défaut). Sans
plafond, elle ne finirait jamais : quand personne ne passe jamais, les manches
s'enchaînent indéfiniment.

### Les réglages

Les seuils vivent dans `src/game/countries.js` :

```js
tirerLettre(used, interdites, minimum) // minimum = nombre de joueurs
game.manchesMax                         // 5 par défaut
```

---

## L'entraînement à la traduction

La v1 comparait la saisie à la cible avec une égalité stricte. Le Levenshtein
qu'elle calculait (`public/translate.js:96`) n'était jamais utilisé pour la note :
il apparaissait juste dans le message d'erreur. Un accent oublié, un article en
trop, une faute de frappe — tout comptait comme une faute.

### 1. Une note sur 100, pas un oui/non

`src/scoring.js` normalise puis compare sur deux axes :

| Axe | Ce qu'il rattrape |
|---|---|
| Levenshtein normalisé | fautes de frappe, accents, casse |
| similarité de mots (positionnel + sac) | évite qu'une faute sur un seul mot soit noyée dans une longue phrase |

Le meilleur des deux fait le score. Valeurs réelles produites par `grade()` :

| Saisie | Attendu | v1 | v2 |
|---|---|---|---|
| `comprendre` | `comprendre` | ✅ | 100 · *correct* |
| `Comprendre !` | `comprendre` | ❌ | 100 · *correct* |
| `eleve` | `élève` | ❌ | 100 · *correct* |
| `cat` | `the cat` | ❌ | 100 · *correct* |
| `comprenndre` | `comprendre` | ❌ | 91 · *presque* |
| `to work out` | `to figure out` | ❌ | 67 · *presque trouvé* + diff |

Les quatre premiers cas ne sont pas des détails : la v1 les rejetait tous. Le
dernier illustre la limite : aucun algorithme de chaîne ne peut savoir que
« to work out » est une vraie traduction de « to figure out ». Pour ça, chaque
carte accepte des **variantes** (voir plus bas), et le diff affiche le mot exact
qui diverge.

### 2. Le diff dit *où* ça ne va pas

Au lieu d'un message binaire, l'écran de retour aligne les mots attendus et
surligne ceux qui manquent, avec les mots en trop signalés à part :

```
Traduisez : to figure out
Attendu    [to] [figure] [+work] [out]
```

### 3. Répétition espacée

`src/srs.js`. Chaque carte a un niveau (0 → 6), chaque niveau un intervalle
(0, 1, 2, 4, 9, 21, 60 jours).

- Bonne réponse → le niveau monte, la carte est repoussée dans le temps.
- Mauvaise réponse → retour au niveau 0, donc due immédiatement : **la carte
  repasse en fin de queue de la session en cours**. On ne la perd pas.
- Une session commence par ce qui est dû, les cartes les plus anciennement
  revues d'abord, puis complète avec les nouvelles.

Le tableau de bord affiche la répartition : nouveau / en apprentissage / connu /
acquis.

### 4. Langues étiquetées

Les CSV de la v1 n'ont aucune notion de langue. Chaque deck porte maintenant une
paire source → cible, modifiable dans l'éditeur. Si le nom du fichier contient la
paire (`fr-en.csv`), elle est détectée automatiquement. Un nom comme `es-fr.csv`
peut donc regrouper plusieurs decks dans une même session, ce qui est impossible
en v1 où tout était mélangé dans une seule liste.

Les codes sont affichés en nom de langue complet grâce à `Intl.DisplayNames`.

### 5. Éditeur pour tous les decks

La v1 n'éditait que `vocabulary.csv` (chemin codé en dur dans `server.js:12`),
alors que le jeu en lisait six. Ici chaque deck s'édite, s'importe, se
télécharge et se supprime.

---

## Format des CSV

```csv
question,response,alt
to figure out,comprendre,"comprendre qqch | déterminer"
cat,chat,minou
```

- Les en-têtes sont optionnels. Sans en-tête, les deux premières colonnes sont
  source et cible.
- En-têtes acceptés : `question`/`source`/`word`… et `response`/`target`/`meaning`…
- `alt` liste les **réponses acceptées** à côté de la référence, séparées par `|`
  ou `;`. Une réponse qui correspond à une variante vaut 100.
- Les guillemets `\"` sont gérés, donc les virgules dans le texte ne cassent rien.

Les decks vivent dans `data/decks/`, la progression dans `data/progress.json`,
l'historique (400 derniers passages) dans `data/history.json`.

---

## Réglages

Les seuils de notation sont en haut de `src/scoring.js` :

```js
const THRESHOLDS = { correct: 92, close: 75, almost: 55 };
```

`correct` = accepted tel quel · `close` = compris, à retravailler · `almost` =
l'intention y est, ce n'est pas la cible. En dessous de `close`, la carte est
remise dans la session et le niveau de répétition espacée retombe à zéro.

Les intervalles de révision sont dans `src/srs.js` (`BOX_INTERVALS`).

---

## Organisation

```
server.js          API REST + statique
src/scoring.js     normalisation, similarité, diff, notation
src/srs.js         répétition espacée
src/store.js       lecture/écriture CSV, métadonnées, progression
public/js/views/   dashboard, play, deck, stats
test/run.js        50 assertions sur la notation, le SRS et le CSV
```

La notation est calculée côté serveur : le client ne peut pas s'auto-noter.