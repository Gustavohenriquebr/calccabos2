import React from 'react'
import { Eye, Trash2 } from 'lucide-react'
import { StatusBadge } from '../ui'
import { useVirtualizer } from '@tanstack/react-virtual'

const COLUNAS = ['TAG', 'Descrição', 'Carga', 'Tensão', 'Distância', 'Cabo', 'Disjuntor', 'Status', 'Ações']

function CircuitTableComponent({ circuitosFiltrados, setModalC, deletarCircuito, statusFinal, limparTexto, fmt, tipoCabo, statusLabel }) {
  const parentRef = React.useRef(null)
  const virtualizer = useVirtualizer({ count: circuitosFiltrados.length, getScrollElement: () => parentRef.current, estimateSize: () => 49, overscan: 10 })
  const rows = virtualizer.getVirtualItems()
  const top = rows.length ? rows[0].start : 0
  const bottom = rows.length ? virtualizer.getTotalSize() - rows[rows.length - 1].end : 0
  return <div ref={parentRef} className="w-full flex-1 overflow-auto" style={{ minHeight: 0 }}><table className="w-full min-w-[1050px] border-collapse text-left">
    <thead className="sticky top-0 z-10 border-y border-slate-200 bg-slate-50"><tr>{COLUNAS.map((h) => <th key={h} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
      {top > 0 && <tr><td style={{ height: top }} colSpan={COLUNAS.length} /></tr>}
      {rows.map((row) => {
        const c = circuitosFiltrados[row.index]
        const cabo = c.cabo_sugerido_tipo_comercial || c.tipo_cabo_comercial || (c.secao_mm2 ? `${tipoCabo(c.tipo_cabo)} ${c.secao_mm2} mm²` : '-')
        const disjuntor = c.disjuntor_corrente_nominal || c.disjuntor_a || c.disjuntor_sugerido_in
        return <tr key={c.id} data-index={row.index} ref={virtualizer.measureElement} className="group cursor-pointer hover:bg-slate-50" onClick={() => setModalC({ ...c })}>
          <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-900">{limparTexto(c.tag, '-')}</td>
          <td className="max-w-[260px] truncate px-3 py-3" title={limparTexto(c.descricao)}>{limparTexto(c.descricao)}</td>
          <td className="px-3 py-3 font-mono text-xs">{fmt(c.potencia_kw, ' kW', 2)}</td>
          <td className="px-3 py-3 font-mono text-xs">{fmt(c.tensao, ' V', 0)}</td>
          <td className="px-3 py-3 font-mono text-xs">{fmt(c.comprimento_real || c.distancia_m, ' m', 1)}</td>
          <td className="px-3 py-3 font-mono text-xs font-medium text-slate-900">{cabo}</td>
          <td className="px-3 py-3 font-mono text-xs">{disjuntor ? fmt(disjuntor, ' A', 0) : '-'}</td>
          <td className="px-3 py-3"><StatusBadge status={statusLabel(statusFinal(c))} /></td>
          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><div className="flex items-center gap-1"><button onClick={() => setModalC({ ...c })} className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-blue-800" title="Ver detalhes"><Eye size={15} /></button><button onClick={() => deletarCircuito(c.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700" title="Excluir circuito"><Trash2 size={15} /></button></div></td>
        </tr>
      })}
      {bottom > 0 && <tr><td style={{ height: bottom }} colSpan={COLUNAS.length} /></tr>}
    </tbody>
  </table></div>
}
export const CircuitTable = React.memo(CircuitTableComponent)
