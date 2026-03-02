FROM node:18-alpine

# Dossier de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances (prod only)
RUN npm ci --only=production

# Copier le code source
COPY src/ ./src/

# Expose le port
EXPOSE 10000

# Démarrer le serveur
CMD ["node", "src/server.js"]
