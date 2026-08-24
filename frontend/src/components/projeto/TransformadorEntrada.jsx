import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, HelpCircle, Save, Zap, Activity, Gauge, Cpu } from 'lucide-react'
import api from '../../services/api'
import {
  Alert,
  Button,
  Card,
  CardBody,
  MetricCard,
  SectionHeader,
  Tooltip,
} from '../ui'

const VAZIO = {
  potencia_kva: '',
  tensao_primaria: '',
  tensao_secundaria: '',
  impedancia_percentual: '',
  ligacao_primaria: 'estrela',
  ligacao_secundaria: 'estrela',
  frequencia: 60,
  observacoes: '',
}

function parseDados(valor) {
  if (!valor) return null
  if (typeof valor === 'object') return valor
  try { return JSON.parse(valor) } catch { return {} }
}

function fmt(valor, sufixo = '', casas = 3) {
  if (valor === null || valor === undefined || valor === '') return '-'
  const numero = Number(valor)
  if (Number.isNaN(numero)) return valor
  return `${numero.toFixed(casas)}${sufixo}`
}

function isPresent(valor) {
  return valor !== null && valor !== undefined && valor !== ''
}

function numero(valor) {
  if (!isPresent(valor)) return null
  const n = Number(valor)
  return Number.isNaN(n) ? null : n
}

function LabelWithTooltip({ label, tooltip }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      <Tooltip content={tooltip} contentClassName="whitespace-normal max-w-xs text-center p-2 leading-relaxed">
        <HelpCircle size={13} className="text-slate-400 transition-colors hover:text-slate-600" />
      </Tooltip>
    </span>
  )
}

