import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Plus, Save, Trash2, Zap } from 'lucide-react'
import api from '../../services/api'
import {
  Alert,
  Card,
  CardBody,
  MetricCard,
  SectionHeader,
  StatusBadge,
  Tooltip,
} from '../ui'

const MEDICAO_VAZIA = {
  linha: '',
  espacamento_a_m: '',
  profundidade_p_m: '',
  resistencia_ohm: '',
}

const VAZIO = {
  tipo_aterramento: 'malha',
  finalidade: 'proteção de pessoas',
  observacoes_tecnicas: '',
  medicoes: [{ ...MEDICAO_VAZIA }],
}

function fmt(valor, sufixo = '', casas = 2) {
  if (valor === null || valor === undefined || valor === '') return 'não calculável'
  const numero = Number(valor)
  if (Number.isNaN(numero)) return String(valor)
  const texto = Number.isInteger(numero) ? String(numero) : numero.toFixed(casas)
  return `${texto}${sufixo}`
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : null
}

function arred(valor, casas = 3) {
  return valor === null || valor === undefined ? null : Number(valor.toFixed(casas))
}

function classificarSolo(resistividadeMedia) {
  if (resistividadeMedia === null || resistividadeMedia === undefined) return 'não calculável'
  if (resistividadeMedia < 100) return 'baixa resistividade'
  if (resistividadeMedia <= 1000) return 'média resistividade'
  return 'alta resistividade'
}

function item(criterio, status, mensagem) {
  return { criterio, status, mensagem }
}

function calcularMedicaoLocal(medicao, index) {
  const a = numero(medicao.espacamento_a_m)
  const p = numero(medicao.profundidade_p_m)
  const resistencia = numero(medicao.resistencia_ohm)
  const erros = []

  if (a !== null && a <= 0) erros.push('Espaçamento a deve ser maior que zero.')
  if (p !== null && p <= 0) erros.push('Profundidade p deve ser maior que zero quando informada.')
  if (resistencia !== null && resistencia <= 0) erros.push('Resistência medida R deve ser maior que zero.')

  let resistividade = null
  if (a !== null && resistencia !== null && a > 0 && resistencia > 0 && erros.length === 0) {
    resistividade = 2 * Math.PI * a * resistencia
  } else if (erros.length === 0) {
    erros.push('Dados insuficientes para calcular resistividade.')
  }

  return {
    linha: medicao.linha || `L${index + 1}`,
    espacamento_a_m: a,
    profundidade_p_m: p,
    resistencia_ohm: resistencia,
    resistividade_ohm_m: arred(resistividade, 3),
    valido: resistividade !== null && erros.length === 0,
    erro: erros.join('; '),
  }
}

function calcularAterramentoLocal(form) {
  const medicoes = (form.medicoes || []).map(calcularMedicaoLocal)
  const resistividades = medicoes
    .filter((medicao) => medicao.valido && medicao.resistividade_ohm_m !== null)
    .map((medicao) => medicao.resistividade_ohm_m)

  const media = resistividades.length ? resistividades.reduce((soma, valor) => soma + valor, 0) / resistividades.length : null
  const menor = resistividades.length ? Math.min(...resistividades) : null
  const maior = resistividades.length ? Math.max(...resistividades) : null
  const variacao = media ? ((maior - menor) / media) * 100 : null
  const invalidasCriticas = medicoes.some((medicao) => (
    (medicao.espacamento_a_m !== null && medicao.espacamento_a_m <= 0)
    || (medicao.profundidade_p_m !== null && medicao.profundidade_p_m <= 0)
    || (medicao.resistencia_ohm !== null && medicao.resistencia_ohm <= 0)
  ))

  let status = 'OK'
  const itens = []
  if (invalidasCriticas) {
    status = 'CRÍTICO'
    itens.push(item('Medições Wenner', 'CRÍTICO', 'Há medições com valores negativos ou iguais a zero.'))
  }
  if (!resistividades.length) {
    status = 'CRÍTICO'
    itens.push(item('Medições Wenner', 'CRÍTICO', 'Nenhuma medição válida cadastrada para cálculo de resistividade.'))
  } else if (resistividades.length < 3 && status !== 'CRÍTICO') {
    status = 'ALERTA'
    itens.push(item('Quantidade de medições', 'ALERTA', 'Poucas medições válidas; recomenda-se ampliar a campanha de medição.'))
  }
  if (variacao !== null && variacao > 50 && status !== 'CRÍTICO') {
    status = 'ALERTA'
    itens.push(item('Variação de resistividade', 'ALERTA', `Grande variação entre medições (${variacao.toFixed(2)}%).`))
  }
  if (!itens.length) {
    itens.push(item('Sistema de aterramento', 'OK', 'Medições Wenner válidas e consistentes para estimativa inicial de resistividade aparente.'))
  }

  return {
    ...form,
    medicoes,
    formula: 'ρ = 2 · π · a · R',
    resistividade_media: arred(media, 3),
    menor_resistividade: arred(menor, 3),
    maior_resistividade: arred(maior, 3),
    variacao_percentual: arred(variacao, 3),
    classificacao_solo: classificarSolo(media),
    status,
    mensagem: itens[0]?.mensagem || 'não calculável',
    itens,
  }
}

