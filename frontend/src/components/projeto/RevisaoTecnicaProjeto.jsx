import { ExternalLink } from 'lucide-react'
import { SectionHeader, StatusBadge } from '../ui'
import { isCircuitNotEvaluated, statusFinalCircuito } from './projectHealth'

function nomeCircuito(circuito) {
  return circuito.tag || circuito.descricao || `Circuito ${circuito.id || ''}`.trim()
}

function LinhaCircuito({ circuito, onOpen }) {
  const status = statusFinalCircuito(circuito)
  const naoAvaliado = isCircuitNotEvaluated(circuito)
  const motivo = circuito.validacao_mensagem || circuito.protecao_nota || circuito.selecao_componentes_justificativa || 'Revise os dados técnicos deste circuito.'
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-900">{nomeCircuito(circuito)}</p>
          <StatusBadge status={status} />
          {naoAvaliado && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Não avaliado</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{motivo}</p>
      </div>
      <button type="button" onClick={() => onOpen?.(circuito)} className="flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900">
        Revisar circuito <ExternalLink size={14} />
      </button>
    </div>
  )
}

function Grupo({ titulo, descricao, circuitos, vazio, onOpen }) {
  return (
    <section className="border-t border-slate-200 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">{titulo}</h3><p className="text-xs text-slate-500">{descricao}</p></div><span className="font-mono text-sm text-slate-600">{circuitos.length}</span></div>
      {circuitos.length ? <div className="mt-2">{circuitos.map((c) => <LinhaCircuito key={c.id || nomeCircuito(c)} circuito={c} onOpen={onOpen} />)}</div> : <p className="mt-2 text-sm text-slate-400">{vazio}</p>}
    </section>
  )
}

export default function RevisaoTecnicaProjeto({ circuitos = [], fluxo, onOpenCircuit }) {
  const bloqueados = circuitos.filter((c) => statusFinalCircuito(c) === 'CRITICO')
  const alertas = circuitos.filter((c) => statusFinalCircuito(c) === 'ALERTA')
  const ok = circuitos.filter((c) => statusFinalCircuito(c) === 'OK')
  const naoAvaliados = circuitos.filter(isCircuitNotEvaluated)

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <SectionHeader title="Revisão Técnica" description="Priorize bloqueios, confira alertas e registre o que ainda não pôde ser avaliado." />
      <div className="border border-slate-300 bg-white p-4">
        <p className="font-semibold text-slate-900">{fluxo?.relatorioFinalLiberado ? 'Dados mínimos para emissão final completos' : 'Relatório final ainda bloqueado'}</p>
        <p className="mt-1 text-sm text-slate-600">{fluxo?.relatorioFinalLiberado ? 'Verificações não avaliadas ainda devem constar como ressalva.' : 'Resolva as pendências indicadas na esteira antes da emissão final.'}</p>
      </div>
      <div className="border border-slate-200 bg-white">
        <Grupo titulo="Pendências críticas" descricao="Impedem a emissão final." circuitos={bloqueados} vazio="Nenhuma pendência crítica." onOpen={onOpenCircuit} />
        <Grupo titulo="Alertas" descricao="Exigem conferência técnica." circuitos={alertas} vazio="Nenhum alerta." onOpen={onOpenCircuit} />
        <Grupo titulo="Não avaliados" descricao="Faltam dados ou modelo aplicável." circuitos={naoAvaliados} vazio="Nenhuma verificação não avaliada." onOpen={onOpenCircuit} />
        <Grupo titulo="OK" descricao="Critérios disponíveis verificados." circuitos={ok} vazio="Nenhum circuito classificado como OK." onOpen={onOpenCircuit} />
      </div>
    </div>
  )
}
