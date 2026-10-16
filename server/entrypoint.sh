#!/bin/bash
set -e

# Koiné — démarrage dans le conteneur.
#
# Sans base de données à attendre, le démarrage tient en une chose : les decks de
# départ. Le volume /app/data masque ce que le dépôt GitHub a installé, donc au
# premier lancement sur un dossier vide l'application n'aurait aucun deck.

DATA_DIR=/app/data
DECK_DIR="$DATA_DIR/decks"
SEED_DIR=/seed/decks

echo "Koiné — preparation des donnees"

mkdir -p "$DECK_DIR"

# Copie sans écrasement : un deck déjà présent sur le NAS est le fruit des
# modifications faites depuis l'interface, il doit survivre au redéploiement.
# Seuls les decks absents sont ajoutés, ce qui permet d'en publier de nouveaux
# sans écraser le travail du joueur.
COPIES=0
if [ -d "$SEED_DIR" ]; then
  for f in "$SEED_DIR"/*.csv; do
    [ -e "$f" ] || continue
    cible="$DECK_DIR/$(basename "$f")"
    if [ -f "$cible" ]; then
      echo "  conserve : $(basename "$f")"
    else
      cp "$f" "$cible"
      echo "  installe : $(basename "$f")"
      COPIES=$((COPIES + 1))
    fi
  done
fi

if [ "$COPIES" -eq 0 ]; then
  echo "  aucun nouveau deck a installer"
fi

# Les fichiers d'etat n'ont pas besoin d'exister : l'application les cree au
# premier enregistrement. Les creer ici evite simplement un premier acces en
# ecriture sur un fichier absent.
[ -f "$DATA_DIR/progress.json" ] || echo '{}' > "$DATA_DIR/progress.json"

COMPTE=$(find "$DECK_DIR" -name '*.csv' | wc -l | tr -d ' ')
echo "$COMPTE deck(s) disponible(s)"

if [ "$COMPTE" -eq 0 ]; then
  echo "ERREUR : aucun deck dans $DECK_DIR. L'application demarrerait vide."
  exit 1
fi

echo "Demarrage..."
exec "$@"