import { CircuitTable } from '../components/projeto/CircuitTable';
import { CircuitModal } from '../components/projeto/CircuitModal';
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bot, Calculator, Send, Trash2, Save, Search, HelpCircle, AlertCircle, Info, AlertTriangle, Sparkles } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'
import AterramentoProjeto from '../components/projeto/AterramentoProjeto'
import AreasClassificadasProjeto from '../components/projeto/AreasClassificadasProjeto'
import DiagramaUnifilar from '../components/projeto/DiagramaUnifilar'
import ParaRaiosProjeto from '../components/projeto/ParaRaiosProjeto'
import ProtecoesProjeto from '../components/projeto/ProtecoesProjeto'
import MemorialProjeto from '../components/projeto/MemorialProjeto'
import ProjetoTabs from '../components/projeto/ProjetoTabs'
import ProjectWorkspaceHeader from '../components/projeto/ProjectWorkspaceHeader'
import SistemaTrifasico from '../components/projeto/SistemaTrifasico'
import TransformadorEntrada from '../components/projeto/TransformadorEntrada'
import VisaoGeralProjeto from '../components/projeto/VisaoGeralProjeto'
import { buildProjectHealth } from '../components/projeto/projectHealth'
import RevisaoTecnicaProjeto from '../components/projeto/RevisaoTecnicaProjeto'
import ExportacoesProjeto from '../components/projeto/ExportacoesProjeto'
import CircuitosToolbar from '../components/projeto/CircuitosToolbar'
import FloatingAssistant from '../components/assistant/FloatingAssistant'
import { LoadingState, EmptyState, StatusBadge, Card, SectionHeader, Tooltip, Alert } from '../components/ui'
import { ProtecaoMTATSection } from '../components/projeto/ProtecaoMTATSection'
import ExcelImportWizard from '../components/projeto/importer/ExcelImportWizard'

const TIPOS = ['CU-PVC', 'CU-XLPE', 'AL-PVC', 'AL-XLPE']
const TENSOES = [
  { label: '127/220 V', value: 220, unit: 'V', reference: 'fase_fase' },
  { label: '220/380 V', value: 380, unit: 'V', reference: 'fase_fase' },
  { label: '380/660 V', value: 660, unit: 'V', reference: 'fase_fase' },
  { label: '440 V', value: 440, unit: 'V', reference: 'fase_fase' },
  { label: '690 V', value: 690, unit: 'V', reference: 'fase_fase' },
  { label: '2,3 kV', value: 2.3, unit: 'kV', reference: 'fase_fase' },
  { label: '4,16 kV', value: 4.16, unit: 'kV', reference: 'fase_fase' },
  { label: '6,6 kV', value: 6.6, unit: 'kV', reference: 'fase_fase' },
  { label: '11 kV', value: 11, unit: 'kV', reference: 'fase_fase' },
  { label: '13,8 kV', value: 13.8, unit: 'kV', reference: 'fase_fase' },
  { label: '23 kV', value: 23, unit: 'kV', reference: 'fase_fase' },
  { label: '34,5 kV', value: 34.5, unit: 'kV', reference: 'fase_fase' },
  { label: '69 kV', value: 69, unit: 'kV', reference: 'fase_fase' },
  { label: '88 kV', value: 88, unit: 'kV', reference: 'fase_fase' },
  { label: '138 kV', value: 138, unit: 'kV', reference: 'fase_fase' },
  { label: '230 kV', value: 230, unit: 'kV', reference: 'fase_fase' },
  { label: '345 kV', value: 345, unit: 'kV', reference: 'fase_fase' },
  { label: '500 kV', value: 500, unit: 'kV', reference: 'fase_fase' },
  { label: '765 kV', value: 765, unit: 'kV', reference: 'fase_fase' },
]
const DISPOSITIVOS = ['MCCB', 'ACB', 'Fuse', 'DJ']
const CURVAS_DISJUNTOR = ['B', 'C', 'D', 'MA', 'L', 'S', 'I']
const METODOS = [
  ['TRAY', 'Bandejamento'],
  ['CONDUIT', 'Eletroduto'],
  ['DIRECT', 'Enterrado'],
  ['AIR', 'Ar livre'],
]
const STATUS_COR = {
  OK: 'bg-success-50 text-success-700',
  ALERTA: 'bg-warning-50 text-warning-700',
  CRITICO: 'bg-danger-50 text-danger-700',
  'NÃO CALCULADO': 'bg-gray-100 text-gray-500',
}

const PROTECAO_COR = {
  OK: 'text-success-700',
  ALERTA: 'text-warning-700',
  CRITICO: 'text-danger-700',
}

