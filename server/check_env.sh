#!/bin/bash

# Diagnostic complet avant de deployer Koiné.
# A lancer sur le NAS :  bash /volume1/docker/koine/server/check_env.sh
#
# Verifie une a une les conditions de deploiement et dit quoi faire quand
# quelque chose manque.

REPO_DIR="/volume1/docker/koine"
ENV_FILE="$REPO_DIR/server/env.production"
COMPOSE_DIR="$REPO_DIR/server"
DATA_DIR="$REPO_DIR/data"

# shellcheck source=/volume1/docker/koine/server/lib.sh
. "$REPO_DIR/server/lib.sh"

OK=0
KO=0

vert() { echo "  [OK]    $1"; }
rouge() { echo "  [MANQUE] $1"; KO=$((KO + 1)); }
jaune() { echo "  [INFO]   $1"; }

echo "=============================================="
echo "  Koiné — diagnostic de deploiement"
echo "=============================================="
echo

# --- 1. git -----------------------------------------------------------------
echo "1. Git"
GIT=$(trouver_git)
if [ -n "$GIT" ]; then
    vert "$GIT"
    jaune "version : $($GIT --version 2>/dev/null | head -1)"
else
    rouge "git introuvable"
    echo "         Installer le paquet Git depuis le Centre de paquets du Synology,"
    echo "         ou rendre l'executable permanent avec :"
    echo "           sudo ln -s /usr/local/git/bin/git /usr/bin/git"
    echo "         Sans git, le premier deploiement reste possible (l'image clone"
    echo "         elle-meme) mais les suivants non."
fi
echo

# --- 2. Depot local ---------------------------------------------------------
echo "2. Depot local"
if depot_est_clone "$REPO_DIR"; then
    vert "$REPO_DIR est un clone git"
    echo "         Pour activer les mises a jour automatiques, voir LISEZ-MOI.md"
else
    jaune "$REPO_DIR n'est pas un clone git"
    echo "         Ce n'est pas bloquant pour le premier deploiement : l'image"
    echo "         se contente de cloner le depot GitHub. Mais ensuite, pour"
    echo "         redeployer apres une modification :"
    if [ -n "$GIT" ]; then
        echo "           cd $REPO_DIR && $GIT clone <url-du-depot>"
    else
        echo "           cd $REPO_DIR && git clone <url-du-depot>"
        echo "           (git n'est pas encore installe sur le NAS)"
    fi
fi
echo

# --- 3. Configuration -------------------------------------------------------
echo "3. Configuration"
if [ -f "$ENV_FILE" ]; then
    vert "env.production present"
else
    rouge "env.production absent"
    echo "         cp $REPO_DIR/server/env.production.example $ENV_FILE"
fi

