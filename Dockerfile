# AnugerahLink: aplikasi Node tanpa dependensi luar.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_FILE=/app/data/app.db

WORKDIR /app
COPY --chown=node:node . .

# Data dan cadangan disimpan di volume, bukan di dalam image.
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
