import { Alert, Card, CardBody, SectionHeader, StatusBadge } from '../ui'
import { useMemo, useRef, useState } from 'react'
import { Download, Minus, Plus, Network, Info } from 'lucide-react'
import toast from 'react-hot-toast'

function parseDados(valor) {
  if (!valor) return {}
  if (typeof valor === 'object') return valor
  try { return JSON.parse(valor) } catch { return {} }
}

function valor(v, sufixo = '', casas = 2) {
  if (v === null || v === undefined || v === '') return 'N/D'
  const numero = Number(v)
  if (Number.isNaN(numero)) return String(v)
  const texto = Number.isInteger(numero) ? String(numero) : numero.toFixed(casas)
  return `${texto}${sufixo}`
}

function normalizarStatus(status) {
  const texto = String(status || '').trim().toUpperCase()
  if (!texto) return 'N/D'
  if (texto === 'OK') return 'OK'
  if (texto.includes('ALERTA')) return 'ALERTA'
  if (texto.includes('CR')) return 'CRITICO'
  return texto
}

function getStatusColors(status) {
  const texto = normalizarStatus(status);
  if (texto === 'OK') return { bg: '#dcfce7', text: '#166534' }
  if (texto === 'ALERTA') return { bg: '#fef3c7', text: '#92400e' }
  if (texto === 'CRITICO') return { bg: '#fee2e2', text: '#b91c1c' }
  return { bg: '#f1f5f9', text: '#475569' }
}

