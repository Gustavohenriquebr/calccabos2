# CalcCabos - Runbook de Operacao

Este documento orienta a verificacao do ambiente publicado sem expor credenciais.

## Servicos oficiais

- Node/frontend/API: `https://calccabos2.onrender.com`
- Motor Python: `https://calccabos2-python.onrender.com`
- Liveness Node: `/health/live`
- Saude completa Node: `/health`
- Readiness Node: `/health/ready`
- Liveness Python: `/api/health`
- Readiness Python: `/api/ready`

## Verificacao rapida

1. Abrir a landing e confirmar carregamento sem erro no navegador.
2. Consultar `/health/live`; deve retornar `status: ok` rapidamente.
3. Consultar `/health`; `status: degraded` exige revisar MongoDB ou Python.
4. Consultar `/health/ready`; HTTP 503 significa que o Node esta vivo, mas nao pronto para calculo.
5. Consultar `/api/health` e `/api/ready` no servico Python.
6. Criar uma conta de teste, projeto e circuito.
7. Executar calculo, gerar memorial preliminar e exportar Excel.

## Interpretação

- `ok`: servico respondendo e dependencias principais disponiveis.
- `degraded`: o Node esta vivo, mas uma dependencia esta indisponivel ou lenta.
- `502/503/504`: tratar como indisponibilidade temporaria do motor; repetir depois de alguns segundos.
- Relatorio final bloqueado com pendencias tecnicas e comportamento esperado.

## Publicacao controlada

1. Confirmar build e testes locais.
2. Confirmar que `.env` e credenciais nao estao no Git.
3. Publicar somente a revisao revisada.
4. Acompanhar os logs do Node e Python durante o primeiro acesso.
5. Repetir o fluxo de cadastro, projeto, circuito, calculo e relatorio.

## Recuperacao

- Se o build falhar, nao promover a revisao.
- Se o Node estiver vivo e o Python degradado, manter o projeto editavel e repetir o calculo depois; nao declarar resultado como aprovado.
- Se houver falha de dados, pausar novas importacoes e preservar os snapshots existentes.
- Reverter somente para uma revisao conhecida e validada, mantendo os dados do MongoDB.

## Limites conhecidos

- O plano gratuito do Render pode suspender servicos e causar cold start.
- A biblioteca `xlsx` possui alertas de seguranca sem correcao direta no pacote atual; o importador limita tamanho, linhas, colunas, tipos e neutraliza formulas.
- Testes de carga reais e backup/restauracao do Atlas ainda precisam ser executados antes de grande volume publico.

CalcCabos e uma ferramenta de apoio tecnico. Resultados de projetos reais exigem revisao e responsabilidade de profissional habilitado.
