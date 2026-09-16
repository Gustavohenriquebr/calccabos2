'use strict'

const PDFDocument = require('pdfkit')
const XLSX = require('xlsx')

function value(value, fallback = 'N/D') {
  if (value === null || value === undefined || value === '') return fallback
  return value
}

function pdfSafeText(value) {
  if (value === null || value === undefined) return value
  return String(value)
    .replace(/Δ/g, 'Delta')
    .replace(/√/g, 'raiz')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
}

function pct(value) {
  if (value === null || value === undefined || value === '') return 'N/D'
  return `${Number(value).toFixed(2)}%`
}

function num(value, suffix = '', decimals = 2) {
  if (value === null || value === undefined || value === '') return 'N/D'
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  return `${Number.isInteger(number) ? number : number.toFixed(decimals)}${suffix}`
}

function voltageLabel(circuit) {
  const dados = circuit.dados_informados || {}
  const valor = dados.tensao ?? dados.tensao_v
  const unidade = dados.tensao_unidade || 'V'
  const tipo = dados.tipo_sistema_tensao || 'AC'
  const classe = dados.classificacao_tensao ? ` · ${dados.classificacao_tensao}` : ''
  return `${num(valor, ` ${unidade}`, unidade === 'kV' ? 2 : 0)} · ${tipo}${classe}`
}

function collectPdf(doc) {
  return new Promise((resolve, reject) => {
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

function header(doc, snapshot) {
  doc
    .fontSize(8)
    .fillColor('#64748b')
    .text(`CalcCabos · ${snapshot.document_status} · hash ${snapshot.input_hash.slice(0, 12)}`, 46, 24, { align: 'right' })
    .moveDown()
  doc.fillColor('#111827')
}

function footer(doc, snapshot) {
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i)
    if (snapshot.watermark) {
      doc
        .save()
        .rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] })
        .fontSize(34)
        .fillColor('#cbd5e1')
        .opacity(0.22)
        .text('PLANO FREE - APOIO TECNICO', 70, doc.page.height / 2, { align: 'center', width: doc.page.width - 140 })
        .opacity(1)
        .restore()
    }
    doc
      .fontSize(8)
      .fillColor('#64748b')
      .text(
        `Documento de apoio técnico. Validação profissional necessária. Página ${i + 1}/${range.count}`,
        46,
        doc.page.height - 36,
        { align: 'center', lineBreak: false }
      )
    header(doc, snapshot)
  }
  doc.fillColor('#111827')
}

function title(doc, text) {
  doc.moveDown(0.6).fontSize(14).fillColor('#111827').text(text, { continued: false })
  doc.moveTo(46, doc.y + 3).lineTo(doc.page.width - 46, doc.y + 3).strokeColor('#cbd5e1').stroke()
  doc.moveDown(0.7)
}

function kvTable(doc, rows) {
  const startX = doc.page.margins.left
  rows.forEach(([label, val]) => {
    const y = doc.y
    doc.fontSize(8).fillColor('#64748b').text(label, startX, y, { width: 140 })
    doc.fontSize(9).fillColor('#111827').text(String(value(val)), startX + 150, y, {
      width: doc.page.width - doc.page.margins.right - startX - 150,
    })
    doc.moveDown(0.2)
  })
  doc.x = startX
  doc.moveDown(0.5)
}

function bulletList(doc, items, empty = 'Sem registros.') {
  const list = Array.isArray(items) && items.length ? items : [empty]
  list.slice(0, 40).forEach((item) => {
    doc.fontSize(9).fillColor('#111827').text(`- ${item}`, { lineGap: 2 })
  })
  doc.moveDown(0.5)
}

function circuitTableRows(snapshot) {
  return snapshot.circuits.map((circuit) => [
    circuit.tag,
    circuit.descricao,
    circuit.origem,
    num(circuit.dados_informados.potencia_kw, ' kW', 1),
    voltageLabel(circuit),
    num(circuit.resultados.corrente_projeto_a, ' A', 1),
    num(circuit.resultados.secao_mm2, ' mm2', 1),
    pct(circuit.resultados.queda_tensao_pct),
    num(circuit.resultados.disjuntor_a, ' A', 0),
    circuit.status,
  ])
}

