/**
 * HeroBackground
 *
 * Camada visual da seção Hero do CalcCabos Landing.
 *
 * Arquitetura (do fundo para frente):
 *   z-0  Fundo base azul-petróleo (profundidade atmosférica)
 *   z-1  <video> atmosférico — muted/autoPlay/loop/playsInline
 *   z-2  Overlay gradiente direcional (não flat genérico)
 *   z-3  Layer A: trilhas distantes (parallax lento, cobre escuro)
 *   z-4  Layer B: trilhas médias (parallax médio, cobre médio)
 *   z-5  Layer C: trilhas próximas (parallax rápido, cobre vivo)
 *   z-6  Vinheta de borda para profundidade
 *
 * Todas as camadas: pointer-events none (não interferem com CTAs/formulário).
 * Parallax: framer-motion useMotionValue + useSpring (GPU-friendly, sem rAF manual).
 * Degrada em mobile (touch)/prefers-reduced-motion → estático.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

/* ─── Paleta local (espelho dos tokens do Landing.jsx) ─── */
const C = {
  bg:          '#070A0F',
  bgDeep:      '#060D18', // azul-petróleo quase-preto — só nesta seção
  copperFar:   'rgba(226,144,91,0.12)',
  copperMid:   'rgba(226,144,91,0.22)',
  copperNear:  'rgba(226,144,91,0.40)',
  dotFar:      'rgba(226,144,91,0.38)',
  dotMid:      'rgba(226,144,91,0.62)',
  dotNear:     'rgba(226,144,91,0.90)',
  nodeFar:     'rgba(226,144,91,0.20)',
  nodeMid:     'rgba(226,144,91,0.32)',
  nodeNear:    'rgba(226,144,91,0.55)',
}

/* ─────────────────────────────────────────────────────────
   SVG de trilhas — coordenadas no espaço 1600 × 750
   Gramática visual: mesma do CircuitTrace existente na
   página (segmentos retos, ângulos de 45°, sem bezier).
   ───────────────────────────────────────────────────────── */

/* LAYER A — fundo, muitas trilhas finas, movimento lento */
const A_PATHS = [
  'M -50,72  L 220,72  L 250,48  L 510,48  L 540,72  L 870,72  L 900,92  L 1180,92  L 1210,72  L 1650,72',
  'M -50,162 L 140,162 L 170,138 L 430,138 L 460,162 L 700,162 L 730,182 L 1040,182 L 1070,162 L 1650,162',
  'M -50,320 L 180,320 L 210,296 L 470,296 L 500,320 L 770,320 L 800,342 L 1090,342 L 1120,320 L 1650,320',
  'M -50,450 L 210,450 L 240,426 L 510,426 L 540,450 L 820,450 L 852,472 L 1140,472 L 1170,450 L 1650,450',
  'M -50,590 L 155,590 L 185,566 L 450,566 L 480,590 L 750,590 L 782,612 L 1060,612 L 1090,590 L 1650,590',
  'M -50,690 L 195,690 L 225,666 L 490,666 L 522,690 L 790,690 L 822,712 L 1100,712 L 1130,690 L 1650,690',
  /* verticais */
  'M 220,72  L 220,138 L 248,162',
  'M 870,72  L 870,162',
  'M 510,296 L 510,426',
  'M 1040,182 L 1040,320',
  'M 750,590 L 750,666',
]
const A_NODES = [
  {cx:220,cy:72}, {cx:510,cy:48}, {cx:870,cy:72}, {cx:1180,cy:92},
  {cx:140,cy:162},{cx:430,cy:138},{cx:700,cy:162},{cx:1040,cy:182},
  {cx:180,cy:320},{cx:470,cy:296},{cx:770,cy:320},{cx:1090,cy:342},
  {cx:210,cy:450},{cx:510,cy:426},{cx:820,cy:450},{cx:1140,cy:472},
  {cx:155,cy:590},{cx:450,cy:566},{cx:750,cy:590},{cx:1060,cy:612},
  {cx:220,cy:138},{cx:870,cy:162},{cx:1040,cy:320},{cx:750,cy:666},
]
const A_CURRENTS = [
  { path:'M -50,72 L 220,72 L 250,48 L 510,48 L 540,72 L 870,72 L 900,92 L 1180,92', dur:'9s',  begin:'0s'  },
  { path:'M -50,320 L 180,320 L 210,296 L 470,296 L 500,320 L 770,320 L 800,342',    dur:'11s', begin:'4s'  },
  { path:'M -50,590 L 155,590 L 185,566 L 450,566 L 480,590 L 750,590 L 782,612',    dur:'13s', begin:'7s'  },
  { path:'M -50,162 L 140,162 L 170,138 L 430,138 L 460,162 L 700,162',              dur:'10s', begin:'2.5s'},
]

