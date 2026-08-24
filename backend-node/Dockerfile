# ── Estágio único — Node.js (usado apenas se deploy somente do Node) ──────────
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["node", "src/app.js"]