function drawSimpleTable(doc, headers, rows) {
  const proportions = [54, 128, 60, 58, 48, 54, 54, 52, 54, 64]
  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const total = proportions.reduce((sum, width) => sum + width, 0)
  const widths = proportions.map((width) => width * availableWidth / total)
  const rowHeight = 22
  const left = 46
  let y = doc.y

  function drawRow(row, isHeader = false) {
    let x = left
    row.forEach((cell, index) => {
      doc.rect(x, y, widths[index], rowHeight).strokeColor('#cbd5e1').stroke()
      doc
        .fontSize(isHeader ? 7 : 7)
        .fillColor(isHeader ? '#ffffff' : '#111827')
      if (isHeader) doc.rect(x, y, widths[index], rowHeight).fillAndStroke('#1f2937', '#cbd5e1')
      doc.fillColor(isHeader ? '#ffffff' : '#111827').text(String(value(cell, '')), x + 3, y + 6, {
        width: widths[index] - 6,
        height: rowHeight - 5,
        ellipsis: true,
      })
      x += widths[index]
    })
    y += rowHeight
    if (y > doc.page.height - 86) {
      doc.addPage()
      y = 70
    }
  }

  drawRow(headers, true)
  rows.forEach((row) => drawRow(row))
  doc.x = left
  doc.y = y + 8
}

async function buildProfessionalPdf(snapshot) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 46,
    bufferPages: true,
    compress: false,
    info: {
      Title: `CalcCabos - Memorial ${snapshot.document_status}`,
      Author: 'CalcCabos',
      Subject: 'Memorial técnico de projeto elétrico',
      Keywords: 'CalcCabos, memorial tecnico, cabos, projeto eletrico',
    },
  })
  const originalText = doc.text.bind(doc)
  doc.text = (text, ...args) => originalText(pdfSafeText(text), ...args)
  const originalHeightOfString = doc.heightOfString.bind(doc)
  doc.heightOfString = (text, ...args) => originalHeightOfString(pdfSafeText(text), ...args)
  const ready = collectPdf(doc)
  const project = snapshot.project

  doc.fontSize(22).fillColor('#111827').text('CalcCabos', { align: 'left' })
  doc.moveDown(0.4).fontSize(17).text('Memorial técnico de dimensionamento elétrico')
  doc.moveDown(0.5)
  const preliminary = snapshot.document_status === 'PRELIMINAR'
  const notice = preliminary
    ? 'RELATÓRIO PRELIMINAR — NÃO LIBERADO PARA EMISSÃO FINAL'
    : 'RELATÓRIO FINAL — DADOS MÍNIMOS SEM BLOQUEIO REGISTRADO'
  const noticeY = doc.y
  const noticeWidth = doc.page.width - 116
  doc.fontSize(10)
  const noticeHeight = Math.max(34, doc.heightOfString(notice, { width: noticeWidth }) + 20)
  doc.rect(46, noticeY, doc.page.width - 92, noticeHeight)
    .fillAndStroke(preliminary ? '#fef3c7' : '#dcfce7', preliminary ? '#f59e0b' : '#22c55e')
    .fillColor(preliminary ? '#92400e' : '#166534')
    .text(notice, 58, noticeY + 10, { width: noticeWidth })
    .fillColor('#111827')
  doc.x = 46
  doc.y = noticeY + noticeHeight + 14

  kvTable(doc, [
    ['Projeto', project.nome],
    ['Cliente', project.cliente],
    ['UF/Cidade', [project.uf, project.cidade].filter(Boolean).join('/')],
    ['Concessionária', project.concessionaria],
    ['Tensão de referência', num(project.tensao_referencia_v, ' V', 0)],
    ['Revisão', project.revisao],
    ['Responsável técnico', project.responsavel_tecnico],
    ['Status do documento', snapshot.document_status],
    ['Data/hora do cálculo', snapshot.generated_at],
    ['Engine version', snapshot.engine_version],
    ['Input hash', snapshot.input_hash],
  ])

  title(doc, 'Escopo')
  doc.fontSize(9).text('Documento de apoio técnico para rastrear entradas, premissas, critérios e resultados persistidos pelo CalcCabos. Não substitui análise, emissão ou responsabilidade de profissional habilitado.')

  title(doc, 'Premissas declaradas')
  bulletList(doc, snapshot.premissas)

  title(doc, 'Critérios adotados')
  bulletList(doc, [
    'Ampacidade: comparação entre corrente de projeto/corrigida e capacidade do condutor selecionado.',
    'Queda de tensão: comparação entre queda calculada persistida e limite adotado no circuito/projeto.',
    'Seção mínima: verificação documental dos mínimos declarados no snapshot.',
    'Proteção: avaliação documentada de corrente nominal, curva e capacidade de interrupção quando disponível.',
    'Curto-circuito: indicado como avaliado apenas quando os dados de curto foram informados no circuito.',
  ])

  title(doc, 'Resumo dos circuitos')
  drawSimpleTable(
    doc,
    ['Circuito', 'Descrição', 'Quadro', 'Pot.', 'Tensão', 'Corrente', 'Seção', 'Queda', 'Proteção', 'Status'],
    circuitTableRows(snapshot)
  )

  snapshot.circuits.slice(0, 40).forEach((circuit) => {
    if (doc.y > doc.page.height - 180) doc.addPage()
    title(doc, `Dimensionamento por circuito — ${circuit.tag}`)
    kvTable(doc, [
      ['Descrição', circuit.descricao],
      ['Origem/Destino', [circuit.origem, circuit.destino].filter(Boolean).join(' -> ')],
      ['Potência / tensão / fases', `${num(circuit.dados_informados.potencia_kw, ' kW', 1)} · ${voltageLabel(circuit)} · ${value(circuit.dados_informados.fases)}F`],
      ['Referência / contexto', `${value(circuit.dados_informados.referencia_tensao)} · ${value(circuit.dados_informados.contexto_aplicacao)}`],
      ['Corrente de projeto', num(circuit.resultados.corrente_projeto_a, ' A', 1)],
      ['Cabo / seção', `${value(circuit.resultados.cabo)} · ${num(circuit.resultados.secao_mm2, ' mm2', 1)}`],
      ['Disjuntor', `${num(circuit.resultados.disjuntor_a, ' A', 0)} · Icu ${num(circuit.resultados.icu_ka, ' kA', 1)} · Curva ${value(circuit.resultados.curva)}`],
      ['Queda de tensão', `${pct(circuit.resultados.queda_tensao_pct)} / limite ${pct(circuit.resultados.queda_tensao_max_pct)}`],
      ['Status', circuit.status],
    ])
    doc.fontSize(9).fillColor('#111827').text('Como chegamos neste resultado?', { underline: true })
    bulletList(doc, [
      `Corrente documentada: ${num(circuit.resultados.corrente_projeto_a, ' A', 1)}.`,
      `Ampacidade documentada: ${num(circuit.resultados.ampacidade_a, ' A', 1)} para seção ${num(circuit.resultados.secao_mm2, ' mm2', 1)}.`,
      `Queda documentada: ${pct(circuit.resultados.queda_tensao_pct)} contra limite ${pct(circuit.resultados.queda_tensao_max_pct)}.`,
      `Proteção documentada: ${num(circuit.resultados.disjuntor_a, ' A', 0)} / Icu ${num(circuit.resultados.icu_ka, ' kA', 1)}.`,
      `Curto-circuito: ${circuit.resultados.isc_local_ka ? `${num(circuit.resultados.isc_local_ka, ' kA', 2)} no ponto informado.` : 'verificação não avaliada por ausência de dado.'}`,
    ])
    if (circuit.alertas.length) {
      doc.fontSize(9).fillColor('#92400e').text('Alertas e pendências:', { underline: true })
      bulletList(doc, circuit.alertas)
      doc.fillColor('#111827')
    }
  })

  title(doc, 'Alertas e pendências')
  bulletList(doc, [...snapshot.summary.bloqueios, ...snapshot.summary.avisos])

  title(doc, 'Unifilar')
  doc.fontSize(9).text('O unifilar visual do projeto poderá ser anexado ao memorial quando o layout persistido estiver disponível. Nesta versão, o relatório registra a pendência de anexo gráfico quando aplicável.')

  title(doc, 'Limitações')
  bulletList(doc, snapshot.limitacoes)

  title(doc, 'Conclusão técnica')
  if (snapshot.document_status === 'PRELIMINAR') {
    doc.fontSize(10).fillColor('#92400e').text('Documento preliminar. Existem dados ausentes, pendências ou verificações bloqueadas/não avaliadas. Não liberado para emissão final.')
  } else {
    doc.fontSize(10).fillColor('#166534').text('Documento final de apoio técnico gerado sem bloqueios mínimos registrados no snapshot. A emissão e responsabilidade técnica dependem de validação profissional aplicável.')
  }
  doc.fillColor('#111827')

  footer(doc, snapshot)
  doc.end()
  return ready
}

