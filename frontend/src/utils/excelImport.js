import * as XLSX from 'xlsx'

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024
export const MAX_IMPORT_ROWS = 5000
export const MAX_IMPORT_COLUMNS = 80

export const REQUIRED_IMPORT_FIELDS = ['nome', 'potencia', 'tensao', 'fp', 'comprimento']

export const IMPORT_FIELDS = [
  { key: 'nome', label: 'Nome / Descricao', required: true },
  { key: 'potencia', label: 'Potencia (kW)', required: true },
  { key: 'tensao', label: 'Tensao (V)', required: true },
  { key: 'fp', label: 'Fator de Potencia', required: true },
  { key: 'comprimento', label: 'Comprimento (m)', required: true },
  { key: 'tag', label: 'TAG', required: false },
  { key: 'metodo_instalacao', label: 'Metodo de Instalacao', required: false },
  { key: 'temperatura', label: 'Temperatura Ambiente', required: false },
  { key: 'tipo_carga', label: 'Tipo de Carga', required: false },
  { key: 'tipo_cabo', label: 'Tipo de Cabo', required: false },
  { key: 'from_barramento', label: 'Quadro / Origem', required: false },
  { key: 'to_equipamento', label: 'Destino / Equipamento', required: false },
  { key: 'fases', label: 'Fases', required: false },
  { key: 'agrupamento', label: 'Agrupamento', required: false },
  { key: 'formacao', label: 'Formacao / Paralelos', required: false },
  { key: 'icc', label: 'Icc / Isc (kA)', required: false },
  { key: 'tempo_atuacao', label: 'Tempo de Atuacao (s)', required: false },
  { key: 'disjuntor_corrente_nominal', label: 'Disjuntor - In (A)', required: false },
  { key: 'disjuntor_icu', label: 'Disjuntor - Icu (kA)', required: false },
  { key: 'disjuntor_curva', label: 'Disjuntor - Curva', required: false },
  { key: 'disjuntor_fabricante', label: 'Disjuntor - Fabricante', required: false },
]

const FIELD_SYNONYMS = {
  nome: ['nome', 'descricao', 'descricao', 'circuito', 'carga', 'equipamento'],
  potencia: ['potencia', 'potencia kw', 'kw', 'potencia ativa', 'carga kw'],
  tensao: ['tensao', 'voltagem', 'v', 'tensao nominal'],
  fp: ['fp', 'fator de potencia', 'fator potencia', 'cos fi', 'cosfi'],
  comprimento: ['comprimento', 'distancia', 'metros', 'metro', 'm'],
  tag: ['tag', 'identificador'],
  metodo_instalacao: ['metodo', 'instalacao', 'metodo instalacao', 'instalacao metodo'],
  temperatura: ['temperatura', 'temp', 'temperatura ambiente'],
  tipo_carga: ['tipo carga', 'carga tipo'],
  tipo_cabo: ['tipo cabo', 'cabo', 'material cabo'],
  from_barramento: ['quadro', 'origem', 'from', 'painel', 'barramento', 'qgbt', 'qd'],
  to_equipamento: ['destino', 'to', 'equipamento', 'carga destino'],
  fases: ['fase', 'fases'],
  agrupamento: ['agrupamento', 'agrup'],
  formacao: ['formacao', 'paralelos', 'paralelo'],
  icc: ['icc', 'isc', 'curto', 'curto circuito'],
  tempo_atuacao: ['tempo atuacao', 'tempo', 'atuacao'],
  disjuntor_corrente_nominal: ['disjuntor in', 'corrente nominal', 'in', 'dj in'],
  disjuntor_icu: ['icu', 'disjuntor icu', 'dj icu'],
  disjuntor_curva: ['curva', 'disjuntor curva', 'curva dj'],
  disjuntor_fabricante: ['fabricante', 'disjuntor fabricante'],
}

