# CalcCabos

Projeto com duas frentes:

1. Desktop (Electron)  
2. Web (Vercel + Render)

## Arquitetura Web (producao)

Fluxo canônico da aplicacao web:

`Frontend React/Vite (Vercel) -> Backend Node/Express (Render) -> Engine Python/FastAPI (Render) -> MongoDB`

- O frontend **sempre** conversa com o backend Node via `VITE_API_URL`.
- O backend Node concentra autenticacao, dados de projeto/circuitos e proxy para o engine Python.
- O backend Python executa calculos, relatorios e agente tecnico.

Guia completo de deploy web: [README_WEB_DEPLOY.md](</C:/Users/GUSTAVO/Desktop/CalcCabos/README_WEB_DEPLOY.md>)

## Estrutura principal

- [frontend](</C:/Users/GUSTAVO/Desktop/CalcCabos/frontend>) -> React + Vite + Tailwind
- [backend-node](</C:/Users/GUSTAVO/Desktop/CalcCabos/backend-node>) -> Express + Mongoose + JWT
- [backend](</C:/Users/GUSTAVO/Desktop/CalcCabos/backend>) -> FastAPI engine de calculo
- [electron](</C:/Users/GUSTAVO/Desktop/CalcCabos/electron>) -> aplicacao desktop

## Desktop (mantido)

O fluxo desktop continua existente e nao foi removido.

### Executar desktop em desenvolvimento

```bash
npm install
cd frontend && npm install && cd ..
cd backend && pip install -r requirements.txt && cd ..
npm run dev
```

## Seguranca (importante)

- Arquivos `.env` locais foram mantidos para nao interromper o ambiente atual.
- O arquivo de exemplo foi sanitizado com placeholders.
- Depois que o deploy web estiver estavel, as chaves expostas historicamente devem ser revogadas e rotacionadas.

