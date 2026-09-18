function metaProjeto(projeto, campo, fallback = 'N/D') {
  return projeto?.[campo] || projeto?.dados_universais?.[campo] || fallback
}

function localProjeto(projeto) {
  const uf = metaProjeto(projeto, 'uf', '')
  const cidade = metaProjeto(projeto, 'cidade', '')
  if (uf || cidade) return [uf, cidade].filter(Boolean).join(' / ')
  return projeto?.localidade || projeto?.contexto || 'Local N/D'
}

function topValue(label, value, wide = false) {
  return (
    <div className={`min-w-0 ${wide ? 'w-[230px]' : 'w-[112px]'}`}>
      <div className="truncate text-xs font-bold uppercase leading-4 text-[#606e7d]">{label}</div>
      <div className="truncate text-sm font-bold leading-5 text-[#121820]">
        {value || 'N/D'}
      </div>
    </div>
  )
}

export default function ProjectWorkspaceHeader({ projeto, health }) {
  const statusOk = health?.statusGeral === 'OK'
  return (
    <header className="shrink-0 border-b border-[#d2d9e0] bg-white">
      <div className="flex min-h-[64px] items-center gap-6 overflow-x-auto px-4 py-2">
        {topValue('PROJETO', projeto?.nome || 'Projeto sem nome', true)}
        {topValue('CLIENTE', projeto?.cliente || 'Cliente não informado')}
        {topValue('LOCAL', localProjeto(projeto))}
        {topValue('CONCESSIONÁRIA', metaProjeto(projeto, 'concessionaria'), true)}
        {topValue('TENSÃO REF.', projeto?.tensao_ref ? `${projeto.tensao_ref} V` : metaProjeto(projeto, 'tensao_referencia'))}
        {topValue('REVISÃO', `Rev. ${projeto?.revisao || '0'}`)}
        {topValue('RESP. TÉCNICO', projeto?.responsavelTecnico || metaProjeto(projeto, 'responsavel_tecnico'), true)}
        <div className="ml-auto">
          <div className={`whitespace-nowrap px-2 py-1 text-xs font-bold leading-4 ${statusOk ? 'cc-status-ok' : 'cc-status-alerta'}`} style={{ borderRadius: 3 }}>
            {statusOk ? 'Projeto validado' : 'Projeto em validação'}
          </div>
        </div>
      </div>
    </header>
  )
}
