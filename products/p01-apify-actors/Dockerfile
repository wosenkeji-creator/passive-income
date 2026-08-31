# Chromium is required, not optional: the host is behind AWS WAF and a token can
# only be minted by a real browser solving the challenge (measured 2026-09-01).
# The plain `apify/actor-node:20` base ships no browser, so the mint would fail
# in the cloud even though the local run works.
#
# The tag is pinned to the playwright version in package.json. The image
# pre-installs exactly one Chromium revision, and the npm package refuses to
# launch a revision it was not built against — an unpinned `:20` (last built
# 2026-05, no 1.62.1 variant) would fail at launch, not at install.
FROM apify/actor-node-playwright-chrome:22-1.62.1

COPY --chown=myuser:myuser package*.json ./
RUN npm ci --include=dev

COPY --chown=myuser:myuser tsconfig.json ./
COPY --chown=myuser:myuser src ./src
COPY --chown=myuser:myuser .actor ./.actor
RUN npm run build
RUN npm prune --omit=dev

CMD ["node", "dist/main.js"]