function normalizarStatus(status, padrao = 'ALERTA') {
  const texto = String(status || '').trim().toUpperCase()
  if (!texto) return padrao
  if (texto === 'OK') return 'OK'
  if (texto.includes('ALERTA')) return 'ALERTA'
  if (texto.includes('CR')) return 'CRITICO'
  return padrao
}

function Campo({ label, tooltip, children, className = '' }) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
        {label}
        {tooltip && (
          <Tooltip content={tooltip} contentClassName="whitespace-normal max-w-xs text-center p-2 leading-relaxed">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 text-[10px] text-slate-400 hover:text-slate-700">
              ?
            </span>
          </Tooltip>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export default function AterramentoProjeto({ projeto, onSaved }) {
  const [form, setForm] = useState(VAZIO)
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)
  const resultadoVisivel = useMemo(() => calcularAterramentoLocal(form), [form])

  useEffect(() => {
    carregar()
  }, [projeto?.id])

  async function carregar() {
    if (!projeto?.id) return
    setLoading(true)
    try {
      const r = await api.get(`/projetos/${projeto.id}/aterramento`)
      const medicoes = r.data.medicoes?.length ? r.data.medicoes : [{ ...MEDICAO_VAZIA }]
      setResultado(r.data)
      setForm({ ...VAZIO, ...r.data, medicoes })
    } catch {
      toast.error('Erro ao carregar aterramento')
    } finally {
      setLoading(false)
    }
  }

  function setCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function setMedicao(index, campo, valor) {
    setForm((atual) => ({
      ...atual,
      medicoes: atual.medicoes.map((medicao, i) => i === index ? { ...medicao, [campo]: valor } : medicao),
    }))
  }

  function adicionarMedicao() {
    setForm((atual) => ({
      ...atual,
      medicoes: [...(atual.medicoes || []), { ...MEDICAO_VAZIA, linha: `L${(atual.medicoes || []).length + 1}` }],
    }))
  }

  function removerMedicao(index) {
    setForm((atual) => ({
      ...atual,
      medicoes: atual.medicoes.length > 1 ? atual.medicoes.filter((_, i) => i !== index) : [{ ...MEDICAO_VAZIA }],
    }))
  }

  function normalizar() {
    return {
      tipo_aterramento: form.tipo_aterramento || '',
      finalidade: form.finalidade || '',
      observacoes_tecnicas: form.observacoes_tecnicas || '',
      medicoes: (form.medicoes || []).map((m, index) => ({
        linha: m.linha || `L${index + 1}`,
        espacamento_a_m: m.espacamento_a_m === '' || m.espacamento_a_m === null || m.espacamento_a_m === undefined ? null : Number(m.espacamento_a_m),
        profundidade_p_m: m.profundidade_p_m === '' || m.profundidade_p_m === null || m.profundidade_p_m === undefined ? null : Number(m.profundidade_p_m),
        resistencia_ohm: m.resistencia_ohm === '' || m.resistencia_ohm === null || m.resistencia_ohm === undefined ? null : Number(m.resistencia_ohm),
      })),
    }
  }

  async function salvar() {
    setLoading(true)
    try {
      const r = await api.put(`/projetos/${projeto.id}/aterramento`, normalizar())
      setResultado(r.data)
      setForm({ ...VAZIO, ...r.data, medicoes: r.data.medicoes?.length ? r.data.medicoes : [{ ...MEDICAO_VAZIA }] })
      await onSaved?.()
      toast.success('Aterramento salvo')
    } catch {
      toast.error('Erro ao salvar aterramento')
    } finally {
      setLoading(false)
    }
  }

  const status = resultado?.status || 'ALERTA'
  const medicoes = form.medicoes || []
  const statusVisivel = resultadoVisivel?.status || status
  const itens = resultadoVisivel?.itens || resultado?.itens || []
  const medicoesValidas = resultadoVisivel?.medicoes?.filter((m) => m.valido).length || 0
  const poucaAmostragem = medicoesValidas > 0 && medicoesValidas < 3
  const temCritico = normalizarStatus(statusVisivel) === 'CRITICO'

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              title="Sistema de Aterramento"
              description="Registro de medições de resistividade pelo método de Wenner e análise preliminar do solo."
            />
            <StatusBadge status={normalizarStatus(statusVisivel)} />
          </div>
        </div>

        <CardBody className="space-y-6">
          {(temCritico || poucaAmostragem) && (
            <div className="space-y-3">
              {temCritico && (
                <Alert variant="danger" icon={AlertTriangle} title="Medições inválidas ou insuficientes">
                  Existem medições com erro ou não há medições válidas para estimar a resistividade aparente.
                </Alert>
              )}
              {!temCritico && poucaAmostragem && (
                <Alert variant="warning" icon={AlertTriangle} title="Poucas medições válidas">
                  Recomenda-se pelo menos 3 medições válidas para uma avaliação inicial mais consistente.
                </Alert>
              )}
            </div>
          )}

          <section className="space-y-4">
            <SectionHeader
              title="Dados gerais"
              description="Finalidade e tipo do sistema de aterramento."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Campo label="Tipo de aterramento">
                <select className="input w-full" value={form.tipo_aterramento || 'malha'} onChange={(e) => setCampo('tipo_aterramento', e.target.value)}>
                  {['malha', 'haste', 'anel', 'equipotencialização'].map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </Campo>
              <Campo label="Finalidade">
                <input className="input w-full" value={form.finalidade || ''} onChange={(e) => setCampo('finalidade', e.target.value)} />
              </Campo>
              <Campo label="Fórmula" tooltip="Fórmula local usada para estimativa inicial pelo método de Wenner.">
                <div className="input w-full bg-slate-50 font-mono text-slate-700">{resultadoVisivel?.formula || 'ρ = 2 · π · a · R'}</div>
              </Campo>
              <Campo label="Observações técnicas" className="md:col-span-3">
                <textarea className="input min-h-[84px] w-full resize-y" value={form.observacoes_tecnicas || ''} onChange={(e) => setCampo('observacoes_tecnicas', e.target.value)} />
              </Campo>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeader
                title="Medições Wenner"
                description="Informe espaçamento, profundidade e resistência medida para cada linha de medição."
              />
              <button onClick={adicionarMedicao} type="button" className="btn btn-secondary inline-flex items-center gap-2 text-xs">
                <Plus size={14} />Adicionar medição
              </button>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[820px] text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    {['Linha', 'Espaçamento a (m)', 'Profundidade p (m)', 'Resistência R (Ω)', 'ρ estimada', 'Status', ''].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medicoes.map((medicao, index) => {
                    const calculada = resultadoVisivel?.medicoes?.[index] || {}
                    return (
                      <tr key={`${medicao.linha}-${index}`} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <input className="input w-full" value={medicao.linha || ''} onChange={(e) => setMedicao(index, 'linha', e.target.value)} placeholder={`L${index + 1}`} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" className="input w-full" value={medicao.espacamento_a_m ?? ''} onChange={(e) => setMedicao(index, 'espacamento_a_m', e.target.value)} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" className="input w-full" value={medicao.profundidade_p_m ?? ''} onChange={(e) => setMedicao(index, 'profundidade_p_m', e.target.value)} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" className="input w-full" value={medicao.resistencia_ohm ?? ''} onChange={(e) => setMedicao(index, 'resistencia_ohm', e.target.value)} />
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700">{fmt(calculada.resistividade_ohm_m, ' Ω.m', 2)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={calculada.valido ? 'OK' : 'ALERTA'} />
                          {calculada.erro && <div className="mt-1 max-w-[240px] text-[11px] text-slate-500">{calculada.erro}</div>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => removerMedicao(index)} type="button" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remover medição">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button onClick={salvar} disabled={loading} className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-50">
              <Save size={15} />
              {loading ? 'Salvando...' : 'Salvar aterramento'}
            </button>
          </div>
        </CardBody>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          title="Resultados locais"
          description="Prévia calculada em tela para apoiar a revisão antes de salvar."
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Resistividade média" value={fmt(resultadoVisivel?.resistividade_media, ' Ω.m', 2)} description="Média válida" icon={Zap} />
          <MetricCard label="Menor resistividade" value={fmt(resultadoVisivel?.menor_resistividade, ' Ω.m', 2)} description="Menor medição" />
          <MetricCard label="Maior resistividade" value={fmt(resultadoVisivel?.maior_resistividade, ' Ω.m', 2)} description="Maior medição" />
          <MetricCard label="Variação" value={fmt(resultadoVisivel?.variacao_percentual, ' %', 2)} description="Dispersão" status={(resultadoVisivel?.variacao_percentual || 0) > 50 ? 'ALERTA' : 'OK'} />
          <MetricCard label="Classificação do solo" value={resultadoVisivel?.classificacao_solo || 'não calculável'} description="Critério preliminar" status={normalizarStatus(statusVisivel)} />
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardBody>
            <SectionHeader title="Status técnico" description={resultadoVisivel?.mensagem || resultado?.mensagem || 'não calculável'} />
            <div className="mt-4 space-y-3">
              {itens.map((item, index) => (
                <div key={`${item.criterio}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[180px] font-semibold text-slate-900">{item.criterio}</div>
                    <StatusBadge status={normalizarStatus(item.status)} />
                    <div className="flex-1 text-sm text-slate-600">{item.mensagem}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
