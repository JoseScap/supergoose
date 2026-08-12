FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/infra/package.json packages/infra/package.json
COPY packages/api/package.json packages/api/package.json

RUN npm ci

COPY tsconfig.json tsconfig.base.json eslint.config.mjs ./
COPY packages/core packages/core
COPY packages/infra packages/infra
COPY packages/api packages/api

RUN npm run build --workspace supergoose-core && npm run build --workspace supergoose-infra && npm run build --workspace supergoose-api
RUN npm prune --omit=dev

FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV API_CORS=http://localhost:5173

LABEL org.opencontainers.image.version="0.0.2"

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/ready').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start", "--workspace", "supergoose-api"]
