# Usa Node 20 (necessario per supportare l'oggetto File globale)                                         M-6 Copy
FROM node:20-alpine

# Imposta la directory di lavoro
WORKDIR /app

# Copia i file di dipendenza
COPY package*.json ./

# Installa le dipendenze
RUN npm install --production

# Copia il resto del codice
COPY . .

# Espone la porta
EXPOSE 7000

# Comando di avvio
CMD ["npm", "start"]



