import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cable, CheckCircle2, FileText, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../services/api'
import toast from 'react-hot-toast'
import LoginVideoBackground from '../components/ui/LoginVideoBackground'

// ─────────────────────────────────────────────
// Dados estáticos
// ─────────────────────────────────────────────
const BENEFICIOS = [
  [Zap,          'Cálculo técnico',     'Dimensionamento de cabos, queda de tensão e curto-circuito.'],
  [ShieldCheck,  'Validação normativa', 'Status OK, ALERTA e CRÍTICO para revisão de projeto.'],
  [FileText,     'Memorial profissional','PDF, Excel e agente de IA em um único ambiente.'],
]

// ─────────────────────────────────────────────
// Sub-componentes dark (somente para esta tela)
// ─────────────────────────────────────────────

function DarkInput({ label, helperText, className = '', ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {label}
          {helperText && (
            <span className="ml-1.5 font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {helperText}
            </span>
          )}
        </label>
      )}
      <input
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-1"
        style={{
          backgroundColor: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.9)',
          '--tw-ring-color': '#E2905B',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(226,144,91,0.6)'
          e.target.style.backgroundColor = 'rgba(255,255,255,0.08)'
        }}
        onBlur={e => {
          e.target.style.borderColor = 'rgba(255,255,255,0.1)'
          e.target.style.backgroundColor = 'rgba(255,255,255,0.06)'
        }}
        {...props}
      />
    </div>
  )
}

