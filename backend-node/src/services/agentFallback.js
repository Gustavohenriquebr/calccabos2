'use strict'

function statusFinal(circuito) {
  return String(circuito.status_final || circuito.status || 'ALERTA').toUpperCase()
}

function buildAgentFallback({ mensagem, projeto, circuitos, reason }) {
  const total = circuitos.length
  const ok = circuitos.filter((c) => statusFinal(c) === 'OK').length
  const critico = circuitos.filter((c) => statusFinal(c).includes('CRIT')).length
  const alerta = Math.max(total - ok - critico, 0)
  const topAlertas = circuitos
    .filter((c) => statusFinal(c) !== 'OK')
    .slice(0, 8)
    .map((c) => `- ${c.tag || c.descricao || 'Circuito'}: status ${statusFinal(c)}${c.nota_tecnica ? ` (${c.nota_tecnica})` : ''}`)

  return [
    '[RESUMO OBJETIVO]',
    'A IA online esta indisponivel no momento, entao respondi com uma analise offline baseada nos dados salvos no backend Node.',
    '',
    '[CONTEXTO]',
    `Projeto: ${projeto?.nome || 'nao informado'}`,
    `Pergunta: ${mensagem}`,
    `Circuitos cadastrados: ${total}`,
    `OK: ${ok} | ALERTA: ${alerta} | CRITICO: ${critico}`,
    '',
    '[PONTOS PARA REVISAO]',
    ...(topAlertas.length ? topAlertas : ['- Nenhum circuito em alerta/critico foi identificado nos dados salvos.']),
    '',
    '[RECOMENDACAO]',
    '1. Confira os dados obrigatorios do projeto e dos circuitos.',
    '2. Revise circuitos em ALERTA/CRITICO antes de liberar memorial.',
    '3. Para IA online, verifique AI_ENABLED, AI_PROVIDER e OPENAI_API_KEY no backend Node.',
    '4. Mesmo com IA online, mantenha validacao de profissional habilitado.',
    '',
    `[DIAGNOSTICO TECNICO] ${reason || 'Falha ao acessar o motor Python.'}`,
  ].join('\n')
}

module.exports = {
  buildAgentFallback,
}