function sheetFromRows(name, rows) {
  return { name, sheet: XLSX.utils.aoa_to_sheet(rows) }
}

function buildProfessionalExcel(snapshot) {
  const wb = XLSX.utils.book_new()
  const project = snapshot.project
  const controlRows = [
    ['CalcCabos - Controle do relatório'],
    ['Status do documento', snapshot.document_status],
    ['Aviso', snapshot.document_status === 'PRELIMINAR' ? 'RELATÓRIO PRELIMINAR — NÃO LIBERADO PARA EMISSÃO FINAL' : 'Relatório final de apoio técnico'],
    ['Input hash', snapshot.input_hash],
    ['Engine version', snapshot.engine_version],
    ['Data/hora do cálculo', snapshot.generated_at],
    ['Total de circuitos', snapshot.summary.total_circuitos],
    ['OK', snapshot.summary.ok],
    ['Alertas', snapshot.summary.alertas],
    ['Bloqueados', snapshot.summary.bloqueados],
    ['Incompletos', snapshot.summary.incompletos],
    ['Não avaliados', snapshot.summary.nao_avaliados],
  ]
  const sheets = [
    sheetFromRows('Controle', controlRows),
    sheetFromRows('Projeto', [
      ['Campo', 'Valor'],
      ['Projeto', project.nome],
      ['Cliente', project.cliente],
      ['UF', project.uf],
      ['Cidade', project.cidade],
      ['Concessionária', project.concessionaria],
      ['Tensão referência (V)', project.tensao_referencia_v],
      ['Revisão', project.revisao],
      ['Responsável técnico', project.responsavel_tecnico],
      ['Observações locais', project.observacoes_locais],
    ]),
    sheetFromRows('Premissas', [['Premissa'], ...snapshot.premissas.map((item) => [item])]),
    sheetFromRows('Circuitos', [
      ['Circuito', 'Descrição', 'Quadro', 'Destino', 'Potência kW', 'Tensão', 'Unidade', 'Tipo', 'Referência', 'Classificação', 'Contexto', 'Fases', 'Corrente A', 'Seção mm2', 'Queda %', 'Proteção A', 'Icu kA', 'Status', 'Input hash'],
      ...snapshot.circuits.map((circuit) => [
        circuit.tag,
        circuit.descricao,
        circuit.origem,
        circuit.destino,
        circuit.dados_informados.potencia_kw,
        circuit.dados_informados.tensao,
        circuit.dados_informados.tensao_unidade,
        circuit.dados_informados.tipo_sistema_tensao,
        circuit.dados_informados.referencia_tensao,
        circuit.dados_informados.classificacao_tensao,
        circuit.dados_informados.contexto_aplicacao,
        circuit.dados_informados.fases,
        circuit.resultados.corrente_projeto_a,
        circuit.resultados.secao_mm2,
        circuit.resultados.queda_tensao_pct,
        circuit.resultados.disjuntor_a,
        circuit.resultados.icu_ka,
        circuit.status,
        snapshot.input_hash,
      ]),
    ]),
    sheetFromRows('Critérios', [
      ['Critério', 'Descrição'],
      ['Ampacidade', 'Comparação com capacidade do condutor persistida no snapshot.'],
      ['Queda de tensão', 'Comparação com limite adotado no circuito/projeto.'],
      ['Seção mínima', 'Verificação documental dos mínimos declarados.'],
      ['Proteção', 'Corrente, curva e capacidade de interrupção quando disponíveis.'],
      ['Curto-circuito', 'Não avaliado quando dados de curto estiverem ausentes.'],
    ]),
    sheetFromRows('Memorial detalhado', [
      ['Circuito', 'Como chegamos neste resultado?'],
      ...snapshot.circuits.map((circuit) => [
        circuit.tag,
        [
          `Corrente: ${num(circuit.resultados.corrente_projeto_a, ' A', 1)}`,
          `Ampacidade: ${num(circuit.resultados.ampacidade_a, ' A', 1)}`,
          `Seção: ${num(circuit.resultados.secao_mm2, ' mm2', 1)}`,
          `Queda: ${pct(circuit.resultados.queda_tensao_pct)}`,
          `Proteção: ${num(circuit.resultados.disjuntor_a, ' A', 0)}`,
        ].join(' | '),
      ]),
    ]),
    sheetFromRows('Alertas', [['Tipo', 'Mensagem'], ...snapshot.summary.bloqueios.map((item) => ['Bloqueio', item]), ...snapshot.summary.avisos.map((item) => ['Aviso', item])]),
    sheetFromRows('Limitações', [['Limitação'], ...snapshot.limitacoes.map((item) => [item])]),
    sheetFromRows('Validação', [
      ['Item', 'Status'],
      ['Relatório final liberado', snapshot.final_released ? 'Sim' : 'Não'],
      ['Aprovação automática', 'Não aplicável'],
      ['Validação profissional', 'Necessária quando aplicável'],
    ]),
    sheetFromRows('Fontes Referências', [
      ['Fonte', 'Observação'],
      ['CalcCabos', 'Snapshot imutável do cálculo persistido.'],
      [project.norma_referencia || 'Norma de referência declarada', 'Conferir edição vigente e aplicabilidade no projeto real.'],
      ['Responsabilidade técnica', 'Documento de apoio técnico, sem substituição de profissional habilitado.'],
    ]),
  ]
  sheets.forEach(({ name, sheet }) => {
    XLSX.utils.book_append_sheet(wb, sheet, name)
  })
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

module.exports = {
  buildProfessionalExcel,
  buildProfessionalPdf,
}
