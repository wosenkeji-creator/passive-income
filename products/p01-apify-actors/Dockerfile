FROM apify/actor-node:20

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY .actor ./.actor
RUN npm run build
RUN npm prune --omit=dev

CMD ["node", "dist/main.js"]