const C_VAZIO = {
  descricao: '',
  tag: '',
  from_barramento: '',
  to_equipamento: '',
  protection_device: 'MCCB',
  modo_dimensionamento: 'manual',
  modo_selecao_componentes: 'manual',
  disjuntor_tensao_nominal: '',
  disjuntor_corrente_nominal: '',
  disjuntor_icu: '',
  disjuntor_curva: 'C',
  disjuntor_fabricante: '',
  corrente_ac_dc: 'AC',
  tensao: 380,
  tensao_unidade: 'V',
  tipo_sistema_tensao: 'AC',
  referencia_tensao: 'fase_fase',
  referencia_tensao_dc: 'polo_polo',
  contexto_aplicacao: 'industrial',
  potencia_kw: 0,
  potencia_kva: '',
  usar_kva_informado: false,
  fator_potencia: 0.85,
  fator_eficiencia: 1,
  fator_demanda: 1,
  distancia_m: 0,
  comprimento_real: '',
  tipo_cabo: 'CU-PVC',
  temp_ambiente: 30,
  fases: 3,
  agrupamento: 1,
  metodo_instalacao: 'TRAY',
  formacao: 1,
  isc_local: '',
  tempo_atuacao: 0.1,
  queda_tensao_alimentador: 0,
  revisao: '0',
  nota_tecnica: '',
  ordem: 0,
  // MT/AT fields
  classe_tensao_kv: '',
  nbi_kv: '',
  tafi_ka: '',
  sequencia_operacao: '',
  meio_extincao: '',
  tipo_acionamento: '',
  modelo: '',
  norma_referencia: '',
  acessorios: null,
}

const DEMO_PROJECT_ID = 'demo-interno'

const DEMO_PROJECT = {
  id: DEMO_PROJECT_ID,
  _id: DEMO_PROJECT_ID,
  nome: 'Edifício Comercial Aurora',
  cliente: 'Aurora Engenharia',
  contexto: 'Comercial',
  uf: 'SP',
  cidade: 'Campinas',
  concessionaria: 'CPFL Paulista',
  tensao_ref: 380,
  revisao: '03',
  responsavel_tecnico: 'Eng. Gustavo H.',
  descricao: 'Projeto demonstrativo local para validação visual do conceito interno.',
  transformador_dados: JSON.stringify({ potencia_kva: 150, tensao_primaria: 13800, tensao_secundaria: 380 }),
  protecao_geral_dados: JSON.stringify({ in: 250, icu: 25, curva: 'C' }),
}

const DEMO_CIRCUITS = [
  { id: 'demo-c01', tag: 'C-01', descricao: 'Iluminação térreo', from_barramento: 'QD-01', ambiente: 'Térreo', tipo_carga: 'Iluminação', potencia: 1.1, tensao: 220, fases: 1, corrente: 2.5, secao: 2.5, queda: 2.1, protecao: 'DJ 10 A', status: 'OK' },
  { id: 'demo-c02', tag: 'C-02', descricao: 'TUG térreo', from_barramento: 'QD-01', ambiente: 'Térreo', tipo_carga: 'Tomadas', potencia: 1.1, tensao: 220, fases: 1, corrente: 2.5, secao: 2.5, queda: 2.0, protecao: 'DJ 10 A', status: 'OK' },
  { id: 'demo-c12', tag: 'C-12', descricao: 'Motor CCM-02', from_barramento: 'QF-BMB', ambiente: 'Bombas', tipo_carga: 'Motor', potencia: 10, tensao: 380, fases: 3, corrente: 27.4, secao: 10, queda: 4.8, protecao: 'DJ 40 A', status: 'CRITICO', validacao_mensagem: 'Queda acima do critério adotado.' },
  { id: 'demo-c21', tag: 'C-21', descricao: 'Bomba principal', from_barramento: 'QF-BMB', ambiente: 'Bombas', tipo_carga: 'Motor', potencia: 7.5, tensao: 380, fases: 3, corrente: 18, secao: 6, queda: 3.2, protecao: 'DJ 32 A', status: 'OK' },
  { id: 'demo-c29', tag: 'C-29', descricao: 'Reserva técnica', from_barramento: 'QT1', ambiente: 'Subestação', tipo_carga: 'Reserva', potencia: 1.32, tensao: 220, fases: 1, corrente: 8, secao: 2.5, queda: 3.9, protecao: 'DJ 16 A', status: 'ALERTA' },
  { id: 'demo-c30', tag: 'C-30', descricao: 'Reserva futura', from_barramento: 'RES-01', ambiente: 'Reserva', tipo_carga: 'Reserva', potencia: null, tensao: 220, fases: 1, corrente: null, secao: null, queda: null, protecao: 'Pendente', status: 'PENDENTE' },
]

const DEMO_MODULE_LABELS = {
  transformador: 'Entrada',
  protecoes: 'Proteções',
  'diagrama-unifilar': 'Unifilar',
  aterramento: 'Aterramento',
  'para-raios': 'Para-raios',
  'areas-classificadas': 'Áreas Classificadas',
  memorial: 'Memorial',
  exportacoes: 'Relatórios',
}