/* LAYER B — meio, trilhas médias */
const B_PATHS = [
  'M -50,118 L 290,118 L 330,86  L 640,86  L 680,118 L 1030,118 L 1065,144 L 1390,144 L 1430,118 L 1650,118',
  'M -50,388 L 245,388 L 285,354 L 595,354 L 635,388 L 950,388 L 988,418 L 1310,418 L 1350,388 L 1650,388',
  'M -50,568 L 270,568 L 312,536 L 614,536 L 654,568 L 970,568 L 1010,598 L 1340,598 L 1380,568 L 1650,568',
  /* verticais */
  'M 640,86  L 640,208 L 668,236 L 668,354',
  'M 1030,118 L 1030,254 L 1060,280 L 1060,388',
  'M 614,536 L 614,700',
]
const B_NODES = [
  {cx:290,cy:118},{cx:640,cy:86}, {cx:1030,cy:118},{cx:1390,cy:144},
  {cx:245,cy:388},{cx:595,cy:354},{cx:950,cy:388}, {cx:1310,cy:418},
  {cx:270,cy:568},{cx:614,cy:536},{cx:970,cy:568}, {cx:1340,cy:598},
  {cx:640,cy:208},{cx:1030,cy:254},{cx:614,cy:700},
]
const B_CURRENTS = [
  { path:'M -50,118 L 290,118 L 330,86 L 640,86 L 680,118 L 1030,118 L 1065,144 L 1390,144', dur:'8s',  begin:'1.5s'},
  { path:'M -50,388 L 245,388 L 285,354 L 595,354 L 635,388 L 950,388',                      dur:'10s', begin:'5s'  },
  { path:'M -50,568 L 270,568 L 312,536 L 614,536 L 654,568 L 970,568',                       dur:'12s', begin:'8.5s'},
]

/* LAYER C — frente, poucas trilhas, movimento rápido */
const C_PATHS = [
  'M -50,248 L 380,248 L 428,206 L 748,206 L 796,248 L 1190,248 L 1240,286 L 1650,286',
  'M -50,500 L 340,500 L 392,456 L 706,456 L 756,500 L 1110,500 L 1158,538 L 1650,538',
  /* vertical */
  'M 748,206 L 748,384 L 778,414 L 778,456',
]
const C_NODES = [
  {cx:380,cy:248},{cx:748,cy:206},{cx:1190,cy:248},
  {cx:340,cy:500},{cx:706,cy:456},{cx:1110,cy:500},
  {cx:748,cy:384},{cx:778,cy:456},
]
const C_CURRENTS = [
  { path:'M -50,248 L 380,248 L 428,206 L 748,206 L 796,248 L 1190,248 L 1240,286', dur:'7s',  begin:'0.5s'},
  { path:'M -50,500 L 340,500 L 392,456 L 706,456 L 756,500 L 1110,500',             dur:'9s',  begin:'3.5s'},
]

