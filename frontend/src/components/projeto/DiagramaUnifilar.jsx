import { useMemo, useRef, useState } from 'react'
import { Download, Maximize2, Minus, Move, Plus, RotateCcw, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { Alert, SectionHeader } from '../ui'
import {
  UNIFILAR_LIBRARY,
  UNIFILAR_STATUS,
  buildUnifilarModel,
} from '../../utils/unifilarModel'

const NODE_SIZE = {
  entrada: { w: 190, h: 78 },
  transformador: { w: 210, h: 96 },
  qgbt: { w: 190, h: 88 },
  quadro: { w: 170, h: 76 },
  disjuntor: { w: 126, h: 68 },
  circuito: { w: 150, h: 90 },
  motor: { w: 150, h: 94 },
  iluminacao: { w: 150, h: 94 },
  tomadas: { w: 150, h: 94 },
  carga: { w: 150, h: 94 },
}

function statusMeta(status) {
  return UNIFILAR_STATUS[status] || UNIFILAR_STATUS.NAO_AVALIADO
}

function nodeSize(node) {
  return NODE_SIZE[node.type] || NODE_SIZE.carga
}

function nodeCenter(node) {
  const size = nodeSize(node)
  return {
    x: node.position.x + size.w / 2,
    y: node.position.y + size.h / 2,
  }
}

function Symbol({ type, x, y }) {
  if (type === 'entrada') {
    return <polygon points={`${x - 12},${y - 11} ${x + 12},${y - 11} ${x},${y + 14}`} fill="#f8fafc" stroke="#111827" strokeWidth="1.6" />
  }
  if (type === 'transformador') {
    return (
      <g>
        <circle cx={x} cy={y - 8} r="12" fill="#fff" stroke="#111827" strokeWidth="1.5" />
        <circle cx={x} cy={y + 8} r="12" fill="#fff" stroke="#111827" strokeWidth="1.5" />
      </g>
    )
  }
  if (type === 'qgbt' || type === 'quadro') {
    return (
      <g>
        <rect x={x - 14} y={y - 13} width="28" height="26" fill="#fff" stroke="#111827" strokeWidth="1.5" />
        <line x1={x - 8} y1={y - 4} x2={x + 8} y2={y - 4} stroke="#111827" strokeWidth="1.5" />
        <line x1={x - 8} y1={y + 4} x2={x + 8} y2={y + 4} stroke="#111827" strokeWidth="1.5" />
      </g>
    )
  }
  if (type === 'motor') {
    return (
      <g>
        <circle cx={x} cy={y} r="14" fill="#fff" stroke="#111827" strokeWidth="1.5" />
        <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">M</text>
      </g>
    )
  }
  if (type === 'iluminacao') {
    return (
      <g>
        <circle cx={x} cy={y} r="14" fill="#fff" stroke="#111827" strokeWidth="1.5" />
        <path d={`M ${x - 9} ${y - 9} L ${x + 9} ${y + 9} M ${x + 9} ${y - 9} L ${x - 9} ${y + 9}`} stroke="#111827" strokeWidth="1.3" />
      </g>
    )
  }
  if (type === 'tomadas') {
    return (
      <g>
        <rect x={x - 13} y={y - 12} width="26" height="24" rx="12" fill="#fff" stroke="#111827" strokeWidth="1.5" />
        <circle cx={x - 5} cy={y} r="1.8" fill="#111827" />
        <circle cx={x + 5} cy={y} r="1.8" fill="#111827" />
      </g>
    )
  }
  return (
    <g>
      <rect x={x - 12} y={y - 12} width="24" height="24" fill="#fff" stroke="#111827" strokeWidth="1.5" />
      <path d={`M ${x - 8} ${y} H ${x + 8}`} stroke="#111827" strokeWidth="1.5" />
    </g>
  )
}

function Field({ label, value }) {
  return (
    <div className="border-b border-[#e2e8f0] py-2 last:border-b-0">
      <div className="text-[12px] font-semibold uppercase tracking-normal text-[#64748b]">{label}</div>
      <div className="mt-1 text-[14px] font-semibold text-[#111827]">{value || 'N/D'}</div>
    </div>
  )
}

function exportName(projeto, ext) {
  const base = String(projeto?.nome || projeto?.id || 'projeto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return `diagrama_unifilar_${base || 'projeto'}.${ext}`
}

export default function DiagramaUnifilar({ projeto, circuitos = [] }) {
  const svgRef = useRef(null)
  const [zoom, setZoom] = useState(0.9)
  const [selectedId, setSelectedId] = useState(null)
  const [showLabels, setShowLabels] = useState(true)

  const model = useMemo(() => buildUnifilarModel({ projeto, circuitos }), [projeto, circuitos])
  const selectedNode = model.nodes.find((node) => node.id === selectedId) || model.nodes[0]
  const selectedEdge = model.edges.find((edge) => edge.id === selectedId)
  const selectedItem = selectedEdge || selectedNode
  const selectedData = selectedItem?.data || {}
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))

  function svgSerializado() {
    if (!svgRef.current) return null
    const serializer = new XMLSerializer()
    return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(svgRef.current)}`
  }

  async function checarExportacao() {
    try {
      await api.post('/usage/check', { feature: 'unifilar_export', projetoId: projeto?._id || projeto?.id })
      return true
    } catch (error) {
      const data = error?.response?.data || {}
      const message = data.message || 'Exportacao do unifilar indisponivel no plano atual.'
      toast.error(`${message} ${data.recommendedPlan ? `Plano recomendado: ${data.recommendedPlan}.` : ''}`)
      return false
    }
  }

  async function exportarSvg() {
    if (!(await checarExportacao())) return
    const content = svgSerializado()
    if (!content) return
    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = exportName(projeto, 'svg')
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportarPng() {
    if (!(await checarExportacao())) return
    try {
      const content = svgSerializado()
      if (!content) return
      const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const image = new Image()
      image.onload = () => {
        const scale = 2
        const canvas = document.createElement('canvas')
        canvas.width = model.bounds.width * scale
        canvas.height = model.bounds.height * scale
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.scale(scale, scale)
        ctx.drawImage(image, 0, 0)
        URL.revokeObjectURL(url)
        const link = document.createElement('a')
        link.download = exportName(projeto, 'png')
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      image.onerror = () => {
        URL.revokeObjectURL(url)
        toast.error('Erro ao exportar imagem')
      }
      image.src = url
    } catch {
      toast.error('Erro ao exportar imagem')
    }
  }

  return (
    <div className="space-y-4">
      <div className="cc-panel overflow-hidden">
        <div className="border-b border-[#d2d9e0] bg-white px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <SectionHeader
              title="Diagrama Unifilar"
              description="Editor visual técnico para estrutura elétrica do projeto."
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="cc-button cc-button-secondary" disabled title="Adicionar quadro">
                <Plus size={15} /> Adicionar quadro
              </button>
              <button type="button" className="cc-button cc-button-secondary" disabled title="Adicionar circuito">
                <Zap size={15} /> Adicionar circuito
              </button>
              <button type="button" className="cc-button cc-button-secondary" onClick={() => setShowLabels((value) => !value)}>
                <Maximize2 size={15} /> Etiquetas
              </button>
              <button type="button" className="cc-button cc-button-secondary" onClick={() => setZoom(0.9)}>
                <RotateCcw size={15} /> Organizar
              </button>
              <button type="button" className="cc-button cc-button-secondary" onClick={exportarSvg}>
                <Download size={15} /> SVG
              </button>
              <button type="button" className="cc-button cc-button-primary" onClick={exportarPng}>
                <Download size={15} /> PNG
              </button>
            </div>
          </div>
        </div>

        <div className="grid min-h-[720px] grid-cols-1 bg-[#f3f6f8] xl:grid-cols-[240px_minmax(0,1fr)_300px]">
          <aside className="border-b border-[#d2d9e0] bg-[#fbfcfd] p-4 xl:border-b-0 xl:border-r">
            <div className="cc-label">Biblioteca</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {UNIFILAR_LIBRARY.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  disabled
                  className="flex min-h-[58px] cursor-not-allowed items-center gap-3 border border-[#d2d9e0] bg-white px-3 py-2 text-left opacity-80"
                  title="Inserção manual ficará para a próxima etapa"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#aeb8c2] bg-[#f8fafc]">
                    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
                      <Symbol type={item.type} x={16} y={16} />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold text-[#111827]">{item.label}</span>
                    <span className="block text-[12px] text-[#64748b]">{item.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0">
            <div className="flex items-center justify-between border-b border-[#d2d9e0] bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#475569]">
                <Move size={15} />
                Canvas técnico: visualização automática dos circuitos existentes
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="cc-button px-2" onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(1))))} title="Reduzir zoom">
                  <Minus size={15} />
                </button>
                <div className="w-16 border border-[#d2d9e0] bg-[#f8fafc] px-2 py-1 text-center text-[13px] font-bold text-[#334155]">
                  {Math.round(zoom * 100)}%
                </div>
                <button type="button" className="cc-button px-2" onClick={() => setZoom((value) => Math.min(1.6, Number((value + 0.1).toFixed(1))))} title="Aumentar zoom">
                  <Plus size={15} />
                </button>
              </div>
            </div>

            <div className="h-[670px] overflow-auto p-5">
              <div
                className="mx-auto border border-[#aeb8c2] bg-white shadow-sm"
                style={{ width: model.bounds.width * zoom, height: model.bounds.height * zoom }}
              >
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${model.bounds.width} ${model.bounds.height}`}
                  width="100%"
                  height="100%"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ fontFamily: 'Inter, Arial, sans-serif' }}
                >
                  <defs>
                    <pattern id="unifilar-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e2e8f0" strokeWidth="0.6" />
                    </pattern>
                    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L9,3 z" fill="#334155" />
                    </marker>
                  </defs>
                  <rect width={model.bounds.width} height={model.bounds.height} fill="#ffffff" />
                  <rect width={model.bounds.width} height={model.bounds.height} fill="url(#unifilar-grid)" />
                  <rect x="18" y="18" width={model.bounds.width - 36} height={model.bounds.height - 36} fill="none" stroke="#111827" strokeWidth="2" />
                  <text x="36" y="50" fontSize="16" fontWeight="700" fill="#111827">CalcCabos - Diagrama Unifilar</text>
                  <text x="36" y="72" fontSize="12" fill="#475569">{projeto?.nome || 'Projeto sem nome'} · Rev. {model.revision}</text>

                  {model.edges.map((edge) => {
                    const from = nodeById.get(edge.from)
                    const to = nodeById.get(edge.to)
                    if (!from || !to) return null
                    const a = nodeCenter(from)
                    const b = nodeCenter(to)
                    const meta = statusMeta(edge.status)
                    const isSelected = selectedId === edge.id
                    const midX = (a.x + b.x) / 2
                    const midY = (a.y + b.y) / 2
                    return (
                      <g key={edge.id} onClick={() => setSelectedId(edge.id)} className="cursor-pointer">
                        <path
                          d={`M ${a.x} ${a.y} V ${midY} H ${b.x} V ${b.y}`}
                          fill="none"
                          stroke={isSelected ? '#0f766e' : '#334155'}
                          strokeWidth={isSelected ? 3.2 : 2}
                          markerEnd="url(#arrow)"
                        />
                        <circle cx={a.x} cy={a.y} r="4" fill={meta.stroke} />
                        {showLabels && (
                          <g transform={`translate(${midX + 8}, ${midY - 22})`}>
                            <rect x="0" y="0" width="150" height="44" fill="#ffffff" stroke="#cbd5e1" />
                            <text x="8" y="16" fontSize="11" fontWeight="700" fill="#111827">{edge.data.cabo || 'Trecho'}</text>
                            <text x="8" y="32" fontSize="10" fill="#475569">{edge.data.disjuntor || edge.data.tensao || edge.data.queda || 'Dados pendentes'}</text>
                          </g>
                        )}
                      </g>
                    )
                  })}

                  {model.nodes.map((node) => {
                    const size = nodeSize(node)
                    const meta = statusMeta(node.status)
                    const isSelected = selectedNode?.id === node.id && !selectedEdge
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.position.x}, ${node.position.y})`}
                        onClick={() => setSelectedId(node.id)}
                        className="cursor-pointer"
                      >
                        <rect
                          width={size.w}
                          height={size.h}
                          fill="#ffffff"
                          stroke={isSelected ? '#0f766e' : '#111827'}
                          strokeWidth={isSelected ? 2.8 : 1.5}
                        />
                        <rect x="0" y="0" width="6" height={size.h} fill={meta.stroke} />
                        <Symbol type={node.type} x={28} y={34} />
                        <text x="54" y="27" fontSize="13" fontWeight="800" fill="#111827">{node.data.tag || node.label}</text>
                        <text x="54" y="45" fontSize="11" fill="#475569">{node.label}</text>
                        <text x="54" y="63" fontSize="10" fill={meta.color} fontWeight="700">{meta.label}</text>
                        {showLabels && (
                          <>
                            <text x="12" y={size.h - 12} fontSize="10" fill="#475569">{node.data.tensao || node.data.potencia || ''}</text>
                            <text x={size.w - 12} y={size.h - 12} textAnchor="end" fontSize="10" fill="#475569">{node.data.corrente || node.data.disjuntor || ''}</text>
                          </>
                        )}
                      </g>
                    )
                  })}

                  <g transform={`translate(${model.bounds.width - 360}, ${model.bounds.height - 138})`}>
                    <rect width="326" height="104" fill="#ffffff" stroke="#111827" strokeWidth="1.6" />
                    <line x1="0" y1="34" x2="326" y2="34" stroke="#111827" />
                    <line x1="196" y1="34" x2="196" y2="104" stroke="#111827" />
                    <text x="12" y="23" fontSize="15" fontWeight="800" fill="#111827">Memorial gráfico</text>
                    <text x="12" y="56" fontSize="10" fill="#475569">PROJETO</text>
                    <text x="12" y="75" fontSize="12" fontWeight="700" fill="#111827">{projeto?.nome || 'N/D'}</text>
                    <text x="210" y="56" fontSize="10" fill="#475569">REVISÃO</text>
                    <text x="210" y="75" fontSize="12" fontWeight="700" fill="#111827">{model.revision}</text>
                    <text x="210" y="94" fontSize="10" fill="#475569">Exportável SVG/PNG</text>
                  </g>
                </svg>
              </div>
            </div>
          </main>

          <aside className="border-t border-[#d2d9e0] bg-white p-4 xl:border-l xl:border-t-0">
            <div className="cc-label">Propriedades</div>
            <h3 className="mt-2 text-[18px] font-bold text-[#111827]">{selectedData.tag || selectedItem?.label || 'Item selecionado'}</h3>
            <div className="mt-2 inline-flex items-center gap-2 border border-[#d2d9e0] px-2 py-1 text-[12px] font-bold" style={{ color: statusMeta(selectedItem?.status).color, backgroundColor: statusMeta(selectedItem?.status).bg }}>
              {statusMeta(selectedItem?.status).label}
            </div>
            <div className="mt-4">
              <Field label="Tipo" value={selectedItem?.type || (selectedEdge ? 'Conexão' : 'N/D')} />
              <Field label="Descrição" value={selectedData.descricao || selectedItem?.label} />
              <Field label="Tensão" value={selectedData.tensao} />
              <Field label="Corrente" value={selectedData.corrente} />
              <Field label="Potência" value={selectedData.potencia} />
              <Field label="Cabo" value={selectedData.cabo} />
              <Field label="Disjuntor / Proteção" value={selectedData.disjuntor} />
              <Field label="Queda de tensão" value={selectedData.queda} />
              <Field label="Circuito vinculado" value={selectedData.linkedCircuitId} />
            </div>
            <div className="mt-4 border border-[#d2d9e0] bg-[#fbfcfd] p-3">
              <div className="text-[12px] font-bold uppercase tracking-normal text-[#64748b]">Pendências</div>
              <p className="mt-2 text-[14px] text-[#334155]">{selectedData.pendencias || 'Sem pendência registrada para este item.'}</p>
            </div>
          </aside>
        </div>
      </div>

      <Alert variant="info" title="MVP do editor visual">
        Esta etapa implementa visualização interativa com dados existentes. Inserção manual, arrastar nós e persistência do layout ficam preparados para a próxima fase, sem duplicar circuitos nem alterar cálculos.
      </Alert>
    </div>
  )
}
