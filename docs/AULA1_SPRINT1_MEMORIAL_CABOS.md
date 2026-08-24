# Sprint 1 - Aula 1: Memorial de Cálculo de Cabos + Rastreabilidade da Lista de Cargas

## Objetivo da Sprint
O objetivo desta sprint foi deixar o CalcCabos mais defensável tecnicamente como um sistema de geração de memorial de cálculo de cabos industriais, fortalecendo a rastreabilidade dos dados e melhorando os relatórios PDF e Excel para apresentar essas informações de forma clara e profissional.

## Arquivos Alterados / Criados
- **Criado:** `backend/app/services/memorial_cabos.py`
  - Criado helper puro, independente de banco de dados, para organizar e extrair as informações cruciais do cálculo e status normativos dos circuitos de maneira consolidada.
- **Alterado:** `backend/app/services/relatorio_excel.py`
  - Adicionada aba "Memorial Cabos", baseada na saída do novo helper, contendo os resultados e a rastreabilidade detalhada dos cálculos e métodos adotados para todos os circuitos, sem afetar ou apagar as abas anteriores.
- **Alterado:** `backend/app/services/relatorio_pdf.py`
  - Adicionada uma tabela simplificada "Memorial de Cálculo de Cabos (Resumo Técnico)" contendo os dados mais importantes de cada circuito. A tabela antiga "Tabela principal de dimensionamento completo" com todas as 38 colunas foi preservada mais abaixo. Também foi adicionado texto fixo de critérios normativos.
- **Alterado:** `frontend/src/components/projeto/MemorialProjeto.jsx`
  - Incluído o bloco de "Critérios de Cálculo de Cabos" explicando a rastreabilidade do dimensionamento, além de melhorar o título da seção de resumo visual.

## O Que Foi Melhorado
- **Apresentação e Auditoria:** Os engenheiros que validarem o projeto pelo CalcCabos terão nas mãos tabelas executivas focadas nos resultados da Aula 1 (seção de cabo, fatores K, Icc, Ib, Iz e ΔV) de forma condensada.
- **Aba de Excel Dedicada:** Onde o revisor consegue filtrar e analisar exatamente o que importa na rastreabilidade sem se perder nas 38 colunas de cálculo internas.
- **Confiabilidade:** Nenhuma lógica de engenharia já implementada foi desfeita e os PDF/Excel ganharam maior legibilidade técnica.

## O Que Ficou Mais Bem Coberto da Aula 1
- **Lista de Cargas / Dimensionamento de Cabos:** O foco da Aula 1 é ter um documento robusto. A nova formatação de PDF e Excel e a apresentação de tela transformam a base de dados em um memorial propriamente dito, que um revisor júnior ou sênior consegue seguir etapa a etapa.

## Itens da Aula 1 Que Permanecem Para o Futuro
- Cargas (separação entre normal, essencial e emergência).
- Lista formal de documentos e gerenciamento de revisões avançado.
- Lista formal de equipamentos.
- SPDA (Sistema de Proteção contra Descargas Atmosféricas).
- Luminotécnico.
- Banco de baterias / Sistemas UPS.
- Dissipação térmica no interior do painel.
- Fator de harmônicos.
- Fluxo de potência na rede (load flow).

## Confirmações e Restrições Atendidas
- **NÃO HOUVE MIGRATION.** Os schemas de banco e models originais do SQLAlchemy (`Projeto` e `Circuito`) não sofreram alterações.
- **NÃO HOUVERAM ALTERAÇÕES DE CÁLCULO.** O arquivo `calculo.py` não foi modificado. Todo o cálculo elétrico foi inteiramente preservado e a lógica matemática é a original. 

## Como Testar
1. Suba o servidor com `python main.py` ou `pytest`.
2. Rode `npm run dev` no frontend.
3. Acesse a tela "Memorial Técnico" dentro de um projeto no frontend e valide a nova Seção "0 - Critérios de Cálculo de Cabos".
4. Gere a exportação Excel (Relatório XLS) e verifique se a nova aba "Memorial Cabos" foi criada com cabeçalhos congelados e auto-filtro.
5. Gere a exportação PDF (Relatório PDF) e observe a nova tabela condensada na primeira parte técnica do PDF ("Memorial de Calculo de Cabos (Resumo Tecnico)"), conferindo as colunas Ib, Icc, Disjuntor Icu, e Status.
