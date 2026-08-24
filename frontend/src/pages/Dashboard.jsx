import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  LogOut,
  Plus,
  Rocket,
  Trash2,
} from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'
import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  LoadingState,
  MetricCard,
  SectionHeader,
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
]

const PASSOS = [
  ['Crie um projeto', 'Defina cliente, contexto normativo e tensao de referencia.'],
  ['Cadastre entrada/transformador', 'Informe dados eletricos de origem e curto-circuito.'],
  ['Importe ou crie circuitos', 'Monte a lista de cargas e calcule em lote.'],
  ['Gere o memorial tecnico', 'Revise pendencias e exporte PDF/Excel.'],
]

function projetoStatus(projeto) {
  const bruto = projeto.status_geral || projeto.status_final || projeto.status
  if (!bruto) return null
  return normalizeStatus(bruto, null)
}

function formatarData(valor) {
  if (!valor) return 'N/D'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'N/D'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(data)
}

function ProjetoCard({ projeto, onOpen, onDelete }) {
  const status = projetoStatus(projeto)
  const atualizado = projeto.atualizado_em || projeto.criado_em

  return (
    <Card
      as="article"
      data-testid={"projeto-card-" + projeto._id}
      className="group cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md hover:shadow-slate-200/70"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-950 group-hover:text-primary-900">
            {projeto.nome}
          </h3>
          <p className="mt-1 truncate text-xs text-slate-500">{projeto.cliente || 'Cliente nao informado'}</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Excluir projeto"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {projeto.descricao && (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{projeto.descricao}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {status ? <StatusBadge status={status} /> : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
            Status N/D
          </span>
        )}
        <span className="rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-900">
          {projeto.contexto || 'industrial'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <div>
          <div className="font-medium text-slate-400">Tensao ref.</div>
          <div className="mt-0.5 text-slate-700">{projeto.tensao_ref ? `${projeto.tensao_ref} V` : 'N/D'}</div>
        </div>
        <div>
          <div className="font-medium text-slate-400">Atualizado</div>
          <div className="mt-0.5 text-slate-700">{formatarData(atualizado)}</div>
        </div>
      </div>

      <div className="mt-4">
        <Button variant="secondary" size="sm" className="w-full">Abrir projeto</Button>
      </div>
    </Card>
  )
}

