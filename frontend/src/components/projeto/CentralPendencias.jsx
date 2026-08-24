import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { Card, CardBody, SectionHeader, StatusBadge } from '../ui'

const grupos = [
  ['criticas', 'Pendências Críticas', XCircle, 'text-red-600', 'bg-red-50 border-red-100'],
  ['alertas', 'Alertas de Revisão', AlertTriangle, 'text-amber-600', 'bg-amber-50 border-amber-100'],
  ['faltantes', 'Dados Faltantes', HelpCircle, 'text-slate-500', 'bg-slate-50 border-slate-200'],
]

function PendenciaItem({ item }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{item.titulo}</div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{item.descricao}</p>
        </div>
        <div className="shrink-0">
          <StatusBadge status={item.status} showDot={false} />
        </div>
      </div>
    </div>
  )
}

export default function CentralPendencias({ health }) {
  const pendencias = health?.pendencias || { criticas: [], alertas: [], faltantes: [] }
  const total = Object.values(pendencias).reduce((acc, lista) => acc + lista.length, 0)

  return (
    <Card className="border-indigo-100 shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-primary-500 to-indigo-500"></div>
      <CardBody>
        <SectionHeader
          title="Central de Pendências"
          description="Resumo visual de impeditivos, alertas técnicos e dados ausentes do projeto."
        />

        {total === 0 ? (
          <div className="mt-5 flex items-center justify-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-8 text-emerald-800 shadow-sm">
            <CheckCircle2 size={24} className="text-emerald-600" />
            <div className="text-center">
              <h4 className="font-semibold text-emerald-900">Projeto saudável!</h4>
              <p className="text-sm">Nenhuma pendência ou alerta técnico consolidado no momento.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {grupos.map(([chave, titulo, Icon, iconClass, headerClass]) => (
              <div key={chave} className="flex flex-col rounded-xl bg-slate-50 border border-slate-100 overflow-hidden">
                <div className={`flex items-center gap-2 px-4 py-3 border-b ${headerClass}`}>
                  <Icon size={18} className={iconClass} />
                  <span className="text-sm font-bold text-slate-800">{titulo}</span>
                  <span className="ml-auto rounded-full bg-white/60 px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">
                    {pendencias[chave]?.length || 0}
                  </span>
                </div>
                <div className="flex-1 p-3 space-y-3">
                  {pendencias[chave]?.length ? (
                    pendencias[chave].map((item, index) => <PendenciaItem key={`${chave}-${index}`} item={item} />)
                  ) : (
                    <div className="flex h-full min-h-[100px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/50 text-sm font-medium text-slate-400">
                      Nenhum item.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
