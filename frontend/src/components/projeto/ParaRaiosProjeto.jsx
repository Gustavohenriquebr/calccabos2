import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Save, Shield, Zap } from 'lucide-react'
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

const VAZIO = {
  tag: '',
  ponto_instalacao: '',
  tensao_trabalho_sistema: '',
  classe_tensao_vmax: '',
  tipo_aterramento_sistema: '',
  fator_aterramento_fa: '',
  tensao_nominal_escolhida_vn: '',
  corrente_nominal_descarga: '',
  frequencia: 60,
  distancia_especifica_escoamento: '',
  diametro_medio_fator_kd: 1,
  nbi_equipamento_protegido: '',
  tensao_residual: '',
  tensao_disruptiva: '',
  observacoes_tecnicas: '',
}

function fmt(valor, sufixo = '', casas = 2) {
  if (valor === null || valor === undefined || valor === '') return 'não informado'
  const numero = Number(valor)
  if (Number.isNaN(numero)) return String(valor)
  const texto = Number.isInteger(numero) ? String(numero) : numero.toFixed(casas)
  return `${texto}${sufixo}`
}

function normalizarStatus(status, padrao = 'ALERTA') {
  const texto = String(status || '').trim().toUpperCase()
  if (!texto) return padrao
  if (texto === 'OK') return 'OK'
  if (texto.includes('ALERTA')) return 'ALERTA'
  if (texto.includes('CR')) return 'CRITICO'
  return padrao
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

export default function ParaRaiosProjeto({ projeto, onSaved }) {
  const [form, setForm] = useState(VAZIO)
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    carregar()
  }, [projeto?.id])

  async function carregar() {
    if (!projeto?.id) return
    setLoading(true)
    try {
      const r = await api.get(`/projetos/${projeto.id}/para-raios`)
      setResultado(r.data)
      setForm({ ...VAZIO, ...r.data })
    } catch {
      toast.error('Erro ao carregar para-raios')
    } finally {
      setLoading(false)
    }
  }

  function setCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function normalizar() {
    const payload = { ...form }
    const numericos = [
      'tensao_trabalho_sistema',
      'classe_tensao_vmax',
      'fator_aterramento_fa',
      'tensao_nominal_escolhida_vn',
      'corrente_nominal_descarga',
      'frequencia',
      'distancia_especifica_escoamento',
      'diametro_medio_fator_kd',
      'nbi_equipamento_protegido',
      'tensao_residual',
      'tensao_disruptiva',
    ]
    numericos.forEach((campo) => {
      payload[campo] = payload[campo] === '' || payload[campo] === null || payload[campo] === undefined ? null : Number(payload[campo])
    })
    return payload
  }

  async function salvar() {
    setLoading(true)
    try {
      const r = await api.put(`/projetos/${projeto.id}/para-raios`, normalizar())
      setResultado(r.data)
      setForm({ ...VAZIO, ...r.data })
      await onSaved?.()
      toast.success('Para-raios salvo')
    } catch {
      toast.error('Erro ao salvar para-raios')
    } finally {
      setLoading(false)
    }
  }

  const status = resultado?.status || 'ALERTA'
  const itens = resultado?.itens || []
  const vmax = numero(form.classe_tensao_vmax)
  const fa = numero(form.fator_aterramento_fa)
  const vn = numero(form.tensao_nominal_escolhida_vn)
  const nbi = numero(form.nbi_equipamento_protegido)
  const residual = numero(form.tensao_residual)

  const faltaDadosBase = !form.tag || !form.ponto_instalacao || !form.tensao_trabalho_sistema || !form.classe_tensao_vmax
  const vnBaixo = vn !== null && vmax !== null && fa !== null && vn < vmax * fa
  const residualMaiorNbi = residual !== null && nbi !== null && residual >= nbi

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              title="Para-raios de Linha"
              description="Cadastro e validação estrutural do para-raios do projeto."
            />
            <StatusBadge status={normalizarStatus(status)} />
          </div>
        </div>

        <CardBody className="space-y-6">
          {(faltaDadosBase || vnBaixo || residualMaiorNbi) && (
            <div className="space-y-3">
              {faltaDadosBase && (
                <Alert variant="warning" icon={AlertTriangle} title="Dados básicos incompletos">
                  Preencha identificação, ponto de instalação, tensão de trabalho e classe de tensão para consolidar a validação.
                </Alert>
              )}
              {vnBaixo && (
                <Alert variant="danger" icon={AlertTriangle} title="Vn escolhido abaixo do mínimo">
                  O Vn escolhido está menor que FA × Vmax. Revise o para-raios selecionado.
                </Alert>
              )}
              {residualMaiorNbi && (
                <Alert variant="warning" icon={AlertTriangle} title="Coordenação de isolamento suspeita">
                  A tensão residual está maior ou igual ao NBI informado. Revise a margem de proteção.
                </Alert>
              )}
            </div>
          )}

          <section className="space-y-4">
            <SectionHeader
              title="Identificação e sistema"
              description="Dados de instalação e condições de operação do para-raios."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Campo label="Identificação / TAG">
                <input className="input w-full" value={form.tag || ''} onChange={(e) => setCampo('tag', e.target.value)} />
              </Campo>
              <Campo label="Ponto de instalação" className="md:col-span-2">
                <input className="input w-full" value={form.ponto_instalacao || ''} onChange={(e) => setCampo('ponto_instalacao', e.target.value)} />
              </Campo>
              <Campo label="Frequência (Hz)">
                <input type="number" className="input w-full" value={form.frequencia ?? ''} onChange={(e) => setCampo('frequencia', e.target.value)} />
              </Campo>
              <Campo label="Tensão de trabalho do sistema" tooltip="Tensão de operação do sistema no ponto de instalação.">
                <input type="number" step="0.01" className="input w-full" value={form.tensao_trabalho_sistema ?? ''} onChange={(e) => setCampo('tensao_trabalho_sistema', e.target.value)} />
              </Campo>
              <Campo label="Classe de tensão / Vmax" tooltip="Tensão máxima do sistema usada no critério de seleção.">
                <input type="number" step="0.01" className="input w-full" value={form.classe_tensao_vmax ?? ''} onChange={(e) => setCampo('classe_tensao_vmax', e.target.value)} />
              </Campo>
              <Campo label="Tipo de aterramento">
                <input className="input w-full" value={form.tipo_aterramento_sistema || ''} onChange={(e) => setCampo('tipo_aterramento_sistema', e.target.value)} />
              </Campo>
              <Campo label="Fator FA" tooltip="Fator de aterramento usado para estimar o Vn mínimo do para-raios.">
                <input type="number" step="0.01" className="input w-full" value={form.fator_aterramento_fa ?? ''} onChange={(e) => setCampo('fator_aterramento_fa', e.target.value)} />
              </Campo>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="Seleção e coordenação"
              description="Valores de escolha do para-raios e coordenação de isolamento."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Campo label="Vn escolhido" tooltip="Tensão nominal escolhida para o para-raios.">
                <input type="number" step="0.01" className="input w-full" value={form.tensao_nominal_escolhida_vn ?? ''} onChange={(e) => setCampo('tensao_nominal_escolhida_vn', e.target.value)} />
              </Campo>
              <Campo label="Corrente nominal de descarga">
                <input type="number" step="0.01" className="input w-full" value={form.corrente_nominal_descarga ?? ''} onChange={(e) => setCampo('corrente_nominal_descarga', e.target.value)} />
              </Campo>
              <Campo label="Distância específica de escoamento">
                <input type="number" step="0.01" className="input w-full" value={form.distancia_especifica_escoamento ?? ''} onChange={(e) => setCampo('distancia_especifica_escoamento', e.target.value)} />
              </Campo>
              <Campo label="Diâmetro médio / KD">
                <input type="number" step="0.01" className="input w-full" value={form.diametro_medio_fator_kd ?? ''} onChange={(e) => setCampo('diametro_medio_fator_kd', e.target.value)} />
              </Campo>
              <Campo label="NBI do equipamento protegido">
                <input type="number" step="0.01" className="input w-full" value={form.nbi_equipamento_protegido ?? ''} onChange={(e) => setCampo('nbi_equipamento_protegido', e.target.value)} />
              </Campo>
              <Campo label="Tensão residual" tooltip="Tensão residual do para-raios durante a descarga.">
                <input type="number" step="0.01" className="input w-full" value={form.tensao_residual ?? ''} onChange={(e) => setCampo('tensao_residual', e.target.value)} />
              </Campo>
              <Campo label="Tensão disruptiva">
                <input type="number" step="0.01" className="input w-full" value={form.tensao_disruptiva ?? ''} onChange={(e) => setCampo('tensao_disruptiva', e.target.value)} />
              </Campo>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="Observações técnicas"
              description="Premissas, notas de catálogo e justificativas da escolha."
            />

            <Campo label="Observações técnicas">
              <textarea className="input min-h-[86px] w-full resize-y" value={form.observacoes_tecnicas || ''} onChange={(e) => setCampo('observacoes_tecnicas', e.target.value)} />
            </Campo>
          </section>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button onClick={salvar} disabled={loading} className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-50">
              <Save size={15} />
              {loading ? 'Salvando...' : 'Salvar para-raios'}
            </button>
          </div>
        </CardBody>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          title="Resultados e justificativa"
          description="Resultados calculados pelo backend para a seleção do para-raios."
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard label="Vn mínimo = FA x Vmax" value={fmt(resultado?.vn_minimo)} description="Critério de tensão nominal" icon={Zap} status={vnBaixo ? 'CRITICO' : 'OK'} />
          <MetricCard label="Distância de escoamento" value={fmt(resultado?.distancia_escoamento)} description="Critério de isolamento" icon={Shield} />
          <MetricCard label="Margem de proteção" value={fmt(resultado?.margem_protecao_pct, ' %', 2)} description="Coordenação com NBI" icon={Shield} status={residualMaiorNbi ? 'ALERTA' : normalizarStatus(status)} />
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardBody>
            <SectionHeader title="Justificativa técnica" description={resultado?.mensagem || 'não calculável'} />
            <div className="mt-4 space-y-3">
              {itens.length ? itens.map((item, index) => (
                <div key={`${item.criterio}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[180px] font-semibold text-slate-900">{item.criterio}</div>
                    <StatusBadge status={normalizarStatus(item.status)} />
                    <div className="flex-1 text-sm text-slate-600">{item.mensagem}</div>
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Salve os dados para gerar a justificativa técnica.
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
