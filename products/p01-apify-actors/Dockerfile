FROM apify/actor-node:20

COPY package*.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src
COPY .actor ./.actor
RUN npm run build
RUN npm prune --omit=dev

CMD ["node", "dist/main.js"]
