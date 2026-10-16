# Koiné — mise en oeuvre sur le NAS

Jeux de mots et de langues : entraînement à la traduction (notation sur 100,
répétition espacée) et jeu des pays.

Même organisation que `plume`, `gestion_locative` et `tresor_prive` : le code vit
dans un dépôt Git, le NAS ne porte que la configuration de déploiement et les
données.

---

## Où sont les choses

| Sur votre Mac | Sur le NAS |
|---|---|
| `~/Perso/04 - Developements/jeu traductions v2` (le code) | `/volume1/docker/koine/server/` |
| dépôt GitHub | `/volume1/docker/koine/data/` (decks + progression) |

L'image Docker **clone le code depuis GitHub** pendant la construction. Le NAS
n'a donc pas besoin du code applicatif, seulement de `server/`.

**Difference avec plume :** pas de base de données. Tout tient dans des
fichiers JSON sous `data/`. Il n'y a donc ni PostgreSQL à créer, ni réseau
partagé à brancher, ni migration à surveiller.

---

## Étape 1 — Créer le dépôt GitHub

Le dossier n'est pas encore un dépôt Git. Sur cette machine :

```bash
cd ~/Perso/04\ -\ Developements/jeu\ traductions\ v2
git init -b main
git add -A
git commit -m "Koiné — jeux de mots et de langues"
```

Créez ensuite un dépôt **privé** sur github.com, nommé `koine`, puis :

```bash
git remote add origin git@github.com:romainlegall/koine.git
git push -u origin main
```

## Étape 2 — Copier la configuration sur le NAS

```bash
scp -r ~/Perso/04\ -\ Developements/jeu\ traductions\ v2/server \
      romain@<ip-du-nas>:/volume1/docker/koine/
ssh romain@<ip-du-nas>
mkdir -p /volume1/docker/koine/data/decks
cp /volume1/docker/koine/server/env.production.example \
   /volume1/docker/koine/server/env.production
nano /volume1/docker/koine/server/env.production
# GITHUB_REPO=romainlegall/koine
# GITHUB_TOKEN=ghp_xxxxxxxxxxxx      <- dépôt privé
```

Le jeton est **fine-grained**, limité à `koine`, permission **lecture seule du
contenu** : <https://github.com/settings/tokens>. Pour un dépôt public, videz
cette variable.

## Étape 3 — Diagnostic

```bash
bash /volume1/docker/koine/server/check_env.sh
```

Vérifie git, le dépôt local, la configuration, les données, Docker et la
liberté du port 3005. Dit quoi faire pour chaque point manquant.

## Étape 4 — Déployer

```bash
bash /volume1/docker/koine/server/deploy.sh
```

Ou en une fois :

```bash
cd /volume1/docker/koine
docker-compose --env-file ./server/env.production -f ./server/docker-compose.yml build --no-cache
docker-compose --env-file ./server/env.production -f ./server/docker-compose.yml up -d
```

L'application répond alors sur `http://<ip-du-nas>:3005`.

---

## Mises à jour ensuite

Le NAS peut surveiller le dépôt et redéployer tout seul. Dans **Planificateur de
tâches** du Synology, une tâche qui s'exécute toutes les heures :

```bash
/volume1/docker/koine/server/check_updates.sh
```

Le script compare la révision locale à celle de GitHub et lance `deploy.sh`
seulement s'il y a du nouveau. Il faut d'abord cloner le dépôt sur le NAS :

```bash
cd /volume1/docker/koine
git clone git@github.com:romainlegall/koine.git repo
```

`deploy.sh` s'attend à trouver le dépôt à la racine de `/volume1/docker/koine` ;
adaptez `REPO_DIR` si vous le clonez dans un sous-dossier.

---

## À savoir

**Le port.** `koine` occupe le **3005**. Étaient déjà pris : 3000
(`tresor_prive`), 3002 (`gestion_locative`), 3004 (`plume`). 3003 l'était aussi
au moment où plume a été déployé.

**Les données sont hors du dépôt.** Seul `data/decks/` est versionné — c'est le
contenu de départ. `progress.json`, `history.json` et `decks.json` sont ignorés
par Git et vivent dans le volume.

**Les modifications survivent aux redéploiements.** C'est le point le plus
délicat, et il est vérifié. Au démarrage, l'`entrypoint.sh` compare les decks de
l'image à ceux du NAS :

```
  installe : questions_nino.csv        <- absent sur le NAS
  conserve : vocabulary_romain.csv     <- deja la, avec vos modifications
  conserve : mon_deck.csv             <- cree depuis l'interface
  aucun nouveau deck a installer
```

Rien n'est jamais écrasé. Pour ajouter un deck sans passer par l'interface,
déposez simplement le CSV dans `/volume1/docker/koine/data/decks/` puis
redémarrez le conteneur.

**Le build lance les tests.** `npm test` s'exécute pendant la construction de
l'image. Les 107 tests couvrent les seuils de notation, le déroulé des manches et
le format CSV ; une régression arrête le déploiement avant d'atteindre le NAS.
Comptez une minute de plus sur le Synology.

**Pas de base de données à sauvegarder.** Un seul dossier à sauvegarder :

```bash
tar czf koine-data.tar.gz -C /volume1/docker/koine data
```

Il contient la progression, les decks ajoutés ou modifiés, et les langues
assignées. Les decks d'origine sont de toute façon dans le dépôt Git.

**Le healthcheck.** L'image vérifie `/api/health` toutes les 30 secondes. Le
conteneur passe `healthy` quand l'application répond. En cas de souci :

```bash
docker logs koine
docker inspect --format='{{.State.Health.Status}}' koine
```

**Plafond mémoire.** 256 Mo, posés dans `docker-compose.yml`. C'est une
application de jeu : si un conteneur se met à boucler, il ne doit pas ronger le
NAS.