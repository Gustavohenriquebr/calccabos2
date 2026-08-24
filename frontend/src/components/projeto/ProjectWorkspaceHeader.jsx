import { ArrowLeft, ArrowRight, Bot, Upload } from 'lucide-react'
import { Button } from '../ui'

export default function ProjectWorkspaceHeader({ projeto, onBack, onImport, primaryAction, onPrimaryAction, onToggleAgent, agentOpen }) {
  return <header className="border-b border-slate-300 bg-white"><div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="min-w-0"><button onClick={onBack} className="mb-1 flex items-center gap-1 text-xs text-slate-500 hover:text-blue-800" data-testid="btn-voltar-dashboard"><ArrowLeft size={13} /> Projetos</button>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h1 className="truncate text-xl font-semibold text-slate-950">{projeto?.nome || 'Projeto sem nome'}</h1><span className="text-xs text-slate-500">Rev. {projeto?.revisao || '0'}</span></div>
      <p className="mt-1 text-sm text-slate-600">{projeto?.cliente || 'Cliente não informado'} · {projeto?.contexto || 'Contexto não informado'} · {projeto?.tensao_ref ? `${projeto.tensao_ref} V` : 'Tensão N/D'}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2"><Button variant="primary" icon={ArrowRight} onClick={onPrimaryAction} data-testid="btn-proximo-passo">{primaryAction?.label || 'Continuar projeto'}</Button><Button variant="secondary" size="sm" icon={Upload} onClick={onImport}>Importar</Button><Button variant={agentOpen ? 'primary' : 'secondary'} size="sm" icon={Bot} onClick={onToggleAgent}>Assistente</Button></div>
  </div></header>
}