export const FILTER_OPERATORS = [
  { key: 'contains', label: 'contem' },
  { key: 'not_contains', label: 'nao contem' },
  { key: 'equals', label: 'igual a' },
  { key: 'not_equals', label: 'diferente de' },
  { key: 'greater_than', label: 'maior que' },
  { key: 'less_than', label: 'menor que' },
  { key: 'between', label: 'entre' },
  { key: 'empty', label: 'vazio' },
  { key: 'not_empty', label: 'nao vazio' },
]

function normalizeText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function isEmptyCell(value) {
  const text = normalizeText(value)
  return text === '' || text === '-' || text === '--'
}

function isNumeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (isNumeric(value)) return value
  const raw = normalizeText(value).replace(/\s+/g, '')
  if (!raw) return null

  let normalized = raw
  if (raw.includes(',') && raw.includes('.')) {
    normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
  } else if (raw.includes(',')) {
    normalized = raw.replace(',', '.')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseInteger(value, fallback) {
  const number = parseNumber(value)
  if (number === null) return fallback
  return Math.max(0, Math.trunc(number))
}

function sanitizeCellValue(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${trimmed}`
  }
  return trimmed
}

function ensureMatrix(rows) {
  const safeRows = Array.isArray(rows) ? rows : []
  const maxColumns = safeRows.reduce((acc, row) => Math.max(acc, Array.isArray(row) ? row.length : 0), 0)
  return safeRows.map((row) => {
    const source = Array.isArray(row) ? row : []
    return Array.from({ length: maxColumns }, (_, index) => {
      const value = source[index]
      return sanitizeCellValue(value)
    })
  })
}

function uniqueHeaders(headers) {
  const used = new Map()
  return headers.map((header, index) => {
    const base = normalizeText(header) || `Coluna ${index + 1}`
    const count = used.get(base) || 0
    used.set(base, count + 1)
    return count === 0 ? base : `${base} (${count + 1})`
  })
}

function normalizeFp(value) {
  const fp = parseNumber(value)
  if (fp === null) return null
  if (fp > 1 && fp <= 100) return fp / 100
  return fp
}

function normalizeInstallationMethod(value) {
  const text = normalizeHeader(value)
  if (!text) return 'TRAY'
  if (text.includes('eletroduto') || text.includes('conduit')) return 'CONDUIT'
  if (text.includes('enterr') || text.includes('direct')) return 'DIRECT'
  if (text.includes('ar livre') || text.includes('air')) return 'AIR'
  if (text.includes('tray') || text.includes('bandej')) return 'TRAY'
  return 'TRAY'
}

function normalizeCableType(value) {
  const text = normalizeHeader(value)
  if (!text) return 'CU-PVC'
  const isAl = text.includes('al') || text.includes('aluminio')
  const isXlpe = text.includes('xlpe')
  const material = isAl ? 'AL' : 'CU'
  const isolacao = isXlpe ? 'XLPE' : 'PVC'
  return `${material}-${isolacao}`
}

function rowHasValue(row) {
  return row.some((cell) => !isEmptyCell(cell))
}

function toRecord(headers, row) {
  const record = {}
  headers.forEach((header, index) => {
    record[header] = row[index] ?? ''
  })
  return record
}

function getMappedValue(record, mapping, key) {
  const header = mapping?.[key]
  if (!header) return ''
  return record[header]
}

function buildCircuitoPayload(record, mapping) {
  const descricao = normalizeText(getMappedValue(record, mapping, 'nome'))
  const potencia = parseNumber(getMappedValue(record, mapping, 'potencia'))
  const tensao = parseNumber(getMappedValue(record, mapping, 'tensao'))
  const fp = normalizeFp(getMappedValue(record, mapping, 'fp'))
  const distancia = parseNumber(getMappedValue(record, mapping, 'comprimento'))

  const circuito = {
    descricao,
    potencia_kw: potencia,
    tensao,
    fator_potencia: fp,
    distancia_m: distancia,
  }

  const tag = normalizeText(getMappedValue(record, mapping, 'tag'))
  const metodoInstalacao = normalizeText(getMappedValue(record, mapping, 'metodo_instalacao'))
  const temperatura = parseNumber(getMappedValue(record, mapping, 'temperatura'))
  const tipoCaboRaw = normalizeText(getMappedValue(record, mapping, 'tipo_cabo'))
  const fromBarramento = normalizeText(getMappedValue(record, mapping, 'from_barramento'))
  const toEquipamento = normalizeText(getMappedValue(record, mapping, 'to_equipamento'))
  const fases = parseInteger(getMappedValue(record, mapping, 'fases'), null)
  const agrupamento = parseInteger(getMappedValue(record, mapping, 'agrupamento'), null)
  const formacao = parseInteger(getMappedValue(record, mapping, 'formacao'), null)
  const icc = parseNumber(getMappedValue(record, mapping, 'icc'))
  const tempoAtuacao = parseNumber(getMappedValue(record, mapping, 'tempo_atuacao'))
  const disjuntorIn = parseNumber(getMappedValue(record, mapping, 'disjuntor_corrente_nominal'))
  const disjuntorIcu = parseNumber(getMappedValue(record, mapping, 'disjuntor_icu'))
  const disjuntorCurva = normalizeText(getMappedValue(record, mapping, 'disjuntor_curva'))
  const disjuntorFabricante = normalizeText(getMappedValue(record, mapping, 'disjuntor_fabricante'))

  if (tag) circuito.tag = tag
  if (metodoInstalacao) circuito.metodo_instalacao = normalizeInstallationMethod(metodoInstalacao)
  if (temperatura !== null) circuito.temp_ambiente = temperatura
  if (tipoCaboRaw) circuito.tipo_cabo = normalizeCableType(tipoCaboRaw)
  if (fromBarramento) circuito.from_barramento = fromBarramento
  if (toEquipamento) circuito.to_equipamento = toEquipamento
  if (fases !== null && fases > 0) circuito.fases = fases
  if (agrupamento !== null && agrupamento > 0) circuito.agrupamento = agrupamento
  if (formacao !== null && formacao > 0) circuito.formacao = formacao
  if (icc !== null) circuito.isc_local = icc
  if (tempoAtuacao !== null) circuito.tempo_atuacao = tempoAtuacao
  if (disjuntorIn !== null) circuito.disjuntor_corrente_nominal = disjuntorIn
  if (disjuntorIcu !== null) circuito.disjuntor_icu = disjuntorIcu
  if (disjuntorCurva) circuito.disjuntor_curva = disjuntorCurva
  if (disjuntorFabricante) circuito.disjuntor_fabricante = disjuntorFabricante

  return validateCircuitoForImport(circuito)
}

export function normalizeHeader(header) {
  return normalizeText(header)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function validateSpreadsheetFile(file) {
  if (!file) throw new Error('Selecione um arquivo para importar.')

  const fileName = normalizeText(file.name)
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (!['xlsx', 'xls', 'csv'].includes(extension)) {
    throw new Error('Formato invalido. Use .xlsx, .xls ou .csv.')
  }

  if (file.size && file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('Arquivo muito grande. Limite maximo: 10 MB.')
  }

  if (/[\\/]/.test(fileName) || fileName.includes('..')) {
    throw new Error('Nome de arquivo invalido.')
  }

  return true
}

export async function parseExcelFile(file) {
  validateSpreadsheetFile(file)

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, {
    type: 'array',
    raw: false,
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
  })
  const sheetNames = workbook.SheetNames || []
  const sheets = sheetNames.map((name) => {
    const worksheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: true,
      raw: false,
    })
    const matrix = ensureMatrix(rows)
    if (matrix.length > MAX_IMPORT_ROWS) {
      throw new Error(`A aba "${name}" tem ${matrix.length} linhas. Limite maximo: ${MAX_IMPORT_ROWS}.`)
    }
    if ((matrix[0]?.length || 0) > MAX_IMPORT_COLUMNS) {
      throw new Error(`A aba "${name}" tem ${matrix[0].length} colunas. Limite maximo: ${MAX_IMPORT_COLUMNS}.`)
    }
    return {
      name,
      rows: matrix,
      rowCount: matrix.length,
      columnCount: matrix[0]?.length || 0,
    }
  })

  if (!sheets.length) throw new Error('Nenhuma aba encontrada no arquivo.')

  return {
    fileName: file.name,
    sheets,
  }
}

export function cleanRows(rows, options = {}) {
  const {
    headerRowIndex = 0,
    removeEmptyRows = true,
    removeEmptyColumns = true,
    trimValues = true,
  } = options

  let matrix = ensureMatrix(rows)
  if (trimValues) {
    matrix = matrix.map((row) => row.map((cell) => (typeof cell === 'string' ? cell.trim() : cell)))
  }

  const safeHeaderIndex = Math.max(0, Math.min(headerRowIndex, Math.max(0, matrix.length - 1)))

  if (removeEmptyColumns && matrix.length > 0) {
    const keepColumns = matrix[0].map((_, colIndex) => matrix.some((row) => !isEmptyCell(row[colIndex])))
    matrix = matrix.map((row) => row.filter((_, colIndex) => keepColumns[colIndex]))
  }

  if (removeEmptyRows && matrix.length > 0) {
    matrix = matrix.filter((row, rowIndex) => {
      if (rowIndex <= safeHeaderIndex) return true
      return rowHasValue(row)
    })
  }

  return ensureMatrix(matrix)
}

export function autoMapColumns(headers) {
  const safeHeaders = uniqueHeaders(Array.isArray(headers) ? headers : [])
  const normalizedHeaders = safeHeaders.map((header) => ({ original: header, normalized: normalizeHeader(header) }))

  const mapping = {}
  const confidence = {}

  IMPORT_FIELDS.forEach(({ key }) => {
    const synonyms = (FIELD_SYNONYMS[key] || []).map((item) => normalizeHeader(item))
    let bestHeader = ''
    let bestScore = 0

    normalizedHeaders.forEach(({ original, normalized }) => {
      if (!normalized) return
      synonyms.forEach((synonym) => {
        if (!synonym) return
        let score = 0
        if (normalized === synonym) score = 100
        else if (normalized.startsWith(`${synonym} `) || normalized.endsWith(` ${synonym}`)) score = 80
        else if (normalized.includes(synonym)) score = 60
        if (score > bestScore) {
          bestScore = score
          bestHeader = original
        }
      })
    })

    mapping[key] = bestHeader
    confidence[key] = bestScore >= 100 ? 'alto' : bestScore >= 60 ? 'medio' : ''
  })

  return { mapping, confidence, headers: safeHeaders }
}

export function createImportFilterRule(overrides = {}) {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    column: '',
    operator: 'contains',
    value: '',
    valueTo: '',
    ...overrides,
  }
}

export function evaluateImportFilter(cellValue, rule) {
  const operator = rule?.operator || 'contains'
  const cellText = normalizeText(cellValue).toLowerCase()
  const filterText = normalizeText(rule?.value).toLowerCase()
  const filterTextTo = normalizeText(rule?.valueTo).toLowerCase()

  if (operator === 'empty') return isEmptyCell(cellValue)
  if (operator === 'not_empty') return !isEmptyCell(cellValue)

  if (!filterText && !['not_contains', 'not_equals'].includes(operator)) return true

  if (operator === 'contains') return cellText.includes(filterText)
  if (operator === 'not_contains') return !cellText.includes(filterText)
  if (operator === 'equals') return cellText === filterText
  if (operator === 'not_equals') return cellText !== filterText

  const cellNumber = parseNumber(cellValue)
  const numberA = parseNumber(filterText)
  const numberB = parseNumber(filterTextTo)

  if (operator === 'greater_than') return cellNumber !== null && numberA !== null && cellNumber > numberA
  if (operator === 'less_than') return cellNumber !== null && numberA !== null && cellNumber < numberA
  if (operator === 'between') {
    if (cellNumber === null || numberA === null || numberB === null) return false
    const min = Math.min(numberA, numberB)
    const max = Math.max(numberA, numberB)
    return cellNumber >= min && cellNumber <= max
  }

  return true
}

export function applyImportFilters({ rows, headerRowIndex = 0, headers = [], rules = [] }) {
  const safeRows = ensureMatrix(rows)
  if (!safeRows.length) {
    return {
      rows: [],
      ignoredRows: [],
      stats: { total: 0, kept: 0, ignored: 0, activeFilters: 0 },
    }
  }

  const safeHeaderIndex = Math.max(0, Math.min(headerRowIndex, safeRows.length - 1))
  const safeHeaders = headers.length ? uniqueHeaders(headers) : uniqueHeaders(safeRows[safeHeaderIndex] || [])
  const activeRules = (Array.isArray(rules) ? rules : []).filter((rule) => {
    if (!rule?.column) return false
    if (['empty', 'not_empty'].includes(rule.operator)) return true
    if (rule.operator === 'between') return normalizeText(rule.value) || normalizeText(rule.valueTo)
    return normalizeText(rule.value)
  })

  const prefixRows = safeRows.slice(0, safeHeaderIndex + 1)
  const dataRows = safeRows.slice(safeHeaderIndex + 1)
  const keptRows = []
  const ignoredRows = []

  dataRows.forEach((row, offset) => {
    const record = toRecord(safeHeaders, row)
    const keep = activeRules.every((rule) => evaluateImportFilter(record[rule.column], rule))
    if (keep) keptRows.push(row)
    else ignoredRows.push({ linha: safeHeaderIndex + offset + 2, row })
  })

  return {
    rows: [...prefixRows, ...keptRows],
    ignoredRows,
    stats: {
      total: dataRows.length,
      kept: keptRows.length,
      ignored: ignoredRows.length,
      activeFilters: activeRules.length,
    },
  }
}

export function normalizeCircuitoForImport(circuito = {}) {
  const normalized = {
    ...circuito,
    descricao: normalizeText(circuito.descricao),
    potencia_kw: parseNumber(circuito.potencia_kw),
    tensao: parseNumber(circuito.tensao),
    fator_potencia: normalizeFp(circuito.fator_potencia),
    distancia_m: parseNumber(circuito.distancia_m),
  }

  const tag = normalizeText(circuito.tag)
  const metodo = normalizeText(circuito.metodo_instalacao)
  const tipoCabo = normalizeText(circuito.tipo_cabo)
  const fromBarramento = normalizeText(circuito.from_barramento)
  const toEquipamento = normalizeText(circuito.to_equipamento)
  const temperatura = parseNumber(circuito.temp_ambiente)
  const fases = parseInteger(circuito.fases, null)
  const agrupamento = parseInteger(circuito.agrupamento, null)
  const formacao = parseInteger(circuito.formacao, null)
  const iscLocal = parseNumber(circuito.isc_local)
  const tempoAtuacao = parseNumber(circuito.tempo_atuacao)
  const disjuntorIn = parseNumber(circuito.disjuntor_corrente_nominal)
  const disjuntorIcu = parseNumber(circuito.disjuntor_icu)

  if (tag) normalized.tag = tag
  else delete normalized.tag
  if (metodo) normalized.metodo_instalacao = normalizeInstallationMethod(metodo)
  else delete normalized.metodo_instalacao
  if (tipoCabo) normalized.tipo_cabo = normalizeCableType(tipoCabo)
  else delete normalized.tipo_cabo
  if (fromBarramento) normalized.from_barramento = fromBarramento
  else delete normalized.from_barramento
  if (toEquipamento) normalized.to_equipamento = toEquipamento
  else delete normalized.to_equipamento
  if (temperatura !== null) normalized.temp_ambiente = temperatura
  else delete normalized.temp_ambiente
  if (fases !== null && fases > 0) normalized.fases = fases
  else delete normalized.fases
  if (agrupamento !== null && agrupamento > 0) normalized.agrupamento = agrupamento
  else delete normalized.agrupamento
  if (formacao !== null && formacao > 0) normalized.formacao = formacao
  else delete normalized.formacao
  if (iscLocal !== null) normalized.isc_local = iscLocal
  else delete normalized.isc_local
  if (tempoAtuacao !== null) normalized.tempo_atuacao = tempoAtuacao
  else delete normalized.tempo_atuacao
  if (disjuntorIn !== null) normalized.disjuntor_corrente_nominal = disjuntorIn
  else delete normalized.disjuntor_corrente_nominal
  if (disjuntorIcu !== null) normalized.disjuntor_icu = disjuntorIcu
  else delete normalized.disjuntor_icu

  const curva = normalizeText(circuito.disjuntor_curva)
  const fabricante = normalizeText(circuito.disjuntor_fabricante)
  if (curva) normalized.disjuntor_curva = curva
  else delete normalized.disjuntor_curva
  if (fabricante) normalized.disjuntor_fabricante = fabricante
  else delete normalized.disjuntor_fabricante

  return normalized
}

export function validateCircuitoForImport(circuito = {}) {
  const normalized = normalizeCircuitoForImport(circuito)
  const errors = []

  if (!normalized.descricao) errors.push('Descricao obrigatoria')
  if (normalized.potencia_kw === null || normalized.potencia_kw <= 0) errors.push('Potencia invalida')
  if (normalized.tensao === null || normalized.tensao <= 0) errors.push('Tensao invalida')
  if (normalized.fator_potencia === null || normalized.fator_potencia <= 0 || normalized.fator_potencia > 1) {
    errors.push('Fator de potencia invalido')
  }
  if (normalized.distancia_m === null || normalized.distancia_m <= 0) errors.push('Comprimento invalido')

  return {
    circuito: normalized,
    errors,
    valido: errors.length === 0,
  }
}

export function validateImportedRows({ rows, headerRowIndex, mapping }) {
  const safeRows = ensureMatrix(rows)
  if (!safeRows.length) {
    return {
      rows: [],
      validRows: [],
      invalidRows: [],
      summary: { total: 0, validas: 0, invalidas: 0 },
      mappingErrors: ['Nenhum dado encontrado para validar.'],
    }
  }

  const safeHeaderIndex = Math.max(0, Math.min(headerRowIndex, safeRows.length - 1))
  const headers = uniqueHeaders(safeRows[safeHeaderIndex] || [])

  const mappingErrors = REQUIRED_IMPORT_FIELDS
    .filter((fieldKey) => !mapping?.[fieldKey])
    .map((fieldKey) => {
      const field = IMPORT_FIELDS.find((item) => item.key === fieldKey)
      return `Campo obrigatorio nao mapeado: ${field?.label || fieldKey}`
    })

  const parsedRows = []
  for (let index = safeHeaderIndex + 1; index < safeRows.length; index += 1) {
    const excelRow = safeRows[index]
    const record = toRecord(headers, excelRow)
    const mappedValues = Object.values(mapping || {})
      .filter(Boolean)
      .map((header) => record[header])

    const allMappedEmpty = mappedValues.length > 0 && mappedValues.every((value) => isEmptyCell(value))
    if (allMappedEmpty) continue

    const { circuito, errors } = buildCircuitoPayload(record, mapping)
    parsedRows.push({
      linha: index + 1,
      valido: errors.length === 0,
      erros: errors,
      circuito,
      origem: record,
    })
  }

  const invalidRows = parsedRows.filter((row) => !row.valido)
  const validRows = parsedRows.filter((row) => row.valido).map((row) => row.circuito)

  return {
    rows: parsedRows,
    validRows,
    invalidRows,
    summary: {
      total: parsedRows.length,
      validas: validRows.length,
      invalidas: invalidRows.length,
    },
    mappingErrors,
  }
}
