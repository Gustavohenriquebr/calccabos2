import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import HeroBackground from '../components/ui/HeroBackground'
import {
  Bot,
  Cable,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Gauge,
  Layers3,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

/* ============================================================
   TOKENS
   Fundo grafite quase-preto + accent cobre (o próprio material
   que o produto dimensiona). Teal só em estados "de corrente".
   ============================================================ */
const T = {
  bg: '#070A0F',
  bgAlt: '#0D1117',
  surface: '#11161D',
  surfaceRaised: '#171D26',
  line: '#1F2733',
  lineBright: 'rgba(226,144,91,0.35)',
  copper: '#E2905B',
  copperBright: '#F2B98A',
  current: '#5EEAD4',
  text: '#F5F7FA',
  textDim: '#8B94A3',
  ok: '#34D399',
  alerta: '#F5B94D',
  critico: '#F76767',
}

const BENEFICIOS = [
  ['Dimensionamento de cabos', 'Corrente de projeto, ampacidade, queda de tensão e critérios de seleção.', Cable],
  ['Validação automática', 'Status técnico por circuito e módulo para revisar pendências com clareza.', ClipboardCheck],
  ['Proteções e Icc', 'Disjuntores, Icu, curto-circuito e verificações de compatibilidade.', ShieldCheck],
  ['Memorial PDF/Excel', 'Documentação técnica exportável para revisão, auditoria e emissão.', FileSpreadsheet],
  ['Diagrama unifilar', 'Representação simples do projeto, transformador, barramento e circuitos.', Network],
  ['Agente com IA', 'Apoio para explicar cálculos, pendências e decisões técnicas.', Bot],
]

const MODULOS = [
  'Transformador / Entrada', 'Sistema elétrico', 'Circuitos', 'Cabos', 'Proteções',
  'Para-raios', 'Aterramento', 'Áreas classificadas', 'Memorial', 'Diagrama unifilar', 'Agente IA',
]

const PASSOS = [
  ['Crie um projeto', 'Defina cliente, contexto normativo e tensão de referência.'],
  ['Cadastre a entrada', 'Informe transformador, sistema elétrico e premissas principais.'],
  ['Importe ou crie circuitos', 'Monte a lista de cargas manualmente ou por planilha.'],
  ['Valide pendências', 'Revise alertas, críticos, proteções, Icc e documentação técnica.'],
  ['Gere o memorial', 'Exporte PDF/Excel e use a IA para apoiar a revisão.'],
]

const PUBLICOS = [
  'Engenheiros eletricistas', 'Projetistas industriais', 'Empresas de manutenção',
  'Consultorias técnicas', 'Estudantes de engenharia', 'Times de engenharia industrial',
]

/* ============================================================
   Trace divider — a "trilha de circuito" que se desenha ao
   entrar em viewport. É o elemento-assinatura da página.
   ============================================================ */
function CircuitTrace({ flip = false }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  return (
    <div ref={ref} className="relative mx-auto h-16 w-full max-w-7xl px-4 sm:px-6" aria-hidden="true">
      <svg viewBox="0 0 1200 64" className="h-full w-full overflow-visible" preserveAspectRatio="none">
        <motion.path
          d={flip
            ? 'M0,32 L440,32 L470,8 L730,8 L760,32 L1200,32'
            : 'M0,32 L440,32 L470,56 L730,56 L760,32 L1200,32'}
          fill="none"
          stroke={T.line}
          strokeWidth="1"
        />
        <motion.path
          d={flip
            ? 'M0,32 L440,32 L470,8 L730,8 L760,32 L1200,32'
            : 'M0,32 L440,32 L470,56 L730,56 L760,32 L1200,32'}
          fill="none"
          stroke={T.copper}
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.circle
          r="3.5"
          fill={T.copper}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: [0, 1, 1, 0] } : {}}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <animateMotion
            dur="1.1s"
            fill="freeze"
            path={flip
              ? 'M0,32 L440,32 L470,8 L730,8 L760,32 L1200,32'
              : 'M0,32 L440,32 L470,56 L730,56 L760,32 L1200,32'}
          />
        </motion.circle>
      </svg>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    OK: { c: T.ok, label: 'OK' },
    ALERTA: { c: T.alerta, label: 'ALERTA' },
    CRITICO: { c: T.critico, label: 'CRÍTICO' },
  }
  const s = map[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide"
      style={{ color: s.c, backgroundColor: `${s.c}1A`, border: `1px solid ${s.c}40` }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: s.c }}
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.c }} />
      </span>
      {s.label}
    </span>
  )
}

function CountUp({ to, duration = 1.4, suffix = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20% 0px' })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!inView) return
    let raf
    const start = performance.now()
    const ease = (t) => 1 - Math.pow(1 - t, 3)
    const step = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000))
      setVal(Math.round(ease(t) * to))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, to, duration])

  return <span ref={ref}>{val}{suffix}</span>
}