function DarkButton({ children, loading, className = '', ...props }) {
  return (
    <button
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
      style={{
        backgroundColor: '#E2905B',
        color: '#070A0F',
        '--tw-ring-color': '#E2905B',
        '--tw-ring-offset-color': '#0D1117',
      }}
      onMouseEnter={e => { if (!loading) e.target.style.backgroundColor = '#d4804b' }}
      onMouseLeave={e => { if (!loading) e.target.style.backgroundColor = '#E2905B' }}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
          style={{ animation: 'spin 0.75s linear infinite' }}
        />
      ) : null}
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
export default function Login({ initialMode = 'login' }) {
  // ── Estado (idêntico ao original) ──
  const [modo, setModo] = useState(initialMode)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', crea: '', empresa: '' })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    setModo(initialMode)
    setErro('')
  }, [initialMode])

  const set = k => e => {
    setErro('')
    setForm(f => ({ ...f, [k]: e.target.value }))
  }

  function alternarModo(novoModo) {
    setErro('')
    setModo(novoModo)
  }

  // ── Submit (idêntico ao original) ──
  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    try {
      let res
      if (modo === 'login') {
        const fd = new FormData()
        fd.append('username', form.email)
        fd.append('password', form.senha)
        res = await api.post('/auth/login', fd)
      } else {
        res = await api.post('/auth/registro', form)
      }
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('usuario', JSON.stringify(res.data.usuario))
      nav('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      let mensagem = modo === 'login'
        ? 'Não foi possível entrar. Verifique seu e-mail e senha.'
        : 'Não foi possível criar sua conta. Verifique os dados informados.'

      if (typeof detail === 'string') {
        mensagem = detail
      } else if (Array.isArray(detail) && detail.length > 0) {
        mensagem = detail.map(d => d.msg || d.detail || String(d.loc ? d.loc.join('.') : d)).join(', ')
      } else if (detail && typeof detail === 'object') {
        mensagem = detail.message || detail.error || JSON.stringify(detail)
      }

      setErro(mensagem)
      toast.error(mensagem)
    }
    setLoading(false)
  }

  const isLogin = modo === 'login'

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 py-8"
      style={{ backgroundColor: '#070A0F', color: 'rgba(255,255,255,0.9)' }}
    >
      {/* Camada de vídeo — z-0, atrás de tudo */}
      <LoginVideoBackground />

      {/* Conteúdo — z-10, sobre o vídeo */}
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">

        {/* ── Hero / lado esquerdo (apenas desktop) ── */}
        <section className="hidden lg:block">
          {/* Badge */}
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              border: '1px solid rgba(226,144,91,0.25)',
              backgroundColor: 'rgba(226,144,91,0.08)',
              color: '#E2905B',
            }}
          >
            <Sparkles size={13} />
            Plataforma SaaS para engenharia elétrica industrial
          </div>

          <div className="max-w-xl">
            {/* Ícone logo */}
            <div
              className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
              style={{ backgroundColor: '#E2905B', color: '#070A0F' }}
            >
              <Cable size={24} />
            </div>

            <h1
              className="text-4xl font-semibold tracking-tight"
              style={{ color: 'rgba(255,255,255,0.95)' }}
            >
              CalcCabos
            </h1>
            <p
              className="mt-4 text-lg leading-8"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Memorial elétrico industrial com cálculo, validação técnica e IA.
            </p>
          </div>

          {/* Cards de benefícios */}
          <div className="mt-8 grid max-w-2xl gap-3">
            {BENEFICIOS.map(([Icon, titulo, descricao], index) => (
              <motion.div
                key={titulo}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.1, duration: 0.4 }}
                className="flex gap-3 rounded-lg p-4"
                style={{
                  border: '1px solid rgba(255,255,255,0.07)',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(226,144,91,0.15)', color: '#E2905B' }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: 'rgba(255,255,255,0.9)' }}
                  >
                    {titulo}
                  </div>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: 'rgba(255,255,255,0.45)' }}
                  >
                    {descricao}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Card / formulário ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mx-auto w-full max-w-md overflow-hidden rounded-xl p-6 sm:p-8"
          style={{
            backgroundColor: 'rgba(13,17,23,0.82)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Cabeçalho do card */}
          <div className="mb-7 text-center">
            {/* Ícone (só mobile) */}
            <div
              className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg lg:hidden"
              style={{ backgroundColor: '#E2905B', color: '#070A0F' }}
            >
              <Cable size={22} />
            </div>

            <div
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: '#E2905B' }}
            >
              CalcCabos
            </div>
            <h2
              className="mt-2 text-2xl font-semibold tracking-tight"
              style={{ color: 'rgba(255,255,255,0.95)' }}
            >
              {isLogin ? 'Entrar na plataforma' : 'Criar conta técnica'}
            </h2>
            <p
              className="mt-2 text-sm leading-6"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Dimensione cabos, valide proteções e gere memoriais técnicos em uma única plataforma.
            </p>
          </div>

          {/* ── Tab switcher com pílula deslizante (framer-motion) ── */}
          <div
            className="relative mb-6 grid grid-cols-2 gap-0 rounded-full p-1"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {[['login', 'Entrar'], ['registro', 'Criar conta']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => alternarModo(id)}
                className="relative rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none"
                style={{
                  color: modo === id ? '#070A0F' : 'rgba(255,255,255,0.45)',
                  zIndex: 1,
                }}
              >
                {/* Pílula animada */}
                {modo === id && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: '#E2905B', zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {label}
              </button>
            ))}
          </div>

          {/* ── Mensagem de erro com slide (framer-motion) ── */}
          <AnimatePresence>
            {erro && (
              <motion.div
                key="erro"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.25 }}
                className="mb-5 flex items-start gap-2.5 overflow-hidden rounded-lg px-4 py-3 text-sm"
                style={{
                  border: '1px solid rgba(239,68,68,0.25)',
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  color: '#fca5a5',
                }}
              >
                <ShieldCheck size={15} className="mt-0.5 shrink-0" />
                <span>{erro}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Formulário ── */}
          <form onSubmit={submit} className="space-y-4">
            {/* Campo Nome (só no cadastro) — entra/sai animado */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  key="campo-nome"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <DarkInput
                    label="Nome completo"
                    name="nome"
                    value={form.nome}
                    onChange={set('nome')}
                    autoComplete="name"
                    required
                    placeholder="Seu nome completo"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <DarkInput
              label="E-mail"
              name="email"
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
              placeholder="seu@email.com"
            />

            <DarkInput
              label="Senha"
              name="senha"
              type="password"
              value={form.senha}
              onChange={set('senha')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              placeholder="••••••••"
            />

            {/* Campos CREA + Empresa (só no cadastro) */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  key="campos-extras"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DarkInput
                      label="CREA"
                      name="crea"
                      helperText="Opcional"
                      value={form.crea}
                      onChange={set('crea')}
                      autoComplete="off"
                      placeholder="0000000/UF"
                    />
                    <DarkInput
                      label="Empresa"
                      name="empresa"
                      helperText="Opcional"
                      value={form.empresa}
                      onChange={set('empresa')}
                      autoComplete="organization"
                      placeholder="Nome da empresa"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <DarkButton type="submit" loading={loading}>
              {isLogin ? 'Entrar' : 'Criar conta'}
            </DarkButton>
          </form>

          {/* Rodapé do card */}
          <div
            className="mt-6 flex items-center justify-center gap-2 text-sm"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <CheckCircle2 size={15} style={{ color: '#4ade80' }} />
            Acesso seguro ao ambiente de projetos CalcCabos.
          </div>
        </motion.div>
      </div>

      {/* Keyframe para o spinner do DarkButton */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
