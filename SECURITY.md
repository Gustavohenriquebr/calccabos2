# Security Policy

## Escopo

Este documento registra a politica inicial de seguranca do CalcCabos durante a preparacao para GitHub e deploy.

## Dados Sensíveis

Nao versionar:

- arquivos `.env`;
- tokens;
- senhas;
- chaves OpenAI, MongoDB, Cloudinary, Render, Vercel ou GitHub;
- certificados;
- bancos locais;
- uploads locais;
- logs com payloads sensiveis.

Use `.env.example` apenas com nomes de variaveis e placeholders.

## Autenticacao e Sessao

- `JWT_SECRET`, `SESSION_SECRET` e `SECRET_KEY` devem ser obrigatorios em producao.
- Senhas devem ser armazenadas somente com hash seguro.
- Hashes de senha nunca devem ser retornados pela API.
- Login e registro devem ter rate limit.

## API

- Validar `body`, `params` e `query`.
- Rejeitar campos proibidos como `userId`, `ownerId`, `role`, `isAdmin`, `senhaHash`, `createdAt`, `updatedAt` e secrets.
- Garantir autorizacao por dono em projetos, circuitos e relatorios.
- Nao retornar stack trace, paths internos ou objetos completos demais.

## Uploads

- Planilhas devem ser tratadas como dados nao confiaveis.
- Aceitar somente formatos necessarios.
- Limitar tamanho, linhas e colunas.
- Nao executar formulas.
- Nao salvar arquivo bruto quando nao for necessario.

## IA Auxiliar

- O frontend nunca deve chamar OpenAI ou outro provedor diretamente.
- Chaves de IA devem existir somente no backend ou no provedor de deploy.
- `OPENAI_API_KEY` nunca deve ser retornada ao frontend, logada ou enviada no contexto da conversa.
- O contexto enviado ao provedor deve ser minimo: projeto, resumo de circuitos, status e alertas relevantes.
- A IA nao pode declarar aprovacao final, assumir responsabilidade tecnica ou ignorar alertas do motor.
- BYOK futuro deve evitar armazenamento em texto puro; preferir uso temporario por sessao ou criptografia forte no backend.

## Reporte

Enquanto o projeto estiver privado/local, registre riscos em issues internas ou no planejamento do bloco seguinte. Antes de abrir o repositorio publicamente, defina canal de contato para vulnerabilidades.