function OnboardingCard({ compact = false }) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-900 text-white">
          <Rocket size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Comece em 4 passos</h2>
          {!compact && <p className="text-xs text-slate-500">Fluxo recomendado para montar o primeiro memorial.</p>}
        </div>
      </div>
      <div className="space-y-3">
        {PASSOS.map(([titulo, descricao], index) => (
          <div key={titulo} className="flex gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-900">
              {index + 1}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-800">{titulo}</div>
              <p className="text-xs leading-5 text-slate-500">{descricao}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const [projetos, setProjetos] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [loading, setLoading] = useState(true)
  const [erroCarregar, setErroCarregar] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroCriar, setErroCriar] = useState('')
  const nav = useNavigate()
  let usuario = {}; try { usuario = JSON.parse(localStorage.getItem('usuario') || '{}') } catch { usuario = {} }

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    setErroCarregar('')
    try {
      const r = await api.get('/projetos')
      const lista = Array.isArray(r.data) ? r.data : (r.data?.items || [])
      setProjetos(lista)
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
      const payload = {
        ...form,
        tensao_ref: parseInt(form.tensao_ref, 10),
      }
      const r = await api.post('/projetos', payload)
      setModal(false)
      toast.success('Projeto criado')
      const targetId = r.data.id || r.data._id
      nav(`/projeto/${targetId}`)
    } catch {
      setErroCriar('Nao foi possivel criar o projeto. Revise os campos e tente novamente.')
      toast.error('Erro ao criar projeto')
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

  function abrirDemo() {
    toast('Projeto demonstrativo sera disponibilizado em breve.')
  }

  function logout() {
    localStorage.clear()
    nav('/login')
  }

  const metricas = useMemo(() => {
    const lista = Array.isArray(projetos) ? projetos : []
    const conhecidos = lista.map(projetoStatus).filter(Boolean)
    const contar = (status) => conhecidos.filter((item) => item === status).length
    const semStatus = conhecidos.length === 0

    return {
      total: lista.length,
      ok: semStatus ? 'N/D' : contar('OK'),
      alerta: semStatus ? 'N/D' : contar('ALERTA'),
      critico: semStatus ? 'N/D' : contar('CRITICO'),
      recentes: lista.length ? Math.min(lista.length, 5) : 0,
    }
  }, [projetos])

  const recentes = useMemo(() => {
    const lista = Array.isArray(projetos) ? projetos : []
    return [...lista]
      .sort((a, b) => new Date(b.atualizado_em || b.criado_em || 0) - new Date(a.atualizado_em || a.criado_em || 0))
      .slice(0, 5)
  }, [projetos])

  const listaProjetos = Array.isArray(projetos) ? projetos : []

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-900 text-white">
              <Cable size={20} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-950">CalcCabos</h1>
              <p className="text-xs text-slate-500">Ola, {usuario.nome || 'engenheiro'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Rocket} onClick={abrirDemo}>Abrir demonstracao</Button>
            <Button icon={Plus} onClick={abrirModal} data-testid="btn-novo-projeto-header">Novo projeto</Button>
            <Button variant="ghost" icon={LogOut} onClick={logout} title="Sair" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">Dashboard</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Central de projetos</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Acompanhe seus memoriais eletricos industriais, pendencias tecnicas e projetos recentes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={FolderOpen} onClick={abrirDemo}>Abrir demonstracao</Button>
            <Button icon={Plus} onClick={abrirModal} data-testid="btn-novo-projeto-hero">Criar projeto</Button>
          </div>
        </div>

        {erroCarregar && (
          <Alert variant="danger" icon={AlertTriangle} className="mb-5">
            {erroCarregar}
          </Alert>
        )}

        {loading ? (
          <LoadingState message="Carregando projetos..." />
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Total de projetos" value={metricas.total} description="Projetos cadastrados" icon={FolderOpen} />
              <MetricCard label="Projetos OK" value={metricas.ok} description="Com status conhecido" status={metricas.ok === 'N/D' ? undefined : 'OK'} icon={CheckCircle2} />
              <MetricCard label="Em ALERTA" value={metricas.alerta} description="Requerem atencao" status={metricas.alerta === 'N/D' ? undefined : 'ALERTA'} icon={AlertTriangle} />
              <MetricCard label="CRITICOS" value={metricas.critico} description="Nao liberados" status={metricas.critico === 'N/D' ? undefined : 'CRITICO'} icon={ShieldIcon} />
              <MetricCard label="Recentes" value={metricas.recentes} description="Ultimos projetos" icon={Clock3} />
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
              <section>
                <div className="mb-4">
                  <SectionHeader
                    title="Meus projetos"
                    description={listaProjetos.length ? 'Abra, revise ou continue um memorial existente.' : 'Crie o primeiro projeto para iniciar seu fluxo tecnico.'}
                  />
                </div>

                {listaProjetos.length === 0 ? (
                  <EmptyState
                    icon={FolderOpen}
                    title="Nenhum projeto ainda"
                    description="Crie um projeto para cadastrar transformador, circuitos, protecoes e gerar seu memorial tecnico."
                    actionLabel="Criar primeiro projeto"
                    onAction={abrirModal}
                    data-testid="btn-novo-projeto-empty"
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {listaProjetos.map((p) => {
                      const projId = p.id || p._id
                      return (
                        <ProjetoCard
                          key={projId}
                          projeto={p}
                          onOpen={() => nav(`/projeto/${projId}`)}
                          onDelete={(e) => deletar(projId, e)}
                        />
                      )
                    })}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <OnboardingCard compact={listaProjetos.length > 0} />

                <Card className="p-4">
                  <SectionHeader
                    title="Projetos recentes"
                    description="Acesso rapido aos ultimos memoriais."
                  />
                  <div className="mt-4 space-y-2">
                    {recentes.length ? recentes.map((projeto) => {
                      const projId = projeto.id || projeto._id
                      return (
                        <button
                          key={projId}
                          type="button"
                          onClick={() => nav(`/projeto/${projId}`)}
                          className="w-full rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-primary-100 hover:bg-primary-50"
                        >
                          <div className="truncate text-sm font-medium text-slate-800">{projeto.nome}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{formatarData(projeto.atualizado_em || projeto.criado_em)}</div>
                        </button>
                      )
                    }) : (
                      <p className="text-sm text-slate-500">Nenhum projeto recente.</p>
                    )}
                  </div>
                </Card>
              </aside>
            </div>
          </>
        )}
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
                    value={form.tensao_ref}
                    onChange={(e) => setForm((f) => ({ ...f, tensao_ref: parseInt(e.target.value, 10) }))}
                  >
                    {TENSOES.map(([valor, label]) => (
                      <option key={valor} value={valor}>{label}</option>
                    ))}
                  </Select>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" loading={salvando} className="flex-1" data-testid="btn-salvar-projeto">
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

function ShieldIcon(props) {
  return <FileText {...props} />
}
