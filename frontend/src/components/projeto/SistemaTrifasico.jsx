import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Activity, Gauge, Save, Zap } from 'lucide-react'
import api from '../../services/api'
import {
  Alert,
  Card,
  CardBody,
  MetricCard,
  SectionHeader,
  Tooltip,
} from '../ui'

const VAZIO = {
  potencia_ativa_kw: '',
  potencia_aparente_kva: '',
  potencia_reativa_kvar: '',
  tensao_linha: '',
  corrente_linha: '',
  fator_potencia: '',
  rendimento: 1,
  ligacao: 'estrela',
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

function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
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

export default function SistemaTrifasico({ projeto, onSaved }) {
  const [form, setForm] = useState(VAZIO)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const dados = parseDados(projeto?.sistema_trifasico_dados)
      setForm({ ...VAZIO, tensao_linha: projeto?.tensao_ref || '', ...(dados || {}) })
      if (!projeto?.id) return
      try {
        const r = await api.get(`/projetos/${projeto.id}/sistema-trifasico`)
        if (ativo) setForm({ ...VAZIO, ...r.data })
      } catch {
        if (ativo) toast.error('Erro ao carregar resumo trifasico')
      }
    }
    carregar()
    return () => { ativo = false }
  }, [projeto?.id, projeto?.sistema_trifasico_dados, projeto?.tensao_ref])

  function setCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function calcularSalvar() {
    setLoading(true)
    try {
      const r = await api.put(`/projetos/${projeto.id}/sistema-trifasico`, form)
      setForm({ ...VAZIO, ...r.data })
      await onSaved?.()
      toast.success('Sistema trifasico salvo')
    } catch {
      toast.error('Erro ao salvar sistema trifasico')
    } finally {
      setLoading(false)
    }
  }

  const fp = numero(form.fator_potencia)
  const rendimento = numero(form.rendimento)
  const tensao = numero(form.tensao_linha)
  const corrente = numero(form.corrente_linha)
  const origemCircuitos = form.origem === 'circuitos'
  const fpInvalido = fp !== null && (fp <= 0 || fp > 1)
  const fpBaixo = fp !== null && fp > 0 && fp < 0.7
  const rendimentoInvalido = rendimento !== null && (rendimento <= 0 || rendimento > 1.2)
  const tensaoIncompleta = !form.tensao_linha
  const correnteAlta = corrente !== null && corrente > 2000

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <SectionHeader
            title="Sistema Elétrico / Trifásico"
            description="Consolide potência, tensão, corrente e fator de potência do projeto ou dos circuitos calculados."
          />
        </div>

        <CardBody className="space-y-6">
          {origemCircuitos && (
            <Alert variant="info" icon={Activity} title="Resumo calculado pelos circuitos">
              Resumo calculado automaticamente a partir de {form.circuitos_considerados || 0} circuito(s). Campos manuais ficam como estimativa inicial.
            </Alert>
          )}

          {(fpInvalido || fpBaixo || rendimentoInvalido || tensaoIncompleta || correnteAlta) && (
            <div className="space-y-3">
              {tensaoIncompleta && (
                <Alert variant="warning" icon={AlertTriangle} title="Tensão de linha pendente">
                  Informe a tensão de linha para consolidar a corrente e os indicadores do sistema.
                </Alert>
              )}
              {fpInvalido && (
                <Alert variant="danger" icon={AlertTriangle} title="Fator de potência inválido">
                  O fator de potência deve estar entre 0 e 1.
                </Alert>
              )}
              {!fpInvalido && fpBaixo && (
                <Alert variant="warning" icon={AlertTriangle} title="Fator de potência baixo">
                  FP abaixo de 0,70 pode indicar carga com baixo fator de potência ou necessidade de revisão.
                </Alert>
              )}
              {rendimentoInvalido && (
                <Alert variant="warning" icon={AlertTriangle} title="Rendimento fora do intervalo esperado">
                  O rendimento deve ser informado como fator decimal. Exemplo: 0.95 para 95%.
                </Alert>
              )}
              {correnteAlta && (
                <Alert variant="info" icon={Gauge} title="Corrente elevada">
                  Corrente de linha elevada. Verifique tensão, potência aparente e premissas de agrupamento do projeto.
                </Alert>
              )}
            </div>
          )}

          <section className="space-y-4">
            <SectionHeader
              title="Potências e tensão"
              description="Dados elétricos principais do sistema."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Campo label="Potência ativa P (kW)" tooltip="Potência ativa total do sistema. Quando há circuitos, pode ser consolidada automaticamente.">
                <input type="number" className="input w-full" value={form.potencia_ativa_kw ?? ''} onChange={(e) => setCampo('potencia_ativa_kw', e.target.value)} />
              </Campo>
              <Campo label="Potência aparente S (kVA)" tooltip="Potência aparente usada para estimar corrente de linha.">
                <input type="number" className="input w-full" value={form.potencia_aparente_kva ?? ''} onChange={(e) => setCampo('potencia_aparente_kva', e.target.value)} />
              </Campo>
              <Campo label="Potência reativa Q (kvar)" tooltip="Potência reativa estimada a partir da potência aparente e ativa.">
                <input type="number" className="input w-full" value={form.potencia_reativa_kvar ?? ''} onChange={(e) => setCampo('potencia_reativa_kvar', e.target.value)} />
              </Campo>
              <Campo label="Tensão de linha (V)" tooltip="Tensão entre fases do sistema trifásico. Exemplo: 380 V ou 690 V.">
                <input type="number" className="input w-full" value={form.tensao_linha ?? ''} onChange={(e) => setCampo('tensao_linha', e.target.value)} />
              </Campo>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="Corrente, FP e ligação"
              description="Parâmetros de operação usados para consolidar o regime do sistema."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Campo label="Corrente de linha (A)" tooltip="Corrente trifásica consolidada do sistema.">
                <input type="number" className="input w-full" value={form.corrente_linha ?? ''} onChange={(e) => setCampo('corrente_linha', e.target.value)} />
              </Campo>
              <Campo label="Fator de potência" tooltip="Valor decimal entre 0 e 1. Exemplo: 0.92.">
                <input type="number" step="0.01" className="input w-full" value={form.fator_potencia ?? ''} onChange={(e) => setCampo('fator_potencia', e.target.value)} />
              </Campo>
              <Campo label="Rendimento" tooltip="Informe como fator decimal. Exemplo: 0.95 para 95%.">
                <input type="number" step="0.01" className="input w-full" value={form.rendimento ?? ''} onChange={(e) => setCampo('rendimento', e.target.value)} />
              </Campo>
              <Campo label="Ligação">
                <select className="input w-full" value={form.ligacao || 'estrela'} onChange={(e) => setCampo('ligacao', e.target.value)}>
                  <option value="estrela">Estrela</option>
                  <option value="triangulo">Triângulo</option>
                </select>
              </Campo>
            </div>
          </section>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button onClick={calcularSalvar} disabled={loading} className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-50">
              <Save size={15} />
              {loading ? 'Calculando...' : 'Calcular e salvar'}
            </button>
          </div>
        </CardBody>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          title="Resumo calculado"
          description="Indicadores retornados pelo backend ou consolidados a partir dos circuitos do projeto."
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="kW nominal das cargas" value={fmt(form.potencia_nominal_cargas_kw ?? form.potencia_ativa_kw, ' kW')} description="Total nominal" icon={Zap} />
          <MetricCard label="P elétrica estimada" value={fmt(form.potencia_ativa_eletrica_kw ?? form.potencia_ativa_kw, ' kW')} description="Potência ativa" icon={Activity} />
          <MetricCard label="S calculada" value={fmt(form.potencia_aparente_kva, ' kVA')} description="Potência aparente" icon={Activity} />
          <MetricCard label="Q calculada" value={fmt(form.potencia_reativa_kvar, ' kvar')} description="Potência reativa" icon={Zap} />
          <MetricCard label="I linha" value={fmt(form.corrente_linha, ' A')} description="Corrente principal" icon={Gauge} />
          <MetricCard label="Tensão de fase" value={fmt(form.tensao_fase, ' V')} description="Resultado por ligação" icon={Zap} />
          <MetricCard label="Corrente de fase" value={fmt(form.corrente_fase, ' A')} description="Resultado por ligação" icon={Gauge} />
          <MetricCard label="FP" value={fmt(form.fator_potencia, '', 4)} description="Fator de potência" status={fpInvalido ? 'CRITICO' : fpBaixo ? 'ALERTA' : 'OK'} />
          <MetricCard label="Rendimento" value={fmt(form.rendimento, '', 4)} description="Fator decimal" status={rendimentoInvalido ? 'ALERTA' : 'OK'} />
        </div>
      </section>
    </div>
  )
}