function DemoModulePlaceholder({ aba }) {
  const label = DEMO_MODULE_LABELS[aba] || 'Módulo técnico'
  return (
    <section className="cc-panel p-6">
      <div className="cc-label">DEMONSTRATIVO LOCAL</div>
      <h1 className="cc-title mt-2">{label}</h1>
      <p className="cc-subtitle mt-2 max-w-2xl">
        Este módulo está visível na navegação para validar o shell técnico aprovado. No demonstrativo local,
        apenas Visão Geral e Circuitos estão conectados para evitar chamadas ao backend.
      </p>
      <div className="mt-6 grid gap-3 text-sm md:grid-cols-3">
        <div className="border border-[#d2d9e0] bg-[#fbfcfd] p-3">
          <div className="cc-label">Status</div>
          <div className="mt-2 font-bold text-[#121820]">Aguardando etapa de implementação</div>
        </div>
        <div className="border border-[#d2d9e0] bg-[#fbfcfd] p-3">
          <div className="cc-label">Escopo atual</div>
          <div className="mt-2 font-bold text-[#121820]">Shell, Visão Geral e Circuitos</div>
        </div>
        <div className="border border-[#d2d9e0] bg-[#fbfcfd] p-3">
          <div className="cc-label">Backend</div>
          <div className="mt-2 font-bold text-[#121820]">Sem chamadas nesta rota demo</div>
        </div>
      </div>
    </section>
  )
}

const NUMERIC_REQUIRED = ['tensao', 'potencia_kw', 'fator_potencia', 'fator_eficiencia', 'fator_demanda', 'distancia_m', 'temp_ambiente', 'queda_tensao_alimentador']
const NUMERIC_OPTIONAL = ['potencia_kva', 'comprimento_real', 'isc_local', 'tempo_atuacao', 'disjuntor_tensao_nominal', 'disjuntor_corrente_nominal', 'disjuntor_icu', 'classe_tensao_kv', 'nbi_kv', 'tafi_ka']
const INTEGER_FIELDS = ['fases', 'agrupamento', 'formacao', 'ordem']

const REPAROS_TEXTO = [
  ['Consist?ncia', 'Consistência'],
  ['consist?ncia', 'consistência'],
  ['subesta??o', 'subestação'],
  ['Subesta??o', 'Subestação'],
  ['Medi??es', 'Medições'],
  ['medi??es', 'medições'],
  ['N?OAPLIC?VEL', 'NÃO APLICÁVEL'],
  ['N?O APLIC?VEL', 'NÃO APLICÁVEL'],
  ['n?o aplic?vel', 'não aplicável'],
  ['Respons?vel', 'Responsável'],
  ['respons?vel', 'responsável'],
  ['Eng. Respons?vel', 'Eng. Responsável'],
  ['Engenheiro respons?vel', 'Engenheiro responsável'],
  ['Descri??o', 'Descrição'],
  ['descri??o', 'descrição'],
  ['Observa??es', 'Observações'],
  ['observa??es', 'observações'],
]

function limparTexto(valor, padrao = '-') {
  if (valor === null || valor === undefined || valor === '') return padrao
  let texto = String(valor)
  REPAROS_TEXTO.forEach(([origem, destino]) => {
    texto = texto.replaceAll(origem, destino)
  })
  return texto.replace(/([A-Za-zÀ-ÿ0-9])\?+([A-Za-zÀ-ÿ0-9])/g, '$1$2')
}

function normalizarStatus(status, padrao = 'ALERTA') {
  const texto = String(status || '').trim().toUpperCase()
  if (!texto) return padrao
  if (texto === 'OK') return 'OK'
  if (texto.includes('ALERTA')) return 'ALERTA'
  if (texto.includes('CR')) return 'CRITICO'
  if (texto.includes('PENDENTE') || texto.includes('NAO_AVALIADO') || texto.includes('NÃO AVALIADO')) return 'PENDENTE'
  return padrao
}

function statusLabel(status) {
  const normalizado = normalizarStatus(status)
  return normalizado === 'CRITICO' ? 'CRÍTICO' : normalizado
}

function statusFinal(c) {
  if (c.status_final) return normalizarStatus(c.status_final)
  const status = String(c.status || '').trim().toUpperCase()
  if (status === 'OK') return 'OK'
  if (status === 'ERRO' || status === 'CRITICO' || status === 'CRÍTICO' || status === 'BLOQUEADO') return 'CRITICO'
  if (status === 'ALERTA') return 'ALERTA'
  if (status === 'PENDENTE' || status === 'NAO_AVALIADO' || status === 'NÃO AVALIADO') return 'PENDENTE'
  return 'ALERTA'
}

function fmt(valor, sufixo = '', casas = 2) {
  if (valor === null || valor === undefined || valor === '') return '-'
  const numero = Number(valor)
  if (Number.isNaN(numero)) return valor
  const texto = Number.isInteger(numero) ? String(numero) : numero.toFixed(casas)
  return `${texto}${sufixo}`
}

function tipoCabo(tipo) {
  const semAcento = String(tipo || 'CU-PVC')
    .split('.').pop()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[_\-\/]+/g, ' ')
  const tokens = semAcento.split(/\s+/).filter(Boolean)
  const junto = tokens.join('')
  let condutor = tokens.includes('AL') || tokens.includes('ALUMINIO') || junto.includes('ALUMINIO') ? 'AL' : 'CU'
  if (tokens.includes('CU') || tokens.includes('COBRE')) condutor = 'CU'
  const isolacao = tokens.includes('XLPE') || junto.includes('XLPE') ? 'XLPE' : 'PVC'
  return `${condutor}-${isolacao}`
}

function parseDados(valor) {
  if (!valor) return null
  if (typeof valor === 'object') return valor
  try { return JSON.parse(valor) } catch { return {} }
}

function parseProjetoJson(valor) {
  if (!valor) return {}
  if (typeof valor === 'object') return valor
  try { return JSON.parse(valor) } catch { return {} }
}

