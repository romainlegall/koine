# syntax=docker/dockerfile:1
#
# Koiné — image de production pour le Synology.
#
# L'application n'est pas copiée depuis le contexte de build : elle est clonée
# depuis GitHub pendant la construction. Le NAS n'a donc besoin que du dossier
# server/ et de ce Dockerfile.
#
# Contrairement à plume, il n'y a pas de base de données : tout tient dans des
# fichiers JSON sous data/, montés en volume. C'est ce qui rend l'image simple.

FROM node:22-slim

ENV NODE_ENV=production \
    PORT=4100

# git est indispensable : c'est lui qui récupère le code au build.
# ca-certificates ne l'est pas moins : sans lui, git ne peut pas vérifier le
# certificat de github.com et le clone echoue sur « server certificate
# verification failed ».
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      git \
      ca-certificates \
      tzdata \
    && rm -rf /var/lib/apt/lists/*

ARG GITHUB_REPO
ARG GITHUB_BRANCH
ARG GITHUB_TOKEN

RUN git clone --depth 1 --branch ${GITHUB_BRANCH:-main} \
      https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git /app

WORKDIR /app

# Les dépendances sont installées une fois pour toutes ici : le rebuild ne les
# refait pas. --omit=dev car il n'y a rien de spécifique au développement, tout
# passe par node --check et les tests intégrés.
RUN npm ci --omit=dev && npm cache clean --force

# Porte de non-régression : la notation et le jeu des pays reposent sur deux
# règles délicates (seuils de similarité, déroulé des manches). Un build cassé
# ne doit pas atteindre le NAS. Ces tests ne touchent aucun fichier de données :
# ils tournent sur des parties créées en mémoire.
RUN npm test

# Les decks de départ sont copiés à part. Au démarrage, le volume /app/data
# masque le contenu du dépôt : sans cette copie de secours, un déploiement
# sur un dossier vide afficherait "aucun deck".
RUN mkdir -p /seed/decks && cp -r /app/data/decks/. /seed/decks/

# Contrôle : sans decks, l'application démarre mais n'a rien à proposer.
RUN ls /seed/decks/*.csv > /dev/null || (echo "ERREUR : aucun deck de départ" && exit 1)

COPY entrypoint.sh /usr/bin/entrypoint.sh
RUN chmod +x /usr/bin/entrypoint.sh

EXPOSE 4100

# Pas de curl dans l'image : le contrôle de santé passe par node lui-même.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4100)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "server.js"]