if [ -f "$ENV_FILE" ]; then
    REPO_VIDE=$(grep -E '^GITHUB_REPO=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)
    JETON=$(grep -E '^GITHUB_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)
    BRANCHE=$(grep -E '^GITHUB_BRANCH=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)

    # On compare au gabarit volontairement evident, pas a la vraie valeur :
    # mettre le depot attendu dans l'exemple rendrait le test incapable de
    # distinguer « non rempli » de « correctement rempli ».
    if [ -z "$REPO_VIDE" ] || [ "$REPO_VIDE" = "VOTRE-COMPTE/koine" ]; then
        rouge "GITHUB_REPO est encore a la valeur d'exemple ($REPO_VIDE)"
        echo "         Renseigner le depot : https://github.com/<votre-compte>/<votre-depot>"
    else
        vert "GITHUB_REPO = $REPO_VIDE"
    fi

    if [ -z "$JETON" ]; then
        if [ -z "$REPO_VIDE" ] || [ "$REPO_VIDE" = "VOTRE-COMPTE/koine" ]; then
            jaune "GITHUB_TOKEN vide : indispensable si le depot est prive"
        else
            jaune "GITHUB_TOKEN vide : normal si le depot est public"
        fi
    else
        vert "GITHUB_TOKEN renseigne"
    fi

    vert "branche : ${BRANCHE:-main}"
fi
echo

# --- 4. Donnees -------------------------------------------------------------
echo "4. Donnees"
if [ -d "$DATA_DIR" ] && [ -w "$DATA_DIR" ]; then
    vert "$DATA_DIR accessible en ecriture"
elif [ -d "$DATA_DIR" ]; then
    rouge "$DATA_DIR existe mais n'est pas accessible en ecriture"
else
    rouge "$DATA_DIR absent"
    echo "         mkdir -p $DATA_DIR/decks"
fi

if [ -d "$DATA_DIR/decks" ]; then
    COMPTE=$(find "$DATA_DIR/decks" -maxdepth 1 -name '*.csv' | wc -l | tr -d ' ')
    if [ "$COMPTE" -gt 0 ]; then
        vert "$COMPTE deck(s) deja installe(s)"
    else
        jaune "aucun deck : ils seront installes au premier demarrage"
    fi
else
    jaune "dossier decks absent : il sera cree au premier demarrage"
fi
echo

# --- 5. Docker --------------------------------------------------------------
echo "5. Docker"
if command -v docker > /dev/null 2>&1; then
    vert "docker disponible : $(docker --version 2>/dev/null | head -1)"
else
    rouge "docker indisponible"
fi

if command -v docker-compose > /dev/null 2>&1; then
    vert "docker-compose disponible"
elif docker compose version > /dev/null 2>&1; then
    jaune "seul 'docker compose' est disponible ; deploy.sh appelle docker-compose"
    echo "         Si le deploiement echoue, creer un lien :"
    echo "           sudo ln -s /usr/local/bin/docker-compose /usr/local/bin/docker-compose"
else
    rouge "docker-compose indisponible"
    echo "         Paquet Docker sur le Synology, ou lien vers le binaire compose v2"
fi

# Sans ce controle, une faute d'indentation dans le YAML n'apparait qu'au
# moment du build, apres avoir attendu la fin de la construction.
COMPOSE_CMD=$(command -v docker-compose 2>/dev/null || echo "")
if [ -z "$COMPOSE_CMD" ] && docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
fi

if [ -n "$COMPOSE_CMD" ] && [ -f "$COMPOSE_DIR/docker-compose.yml" ]; then
    # On se fie au code de sortie, pas a la sortie standard : compose v2 ecrit
    # un avertissement sur stderr pour un fichier parfaitement valide
    # (« l'attribut version est depreciee »).
    $COMPOSE_CMD -f "$COMPOSE_DIR/docker-compose.yml" config > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        vert "docker-compose.yml est valide"
    else
        rouge "docker-compose.yml est illisible"
        $COMPOSE_CMD -f "$COMPOSE_DIR/docker-compose.yml" config 2>&1 > /dev/null |
            head -3 | sed 's/^/           /'
        echo "         Le build echouerait immediatement. Corriger avant de deployer."
    fi
fi

if docker ps 2>/dev/null | grep -q koine; then
    SANTE=$(docker inspect --format='{{.State.Health.Status}}' koine 2>/dev/null)
    if [ "$SANTE" = "healthy" ]; then
        vert "conteneur koine en marche et sain"
    elif [ "$SANTE" = "starting" ]; then
        jaune "conteneur koine demarrage"
    else
        rouge "conteneur koine en mauvaise sante ($SANTE)"
        echo "         docker logs koine"
    fi
else
    jaune "conteneur koine non demarre (normal avant le premier deploiement)"
fi
echo

# --- 6. Port ----------------------------------------------------------------
echo "6. Port"
if docker ps 2>/dev/null | grep -q '"3005->'; then
    vert "port 3005 attribue a koine"
elif command -v netstat > /dev/null 2>&1 && netstat -an 2>/dev/null | grep -q '3005.*LISTEN'; then
    rouge "le port 3005 est deja occupe par un autre service"
    echo "         Changer le port dans server/docker-compose.yml puis redeployer"
else
    vert "port 3005 libre"
fi
jaune "a titre indicatif : 3000 tresor-prive, 3002 gestion_locative, 3004 plume"
echo

echo "=============================================="
if [ "$KO" -eq 0 ]; then
    echo "  Tout est en place. Deploiement possible."
else
    echo "  $KO element(s) a regler avant de deployer."
fi
echo "=============================================="
exit $KO