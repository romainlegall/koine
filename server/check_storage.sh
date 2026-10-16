#!/bin/bash

# Verification du dossier de donnees avant de deployer Koiné.
#
# A lancer sur le NAS :  bash /volume1/docker/koine/server/check_storage.sh
#
# Le dossier data/ est le seul volume de l'application. S'il disparait, la
# progression et les decks ajoutes depuis l'interface sont perdus : on verifie
# donc qu'il existe, qu'il est accessible en ecriture, et qu'il contient bien des
# CSV lisibles.

DATA_DIR="/volume1/docker/koine/data"
DECK_DIR="$DATA_DIR/decks"

KO=0

vert() { echo "  [OK]    $1"; }
rouge() { echo "  [MANQUE] $1"; KO=$((KO + 1)); }
jaune() { echo "  [INFO]   $1"; }

echo "=============================================="
echo "  Koiné — verification des donnees"
echo "=============================================="
echo

echo "1. Dossier data"
if [ -d "$DATA_DIR" ]; then
    vert "$DATA_DIR existe"
else
    rouge "$DATA_DIR est absent"
    echo "         mkdir -p $DECK_DIR"
fi

if [ -d "$DATA_DIR" ]; then
    if [ -w "$DATA_DIR" ]; then
        vert "accessible en ecriture"
    else
        rouge "existe mais n'est pas accessible en ecriture"
        echo "         Le conteneur ecrit en root. Si le message persiste :"
        echo "           sudo chown -R 0:0 $DATA_DIR"
    fi
fi
echo

echo "2. Decks"
if [ ! -d "$DECK_DIR" ]; then
    rouge "$DECK_DIR est absent"
    echo "         L'application demarre mais n'a aucun deck a proposer."
    echo "         mkdir -p $DECK_DIR   puis redeployer : entrypoint.sh les installe."
else
    COMPTE=$(find "$DECK_DIR" -maxdepth 1 -name '*.csv' | wc -l | tr -d ' ')
    if [ "$COMPTE" -gt 0 ]; then
        vert "$COMPTE deck(s) :"
        find "$DECK_DIR" -maxdepth 1 -name '*.csv' -exec basename {} \; | sort | sed 's/^/           /'
    else
        rouge "aucun CSV dans $DECK_DIR"
        echo "         Les decks de debut sont reinstalles au demarrage du conteneur."
        echo "         Verifiez l'entreepoint dans les journaux :"
        echo "           docker logs koine"
    fi
fi
echo

echo "3. Fichiers d'etat"
for f in progress.json decks.json history.json; do
    if [ -f "$DATA_DIR/$f" ]; then
        TAILLE=$(wc -c < "$DATA_DIR/$f" | tr -d ' ')
        if [ "$TAILLE" -lt 2 ]; then
            jaune "$f present mais vide ($TAILLE octets) : aucune revision enregistree"
        else
            vert "$f — $TAILLE octets"
        fi
    else
        jaune "$f absent : normal tant qu'aucune partie n'a ete jouee"
    fi
done

if [ -f "$DATA_DIR/progress.json" ]; then
    CARTES=$(node -e "try{console.log(Object.keys(require('$DATA_DIR/progress.json')).length)}catch(e){console.log('illisible')}" 2>/dev/null)
    if [ "$CARTES" = "illisible" ]; then
        rouge "progress.json est illisible — le fichier est peut-etre corrompu"
        echo "         docker stop koine && mv $DATA_DIR/progress.json $DATA_DIR/progress.json.sauve"
        echo "         puis relancer. La progression repartira a zero."
    elif [ "$CARTES" -gt 0 ]; then
        vert "$CARTES carte(s) avec une progression enregistree"
    else
        jaune "aucune carte revisee pour l'instant"
    fi
fi
echo

echo "=============================================="
if [ "$KO" -eq 0 ]; then
    echo "  Donnees pretes."
else
    echo "  $KO element(s) a regler avant de deployer."
fi
echo "=============================================="
exit $KO