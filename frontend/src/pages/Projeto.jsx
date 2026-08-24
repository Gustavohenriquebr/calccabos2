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
import ProjectFlowStepper from '../components/projeto/ProjectFlowStepper'
import RevisaoTecnicaProjeto from '../components/projeto/RevisaoTecnicaProjeto'
import ExportacoesProjeto from '../components/projeto/ExportacoesProjeto'
import CircuitosToolbar from '../components/projeto/CircuitosToolbar'
import FloatingAssistant from '../components/assistant/FloatingAssistant'
import { LoadingState, EmptyState, StatusBadge, Card, SectionHeader, Tooltip, Alert } from '../components/ui'
import { ProtecaoMTATSection } from '../components/projeto/ProtecaoMTATSection'
import ExcelImportWizard from '../components/projeto/importer/ExcelImportWizard'

const TIPOS = ['CU-PVC', 'CU-XLPE', 'AL-PVC', 'AL-XLPE']
const TENSOES = [127, 220, 380, 440, 690, 13800]
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
  return padrao
}

function statusLabel(status) {
  const normalizado = normalizarStatus(status)
  return normalizado === 'CRITICO' ? 'CRÍTICO' : normalizado
}

function statusFinal(c) {
  if (c.status_final) return normalizarStatus(c.status_final)
  if (c.status === 'ok') return 'OK'
  if (c.status === 'erro' || c.status === 'critico') return 'CRITICO'
  if (c.status === 'alerta') return 'ALERTA'
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

function circuitoVazioProjeto(projeto) {
  const transformador = parseProjetoJson(projeto?.transformador_dados)
  return {
    ...C_VAZIO,
    tensao: transformador.tensao_secundaria || projeto?.tensao_ref || C_VAZIO.tensao,
    isc_local: transformador.corrente_curto_secundario_ka || '',
  }
}

function normalizarPayload(c, projetoId) {
  const payload = { ...c, projeto_id: projetoId }
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
  const STRING_OPTIONAL = ['sequencia_operacao', 'meio_extincao', 'tipo_acionamento', 'modelo', 'norma_referencia']
  STRING_OPTIONAL.forEach((campo) => {
    const valor = payload[campo]
    payload[campo] = valor === '' || valor === null || valor === undefined ? null : String(valor)
  })
  payload.fator_eficiencia = payload.fator_eficiencia > 1 ? payload.fator_eficiencia / 100 : payload.fator_eficiencia
  payload.formacao = Math.max(payload.formacao || 1, 1)
  payload.agrupamento = Math.max(payload.agrupamento || 1, 1)
  payload.corrente_ac_dc = payload.corrente_ac_dc || 'AC'
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
  const msgRef = useRef(null)
  let usuario = {}; try { usuario = JSON.parse(localStorage.getItem('usuario') || '{}') } catch { usuario = {} }

  useEffect(() => { carregar() }, [id])
  useEffect(() => { if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight }, [msgs])

  async function carregar() {
    try {
      const [rp, rc] = await Promise.all([api.get(`/projetos/${id}`), api.get(`/circuitos/projeto/${id}`)])
      setProjeto(rp.data)
      const listaC = Array.isArray(rc.data) ? rc.data : (rc.data?.items || [])
      setCircuitos(listaC)
    } catch (error) {
      toast.error('Erro ao carregar o projeto. Verifique sua conexão.')
      nav('/dashboard')
    }
  }

  async function calcularTodos() {
    try {
      const r = await api.post(`/circuitos/calcular-lote/${id}`)
      await carregar()
      const { calculados, total, erros = [] } = r.data
      if (erros.length > 0) {
        toast.error(`${erros.length} circuito(s) com erro. ${calculados}/${total} calculados.`)
      } else {
        toast.success(`${calculados} circuito(s) calculados`)
      }
    } catch (error) {
      toast.error('Erro ao calcular circuitos')
    }
  }

  async function salvarDadosProjeto(dados) {
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
      toast.error('Erro ao salvar')
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
        return json?.detail || json?.error || fallback || texto
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
        content: r.data.resposta,
        modelo: r.data.modelo || null,
      }])
    } catch (error) {
      setMsgs((m) => [...m, { role: 'assistant', content: mensagemErroApi(error, 'Erro de conexao com o agente.') }])
    } finally {
      setLoadingIA(false)
    }
  }

  async function exportar(tipo) {
    let url = null
    try {
      const r = await api.get(`/relatorios/${id}/${tipo}`, {
        responseType: 'blob',
        timeout: EXPORT_TIMEOUT_MS,
      })
      // FIX: Always revoke the blob URL in finally to prevent memory leaks,
      // even if the anchor click or any subsequent code throws.
      url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `calccabos_${id}.${tipo === 'pdf' ? 'pdf' : 'xlsx'}`
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
    <div className="min-h-screen bg-surface-base p-6">
      <LoadingState message="Carregando projeto..." />
    </div>
  )

  const listaCircuitos = Array.isArray(circuitos) ? circuitos : (circuitos?.items || [])
  const ok = listaCircuitos.filter((c) => statusFinal(c) === 'OK').length
  const alert = listaCircuitos.filter((c) => statusFinal(c) === 'ALERTA').length
  const erro = listaCircuitos.filter((c) => statusFinal(c) === 'CRITICO').length
  const health = buildProjectHealth(projeto, listaCircuitos, usuario)

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
    exportar(tipo)
  }

  const circuitosFiltrados = listaCircuitos.filter(c => {
    if (filtroStatus !== 'TODOS') {
      if (statusFinal(c) !== filtroStatus) return false;
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
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <ProjectWorkspaceHeader
        projeto={projeto}
        health={health}
        onBack={() => nav('/dashboard')}
        onImport={abrirImportacao}
        primaryAction={health.fluxo?.proximaAcao}
        onPrimaryAction={executarProximaAcao}
        onToggleAgent={() => setAgenteAberto((aberto) => !aberto)}
        agentOpen={agenteAberto}
      />

      <ProjetoTabs ativa={abaAtiva} onChange={setAbaAtiva} />
      <ProjectFlowStepper fluxo={health.fluxo} ativa={abaAtiva} onChange={setAbaAtiva} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 sm:p-5">
          {abaAtiva === 'visao-geral' && (
            <VisaoGeralProjeto
              projeto={projeto}
              circuitos={circuitos}
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
          {abaAtiva === 'transformador' && (
            <TransformadorEntrada projeto={projeto} onSaved={carregar} />
          )}
          {abaAtiva === 'sistema-trifasico' && (
            <SistemaTrifasico projeto={projeto} onSaved={carregar} />
          )}
          {abaAtiva === 'diagrama-unifilar' && (
            <DiagramaUnifilar projeto={projeto} circuitos={circuitos} />
          )}
          {abaAtiva === 'protecoes' && (
            <ProtecoesProjeto projeto={projeto} onSaved={carregar} />
          )}
          {abaAtiva === 'para-raios' && (
            <ParaRaiosProjeto projeto={projeto} onSaved={carregar} />
          )}
          {abaAtiva === 'aterramento' && (
            <AterramentoProjeto projeto={projeto} onSaved={carregar} />
          )}
          {abaAtiva === 'areas-classificadas' && (
            <AreasClassificadasProjeto projeto={projeto} onSaved={carregar} />
          )}
          {abaAtiva === 'memorial' && (
            <MemorialProjeto projeto={projeto} circuitos={circuitos} />
          )}
          {abaAtiva === 'revisao-tecnica' && (
            <RevisaoTecnicaProjeto circuitos={listaCircuitos} fluxo={health.fluxo} onOpenCircuit={(circuito) => setModalC({ ...circuito })} />
          )}
          {abaAtiva === 'exportacoes' && (
            <ExportacoesProjeto fluxo={health.fluxo} onExportPdf={() => exportarFinal('pdf')} onExportExcel={() => exportarFinal('excel')} />
          )}
          {abaAtiva === 'circuitos' && (
            <div className="h-full flex flex-col min-h-[500px]">
              {circuitos.length > 0 ? (
                <Card className="flex-1 flex flex-col shadow-sm border border-slate-200 overflow-hidden">
                  <CircuitosToolbar 
                    busca={busca} setBusca={setBusca}
                    filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
                    filtroModo={filtroModo} setFiltroModo={setFiltroModo}
                    filtroProtecao={filtroProtecao} setFiltroProtecao={setFiltroProtecao}
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
                </Card>
              ) : (
                <div className="flex-1 flex items-center justify-center pt-8">
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
        </div>


      </div>

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