function Reveal({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function FeatureCard({ title, description, icon: Icon, index }) {
  return (
    <Reveal delay={index * 0.06}>
      <motion.div
        whileHover={{ y: -4, borderColor: T.lineBright }}
        transition={{ duration: 0.25 }}
        className="group h-full rounded-xl border p-5"
        style={{ backgroundColor: T.surface, borderColor: T.line }}
      >
        <div
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
          style={{ backgroundColor: '#E2905B14', color: T.copper }}
        >
          <Icon size={19} />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: T.text }}>{title}</h3>
        <p className="mt-2 text-sm leading-6" style={{ color: T.textDim }}>{description}</p>
      </motion.div>
    </Reveal>
  )
}

function ModuleChip({ name, index }) {
  return (
    <Reveal delay={index * 0.03}>
      <div
        className="rounded-lg border px-3.5 py-2.5 font-mono text-[13px] tracking-tight"
        style={{ backgroundColor: T.surface, borderColor: T.line, color: T.textDim }}
      >
        <span style={{ color: T.copper }}>#</span> {name}
      </div>
    </Reveal>
  )
}

function PrimaryButton({ children, onClick, variant = 'solid', size = 'md' }) {
  const isSolid = variant === 'solid'
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition-colors ${
        size === 'lg' ? 'px-5 py-3 text-[15px]' : 'px-4 py-2.5 text-sm'
      }`}
      style={
        isSolid
          ? { backgroundColor: T.copper, color: '#1A0F08' }
          : { backgroundColor: 'transparent', color: T.text, border: `1px solid ${T.line}` }
      }
    >
      {children}
    </motion.button>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroFade = useTransform(scrollYProgress, [0, 1], [1, 0.4])
  const heroShift = useTransform(scrollYProgress, [0, 1], [0, 40])

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-20 border-b backdrop-blur"
        style={{ borderColor: T.line, backgroundColor: 'rgba(7,10,15,0.85)' }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2.5 text-left">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: T.copper, color: '#1A0F08' }}
            >
              <Cable size={18} />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-4">CalcCabos</span>
              <span className="block font-mono text-[11px]" style={{ color: T.textDim }}>
                Memorial elétrico industrial
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <PrimaryButton variant="ghost" onClick={() => navigate('/login')}>Entrar</PrimaryButton>
            <PrimaryButton onClick={() => navigate('/cadastro')}>Criar conta grátis</PrimaryButton>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section ref={heroRef} className="relative overflow-hidden">
          {/* Camada de fundo: vídeo + trilhas de circuito 3D em profundidade */}
          <HeroBackground />

          {/* fundo: grid sutil de cobre (textura extra sobre o vídeo) */}
          <div className="pointer-events-none absolute inset-0 z-[1] opacity-[0.04]" aria-hidden="true">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
                  <path d="M 42 0 L 0 0 0 42" fill="none" stroke={T.copper} strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <motion.div
            style={{ opacity: heroFade, y: heroShift }}
            className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-28"
          >
            <div className="flex flex-col justify-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs font-medium"
                style={{ borderColor: T.line, color: T.copperBright, backgroundColor: T.surface }}
              >
                <Sparkles size={13} />
                Plataforma para engenharia elétrica industrial
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08 }}
                className="max-w-3xl text-[2.6rem] font-semibold leading-[1.08] tracking-tight sm:text-6xl"
              >
                Dimensione cabos industriais{' '}
                <span style={{ color: T.copper }}>com a precisão</span> que a norma exige.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.16 }}
                className="mt-5 max-w-2xl text-lg leading-8"
                style={{ color: T.textDim }}
              >
                Cálculo, validação de proteções e memorial técnico em um único fluxo —
                do transformador ao último circuito, com apoio de IA.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.24 }}
                className="mt-8 flex flex-wrap gap-3"
              >
                <PrimaryButton size="lg" onClick={() => navigate('/cadastro')}>Criar conta grátis</PrimaryButton>
                <PrimaryButton size="lg" variant="ghost" onClick={() => navigate('/login')}>Entrar</PrimaryButton>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.34 }}
                className="mt-8 flex flex-wrap gap-2"
              >
                <StatusPill status="OK" />
                <StatusPill status="ALERTA" />
                <StatusPill status="CRITICO" />
              </motion.div>
            </div>

            {/* Console ao vivo */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: T.line, backgroundColor: T.surface }}
            >
              <div className="border-b px-5 py-4" style={{ borderColor: T.line, backgroundColor: T.bgAlt }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: T.copperBright }}>
                      Projeto executivo
                    </div>
                    <div className="mt-1 text-lg font-semibold">Subestação Industrial QGBT-01</div>
                  </div>
                  <StatusPill status="ALERTA" />
                </div>
              </div>
              <div className="grid gap-3 p-5">
                {[
                  ['Circuitos calculados', 128, '', Gauge],
                  ['Pendências críticas', 2, '', ShieldCheck],
                ].map(([label, value, suffix, Icon]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border p-4"
                    style={{ borderColor: T.line, backgroundColor: T.bg }}
                  >
                    <div>
                      <div className="text-xs" style={{ color: T.textDim }}>{label}</div>
                      <div className="mt-1 font-mono text-2xl font-semibold">
                        <CountUp to={value} suffix={suffix} />
                      </div>
                    </div>
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: '#E2905B14', color: T.copper }}
                    >
                      <Icon size={19} />
                    </div>
                  </div>
                ))}
                <div
                  className="flex items-center justify-between rounded-xl border p-4"
                  style={{ borderColor: T.line, backgroundColor: T.bg }}
                >
                  <div>
                    <div className="text-xs" style={{ color: T.textDim }}>Memoriais exportados</div>
                    <div className="mt-1 font-mono text-2xl font-semibold">PDF / Excel</div>
                  </div>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: '#E2905B14', color: T.copper }}
                  >
                    <FileText size={19} />
                  </div>
                </div>

                <div className="rounded-xl border p-4" style={{ borderColor: T.line, backgroundColor: T.bgAlt }}>
                  <div className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.textDim }}>
                    Central de pendências
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color: T.text }}>Para-raios incompleto</span>
                      <StatusPill status="ALERTA" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color: T.text }}>Equipamento sem proteção Ex</span>
                      <StatusPill status="CRITICO" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <CircuitTrace />

        {/* Benefícios */}
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Reveal>
            <div className="mb-3 font-mono text-xs tracking-[0.18em]" style={{ color: T.copper }}>BENEFÍCIOS</div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Do cálculo à documentação, num fluxo único.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: T.textDim }}>
              O CalcCabos organiza cálculo, validação e documentação para projetos industriais.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS.map(([title, description, Icon], i) => (
              <FeatureCard key={title} title={title} description={description} icon={Icon} index={i} />
            ))}
          </div>
        </section>

        <CircuitTrace flip />

        {/* Módulos */}
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Reveal>
            <div className="mb-3 font-mono text-xs tracking-[0.18em]" style={{ color: T.copper }}>MÓDULOS</div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Um ambiente completo</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: T.textDim }}>
              Estruture o memorial elétrico industrial além da tabela de cabos.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {MODULOS.map((modulo, i) => <ModuleChip key={modulo} name={modulo} index={i} />)}
          </div>
        </section>

        <CircuitTrace />

        {/* Como funciona — sequência real, numeração se justifica */}
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Reveal>
            <div className="mb-3 font-mono text-xs tracking-[0.18em]" style={{ color: T.copper }}>COMO FUNCIONA</div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Do cadastro do projeto à documentação final
            </h2>
          </Reveal>
          <div className="relative mt-10 grid gap-4 lg:grid-cols-5">
            <div
              className="absolute left-0 right-0 top-4 hidden h-px lg:block"
              style={{ backgroundColor: T.line }}
              aria-hidden="true"
            />
            {PASSOS.map(([title, description], index) => (
              <Reveal key={title} delay={index * 0.08}>
                <div className="relative">
                  <div
                    className="relative z-10 mb-4 flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-semibold"
                    style={{ backgroundColor: T.copper, color: '#1A0F08' }}
                  >
                    {index + 1}
                  </div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: T.textDim }}>{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <CircuitTrace flip />

        {/* Para quem é */}
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Reveal>
            <div className="mb-3 font-mono text-xs tracking-[0.18em]" style={{ color: T.copper }}>PARA QUEM É</div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Feito para quem assina o projeto</h2>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PUBLICOS.map((publico, i) => (
              <Reveal key={publico} delay={i * 0.05}>
                <div
                  className="flex items-center gap-3 rounded-lg border p-4"
                  style={{ borderColor: T.line, backgroundColor: T.surface }}
                >
                  <CheckCircle2 size={17} style={{ color: T.current }} />
                  <span className="text-sm font-medium">{publico}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="px-4 py-16 sm:px-6">
          <Reveal>
            <div
              className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border p-8 sm:p-12"
              style={{ borderColor: T.line, backgroundColor: T.bgAlt }}
            >
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
                style={{ backgroundColor: T.copper, opacity: 0.12 }}
                aria-hidden="true"
              />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs" style={{ color: T.copperBright }}>
                    <Layers3 size={16} />
                    Ambiente técnico de projeto elétrico
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Comece seu próximo memorial industrial.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: T.textDim }}>
                    Crie projetos, valide pendências e gere documentação técnica com mais clareza.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <PrimaryButton variant="ghost" onClick={() => navigate('/login')}>Entrar</PrimaryButton>
                  <PrimaryButton onClick={() => navigate('/cadastro')}>Criar conta grátis</PrimaryButton>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
    </div>
  )
}
