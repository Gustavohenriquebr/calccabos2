# Estágio de build unificado para rodar Node.js e FastAPI no mesmo contêiner
FROM nikolaik/python-nodejs:python3.11-nodejs20-slim

# Instalar dependências do sistema necessárias para compilar pacotes Python e rodar o supervisord
RUN apt-get update && apt-get install -y supervisor gcc libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ==========================================
# 1. Instalar dependências do Python (FastAPI)
# ==========================================
COPY backend/requirements.txt ./backend/
# Com a imagem Debian slim, o pip usará pacotes pré-compilados (wheels) para o pandas, psycopg, etc, instalando super rápido.
RUN pip install --no-cache-dir -r backend/requirements.txt

# ==========================================
# 2. Instalar dependências do Node.js
# ==========================================
COPY backend-node/package*.json ./backend-node/
RUN cd backend-node && npm ci --omit=dev

# ==========================================
# 3. Copiar código fonte
# ==========================================
COPY backend/ ./backend/
COPY backend-node/ ./backend-node/

# ==========================================
# 4. Configurar Supervisord
# ==========================================
COPY supervisord.conf /etc/supervisord.conf

# O Node rodará na 8000, e o Python na 8001 internamente.
# O Render vai mapear a porta 8000 para a internet.
ENV PORT=8000
ENV PYTHON_SERVICE_URL=http://127.0.0.1:8001

EXPOSE 8000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
