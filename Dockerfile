# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Optional test stage. It is not part of the runtime image, so Compose does not
# build it. Run it explicitly with:
#
#   docker build --target test -t login-system:test .
# ---------------------------------------------------------------------------
FROM node:24-alpine AS test

WORKDIR /app
ENV NODE_ENV=test

COPY package.json schema.sql server.js ./
COPY src ./src
COPY public ./public
COPY test ./test

RUN npm test

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

LABEL org.opencontainers.image.title="Login System" \
      org.opencontainers.image.description="A basic SQL-backed login system built with Node.js and SQLite" \
      org.opencontainers.image.version="1.0.0"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/app/data/login.db

WORKDIR /app

COPY package.json schema.sql server.js ./
COPY src ./src
COPY public ./public

# Keep application files owned by root, but readable by the unprivileged user.
# The data directory is separate because SQLite must be able to write there.
RUN chmod -R a+rX /app \
    && mkdir -p /app/data \
    && chown node:node /app/data

USER node

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

STOPSIGNAL SIGTERM

CMD ["node", "server.js"]