function wrapText(text, maxLen) {
  if (!text) return ['N/D']
  if (text.length <= maxLen) return [text];
  const words = text.split(' ');
  const lines = [];
  let current = '';
  words.forEach(w => {
    if ((current + ' ' + w).length > maxLen) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = current ? current + ' ' + w : w;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export default function DiagramaUnifilar({ projeto, circuitos = [] }) {
  const svgRef = useRef(null)
  const [zoom, setZoom] = useState(1)

  const diagrama = useMemo(() => {
    const transformador = parseDados(projeto?.transformador_dados)
    
    // Tratamento robusto para protecao geral (pode vir aninhada em .geral ou .disjuntor_geral)
    let pRaw = parseDados(projeto?.protecao_geral_dados);
    let protecaoGeral = pRaw?.geral || pRaw?.disjuntor_geral || pRaw || {};
    
    const tensaoSecundaria = transformador.tensao_secundaria || projeto?.tensao_ref

    return {
      entrada: {
        tensao: valor(projeto?.tensao_ref, 'V', 0),
        contexto: projeto?.contexto || 'Rede Concessionária',
      },
      transformador: {
        potencia: valor(transformador.potencia_kva, 'kVA', 1),
        primSec: `${transformador.tensao_primaria_formatada || valor(transformador.tensao_primaria, 'V', 0)} / ${transformador.tensao_secundaria_formatada || valor(tensaoSecundaria, 'V', 0)}`,
        icc: valor(transformador.corrente_curto_secundario_ka, 'kA', 2),
      },
      barramento: {
        tensao: valor(tensaoSecundaria, 'V', 0),
      },
      disjuntorGeral: {
        in: valor(protecaoGeral.in || protecaoGeral.In || protecaoGeral.corrente_nominal, 'A', 0),
        icu: valor(protecaoGeral.icu || protecaoGeral.Icu || protecaoGeral.capacidade_interrupcao, 'kA', 1),
        curva: protecaoGeral.curva || protecaoGeral.curve || 'N/D',
        status: normalizarStatus(protecaoGeral.status),
      },
      circuitos: circuitos.map((circ, index) => {
        const corrente = circ.disjuntor_sugerido_in || circ.disjuntor_corrente_nominal || circ.disjuntor_a;
        const icu = circ.disjuntor_sugerido_icu || circ.disjuntor_icu;
        const curva = circ.disjuntor_sugerido_curva || circ.disjuntor_curva;
        const djStr = `${valor(corrente, 'A', 0)} / ${valor(icu, 'kA', 1)}${curva ? ` / ${curva}` : ''}`;
        
        const caboStr = circ.cabo_sugerido_tipo_comercial || circ.tipo_cabo_comercial || (circ.secao_mm2 ? `#${valor(circ.secao_mm2, 'mm2', 0)}` : 'N/D');
        
        const st = circ.status_final || circ.status || 'N/D';
        const colors = getStatusColors(st);

        return {
          id: circ.id || `circ-${index}`,
          nome: circ.tag || circ.descricao || `Circuito ${index + 1}`,
          potencia: circ.potencia_kw != null ? valor(circ.potencia_kw, ' kW', 1) : 'N/D',
          ib: valor(circ.corrente_projeto || circ.corrente_nominal, 'A', 1),
          cabo: caboStr,
          comprimento: valor(circ.comprimento, 'm', 0),
          disjuntor: djStr,
          icc: valor(circ.isc_local, 'kA', 2),
          statusLabel: normalizarStatus(st),
          statusColor: colors.text,
          statusColorBg: colors.bg,
        }
      })
    }
  }, [projeto, circuitos])

  // --- LAYOUT CONSTANTS EPLAN-STYLE ---
  const SPACING = 140;
  const totalCircuitsWidth = Math.max(1, diagrama.circuitos.length) * SPACING;
  const busbarWidth = Math.max(800, totalCircuitsWidth + 100);
  const canvasWidth = busbarWidth + 400;
  const canvasHeight = 1150;
  const centerX = canvasWidth / 2;
  const startX = centerX - ((diagrama.circuitos.length - 1) * SPACING) / 2;
  
  const leftBoundary = centerX - busbarWidth/2;
  const rightBoundary = centerX + busbarWidth/2;
  const tableStartX = leftBoundary - 180;
  const tableEndX = rightBoundary + 80;
  
  const tableRows = [
    { id: 'carga', label: 'TAG / DESCRIÇÃO', height: 60 },
    { id: 'pot', label: 'POTÊNCIA / IB', height: 45 },
    { id: 'cab', label: 'CABO / L (m)', height: 45 },
    { id: 'dj', label: 'DISJ. (In / Icu)', height: 45 },
    { id: 'st', label: 'STATUS', height: 40 },
  ]
  let currentY = 700;
  const tableYCoords = tableRows.map(r => { const y = currentY; currentY += r.height; return { ...r, y } });
  const tableBottomY = currentY;

  function svgSerializado() {
    if (!svgRef.current) return null
    const serializer = new XMLSerializer()
    const conteudo = serializer.serializeToString(svgRef.current)
    return `<?xml version="1.0" encoding="UTF-8"?>\n${conteudo}`
  }

  function exportarSvg() {
    const conteudo = svgSerializado()
    if (!conteudo) return
    const blob = new Blob([conteudo], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `diagrama_unifilar_${projeto?.id || 'projeto'}.svg`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportarPng() {
    try {
      const conteudo = svgSerializado()
      if (!conteudo) return
      const blob = new Blob([conteudo], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const imagem = new Image()
      imagem.onload = () => {
        const escala = 2
        const canvas = document.createElement('canvas')
        canvas.width = canvasWidth * escala
        canvas.height = canvasHeight * escala
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.scale(escala, escala)
        ctx.drawImage(imagem, 0, 0)
        URL.revokeObjectURL(url)
        const link = document.createElement('a')
        link.download = `diagrama_unifilar_${projeto?.id || 'projeto'}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      imagem.onerror = () => {
        URL.revokeObjectURL(url)
        toast.error('Erro ao exportar imagem')
      }
      imagem.src = url
    } catch {
      toast.error('Erro ao exportar imagem')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <SectionHeader
              title="Diagrama Unifilar Profissional"
              description="Visualização técnica CAD-Style padrão EPLAN gerada automaticamente."
            />
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(1))))} className="btn btn-secondary px-2 py-1" title="Reduzir zoom">
                <Minus size={14} />
              </button>
              <div className="w-14 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-medium text-slate-600">{Math.round(zoom * 100)}%</div>
              <button onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(1))))} className="btn btn-secondary px-2 py-1" title="Aumentar zoom">
                <Plus size={14} />
              </button>
              <button onClick={exportarSvg} className="btn btn-secondary flex items-center gap-2 text-xs">
                <Download size={14} />SVG
              </button>
              <button onClick={exportarPng} className="btn btn-primary flex items-center gap-2 text-xs">
                <Download size={14} />PNG
              </button>
            </div>
          </div>
        </div>
        <CardBody className="space-y-4">
          <Alert variant="info" icon={Info} title="Diagrama padrão EPLAN">
            Este diagrama adota a simbologia internacional IEC e tabelas de carga alinhadas, ideal para plotagem profissional e exportação para pranchas técnicas.
          </Alert>
        </CardBody>
      </Card>

      <div 
        className="overflow-auto rounded-xl border border-slate-300 shadow-inner bg-slate-100 p-6" 
        style={{ maxHeight: '75vh' }}
      >
        <div 
          className="relative mx-auto bg-white shadow-xl border border-slate-300 overflow-hidden"
          style={{ 
            width: canvasWidth * zoom, 
            height: canvasHeight * zoom,
          }}
        >
          <svg 
            ref={svgRef} 
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} 
            width="100%" 
            height="100%" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            <rect width={canvasWidth} height={canvasHeight} fill="#ffffff" />
            
            {/* Grid Pattern Background */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Borders */}
            <rect x={20} y={20} width={canvasWidth - 40} height={canvasHeight - 40} fill="none" stroke="#0f172a" strokeWidth={3}/>
            <rect x={25} y={25} width={canvasWidth - 50} height={canvasHeight - 50} fill="none" stroke="#0f172a" strokeWidth={1}/>

            {/* --- COMPONENTES PRINCIPAIS --- */}
            
            {/* Rede */}
            <g transform={`translate(${centerX}, 80)`}>
              <polygon points="-25,-15 25,-15 0,20" fill="#f8fafc" stroke="#0f172a" strokeWidth={2}/>
              <text x={40} y={-5} fontSize={14} fontWeight="bold" fill="#0f172a">REDE ELÉTRICA</text>
              <text x={40} y={12} fontSize={12} fill="#475569">{diagrama.entrada.contexto} - {diagrama.entrada.tensao}</text>
            </g>
            <line x1={centerX} y1={100} x2={centerX} y2={200} stroke="#0f172a" strokeWidth={2}/>

            {/* Trafo */}
            <g transform={`translate(${centerX}, 240)`}>
              <circle cx={0} cy={-18} r={22} fill="#ffffff" stroke="#0f172a" strokeWidth={2}/>
              <circle cx={0} cy={18} r={22} fill="#ffffff" stroke="#0f172a" strokeWidth={2}/>
              {/* Delta */}
              <polygon points="0,-28 -8,-10 8,-10" fill="none" stroke="#0f172a" strokeWidth={1.5}/>
              {/* Star */}
              <path d="M 0,18 L 0,8 M 0,18 L -8,25 M 0,18 L 8,25" stroke="#0f172a" strokeWidth={1.5}/>
              
              <text x={45} y={-15} fontSize={14} fontWeight="bold" fill="#0f172a">TRANSFORMADOR</text>
              <text x={45} y={2} fontSize={12} fill="#475569">{diagrama.transformador.potencia}</text>
              <text x={45} y={17} fontSize={12} fill="#475569">{diagrama.transformador.primSec}</text>
              <text x={45} y={32} fontSize={12} fill="#475569">Icc sec: {diagrama.transformador.icc}</text>
            </g>
            <line x1={centerX} y1={280} x2={centerX} y2={370} stroke="#0f172a" strokeWidth={2}/>

            {/* DJ Geral */}
            <g transform={`translate(${centerX}, 400)`}>
              <rect x={-15} y={-30} width={30} height={60} fill="#ffffff" stroke="#0f172a" strokeWidth={2}/>
              <path d="M -10,-20 L 10,20 M 10,-20 L -10,20" stroke="#0f172a" strokeWidth={1.5}/>
              <text x={45} y={-10} fontSize={14} fontWeight="bold" fill="#0f172a">DISJUNTOR GERAL</text>
              <text x={45} y={6} fontSize={12} fill="#475569">In: {diagrama.disjuntorGeral.in} / Icu: {diagrama.disjuntorGeral.icu}</text>
              <text x={45} y={22} fontSize={12} fill="#475569">Curva: {diagrama.disjuntorGeral.curva}</text>
            </g>
            <line x1={centerX} y1={430} x2={centerX} y2={530} stroke="#0f172a" strokeWidth={2}/>
            <circle cx={centerX} cy={530} r={5} fill="#0f172a" />

            {/* Barramento */}
            <line x1={leftBoundary} y1={530} x2={rightBoundary} y2={530} stroke="#0f172a" strokeWidth={8} strokeLinecap="round"/>
            <text x={leftBoundary} y={515} fontSize={16} fontWeight="bold" fill="#0f172a">BARRAMENTO PRINCIPAL - {diagrama.barramento.tensao}</text>

            {/* --- TABELA DE CARGAS --- */}
            {/* Borda Externa Tabela Header */}
            <rect x={tableStartX} y={700} width={tableEndX - tableStartX} height={tableBottomY - 700} fill="none" stroke="#0f172a" strokeWidth={2}/>
            
            {/* Linhas Horizontais da Tabela */}
            {tableYCoords.map(row => (
              <g key={row.id}>
                {row.y > 700 && <line x1={tableStartX} y1={row.y} x2={tableEndX} y2={row.y} stroke="#0f172a" strokeWidth={1}/>}
                <rect x={tableStartX} y={row.y} width={180} height={row.height} fill="#f8fafc" />
                <text x={tableStartX + 15} y={row.y + row.height/2 + 4} fontSize={11} fontWeight="bold" fill="#334155">{row.label}</text>
              </g>
            ))}
            {/* Linha Vertical Separa Header */}
            <line x1={tableStartX + 180} y1={700} x2={tableStartX + 180} y2={tableBottomY} stroke="#0f172a" strokeWidth={2}/>

            {/* --- CIRCUITOS / RAMAIS --- */}
            {diagrama.circuitos.length === 0 && (
               <text x={centerX} y={600} fontSize={14} fill="#64748b" fontStyle="italic" textAnchor="middle">Nenhum circuito cadastrado.</text>
            )}

            {diagrama.circuitos.map((circ, i) => {
              const cx = startX + i * SPACING;
              return (
                <g key={circ.id}>
                  {/* Conexão Barramento */}
                  <circle cx={cx} cy={530} r={4} fill="#0f172a" />
                  <line x1={cx} y1={530} x2={cx} y2={590} stroke="#0f172a" strokeWidth={2}/>
                  
                  {/* Disjuntor Ramal */}
                  <g transform={`translate(${cx}, 610)`}>
                    <rect x={-10} y={-20} width={20} height={40} fill="#ffffff" stroke="#0f172a" strokeWidth={2}/>
                    <path d="M -6,-12 L 6,12 M 6,-12 L -6,12" stroke="#0f172a" strokeWidth={1.5}/>
                  </g>
                  
                  {/* Linha de descida para Tabela */}
                  <line x1={cx} y1={630} x2={cx} y2={700} stroke="#0f172a" strokeWidth={2}/>
                  <polygon points={`${cx-5},690 ${cx+5},690 ${cx},700`} fill="#0f172a" />

                  {/* Linha Vertical Grid Tabela */}
                  {i > 0 && <line x1={cx - SPACING/2} y1={700} x2={cx - SPACING/2} y2={tableBottomY} stroke="#cbd5e1" strokeWidth={1}/>}
                  
                  {/* Coluna da Tabela (Dados) */}
                  <g transform={`translate(${cx}, 0)`}>
                    {/* CARGA */}
                    {wrapText(circ.nome, 20).map((linha, idx, arr) => (
                        <text 
                          key={idx} 
                          x={0} 
                          y={700 + 30 - ((arr.length - 1) * 7) + (idx * 14)} 
                          textAnchor="middle" 
                          fontSize={11} 
                          fontWeight="bold" 
                          fill="#0f172a"
                        >
                          {linha}
                        </text>
                    ))}
                    
                    {/* POTÊNCIA */}
                    <text x={0} y={760 + 16} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#0f172a">{circ.potencia}</text>
                    <text x={0} y={760 + 30} textAnchor="middle" fontSize={10} fill="#475569">Ib: {circ.ib}</text>
                    
                    {/* CABO */}
                    <text x={0} y={805 + 16} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#0f172a">{circ.cabo}</text>
                    <text x={0} y={805 + 30} textAnchor="middle" fontSize={10} fill="#475569">L: {circ.comprimento}</text>
                    
                    {/* DISJUNTOR */}
                    <text x={0} y={850 + 16} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#0f172a">{circ.disjuntor.split('/')[0]}</text>
                    <text x={0} y={850 + 30} textAnchor="middle" fontSize={10} fill="#475569">{circ.disjuntor.split('/').slice(1).join('/') || '—'}</text>
                    
                    {/* STATUS */}
                    <rect x={-35} y={895 + 10} width={70} height={20} rx={4} fill={circ.statusColorBg} />
                    <text x={0} y={895 + 24} textAnchor="middle" fontSize={10} fontWeight="bold" fill={circ.statusColor}>{circ.statusLabel}</text>
                  </g>
                </g>
              )
            })}
            
            {/* Fechamento Linha Grid Direita (última coluna) se houver circuitos */}
            {diagrama.circuitos.length > 0 && (
              <line 
                x1={startX + (diagrama.circuitos.length - 1)*SPACING + SPACING/2} 
                y1={700} 
                x2={startX + (diagrama.circuitos.length - 1)*SPACING + SPACING/2} 
                y2={tableBottomY} 
                stroke="#cbd5e1" 
                strokeWidth={1}
              />
            )}

            {/* --- SELO DO PROJETO (TITLE BLOCK) --- */}
            <g transform={`translate(${canvasWidth - 360}, ${canvasHeight - 160})`}>
              <rect x={0} y={0} width={330} height={130} fill="#ffffff" stroke="#0f172a" strokeWidth={2}/>
              <line x1={0} y1={40} x2={330} y2={40} stroke="#0f172a" strokeWidth={1}/>
              <line x1={0} y1={85} x2={330} y2={85} stroke="#0f172a" strokeWidth={1}/>
              
              <text x={15} y={26} fontSize={18} fontWeight="bold" fill="#0f172a">CalcCabos Engenharia</text>
              <text x={230} y={24} fontSize={10} fill="#64748b">DIAGRAMA UNIFILAR</text>
              
              <text x={15} y={58} fontSize={10} fill="#475569">PROJETO:</text>
              <text x={15} y={74} fontSize={13} fontWeight="bold" fill="#0f172a">{projeto?.nome || 'N/D'}</text>
              
              <text x={15} y={104} fontSize={10} fill="#475569">TENSÃO DE OPERAÇÃO:</text>
              <text x={15} y={120} fontSize={12} fontWeight="bold" fill="#0f172a">{diagrama.barramento.tensao}</text>
              
              <line x1={200} y1={85} x2={200} y2={130} stroke="#0f172a" strokeWidth={1}/>
              <text x={215} y={104} fontSize={10} fill="#475569">DATA EMISSÃO:</text>
              <text x={215} y={120} fontSize={12} fontWeight="bold" fill="#0f172a">{new Date().toLocaleDateString('pt-BR')}</text>
            </g>

          </svg>
        </div>
      </div>
    </div>
  )
}