const AGENTE_TIMEOUT_MS = 180000
const EXPORT_TIMEOUT_MS = 180000
const CALCULO_TIMEOUT_MS = 180000

function circuitoVazioProjeto(projeto) {
  const transformador = parseProjetoJson(projeto?.transformador_dados)
  return {
    ...C_VAZIO,
    tensao: transformador.tensao_secundaria || projeto?.tensao_ref || C_VAZIO.tensao,
    tensao_unidade: 'V',
    tipo_sistema_tensao: 'AC',
    referencia_tensao: 'fase_fase',
    contexto_aplicacao: String(projeto?.contexto || C_VAZIO.contexto_aplicacao || 'industrial').toLowerCase(),
    isc_local: transformador.corrente_curto_secundario_ka || '',
  }
}

function normalizarPayload(c, projetoId) {
  const CAMPOS_EDITAVEIS_CIRCUITO = [
    'ordem', 'descricao', 'tensao', 'tensao_unidade', 'tipo_sistema_tensao', 'referencia_tensao',
    'referencia_tensao_dc', 'contexto_aplicacao', 'potencia_kw', 'potencia_kva', 'fator_potencia', 'distancia_m',
    'tipo_cabo', 'temp_ambiente', 'fases', 'agrupamento', 'corrente_ac_dc', 'fator_demanda',
    'fator_eficiencia', 'metodo_instalacao', 'formacao', 'comprimento_real', 'queda_tensao_alimentador',
    'isc_local', 'usar_kva_informado', 'configuracao_eletrica', 'referencia_tensao', 'modo_entrada',
    'base_potencia', 'corrente_informada', 'aplicacao_circuito', 'secao_minima_aplicacao',
    'secao_minima_mecanica', 'queda_tensao_limite', 'tag', 'from_barramento', 'to_equipamento',
    'protection_device', 'modo_dimensionamento', 'modo_selecao_componentes', 'disjuntor_tensao_nominal',
    'disjuntor_corrente_nominal', 'disjuntor_icu', 'disjuntor_curva', 'disjuntor_fabricante',
    'classe_tensao_kv', 'nbi_kv', 'tafi_ka', 'sequencia_operacao', 'meio_extincao', 'tipo_acionamento',
    'acessorios', 'modelo', 'norma_referencia',
  ]
  const payload = { projeto_id: projetoId }
  CAMPOS_EDITAVEIS_CIRCUITO.forEach((campo) => {
    if (c[campo] !== undefined) payload[campo] = c[campo]
  })
  NUMERIC_REQUIRED.forEach((campo) => {
    const valor = payload[campo]
    payload[campo] = valor === '' || valor === null || valor === undefined ? 0 : Number(valor)
  })
  NUMERIC_OPTIONAL.forEach((campo) => {
    const valor = payload[campo]
    payload[campo] = valor === '' || valor === null || valor === undefined ? null : Number(valor)
  })
  INTEGER_FIELDS.forEach((campo) => {
    const valor = payload[campo]
    payload[campo] = valor === '' || valor === null || valor === undefined ? 0 : parseInt(valor, 10)
  })
  const STRING_OPTIONAL = [
    'tensao_unidade', 'tipo_sistema_tensao', 'referencia_tensao', 'referencia_tensao_dc',
    'contexto_aplicacao', 'sequencia_operacao', 'meio_extincao', 'tipo_acionamento',
    'modelo', 'norma_referencia',
  ]
  STRING_OPTIONAL.forEach((campo) => {
    const valor = payload[campo]
    payload[campo] = valor === '' || valor === null || valor === undefined ? null : String(valor)
  })
  payload.fator_eficiencia = payload.fator_eficiencia > 1 ? payload.fator_eficiencia / 100 : payload.fator_eficiencia
  payload.formacao = Math.max(payload.formacao || 1, 1)
  payload.agrupamento = Math.max(payload.agrupamento || 1, 1)
  payload.tensao_unidade = payload.tensao_unidade === 'kV' ? 'kV' : 'V'
  payload.tipo_sistema_tensao = payload.tipo_sistema_tensao === 'DC' || payload.corrente_ac_dc === 'DC' ? 'DC' : 'AC'
  payload.corrente_ac_dc = payload.tipo_sistema_tensao
  if (payload.tipo_sistema_tensao === 'DC') {
    payload.configuracao_eletrica = 'dc'
    payload.fases = 1
    payload.fator_potencia = 1
  }
  if (payload.tipo_sistema_tensao === 'AC' && !payload.referencia_tensao) payload.referencia_tensao = 'fase_fase'
  if (payload.tipo_sistema_tensao === 'DC' && !payload.referencia_tensao_dc) payload.referencia_tensao_dc = 'polo_polo'
  payload.metodo_instalacao = payload.metodo_instalacao || 'TRAY'
  payload.modo_dimensionamento = payload.modo_dimensionamento || payload.modo_selecao_componentes || 'manual'
  payload.modo_selecao_componentes = payload.modo_dimensionamento
  payload.descricao = payload.descricao || payload.tag || 'Circuito sem descrição'
  payload.tipo_cabo = tipoCabo(payload.tipo_cabo)
  payload.usar_kva_informado = Boolean(payload.usar_kva_informado)
  return payload
}

