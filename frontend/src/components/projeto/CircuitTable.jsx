import React from 'react'
import { Eye, Trash2 } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'

const COLUNAS = ['Circuito', 'Descrição', 'Quadro', 'Potência', 'Tensão', 'Faseamento', 'Corrente', 'Seção', 'Queda', 'Proteção', 'Status', 'Ações']

function statusBadge(status) {
  if (status === 'OK') return <span className="cc-status-ok px-2 py-1 text-xs font-bold" style={{ borderRadius: 3 }}>OK</span>
  if (status === 'CRITICO') return <span className="cc-status-bloqueado px-2 py-1 text-xs font-bold" style={{ borderRadius: 3 }}>Bloqueado</span>
  if (status === 'ALERTA') return <span className="cc-status-alerta px-2 py-1 text-xs font-bold" style={{ borderRadius: 3 }}>Atenção</span>
  return <span className="cc-status-pendente px-2 py-1 text-xs font-bold" style={{ borderRadius: 3 }}>Pendente</span>
}

function faseamento(fases) {
  const n = Number(fases)
  if (n === 3) return '3F'
  if (n === 2) return '2F+N'
  if (n === 1) return 'F+N'
  return '-'
}

function CircuitTableComponent({ circuitosFiltrados, setModalC, deletarCircuito, statusFinal, limparTexto, fmt, tipoCabo, statusLabel }) {
  const parentRef = React.useRef(null)
  const virtualizer = useVirtualizer({ count: circuitosFiltrados.length, getScrollElement: () => parentRef.current, estimateSize: () => 52, overscan: 10 })
  const rows = virtualizer.getVirtualItems()
  const top = rows.length ? rows[0].start : 0
  const bottom = rows.length ? virtualizer.getTotalSize() - rows[rows.length - 1].end : 0
  const selecionado = circuitosFiltrados.find((c) => statusFinal(c) === 'CRITICO') || circuitosFiltrados[0]
  return <div className="flex min-h-0 flex-1 flex-col">
    <div ref={parentRef} className="w-full flex-1 overflow-auto" style={{ minHeight: 0 }}>
      <table className="cc-table w-full min-w-[1180px] border-collapse text-left">
    <thead className="sticky top-0 z-10"><tr>{COLUNAS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>
      {top > 0 && <tr><td style={{ height: top }} colSpan={COLUNAS.length} /></tr>}
      {rows.map((row) => {
        const c = circuitosFiltrados[row.index]
        const potencia = c.potencia_kva ?? c.potencia_kw ?? c.potencia
        const potenciaSufixo = c.potencia_kva ? ' kVA' : ' kW'
        const cabo = c.cabo_sugerido_tipo_comercial || c.tipo_cabo_comercial || (c.secao_mm2 || c.secao ? `${tipoCabo(c.tipo_cabo)} ${c.secao_mm2 || c.secao} mm²` : '-')
        const disjuntor = c.disjuntor_corrente_nominal || c.disjuntor_a || c.disjuntor_sugerido_in || c.protecao
        const status = statusFinal(c)
        return <tr key={c.id} data-index={row.index} ref={virtualizer.measureElement} className={`group cursor-pointer hover:bg-[#fbfcfd] ${status === 'CRITICO' ? 'border-l-4 border-l-[#ae2724]' : ''}`} onClick={() => setModalC({ ...c })}>
          <td className="font-mono font-bold">{limparTexto(c.tag, '-')}</td>
          <td className="max-w-[220px] truncate" title={limparTexto(c.descricao)}>{limparTexto(c.descricao)}</td>
          <td className="font-mono">{limparTexto(c.from_barramento || c.quadro || '-', '-')}</td>
          <td className="font-mono">{fmt(potencia, potenciaSufixo, 2)}</td>
          <td className="font-mono">{fmt(c.tensao, ' V', 0)}</td>
          <td className="font-mono">{faseamento(c.fases)}</td>
          <td className="font-mono">{fmt(c.corrente_projeto || c.corrente_nominal || c.corrente, ' A', 1)}</td>
          <td className="font-mono font-semibold">{c.secao_mm2 || c.secao ? `${fmt(c.secao_mm2 || c.secao, '', 1)} mm²` : '-'}</td>
          <td className={`font-mono ${status === 'CRITICO' ? 'font-bold text-[#ae2724]' : ''}`}>{fmt(c.queda_tensao_acumulada ?? c.queda_tensao_pct ?? c.queda, '%', 2)}</td>
          <td className="font-mono">{typeof disjuntor === 'string' ? disjuntor : disjuntor ? fmt(disjuntor, ' A', 0) : '-'}</td>
          <td>{statusBadge(status)}</td>
          <td onClick={(e) => e.stopPropagation()}><div className="flex items-center gap-1"><button onClick={() => setModalC({ ...c })} className="rounded p-1.5 text-[#0e5992] hover:bg-[#edf0f3]" title="Ver detalhes"><Eye size={15} /></button><button onClick={() => deletarCircuito(c.id)} className="rounded p-1.5 text-[#606e7d] hover:bg-[#fee8e6] hover:text-[#ae2724]" title="Excluir circuito"><Trash2 size={15} /></button></div></td>
        </tr>
      })}
      {bottom > 0 && <tr><td style={{ height: bottom }} colSpan={COLUNAS.length} /></tr>}
    </tbody>
      </table>
    </div>
    {selecionado && (
      <div className="border-t border-[#d2d9e0] bg-white p-3">
        <h2 className="text-sm font-bold text-[#121820]">Detalhes do circuito selecionado: {limparTexto(selecionado.tag, '-')}</h2>
        <p className="mt-1 text-sm text-[#606e7d]">{limparTexto(selecionado.descricao)}</p>
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-7">
          {[
            ['Quadro origem', limparTexto(selecionado.from_barramento || selecionado.quadro || '-')],
            ['Potência', fmt(selecionado.potencia_kva ?? selecionado.potencia_kw ?? selecionado.potencia, selecionado.potencia_kva ? ' kVA' : ' kW', 2)],
            ['Corrente', fmt(selecionado.corrente_projeto || selecionado.corrente_nominal || selecionado.corrente, ' A', 1)],
            ['Seção calculada', selecionado.secao_mm2 || selecionado.secao ? `${fmt(selecionado.secao_mm2 || selecionado.secao, '', 1)} mm²` : '-'],
            ['Queda de tensão', fmt(selecionado.queda_tensao_acumulada ?? selecionado.queda_tensao_pct ?? selecionado.queda, '%', 2)],
            ['Proteção', disjuntorTexto(selecionado, fmt)],
            ['Status', statusLabel(statusFinal(selecionado))],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="cc-label">{label}</div>
              <div className={`mt-2 font-bold ${label === 'Queda de tensão' && statusFinal(selecionado) === 'CRITICO' ? 'text-[#ae2724]' : 'text-[#121820]'}`}>{value}</div>
            </div>
          ))}
        </div>
        {(selecionado.validacao_mensagem || selecionado.protecao_nota) && <p className="mt-3 text-xs font-medium text-[#ae2724]">Validação: {selecionado.validacao_mensagem || selecionado.protecao_nota}</p>}
      </div>
    )}
  </div>
}
export const CircuitTable = React.memo(CircuitTableComponent)

function disjuntorTexto(c, fmt) {
  const valor = c.disjuntor_corrente_nominal || c.disjuntor_a || c.disjuntor_sugerido_in || c.protecao
  if (typeof valor === 'string') return valor
  return valor ? `Disjuntor ${fmt(valor, ' A', 0)}` : '-'
}