function Campo({ label, tooltip, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-slate-600">
        {tooltip ? <LabelWithTooltip label={label} tooltip={tooltip} /> : label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export default function TransformadorEntrada({ projeto, onSaved }) {
  const [form, setForm] = useState(VAZIO)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const dados = parseDados(projeto?.transformador_dados)
    setForm({ ...VAZIO, ...(dados || {}) })
  }, [projeto?.id, projeto?.transformador_dados])

  function setCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function salvar() {
    setLoading(true)
    try {
      const r = await api.put(`/projetos/${projeto.id}/transformador`, form)
      setForm({ ...VAZIO, ...r.data })
      await onSaved?.()
      toast.success('Transformador salvo')
    } catch {
      toast.error('Erro ao salvar transformador')
    } finally {
      setLoading(false)
    }
  }

  const potenciaKva = numero(form.potencia_kva)
  const tensaoPrimaria = numero(form.tensao_primaria)
  const tensaoSecundaria = numero(form.tensao_secundaria)
  const impedancia = numero(form.impedancia_percentual)

  const faltaPotencia = !isPresent(form.potencia_kva)
  const faltaTensaoPrimaria = !isPresent(form.tensao_primaria)
  const faltaTensaoSecundaria = !isPresent(form.tensao_secundaria)
  const faltaImpedancia = !isPresent(form.impedancia_percentual) || impedancia === 0
  const tensaoInvertida =
    tensaoPrimaria !== null &&
    tensaoSecundaria !== null &&
    tensaoPrimaria > 0 &&
    tensaoSecundaria > 0 &&
    tensaoPrimaria < tensaoSecundaria
  const tensaoPrimariaKvProvavel =
    tensaoPrimaria !== null &&
    tensaoPrimaria > 0 &&
    tensaoPrimaria < 100 &&
    tensaoSecundaria !== null &&
    tensaoSecundaria >= 100
  const pendencias = [
    faltaPotencia && 'Informe a potência nominal em kVA',
    faltaTensaoSecundaria && 'Informe a tensão secundária',
    faltaImpedancia && 'Informe a impedância Z%',
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <SectionHeader
            title="Transformador / Entrada"
            description="Defina os dados nominais do transformador para consolidar corrente nominal, relação de transformação e curto-circuito presumido."
          />
        </div>

        <CardBody className="space-y-6">
          {(pendencias.length > 0 || tensaoInvertida || tensaoPrimariaKvProvavel) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              {pendencias.length > 0 && <p className="font-semibold text-amber-950">{pendencias.length} pendência(s) para calcular o transformador</p>}
              {pendencias.length > 0 && <ul className="mt-2 space-y-1 text-sm text-amber-900">{pendencias.map((item) => <li key={item}>• {item}</li>)}</ul>}

              {tensaoInvertida && (
                <p className="mt-3 text-sm font-medium text-rose-700">Revise as tensões: a primária está menor que a secundária.</p>
              )}

              {tensaoPrimariaKvProvavel && (
                <p className="mt-2 text-sm text-blue-700">Valores como 13,8 na tensão primária são normalizados pelo backend como 13,8 kV.</p>
              )}
            </div>
          )}

          <section className="space-y-4">
            <SectionHeader
              title="1. Campos essenciais"
              description="Estes três dados alimentam as correntes nominais e o curto presumido."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Campo
                label="Potência nominal (kVA)"
                tooltip="Potência aparente nominal do transformador. Exemplo: 1000 kVA."
              >
                <input
                  type="number"
                  className="input w-full"
                  value={form.potencia_kva ?? ''}
                  onChange={(e) => setCampo('potencia_kva', e.target.value)}
                />
              </Campo>

              <Campo
                label="Tensão secundária (V)"
                tooltip="Tensão de saída do transformador em baixa tensão. Exemplo: 380 V."
              >
                <input
                  type="number"
                  className="input w-full"
                  value={form.tensao_secundaria ?? ''}
                  onChange={(e) => setCampo('tensao_secundaria', e.target.value)}
                />
              </Campo>

              <Campo
                label="Impedância Z (%)"
                tooltip="Impedância percentual do transformador. É usada para estimar a corrente de curto-circuito secundária."
              >
                <input
                  type="number"
                  step="0.01"
                  className="input w-full"
                  value={form.impedancia_percentual ?? ''}
                  onChange={(e) => setCampo('impedancia_percentual', e.target.value)}
                />
              </Campo>
            </div>
          </section>

          <details className="group rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer list-none font-semibold text-slate-800">2. Campos opcionais <span className="ml-2 text-xs font-normal text-slate-500">tensão primária, ligações e frequência</span></summary>
            <div className="mt-4 space-y-4">
            <SectionHeader
              title="Dados complementares"
              description="Preencha quando forem relevantes para o projeto e o memorial."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Campo label="Tensão primária (V ou kV)" tooltip="Valores como 13.8 são normalizados como 13,8 kV pelo backend.">
                <input type="number" step="0.01" className="input w-full" value={form.tensao_primaria ?? ''} onChange={(e) => setCampo('tensao_primaria', e.target.value)} />
              </Campo>
              <Campo label="Ligação primária">
                <select
                  className="input w-full"
                  value={form.ligacao_primaria || 'estrela'}
                  onChange={(e) => setCampo('ligacao_primaria', e.target.value)}
                >
                  <option value="estrela">Estrela</option>
                  <option value="triangulo">Triângulo</option>
                </select>
              </Campo>

              <Campo label="Ligação secundária">
                <select
                  className="input w-full"
                  value={form.ligacao_secundaria || 'estrela'}
                  onChange={(e) => setCampo('ligacao_secundaria', e.target.value)}
                >
                  <option value="estrela">Estrela</option>
                  <option value="triangulo">Triângulo</option>
                </select>
              </Campo>

              <Campo label="Frequência (Hz)">
                <input
                  type="number"
                  className="input w-full"
                  value={form.frequencia ?? ''}
                  onChange={(e) => setCampo('frequencia', e.target.value)}
                />
              </Campo>
            </div>
            </div>
          </details>

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer list-none font-semibold text-slate-800">3. Avançado <span className="ml-2 text-xs font-normal text-slate-500">observações e dados de placa</span></summary>
            <div className="mt-4 space-y-4">
            <SectionHeader
              title="Observações técnicas"
              description="Registre premissas, notas de placa ou comentários relevantes para o memorial."
            />

            <Campo label="Observações técnicas">
              <textarea
                className="input min-h-[96px] w-full resize-y"
                value={form.observacoes || ''}
                onChange={(e) => setCampo('observacoes', e.target.value)}
              />
            </Campo>
            </div>
          </details>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <Button onClick={salvar} disabled={loading} icon={Save}>
              {loading ? 'Salvando...' : 'Salvar transformador'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          title="Resultados calculados"
          description="Valores retornados pelo motor técnico após salvar os dados do transformador."
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Tensão primária normalizada"
            value={form.tensao_primaria_formatada || fmt(form.tensao_primaria, ' V')}
            description="Valor usado no cálculo"
            icon={Zap}
          />
          <MetricCard
            label="Relação de transformação"
            value={fmt(form.relacao_transformacao, '', 4)}
            description="Primário / secundário"
            icon={Activity}
          />
          <MetricCard
            label="In primário"
            value={fmt(form.corrente_nominal_primario, ' A')}
            description="Corrente nominal"
            icon={Gauge}
          />
          <MetricCard
            label="In secundário"
            value={fmt(form.corrente_nominal_secundario, ' A')}
            description="Corrente nominal"
            icon={Gauge}
          />
          <MetricCard
            label="Icc presumida secundária"
            value={fmt(form.corrente_curto_secundario_ka, ' kA')}
            description="Estimativa por Z%"
            icon={Cpu}
            status={form.corrente_curto_secundario_ka ? 'OK' : 'ALERTA'}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <strong className="text-slate-900">Critério:</strong>{' '}
          Os resultados acima são calculados pelo backend a partir dos dados salvos. Esta tela apenas organiza e exibe os valores retornados.
        </div>
      </section>
    </div>
  )
}
