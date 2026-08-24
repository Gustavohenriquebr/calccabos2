import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, CheckCircle2, Save, Shield, Zap } from 'lucide-react'
import api from '../../services/api'
import {
  Alert,
  Card,
  CardBody,
  EmptyState,
  MetricCard,
  SectionHeader,
  StatusBadge,
  Tooltip,
} from '../ui'

const VAZIO = {
  tag: 'DJ-GERAL-QGBT',
  tipo: 'ACB',
  vn: '',
  in: '',
  icu: '',
  curva: 'C',
  fabricante: '',
}

function fmt(valor, sufixo = '', casas = 2) {
  if (valor === null || valor === undefined || valor === '') return 'N/D'
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

function statusLabel(status) {
  const normalizado = normalizarStatus(status)
  return normalizado === 'CRITICO' ? 'CRÍTICO' : normalizado
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

export default function ProtecoesProjeto({ projeto, onSaved }) {
  const [form, setForm] = useState(VAZIO)
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    carregar()
  }, [projeto?.id])

  async function carregar() {
    if (!projeto?.id) return
    setLoading(true)
    try {
      const r = await api.get(`/projetos/${projeto.id}/protecoes`)
      setDados(r.data)
      setForm({ ...VAZIO, ...(r.data.geral || {}) })
    } catch {
      toast.error('Erro ao carregar proteções')
    } finally {
      setLoading(false)
    }
  }

  function setCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  async function salvarGeral() {
    setLoading(true)
    try {
      const payload = {
        tag: form.tag || 'DJ-GERAL-QGBT',
        tipo: form.tipo || 'ACB',
        vn: form.vn === '' ? null : Number(form.vn),
        in: form.in === '' ? null : Number(form.in),
        icu: form.icu === '' ? null : Number(form.icu),
        curva: form.curva || 'C',
        fabricante: form.fabricante || '',
      }
      const r = await api.put(`/projetos/${projeto.id}/protecoes`, payload)
      setDados((atual) => ({ ...(atual || {}), geral: r.data }))
      setForm({ ...VAZIO, ...r.data })
      await onSaved?.()
      toast.success('Proteção geral salva')
    } catch {
      toast.error('Erro ao salvar proteção geral')
    } finally {
      setLoading(false)
    }
  }

  const geral = dados?.geral || {}
  const circuitos = dados?.circuitos || []
  const criticos = circuitos.filter((c) => normalizarStatus(c.status) === 'CRITICO').length
  const alertas = circuitos.filter((c) => normalizarStatus(c.status) === 'ALERTA').length
  const ok = circuitos.filter((c) => normalizarStatus(c.status) === 'OK').length

  const inGeral = numero(form.in)
  const icuGeral = numero(form.icu)
  const correnteBarramento = numero(geral.corrente_barramento)
  const iccTransformador = numero(geral.icc_transformador)

  const inBaixo = inGeral !== null && correnteBarramento !== null && inGeral < correnteBarramento
  const icuBaixo = icuGeral !== null && iccTransformador !== null && icuGeral < iccTransformador
  const margemBaixaIcu = icuGeral !== null && iccTransformador !== null && icuGeral >= iccTransformador && icuGeral <= iccTransformador * 1.1

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              title="Sistema de Proteção"
              description="Validação estrutural do disjuntor geral e das proteções dos circuitos."
            />
            <StatusBadge status={normalizarStatus(geral.status)} />
          </div>
        </div>

        <CardBody className="space-y-6">
          {(inBaixo || icuBaixo || margemBaixaIcu || !form.in || !form.icu) && (
            <div className="space-y-3">
              {!form.in && (
                <Alert variant="warning" icon={AlertTriangle} title="Corrente nominal pendente">
                  Informe a corrente nominal do disjuntor geral para validar a proteção de entrada.
                </Alert>
              )}
              {!form.icu && (
                <Alert variant="warning" icon={AlertTriangle} title="Icu pendente">
                  Informe a capacidade de interrupção do disjuntor geral para comparar com o Icc disponível.
                </Alert>
              )}
              {inBaixo && (
                <Alert variant="danger" icon={AlertTriangle} title="In abaixo da corrente do barramento">
                  A corrente nominal do disjuntor geral está menor que a corrente estimada do barramento.
                </Alert>
              )}
              {icuBaixo && (
                <Alert variant="danger" icon={AlertTriangle} title="Icu menor que Icc">
                  A capacidade de interrupção do disjuntor geral está menor que o Icc estimado do transformador.
                </Alert>
              )}
              {!icuBaixo && margemBaixaIcu && (
                <Alert variant="warning" icon={AlertTriangle} title="Margem baixa de interrupção">
                  O Icu está muito próximo do Icc estimado. Recomenda-se revisar a margem de segurança.
                </Alert>
              )}
            </div>
          )}

          <section className="space-y-4">
            <SectionHeader
              title="Disjuntor geral"
              description="Dados principais da proteção de entrada do QGBT."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Campo label="TAG do disjuntor geral">
                <input className="input w-full" value={form.tag || ''} onChange={(e) => setCampo('tag', e.target.value)} />
              </Campo>

              <Campo label="Tipo" tooltip="Tipo do dispositivo geral, por exemplo ACB ou MCCB.">
                <select className="input w-full" value={form.tipo || 'ACB'} onChange={(e) => setCampo('tipo', e.target.value)}>
                  {['ACB', 'MCCB', 'DJ', 'Fuse'].map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </Campo>

              <Campo label="Vn disjuntor geral (V)" tooltip="Tensão nominal do dispositivo de proteção.">
                <input type="number" className="input w-full" value={form.vn ?? ''} onChange={(e) => setCampo('vn', e.target.value)} />
              </Campo>

              <Campo label="In disjuntor geral (A)" tooltip="Corrente nominal do disjuntor geral. Deve ser compatível com a corrente do barramento.">
                <input type="number" className="input w-full" value={form.in ?? ''} onChange={(e) => setCampo('in', e.target.value)} />
              </Campo>

              <Campo label="Icu disjuntor geral (kA)" tooltip="Capacidade de interrupção. Deve ser maior ou igual ao Icc no ponto de instalação.">
                <input type="number" step="0.1" className="input w-full" value={form.icu ?? ''} onChange={(e) => setCampo('icu', e.target.value)} />
              </Campo>

              <Campo label="Curva">
                <select className="input w-full" value={form.curva || 'C'} onChange={(e) => setCampo('curva', e.target.value)}>
                  {['B', 'C', 'D', 'L', 'S', 'I'].map((curva) => <option key={curva} value={curva}>{curva}</option>)}
                </select>
              </Campo>

              <Campo label="Fabricante" className="md:col-span-2">
                <input className="input w-full" value={form.fabricante || ''} onChange={(e) => setCampo('fabricante', e.target.value)} />
              </Campo>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="Resumo da validação"
              description="Indicadores calculados pelo backend para a proteção geral."
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <MetricCard label="Corrente do barramento" value={fmt(geral.corrente_barramento, ' A', 2)} description="Referência de carga" icon={Zap} status={inBaixo ? 'CRITICO' : 'OK'} />
              <MetricCard label="Icc do transformador" value={fmt(geral.icc_transformador, ' kA', 2)} description="Curto-circuito disponível" icon={Shield} status={icuBaixo ? 'CRITICO' : margemBaixaIcu ? 'ALERTA' : 'OK'} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Mensagem técnica</div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">{geral.mensagem || 'N/D'}</p>
              </div>
            </div>
          </section>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button onClick={salvarGeral} disabled={loading} className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-50">
              <Save size={15} />
              {loading ? 'Salvando...' : 'Salvar disjuntor geral'}
            </button>
          </div>
        </CardBody>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          title="Proteções dos circuitos"
          description="Resumo de status das proteções individuais já calculadas para os circuitos."
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricCard label="Proteções de circuitos" value={circuitos.length} description="Total avaliado" icon={Shield} />
          <MetricCard label="OK" value={ok} description="Proteções sem pendência" status="OK" icon={CheckCircle2} />
          <MetricCard label="Alertas" value={alertas} description="Requerem revisão" status="ALERTA" icon={AlertTriangle} />
          <MetricCard label="Críticos" value={criticos} description="Não liberados" status="CRITICO" icon={AlertTriangle} />
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          {circuitos.length ? (
            <div className="overflow-auto">
              <table className="w-full min-w-[980px] text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    {['Circuito', 'Dispositivo', 'In', 'Ib', 'Iz', 'Icu', 'Icc', 'Curva', 'Status', 'Mensagem'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {circuitos.map((c) => (
                    <tr key={c.id || c.descricao} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-slate-900">{c.tag || c.descricao || 'N/D'}</td>
                      <td className="px-3 py-2">{c.protection_device || 'N/D'}</td>
                      <td className="px-3 py-2 font-mono">{fmt(c.in, ' A', 0)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(c.ib, ' A', 1)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(c.iz, ' A', 1)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(c.icu, ' kA', 1)}</td>
                      <td className="px-3 py-2 font-mono">{fmt(c.icc, ' kA', 2)}</td>
                      <td className="px-3 py-2">{c.curva || 'N/D'}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={normalizarStatus(c.status)} />
                      </td>
                      <td className="max-w-[320px] truncate px-3 py-2" title={c.mensagem || ''}>{c.mensagem || 'N/D'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Shield}
              title="Nenhum circuito para validar"
              description="Cadastre circuitos e execute o cálculo para visualizar a validação das proteções individuais."
            />
          )}
        </Card>
      </section>
    </div>
  )
}
