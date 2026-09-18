import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  FileText,
  FolderOpen,
  LogOut,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'
import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  LoadingState,
  Select,
  StatusBadge,
  Textarea,
  normalizeStatus,
} from '../components/ui'

const FORM_INICIAL = {
  nome: '',
  descricao: '',
  cliente: '',
  contexto: 'industrial',
  tensao_ref: 380,
}

const CONTEXTOS = [
  ['industrial', 'Industrial (NBR 5410)'],
  ['offshore', 'Offshore Petrobras (N-2040)'],
  ['hospitalar', 'Hospitalar'],
  ['residencial', 'Residencial'],
]

const TENSOES = [
  [127, '127 V'],
  [220, '220 V'],
  [380, '380 V'],
  [440, '440 V'],
  [690, '690 V'],
  [13800, '13,8 kV'],
  [23000, '23 kV'],
  [34500, '34,5 kV'],
  [69000, '69 kV'],
  [138000, '138 kV'],
  [230000, '230 kV'],
  [345000, '345 kV'],
  [500000, '500 kV'],
  [765000, '765 kV'],
  [1000000, '1.000 kV'],
]

function projetoStatus(projeto) {
  const bruto = projeto.status_geral || projeto.status_final || projeto.status
  return normalizeStatus(bruto || 'PENDENTE', 'PENDENTE')
}

function dado(projeto, campo, fallback = '') {
  return projeto?.[campo] || projeto?.dados_universais?.[campo] || fallback
}

function localProjeto(projeto) {
  const uf = dado(projeto, 'uf')
  const cidade = dado(projeto, 'cidade')
  if (uf || cidade) return [uf, cidade].filter(Boolean).join(' / ')
  return projeto.localidade || projeto.contexto || 'N/D'
}

function concessionariaProjeto(projeto) {
  return dado(projeto, 'concessionaria', 'N/D')
}

function revisaoProjeto(projeto) {
  return `Rev. ${projeto.revisao || dado(projeto, 'revisao', '0')}`
}

