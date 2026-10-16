#!/bin/bash

# Deploiement de Koiné sur le NAS.
#
# A lancer depuis le NAS :
#   bash /volume1/docker/koine/server/deploy.sh
#
# Tire les derniers commits, reconstruit l'image et redemarre le conteneur.
# Le dossier data/ est monte en volume : il n'est jamais touche.

REPO_DIR="/volume1/docker/koine"
COMPOSE_DIR="$REPO_DIR/server"
LOG_FILE="$REPO_DIR/deploy.log"

# shellcheck source=/volume1/docker/koine/server/lib.sh
. "$COMPOSE_DIR/lib.sh"

log() {
    # Docker affiche la commande de build, et le jeton y est developpe en clair :
    # sans ce masquage, il atterrit dans deploy.log en lecture simple. Tout ce
    # qui passe par docker-compose doit donc etre filtre.
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        echo "$1" | sed "s/${GITHUB_TOKEN}/JETON_CAVIARDE/g" | tee -a "$LOG_FILE"
    else
        echo "$1" | tee -a "$LOG_FILE"
    fi
}

# docker-compose sort aussi beaucoup de choses sur stderr (progression du
# build, diagnostics). Meme filtre, meme raison.
#
# -p koine est obligatoire : sans lui, compose deduit le nom de projet du
# dossier courant. Les quatre applications du NAS se ressemblent
# (/volume1/docker/<app>/server/docker-compose.yml), donc un deploiement lance
# depuis le dossier server/ aboutit au nom "server" pour tout le monde — et le
# "down" de l'un arrete alors les conteneurs de l'autre. C'est deja arrive.
docker_compose() {
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        docker-compose -p koine --env-file "$COMPOSE_DIR/env.production" \
            -f "$COMPOSE_DIR/docker-compose.yml" "$@" 2>&1 |
            sed "s/${GITHUB_TOKEN}/JETON_CAVIARDE/g"
        return "${PIPESTATUS[0]}"
    fi
    docker-compose -p koine --env-file "$COMPOSE_DIR/env.production" \
        -f "$COMPOSE_DIR/docker-compose.yml" "$@" 2>&1
    return $?
}

# Charge les variables du fichier d'environnement, sans les exporter toutes :
# seules celles utilisees ci-dessous interessent.
charger_env() {
    [ -f "$COMPOSE_DIR/env.production" ] || return 1
    eval "$(grep -E '^[A-Z_]+=' "$COMPOSE_DIR/env.production" | sed 's/^export //')"
    return 0
}

log "=== Deploiement Koiné : $(date) ==="

# GIT_BIN est lu avant tout : s'il est renseigne dans env.production, il prime
# sur la recherche automatique.
if ! charger_env; then
    log "ERREUR : $COMPOSE_DIR/env.production est absent ou illisible."
    log "        cp $COMPOSE_DIR/env.production.example $COMPOSE_DIR/env.production"
    exit 1
fi

GIT=$(trouver_git)

# Le git de l'hote n'est pas necessaire pour deployer : la construction de
# l'image s'appuie sur le git installe DANS l'image, qui clone le depot. Il ne
# sert qu'a mettre a jour le clone local entre deux deploiements.
if [ -z "$GIT" ]; then
    if depot_est_clone "$REPO_DIR"; then
        log "AVERTISSEMENT : git absent du NAS, le depot local ne sera pas mis a jour."
    else
        log "AVERTISSEMENT : git absent du NAS et aucun depot local."
        log "                Le deploiement continue : l'image va cloner"
        log "                directement le depot GitHub."
    fi
    log "                Pour retablir les mises a jour automatiques, installer"
    log "                le paquet Git depuis le Centre de paquets."
    log ""
else
    log "Git : $GIT ($($GIT --version 2>/dev/null | head -1))"
fi

BRANCH="${GITHUB_BRANCH:-main}"

if [ -n "$GIT" ] && depot_est_clone "$REPO_DIR"; then
    log "Mise a jour du depot..."
    cd "$REPO_DIR" || exit 1
    "$GIT" fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
    LOCAL=$("$GIT" rev-parse HEAD)
    REMOTE=$("$GIT" rev-parse "origin/$BRANCH" 2>/dev/null)

    if [ "$LOCAL" = "$REMOTE" ]; then
        log "Aucun nouveau commit (${LOCAL:0:8}), rien a reconstruire."
        log "=== Fin : $(date) ==="
        exit 0
    fi

    log "Nouveaux commits : ${LOCAL:0:8} -> ${REMOTE:0:8}"
    log "Recuperation..."
    "$GIT" checkout "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
    "$GIT" pull --ff-only origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
else
    log "Construction depuis le depot GitHub ($GITHUB_REPO, branche $BRANCH)."
    log "Pour activer les mises a jour automatiques, cloner une fois :"
    log "  cd $REPO_DIR && git clone <url-du-depot>"
    log ""
fi

# Le redéploiement ne doit jamais perdre la progression : on refuse de
# continuer si le volume a disparu entre-temps. Ce controle precede le "down",
# sinon on aurait deja arrêté le conteneur pour rien.
if [ ! -d "$REPO_DIR/data/decks" ]; then
    log "ERREUR : $REPO_DIR/data/decks est introuvable."
    log "        Créer le dossier et y placer au moins un CSV, sinon le"
    log "        conteneur refusera de démarrer."
    exit 1
fi

log "Arrêt des conteneurs..."
docker_compose down | tee -a "$LOG_FILE"

log "Reconstruction de l'image (quelques minutes sur Synology)..."
docker_compose build --no-cache | tee -a "$LOG_FILE"

if [ ${PIPESTATUS[0]:-0} -ne 0 ]; then
    log "ERREUR : la construction a echoue. Voir les lignes ci-dessus."
    log "=== Fin : $(date) ==="
    exit 1
fi

log "Démarrage..."
docker_compose up -d | tee -a "$LOG_FILE"

sleep 4
log "Journaux du conteneur..."
docker_compose logs --tail=25 | tee -a "$LOG_FILE"

log "Deploiement termine. Koiné devrait repondre sur le port 3005."
log "=== Fin : $(date) ==="