function Campo({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-xs text-slate-600 font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function LabelWithTooltip({ label, tooltip }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      <Tooltip content={tooltip} contentClassName="whitespace-normal max-w-xs text-center p-2 leading-relaxed">
        <HelpCircle size={13} className="text-slate-400 hover:text-slate-600 transition-colors" />
      </Tooltip>
    </span>
  )
}

export default function Projeto() {
  const { id } = useParams()
  const nav = useNavigate()
  const [projeto, setProjeto] = useState(null)
  const [circuitos, setCircuitos] = useState([])
  const [revisoes, setRevisoes] = useState([])
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: 'Olá! Sou o agente de engenharia do CalcCabos. Posso analisar ampacidade, queda de tensão, curto-circuito térmico e critérios Petrobras dos circuitos.' }])
  const [inputMsg, setInputMsg] = useState('')
  const [loadingIA, setLoadingIA] = useState(false)
  const [modalC, setModalC] = useState(null)
  const [agenteAberto, setAgenteAberto] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState('visao-geral')
  const [importModal, setImportModal] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [filtroModo, setFiltroModo] = useState('TODOS')
  const [filtroProtecao, setFiltroProtecao] = useState('TODOS')
  const [filtroQuadro, setFiltroQuadro] = useState('TODOS')
  const [filtroAmbiente, setFiltroAmbiente] = useState('TODOS')
  const [filtroTipoCarga, setFiltroTipoCarga] = useState('TODOS')
  const msgRef = useRef(null)
  let usuario = {}; try { usuario = JSON.parse(localStorage.getItem('usuario') || '{}') } catch { usuario = {} }

  useEffect(() => { carregar() }, [id])
  useEffect(() => { if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight }, [msgs])

  async function carregar() {
    if (id === DEMO_PROJECT_ID) {
      setProjeto(DEMO_PROJECT)
      setCircuitos(DEMO_CIRCUITS)
      setRevisoes([])
      return
    }
    try {
      const [rp, rc, rr] = await Promise.all([
        api.get(`/projetos/${id}`),
        api.get(`/circuitos/projeto/${id}`),
        api.get(`/projetos/${id}/revisoes`).catch(() => ({ data: [] })),
      ])
      setProjeto(rp.data)
      const listaC = Array.isArray(rc.data) ? rc.data : (rc.data?.items || [])
      setCircuitos(listaC)
      setRevisoes(Array.isArray(rr.data) ? rr.data : [])
    } catch (error) {
      toast.error('Erro ao carregar o projeto. Verifique sua conexão.')
      nav('/dashboard')
    }
  }

  async function calcularTodos() {
    if (id === DEMO_PROJECT_ID) {
      toast.success('Projeto demonstrativo carregado para validação visual.')
      return
    }
    try {
      const r = await api.post(`/circuitos/calcular-lote/${id}`, null, { timeout: CALCULO_TIMEOUT_MS })
      await carregar()
      const { calculados, total, erros = [] } = r.data
      if (erros.length > 0) {
        toast.error(`${erros.length} circuito(s) com erro. ${calculados}/${total} calculados.`)
      } else {
        toast.success(`${calculados} circuito(s) calculados`)
      }
    } catch (error) {
      toast.error(mensagemErroApi(error, 'O motor de calculo esta iniciando ou temporariamente indisponivel. Aguarde e tente novamente.'))
    }
  }

  async function salvarDadosProjeto(dados) {
    if (id === DEMO_PROJECT_ID) {
      setProjeto((atual) => ({ ...atual, ...dados }))
      toast.success('Dados atualizados no demonstrativo local')
      return
    }
    try {
      await api.put(`/projetos/${id}`, dados)
      await carregar()
      toast.success('Dados do projeto atualizados')
    } catch (error) {
      toast.error(mensagemErroApi(error, 'Erro ao atualizar os dados do projeto'))
      throw error
    }
  }

  async function salvarCircuito(c) {
    try {
      const payload = normalizarPayload(c, id)
      if (c.id) {
        await api.put(`/circuitos/${c.id}`, payload)
      } else {
        await api.post('/circuitos/', payload)
      }
      setModalC(null)
      carregar()
      toast.success('Circuito salvo')
    } catch (error) {
      toast.error(mensagemErroApi(error, 'Erro ao salvar circuito'))
    }
  }

  async function deletarCircuito(cid) {
    if (!confirm('Deletar circuito?')) return
    // FIX: Unhandled rejection on api.delete causes silent failure with no user feedback.
    try {
      await api.delete(`/circuitos/${cid}`)
      await carregar()
    } catch (error) {
      toast.error('Erro ao deletar circuito')
    }
  }

  function novoCircuito() {
    setAbaAtiva('circuitos')
    setModalC(circuitoVazioProjeto(projeto))
  }

  function mensagemErroApi(error, fallback) {
    const data = error?.response?.data || {}
    if (data.code === 'USAGE_LIMIT_EXCEEDED' || data.code === 'FEATURE_NOT_AVAILABLE') {
      return `${data.message || fallback} Alternativa: continue editando o projeto ou solicite o plano ${data.recommendedPlan || 'pro'}.`
    }
    if (data.message) return data.message
    const detail = error?.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (detail?.mensagem) return detail.mensagem
    if (detail?.upstream?.reason) return String(detail.upstream.reason)
    if (error?.response?.data?.upstream?.reason) return String(error.response.data.upstream.reason)
    if (typeof error?.response?.data?.error === 'string') return error.response.data.error
    if (Array.isArray(detail)) return detail.map((item) => item.msg || JSON.stringify(item)).join('; ')
    return fallback
  }

  async function lerErroBlob(error) {
    const blob = error?.response?.data
    const fallback = mensagemErroApi(error, '')
    if (!(typeof Blob !== 'undefined' && blob instanceof Blob)) {
      return fallback
    }

    try {
      const texto = await blob.text()
      if (!texto) return fallback
      try {
        const json = JSON.parse(texto)
        return json?.message || json?.detail || json?.error || fallback || texto
      } catch {
        return fallback || texto
      }
    } catch {
      return fallback
    }
  }

  function abrirImportacao() {
    setImportModal(true)
  }

  async function enviarMsg() {
    if (!inputMsg.trim()) return
    const userMsg = inputMsg.trim()
    setInputMsg('')
    const novosMsgs = [...msgs, { role: 'user', content: userMsg }]
    setMsgs(novosMsgs)
    setLoadingIA(true)
    try {
      // FIX: ok/alert/erro are derived values that only exist after the early
      // return guard. Deriving them here inside the async closure from the
      // actual circuitos state ensures they are always valid, never undefined.
      const _ok = circuitos.filter((c) => statusFinal(c) === 'OK').length
      const _alert = circuitos.filter((c) => statusFinal(c) === 'ALERTA').length
      const _erro = circuitos.filter((c) => statusFinal(c) === 'CRITICO').length
      const r = await api.post(
        '/agente/chat',
        {
          projeto_id: id,
          mensagem: userMsg,
          aba_atual: abaAtiva,
          contexto_site: {
            rota: `/projeto/${id}`,
            aba_atual: abaAtiva,
            total_circuitos: circuitos.length,
            circuitos_ok: _ok,
            circuitos_alerta: _alert,
            circuitos_criticos: _erro,
          },
          historico: novosMsgs.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        },
        { timeout: AGENTE_TIMEOUT_MS }
      )
      setMsgs((m) => [...m, {
        role: 'assistant',
        content: r.data.fallback_offline
          ? `${r.data.resposta}\n\n[AVISO] IA online indisponível; resposta gerada por fallback local do CalcCabos.`
          : r.data.resposta,
        modelo: r.data.modelo || null,
        provider: r.data.provider || null,
      }])
    } catch (error) {
      const fallbackResposta = error?.response?.data?.resposta
      if (fallbackResposta) {
        setMsgs((m) => [...m, {
          role: 'assistant',
          content: `${fallbackResposta}\n\n[AVISO] IA online indisponível; resposta gerada por fallback local do CalcCabos.`,
          modelo: error.response.data.modelo || 'offline-node-fallback',
          provider: error.response.data.provider || 'node-fallback',
        }])
        return
      }
      setMsgs((m) => [...m, { role: 'assistant', content: mensagemErroApi(error, 'Erro de conexao com o agente.') }])
    } finally {
      setLoadingIA(false)
    }
  }

  async function exportar(tipo, modo = 'final') {
    let url = null
    try {
      const r = await api.get(`/relatorios/${id}/${tipo}`, {
        params: { modo },
        responseType: 'blob',
        timeout: EXPORT_TIMEOUT_MS,
      })
      // FIX: Always revoke the blob URL in finally to prevent memory leaks,
      // even if the anchor click or any subsequent code throws.
      url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `calccabos_${id}_${modo}.${tipo === 'pdf' ? 'pdf' : 'xlsx'}`
      a.click()
    } catch (error) {
      const detalhe = await lerErroBlob(error)
      const nome = tipo === 'pdf' ? 'PDF' : 'Excel'
      toast.error(detalhe || `Erro ao gerar ${nome}`)
    } finally {
      if (url) URL.revokeObjectURL(url)
    }
  }

  if (!projeto) return (
    <div className="min-h-screen bg-[#f4f6f8] p-6">
      <LoadingState message="Carregando projeto..." />
    </div>
  )

  const listaCircuitos = Array.isArray(circuitos) ? circuitos : (circuitos?.items || [])
  const ok = listaCircuitos.filter((c) => statusFinal(c) === 'OK').length
  const alert = listaCircuitos.filter((c) => statusFinal(c) === 'ALERTA').length
  const erro = listaCircuitos.filter((c) => statusFinal(c) === 'CRITICO').length
  const health = buildProjectHealth(projeto, listaCircuitos, usuario)
  const isDemoProject = id === DEMO_PROJECT_ID

  function executarProximaAcao() {
    const proxima = health.fluxo?.proximaAcao
    if (!proxima) return setAbaAtiva('visao-geral')
    if (proxima.action === 'new-circuit') return novoCircuito()
    if (proxima.action === 'calculate') {
      setAbaAtiva('circuitos')
      return calcularTodos()
    }
    setAbaAtiva(proxima.destino)
  }

  function exportarFinal(tipo) {
    if (!health.fluxo?.relatorioFinalLiberado) {
      toast.error('Emissão final bloqueada. Revise as etapas e pendências do projeto.')
      setAbaAtiva('revisao-tecnica')
      return
    }
    exportar(tipo, 'final')
  }

  function exportarPreliminar(tipo) {
    if (!health.fluxo?.relatorioPreliminarDisponivel) {
      toast.error('Relatório preliminar indisponível. Cadastre e calcule pelo menos um circuito.')
      return
    }
    exportar(tipo, 'preliminar')
  }

  const circuitosFiltrados = listaCircuitos.filter(c => {
    if (filtroQuadro !== 'TODOS') {
      const quadro = c.from_barramento || c.quadro || ''
      if (quadro !== filtroQuadro) return false
    }
    if (filtroAmbiente !== 'TODOS') {
      const ambiente = c.ambiente || c.to_equipamento || ''
      if (ambiente !== filtroAmbiente) return false
    }
    if (filtroStatus !== 'TODOS') {
      if (statusFinal(c) !== filtroStatus) return false;
    }
    if (filtroTipoCarga !== 'TODOS') {
      const tipoCarga = c.tipo_carga || c.tipo || c.categoria_carga || c.natureza_carga || ''
      if (tipoCarga !== filtroTipoCarga) return false;
    }
    if (filtroModo !== 'TODOS') {
      const modo = (c.modo_dimensionamento || c.modo_selecao_componentes || 'manual').toLowerCase()
      if (modo !== filtroModo.toLowerCase()) return false;
    }
    if (filtroProtecao !== 'TODOS') {
      const prot = normalizarStatus(c.protecao_status)
      if (prot !== filtroProtecao) return false;
    }
    if (busca) {
      const b = busca.toLowerCase();
      const matchTag = (c.tag || '').toLowerCase().includes(b);
      const matchDesc = (c.descricao || '').toLowerCase().includes(b);
      const matchFrom = (c.from_barramento || '').toLowerCase().includes(b);
      const matchTo = (c.to_equipamento || '').toLowerCase().includes(b);
      const matchDevice = (c.protection_device || '').toLowerCase().includes(b);
      const matchCabo = (c.cabo_sugerido_tipo_comercial || c.tipo_cabo_comercial || '').toLowerCase().includes(b);
      const matchModo = (c.modo_dimensionamento || c.modo_selecao_componentes || 'manual').toLowerCase().includes(b);
      
      if (!matchTag && !matchDesc && !matchFrom && !matchTo && !matchDevice && !matchCabo && !matchModo) {
        return false;
      }
    }
    return true;
  });

  function limparFiltros() {
    setBusca('');
    setFiltroStatus('TODOS');
    setFiltroModo('TODOS');
    setFiltroProtecao('TODOS');
    setFiltroQuadro('TODOS');
    setFiltroAmbiente('TODOS');
    setFiltroTipoCarga('TODOS');
  }

  const opcoesQuadro = [...new Set(listaCircuitos.map((c) => c.from_barramento || c.quadro).filter(Boolean))]
  const opcoesAmbiente = [...new Set(listaCircuitos.map((c) => c.ambiente || c.to_equipamento).filter(Boolean))]
  const opcoesTipoCarga = [...new Set(listaCircuitos.map((c) => c.tipo_carga || c.tipo || c.categoria_carga || c.natureza_carga).filter(Boolean))]

  return (
    <div className="cc-app flex">
      <ProjetoTabs ativa={abaAtiva} onChange={setAbaAtiva} projeto={projeto} health={health} />

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <ProjectWorkspaceHeader
          projeto={projeto}
          health={health}
        />

        <main className="min-h-0 flex-1 overflow-auto bg-[#f4f6f8] px-4 py-4">
          {abaAtiva === 'visao-geral' && (
            <VisaoGeralProjeto
              projeto={projeto}
              circuitos={circuitos}
              revisoes={revisoes}
              health={health}
              total={circuitos.length}
              ok={ok}
              alertas={alert}
              criticos={erro}
              onNavigate={setAbaAtiva}
              onPrimaryAction={executarProximaAcao}
              onSaveProject={salvarDadosProjeto}
            />
          )}
          {isDemoProject && !['visao-geral', 'circuitos'].includes(abaAtiva) && (
            <DemoModulePlaceholder aba={abaAtiva} />
          )}
          {!isDemoProject && abaAtiva === 'transformador' && (
            <TransformadorEntrada projeto={projeto} onSaved={carregar} />
          )}
          {!isDemoProject && abaAtiva === 'sistema-trifasico' && (
            <SistemaTrifasico projeto={projeto} onSaved={carregar} />
          )}
          {!isDemoProject && abaAtiva === 'diagrama-unifilar' && (
            <DiagramaUnifilar projeto={projeto} circuitos={circuitos} />
          )}
          {!isDemoProject && abaAtiva === 'protecoes' && (
            <ProtecoesProjeto projeto={projeto} onSaved={carregar} />
          )}
          {!isDemoProject && abaAtiva === 'para-raios' && (
            <ParaRaiosProjeto projeto={projeto} onSaved={carregar} />
          )}
          {!isDemoProject && abaAtiva === 'aterramento' && (
            <AterramentoProjeto projeto={projeto} onSaved={carregar} />
          )}
          {!isDemoProject && abaAtiva === 'areas-classificadas' && (
            <AreasClassificadasProjeto projeto={projeto} onSaved={carregar} />
          )}
          {!isDemoProject && abaAtiva === 'memorial' && (
            <MemorialProjeto projeto={projeto} circuitos={circuitos} />
          )}
          {!isDemoProject && abaAtiva === 'revisao-tecnica' && (
            <RevisaoTecnicaProjeto circuitos={listaCircuitos} fluxo={health.fluxo} onOpenCircuit={(circuito) => setModalC({ ...circuito })} />
          )}
          {!isDemoProject && abaAtiva === 'exportacoes' && (
            <ExportacoesProjeto
              fluxo={health.fluxo}
              onExportPdf={() => exportarFinal('pdf')}
              onExportExcel={() => exportarFinal('excel')}
              onExportPreliminarPdf={() => exportarPreliminar('pdf')}
              onExportPreliminarExcel={() => exportarPreliminar('excel')}
            />
          )}
          {abaAtiva === 'circuitos' && (
            <div className="flex min-h-[500px] flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="cc-title">Circuitos</h1>
                  <p className="cc-subtitle">Tabela técnica para dimensionamento, validação e revisão dos circuitos.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={calcularTodos} className="cc-button">Recalcular</button>
                  <button type="button" onClick={novoCircuito} className="cc-button cc-button-primary">Novo circuito</button>
                </div>
              </div>
              {circuitos.length > 0 ? (
                <div className="cc-panel flex flex-1 flex-col overflow-hidden">
                  <CircuitosToolbar 
                    busca={busca} setBusca={setBusca}
                    filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
                    filtroModo={filtroModo} setFiltroModo={setFiltroModo}
                    filtroProtecao={filtroProtecao} setFiltroProtecao={setFiltroProtecao}
                    filtroQuadro={filtroQuadro} setFiltroQuadro={setFiltroQuadro}
                    filtroAmbiente={filtroAmbiente} setFiltroAmbiente={setFiltroAmbiente}
                    filtroTipoCarga={filtroTipoCarga} setFiltroTipoCarga={setFiltroTipoCarga}
                    opcoesQuadro={opcoesQuadro}
                    opcoesAmbiente={opcoesAmbiente}
                    opcoesTipoCarga={opcoesTipoCarga}
                    total={circuitos.length} exibindo={circuitosFiltrados.length}
                    limparFiltros={limparFiltros}
                  />
                  {circuitosFiltrados.length > 0 ? (
                    <CircuitTable
                        circuitosFiltrados={circuitosFiltrados}
                        setModalC={setModalC}
                        deletarCircuito={deletarCircuito}
                        statusFinal={statusFinal}
                        limparTexto={limparTexto}
                        fmt={fmt}
                        tipoCabo={tipoCabo}
                        normalizarStatus={normalizarStatus}
                        statusLabel={statusLabel}
                      />
                  ) : (
                    <div className="flex-1 flex items-center justify-center pt-8 bg-slate-50/50">
                      <EmptyState
                        icon={Search}
                        title="Nenhum circuito encontrado"
                        description="Ajuste a busca ou limpe os filtros para visualizar novamente todos os circuitos."
                        actionLabel="Limpar filtros"
                        onAction={limparFiltros}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="cc-panel flex flex-1 items-center justify-center pt-8">
                  <EmptyState
                    icon={Calculator}
                    title="Nenhum circuito cadastrado"
                    description="Adicione o primeiro circuito ou importe uma lista de cargas para iniciar o dimensionamento."
                    actionLabel="+ Novo Circuito"
                    onAction={novoCircuito}
                  />
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {agenteAberto && (
        <FloatingAssistant
          open={agenteAberto}
          onOpen={() => setAgenteAberto(true)}
          onClose={() => setAgenteAberto(false)}
          onMinimize={() => setAgenteAberto(false)}
          messages={msgs}
          inputValue={inputMsg}
          onInputChange={setInputMsg}
          onSend={enviarMsg}
          loading={loadingIA}
          abaAtiva={abaAtiva}
          projeto={projeto}
          health={health}
          setInputMsg={setInputMsg}
        />
      )}

{modalC && (
  <CircuitModal
    modalC={modalC}
    setModalC={setModalC}
    salvarCircuito={salvarCircuito}
    fmt={fmt}
    tipoCabo={tipoCabo}
    normalizarStatus={normalizarStatus}
    statusLabel={statusLabel}
    statusFinal={statusFinal}
    C_VAZIO={C_VAZIO}
    TIPOS={TIPOS}
    TENSOES={TENSOES}
    METODOS={METODOS}
    DISPOSITIVOS={DISPOSITIVOS}
    CURVAS_DISJUNTOR={CURVAS_DISJUNTOR}
    REPAROS_TEXTO={REPAROS_TEXTO}
    Campo={Campo}
    LabelWithTooltip={LabelWithTooltip}
  />
)}
      {importModal && (
        <ExcelImportWizard
          onClose={() => setImportModal(false)}
          onImportacaoConcluida={() => carregar()}
          projetoId={projeto?._id}
        />
      )}
    </div>
  )
}