/* ─── Sub-componente: uma camada de trilhas SVG ─── */
function CircuitLayer({ paths, nodes, currents, strokeColor, nodeColor, dotColor, strokeWidth, nodeR, dotR, animate }) {
  return (
    <svg
      viewBox="0 0 1600 750"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {/* Trilhas */}
      {paths.map((d, i) => (
        <path
          key={`p${i}`}
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Nós de junção */}
      {nodes.map((n, i) => (
        <circle key={`n${i}`} cx={n.cx} cy={n.cy} r={nodeR} fill={nodeColor} />
      ))}

      {/* Pontos de corrente animados */}
      {animate && currents.map((c, i) => (
        <circle key={`d${i}`} r={dotR} fill={dotColor}>
          <animateMotion
            dur={c.dur}
            begin={c.begin}
            repeatCount="indefinite"
            path={c.path}
          />
        </circle>
      ))}
    </svg>
  )
}

/* ─── Componente principal ─── */
export default function HeroBackground() {
  const [videoLoaded, setVideoLoaded] = useState(false)

  /* prefers-reduced-motion */
  const prefersReduced = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  ).current

  /* Apenas desktop com hover real (não touch) */
  const isHover = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
      : false
  ).current

  /* Motion values — normalizado -0.5 a 0.5 */
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  /* Spring suave: stiffness baixo para movimento elegante */
  const smoothX = useSpring(rawX, { stiffness: 45, damping: 22 })
  const smoothY = useSpring(rawY, { stiffness: 45, damping: 22 })

  /* Transformações por camada (amplitude sutil) */
  const xA = useTransform(smoothX, v => v * 18)
  const yA = useTransform(smoothY, v => v * 12)
  const xB = useTransform(smoothX, v => v * 32)
  const yB = useTransform(smoothY, v => v * 21)
  const xC = useTransform(smoothX, v => v * 50)
  const yC = useTransform(smoothY, v => v * 32)

  /* Listener de mouse — throttled via requestAnimationFrame.
     rawX/rawY só são atualizados 1× por frame de renderização,
     independente de quantos eventos brutos de mousemove dispararem. */
  useEffect(() => {
    if (prefersReduced || !isHover) return

    let rafHandle = null

    const onMove = (e) => {
      // Cancela frame pendente para não empilhar chamadas
      if (rafHandle !== null) cancelAnimationFrame(rafHandle)

      rafHandle = requestAnimationFrame(() => {
        rawX.set(e.clientX / window.innerWidth - 0.5)
        rawY.set(e.clientY / window.innerHeight - 0.5)
        rafHandle = null
      })
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (rafHandle !== null) cancelAnimationFrame(rafHandle)
    }
  }, [rawX, rawY, prefersReduced, isHover])

  /* Animações dos pontos de corrente apenas se não for reduced-motion */
  const animateDots = !prefersReduced

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    >
      {/* ── Fundo base: azul-petróleo profundo ── */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 120% 90% at 32% 48%, ${C.bgDeep} 0%, ${C.bg} 58%, #04070C 100%)`,
        }}
      />

      {/* ── Vídeo atmosférico ── */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: videoLoaded && !prefersReduced ? 0.32 : 0,
          transition: 'opacity 1.8s ease',
          filter: 'blur(0.6px) saturate(0.85)',
        }}
        autoPlay={!prefersReduced}
        loop
        muted
        playsInline
        poster="/video2-poster.svg"
        onCanPlay={() => setVideoLoaded(true)}
      >
        <source src="/video2-bg.mp4" type="video/mp4" />
      </video>

      {/* ── Overlay: gradiente direcional com profundidade ── */}
      {/* Não é um flat rgba genérico — tem direção e tonal azul-petróleo */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(145deg,',
            `  rgba(6,13,24,0.76) 0%,`,
            `  rgba(7,10,15,0.50) 40%,`,
            `  rgba(6,13,24,0.70) 100%`,
            ')',
          ].join(''),
        }}
      />

      {/* ── Layer A — trilhas distantes, parallax lento ── */}
      <motion.div
        className="absolute"
        style={{
          top: '-5%', left: '-5%', width: '110%', height: '110%',
          x: prefersReduced ? 0 : xA,
          y: prefersReduced ? 0 : yA,
        }}
      >
        <CircuitLayer
          paths={A_PATHS}
          nodes={A_NODES}
          currents={A_CURRENTS}
          strokeColor={C.copperFar}
          nodeColor={C.nodeFar}
          dotColor={C.dotFar}
          strokeWidth={0.5}
          nodeR={1.4}
          dotR={2.0}
          animate={animateDots}
        />
      </motion.div>

      {/* ── Layer B — trilhas médias ── */}
      <motion.div
        className="absolute"
        style={{
          top: '-5%', left: '-5%', width: '110%', height: '110%',
          x: prefersReduced ? 0 : xB,
          y: prefersReduced ? 0 : yB,
        }}
      >
        <CircuitLayer
          paths={B_PATHS}
          nodes={B_NODES}
          currents={B_CURRENTS}
          strokeColor={C.copperMid}
          nodeColor={C.nodeMid}
          dotColor={C.dotMid}
          strokeWidth={0.8}
          nodeR={1.9}
          dotR={2.5}
          animate={animateDots}
        />
      </motion.div>

      {/* ── Layer C — trilhas próximas, parallax rápido ── */}
      <motion.div
        className="absolute"
        style={{
          top: '-5%', left: '-5%', width: '110%', height: '110%',
          x: prefersReduced ? 0 : xC,
          y: prefersReduced ? 0 : yC,
        }}
      >
        <CircuitLayer
          paths={C_PATHS}
          nodes={C_NODES}
          currents={C_CURRENTS}
          strokeColor={C.copperNear}
          nodeColor={C.nodeNear}
          dotColor={C.dotNear}
          strokeWidth={1.2}
          nodeR={2.4}
          dotR={3.2}
          animate={animateDots}
        />
      </motion.div>

      {/* ── Vinheta de borda: reforça profundidade ── */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 160px rgba(4,7,12,0.55)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Degradê de saída na base (fusão com seção seguinte) ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-28"
        style={{
          background: `linear-gradient(to bottom, transparent, ${C.bg})`,
        }}
      />
    </div>
  )
}