function formatarData(valor) {
  if (!valor) return 'N/D'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'N/D'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(data)
}

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function StatBox({ label, value, helper, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'border-[#d2d9e0] bg-white text-[#121820]',
    review: 'border-[#d2d9e0] bg-[#fbfcfd] text-[#121820]',
    alert: 'border-[#f4d58f] bg-[#fff9e8] text-[#8a5b08]',
    ok: 'border-[#bfe6cc] bg-[#f4fbf6] text-[#106f46]',
  }

  return (
    <div className={`border px-4 py-3 ${tones[tone] || tones.neutral}`} style={{ borderRadius: 4 }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#606e7d]">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-7">{value}</p>
        </div>
        {Icon && <Icon size={18} className="mt-1 text-[#606e7d]" />}
      </div>
      <p className="mt-2 text-sm leading-5 text-[#606e7d]">{helper}</p>
    </div>
  )
}

function usoTexto(atual, limite) {
  if (limite === null || limite === undefined) return `${atual || 0}`
  return `${atual || 0}/${limite}`
}

function mensagemLimite(error, fallback) {
  const data = error?.response?.data || {}
  if (data.code === 'USAGE_LIMIT_EXCEEDED' || data.code === 'FEATURE_NOT_AVAILABLE') {
    return `${data.message || fallback} Plano recomendado: ${data.recommendedPlan || 'pro'}.`
  }
  return data.message || data.detail || fallback
}

export default function Dashboard() {
  const [projetos, setProjetos] = useState([])
  const [planoUso, setPlanoUso] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [loading, setLoading] = useState(true)
  const [erroCarregar, setErroCarregar] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroCriar, setErroCriar] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [filtroLocalidade, setFiltroLocalidade] = useState('TODOS')
  const nav = useNavigate()
  let usuario = {}
  try { usuario = JSON.parse(localStorage.getItem('usuario') || '{}') } catch { usuario = {} }

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    setErroCarregar('')
    try {
      const [r, plano] = await Promise.all([
        api.get('/projetos'),
        api.get('/billing/current-plan').catch(() => ({ data: null })),
      ])
      const lista = Array.isArray(r.data) ? r.data : (r.data?.items || [])
      setProjetos(lista)
      setPlanoUso(plano.data)
    } catch {
      setErroCarregar('Nao foi possivel carregar seus projetos agora.')
      toast.error('Erro ao carregar projetos')
    } finally {
      setLoading(false)
    }
  }

  function abrirModal() {
    setForm(FORM_INICIAL)
    setErroCriar('')
    setModal(true)
  }

  async function criar(e) {
    e.preventDefault()
    setSalvando(true)
    setErroCriar('')
    try {
      const tensaoRef = Number(form.tensao_ref)
      if (!Number.isFinite(tensaoRef) || tensaoRef <= 0) {
        throw new Error('Informe uma tensao de referencia positiva.')
      }
      const payload = { ...form, tensao_ref: tensaoRef }
      const r = await api.post('/projetos', payload)
      setModal(false)
      toast.success('Projeto criado')
      nav(`/projeto/${r.data.id || r.data._id}`)
    } catch (error) {
      const msg = mensagemLimite(error, 'Nao foi possivel criar o projeto. Revise os campos e tente novamente.')
      setErroCriar(msg)
      toast.error(msg)
    } finally {
      setSalvando(false)
    }
  }

  async function deletar(id, e) {
    e.stopPropagation()
    if (!confirm('Deletar projeto e todos os circuitos?')) return
    try {
      await api.delete(`/projetos/${id}`)
      await carregar()
      toast.success('Projeto excluido')
    } catch {
      toast.error('Erro ao excluir projeto')
    }
  }

  function logout() {
    localStorage.clear()
    nav('/login')
  }

  const listaProjetos = Array.isArray(projetos) ? projetos : []

  const localidades = useMemo(() => {
    const set = new Set()
    listaProjetos.forEach((projeto) => {
      const local = localProjeto(projeto)
      const concessionaria = concessionariaProjeto(projeto)
      const valor = [local, concessionaria].filter((item) => item && item !== 'N/D').join(' | ')
      if (valor) set.add(valor)
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [listaProjetos])

  const projetosFiltrados = useMemo(() => {
    const texto = normalizarBusca(busca)
    return listaProjetos.filter((projeto) => {
      const status = projetoStatus(projeto)
      const localidade = [localProjeto(projeto), concessionariaProjeto(projeto)].filter(Boolean).join(' | ')
      const alvoBusca = normalizarBusca([
        projeto.nome,
        projeto.cliente,
        localProjeto(projeto),
        concessionariaProjeto(projeto),
      ].join(' '))

      return (!texto || alvoBusca.includes(texto))
        && (filtroStatus === 'TODOS' || status === filtroStatus)
        && (filtroLocalidade === 'TODOS' || localidade === filtroLocalidade)
    })
  }, [listaProjetos, busca, filtroStatus, filtroLocalidade])

  const metricas = useMemo(() => {
    const emRevisao = listaProjetos.filter((projeto) => ['ALERTA', 'PENDENTE'].includes(projetoStatus(projeto))).length
    const criticos = listaProjetos.filter((projeto) => projetoStatus(projeto) === 'CRITICO').length
    const liberados = listaProjetos.filter((projeto) => projetoStatus(projeto) === 'OK' || projeto.relatorio_liberado).length
    return { total: listaProjetos.length, emRevisao, criticos, liberados }
  }, [listaProjetos])

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#121820]">
      <header className="border-b border-[#d2d9e0] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#13202e] text-white" style={{ borderRadius: 4 }}>
              <Cable size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-6 text-[#121820]">CalcCabos</h1>
              <p className="mt-0.5 text-sm text-[#606e7d]">Projetos eletricos, revisoes e memoriais tecnicos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-[#606e7d] sm:inline">Sessao: {usuario.nome || 'engenheiro'}</span>
            <Button
              icon={Plus}
              onClick={abrirModal}
              className="border-[#13202e] bg-[#13202e] text-white hover:border-[#1b2a39] hover:bg-[#1b2a39]"
              data-testid="btn-novo-projeto-header"
            >
              Novo projeto
            </Button>
            <Button variant="ghost" icon={LogOut} onClick={logout} title="Sair" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        {erroCarregar && (
          <Alert variant="danger" icon={AlertTriangle} className="mb-5">
            {erroCarregar}
          </Alert>
        )}

        <section className="mb-5 grid gap-3 md:grid-cols-4">
          <StatBox label="Total de projetos" value={metricas.total} helper="Base cadastrada" icon={FolderOpen} />
          <StatBox label="Em revisao" value={metricas.emRevisao} helper="Pendentes ou com alerta" tone="review" icon={AlertTriangle} />
          <StatBox label="Criticos" value={metricas.criticos} helper="Nao liberados" tone="alert" icon={AlertTriangle} />
          <StatBox label="Relatorios liberados" value={metricas.liberados} helper="Aptos para emissao" tone="ok" icon={CheckCircle2} />
        </section>

        {planoUso && (
          <section className="cc-panel mb-5 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="cc-label">Plano atual</div>
                <h2 className="mt-1 text-lg font-bold text-[#121820]">{planoUso.plan?.name || 'Free'}</h2>
                <p className="mt-1 text-sm text-[#606e7d]">
                  Uso mensal de staging. Upgrade e pagamento ainda nao estao habilitados.
                </p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[620px]">
                <div className="border border-[#d2d9e0] bg-[#fbfcfd] p-3">
                  <div className="cc-label">Projetos</div>
                  <div className="mt-1 font-bold">{usoTexto(planoUso.usage?.activeProjects, planoUso.plan?.limits?.activeProjects)}</div>
                </div>
                <div className="border border-[#d2d9e0] bg-[#fbfcfd] p-3">
                  <div className="cc-label">PDF / Excel</div>
                  <div className="mt-1 font-bold">
                    {usoTexto(planoUso.usage?.pdfExports, planoUso.plan?.limits?.pdfExports)} PDF · {usoTexto(planoUso.usage?.excelExports, planoUso.plan?.limits?.excelExports)} XLSX
                  </div>
                </div>
                <div className="border border-[#d2d9e0] bg-[#fbfcfd] p-3">
                  <div className="cc-label">IA / Importacao</div>
                  <div className="mt-1 font-bold">
                    {usoTexto(planoUso.usage?.aiMessages, planoUso.plan?.limits?.aiMessages)} IA · {usoTexto(planoUso.usage?.importedRows, planoUso.plan?.limits?.importedRows)} linhas
                  </div>
                </div>
              </div>
              <Button variant="secondary" disabled>Upgrade em breve</Button>
            </div>
          </section>
        )}

        <section className="cc-panel overflow-hidden">
          <div className="border-b border-[#d2d9e0] bg-white px-4 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-bold leading-6 text-[#121820]">Projetos</h2>
                <p className="mt-1 text-sm text-[#606e7d]">
                  Consulte, filtre e continue revisoes tecnicas sem trocar a estrutura do sistema por localidade.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_260px] xl:w-[720px]">
                <label className="cc-label">
                  Buscar
                  <div className="relative mt-1">
                    <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#606e7d]" />
                    <input
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      className="cc-field pl-8"
                      placeholder="Projeto ou cliente"
                    />
                  </div>
                </label>
                <label className="cc-label">
                  Status
                  <select value={filtroStatus} onChange={(event) => setFiltroStatus(event.target.value)} className="cc-field mt-1">
                    <option value="TODOS">Todos</option>
                    <option value="OK">OK</option>
                    <option value="ALERTA">Alerta</option>
                    <option value="CRITICO">Critico</option>
                    <option value="PENDENTE">Pendente</option>
                  </select>
                </label>
                <label className="cc-label">
                  Concessionaria / localidade
                  <select value={filtroLocalidade} onChange={(event) => setFiltroLocalidade(event.target.value)} className="cc-field mt-1">
                    <option value="TODOS">Todas</option>
                    {localidades.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingState message="Carregando projetos..." />
            </div>
          ) : listaProjetos.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FolderOpen}
                title="Nenhum projeto cadastrado"
                description="Crie o primeiro projeto para configurar entrada, circuitos, protecoes e memorial tecnico."
                actionLabel="Criar primeiro projeto"
                onAction={abrirModal}
                data-testid="btn-novo-projeto-empty"
              />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="cc-table w-full min-w-[1080px] border-collapse">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>Cliente</th>
                    <th>UF / cidade</th>
                    <th>Concessionaria</th>
                    <th>Tensao ref.</th>
                    <th>Revisao</th>
                    <th>Status</th>
                    <th>Ultima atualizacao</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {projetosFiltrados.map((projeto) => {
                    const projId = projeto.id || projeto._id
                    const status = projetoStatus(projeto)
                    return (
                      <tr
                        key={projId}
                        data-testid={`projeto-card-${projId}`}
                        className="cursor-pointer hover:bg-[#fbfcfd]"
                        onClick={() => nav(`/projeto/${projId}`)}
                      >
                        <td>
                          <div className="font-bold text-[#121820]">{projeto.nome}</div>
                          {projeto.descricao && <div className="mt-0.5 max-w-[280px] truncate text-sm text-[#606e7d]">{projeto.descricao}</div>}
                        </td>
                        <td>{projeto.cliente || 'N/D'}</td>
                        <td>{localProjeto(projeto)}</td>
                        <td>{concessionariaProjeto(projeto)}</td>
                        <td className="font-mono">{projeto.tensao_ref ? `${projeto.tensao_ref} V` : dado(projeto, 'tensao_referencia', 'N/D')}</td>
                        <td className="font-mono">{revisaoProjeto(projeto)}</td>
                        <td><StatusBadge status={status} /></td>
                        <td>{formatarData(projeto.atualizado_em || projeto.updatedAt || projeto.criado_em || projeto.createdAt)}</td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => nav(`/projeto/${projId}`)}>Abrir</Button>
                            <button
                              type="button"
                              onClick={(event) => deletar(projId, event)}
                              className="rounded border border-[#d2d9e0] bg-white p-2 text-[#606e7d] hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                              title="Excluir projeto"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {projetosFiltrados.length === 0 && (
                <div className="border-t border-[#e6eaee] bg-[#fbfcfd] px-4 py-8 text-center">
                  <FileText size={24} className="mx-auto text-[#606e7d]" />
                  <p className="mt-2 text-sm font-semibold text-[#121820]">Nenhum projeto encontrado com os filtros atuais.</p>
                  <button type="button" onClick={() => { setBusca(''); setFiltroStatus('TODOS'); setFiltroLocalidade('TODOS') }} className="cc-button mt-4">
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <Card variant="elevated" className="w-full max-w-lg overflow-hidden">
            <CardBody className="p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Novo projeto</h3>
                  <p className="mt-1 text-sm text-slate-500">Configure os dados basicos do memorial tecnico.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  Fechar
                </button>
              </div>

              {erroCriar && (
                <Alert variant="danger" icon={AlertTriangle} className="mb-4">
                  {erroCriar}
                </Alert>
              )}

              <form onSubmit={criar} className="space-y-4">
                <Input
                  label="Nome do projeto"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  required
                  data-testid="input-projeto-nome"
                />
                <Input
                  label="Cliente"
                  helperText="Opcional"
                  value={form.cliente}
                  onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
                />
                <Textarea
                  label="Descricao"
                  helperText="Opcional"
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Contexto normativo"
                    value={form.contexto}
                    onChange={(e) => setForm((f) => ({ ...f, contexto: e.target.value }))}
                  >
                    {CONTEXTOS.map(([valor, label]) => (
                      <option key={valor} value={valor}>{label}</option>
                    ))}
                  </Select>
                  <Select
                    label="Tensao de referencia"
                    value={TENSOES.some(([valor]) => valor === Number(form.tensao_ref)) ? form.tensao_ref : 'outro'}
                    onChange={(e) => setForm((f) => ({ ...f, tensao_ref: e.target.value === 'outro' ? '' : Number(e.target.value) }))}
                  >
                    <option value="outro">Outro / valor livre</option>
                    {TENSOES.map(([valor, label]) => (
                      <option key={valor} value={valor}>{label}</option>
                    ))}
                  </Select>
                  {!TENSOES.some(([valor]) => valor === Number(form.tensao_ref)) && (
                    <Input
                      label="Tensao personalizada (V)"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.tensao_ref}
                      onChange={(e) => setForm((f) => ({ ...f, tensao_ref: e.target.value }))}
                      helperText="Use qualquer valor positivo; os presets sao apenas atalhos."
                      required
                    />
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    loading={salvando}
                    className="flex-1 border-[#13202e] bg-[#13202e] text-white hover:border-[#1b2a39] hover:bg-[#1b2a39]"
                    data-testid="btn-salvar-projeto"
                  >
                    Criar projeto
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
