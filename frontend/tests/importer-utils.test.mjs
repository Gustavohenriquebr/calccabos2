import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_IMPORT_FILE_BYTES,
  applyImportFilters,
  autoMapColumns,
  validateImportedRows,
  validateSpreadsheetFile,
} from '../src/utils/excelImport.js'

test('validateSpreadsheetFile rejects unsupported files and oversized spreadsheets', () => {
  assert.throws(
    () => validateSpreadsheetFile({ name: 'payload.js', size: 1200 }),
    /Formato invalido/,
  )

  assert.throws(
    () => validateSpreadsheetFile({ name: 'circuitos.xlsx', size: MAX_IMPORT_FILE_BYTES + 1 }),
    /Arquivo muito grande/,
  )

  assert.equal(validateSpreadsheetFile({ name: 'circuitos.xlsx', size: 1200 }), true)
})

test('import preview neutralizes spreadsheet formula-like cells', async () => {
  const file = new File(
    ['TAG,Descricao\nC-01,=HYPERLINK("https://example.invalid")'],
    'circuitos.csv',
    { type: 'text/csv' },
  )

  // The parser must return the value as data, never as an executable formula.
  const { parseExcelFile } = await import('../src/utils/excelImport.js')
  const parsed = await parseExcelFile(file)
  assert.ok(!String(parsed.sheets[0].rows[1][1] || '').startsWith('='))
})

test('applyImportFilters supports text filters before validation', () => {
  const rows = [
    ['TAG', 'Descricao', 'Quadro', 'Potencia', 'Tensao', 'FP', 'Distancia'],
    ['C-01', 'Iluminacao recepcao', 'QD-01', '1,2', '220', '0,92', '25'],
    ['C-02', 'Tomadas sala', 'QD-01', '2,4', '220', '0,9', '18'],
    ['C-03', 'Motor bomba', 'QF-BMB', '7,5', '380', '0,86', '42'],
  ]

  const result = applyImportFilters({
    rows,
    headerRowIndex: 0,
    headers: rows[0],
    rules: [{ id: 'f1', column: 'Quadro', operator: 'contains', value: 'QD-01' }],
  })

  assert.equal(result.stats.total, 3)
  assert.equal(result.stats.kept, 2)
  assert.equal(result.stats.ignored, 1)
  assert.deepEqual(result.rows.map((row) => row[0]), ['TAG', 'C-01', 'C-02'])
})

test('applyImportFilters supports numeric ranges', () => {
  const rows = [
    ['Circuito', 'Potencia'],
    ['C-01', '1'],
    ['C-02', '5'],
    ['C-03', '12'],
  ]

  const result = applyImportFilters({
    rows,
    headerRowIndex: 0,
    headers: rows[0],
    rules: [{ id: 'f1', column: 'Potencia', operator: 'between', value: '2', valueTo: '10' }],
  })

  assert.equal(result.stats.kept, 1)
  assert.equal(result.rows[1][0], 'C-02')
})

test('filtered rows can be mapped and validated without importing all rows', () => {
  const rows = [
    ['TAG', 'Descricao', 'Quadro', 'Potencia', 'Tensao', 'FP', 'Distancia'],
    ['C-01', 'Iluminacao recepcao', 'QD-01', '1,2', '220', '0,92', '25'],
    ['C-02', 'Motor bomba', 'QF-BMB', '7,5', '380', '0,86', '42'],
  ]

  const filtered = applyImportFilters({
    rows,
    headerRowIndex: 0,
    headers: rows[0],
    rules: [{ id: 'f1', column: 'Quadro', operator: 'equals', value: 'QF-BMB' }],
  })

  const auto = autoMapColumns(rows[0])
  const validation = validateImportedRows({
    rows: filtered.rows,
    headerRowIndex: 0,
    mapping: auto.mapping,
  })

  assert.equal(validation.summary.total, 1)
  assert.equal(validation.summary.validas, 1)
  assert.equal(validation.validRows[0].descricao, 'Motor bomba')
  assert.equal(validation.validRows[0].from_barramento, 'QF-BMB')
})
