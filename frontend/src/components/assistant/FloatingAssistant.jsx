import { useEffect, useMemo, useRef } from 'react'
import { Bot, HelpCircle, Maximize2, MessageCircle, Minus, Send, Sparkles, X, Zap } from 'lucide-react'
import { StatusBadge } from '../ui'

const QUICK_ACTIONS_BY_TAB = {
  'visao-geral': ['Resumir projeto', 'O que falta preencher?', 'Listar críticos'],
  circuitos: ['Verificar críticos', 'Maior queda de tensão', 'Justificar cabo'],
  transformador: ['Explicar Icc do transformador', 'Verificar coerência do trafo', 'O que significa Z%?'],
  'sistema-trifasico': ['Explicar sistema trifásico', 'Validar potências totais', 'Ver corrente de linha'],
  protecoes: ['Verificar proteção geral', 'Icu está adequado?', 'Listar proteções críticas'],
  'para-raios': ['Explicar para-raios', 'O que falta no para-raios?', 'Revisar Vn escolhido'],
  aterramento: ['Explicar aterramento', 'Analisar medições Wenner', 'Classificar solo'],
  'areas-classificadas': ['Verificar equipamentos Ex', 'Listar áreas críticas', 'Explicar zonas Ex'],
  memorial: ['Resumir memorial', 'Gerar conclusão técnica', 'Destacar pendências'],
  'diagrama-unifilar': ['Explicar diagrama', 'Verificar barramento', 'Resumir conexões principais'],
}

const TAB_LABELS = {
  'visao-geral': 'Visão Geral',
  circuitos: 'Circuitos',
  transformador: 'Transformador',
  'sistema-trifasico': 'Sistema Trifásico',
  protecoes: 'Proteções',
  'para-raios': 'Para-raios',
  aterramento: 'Aterramento',
  'areas-classificadas': 'Áreas Classificadas',
  memorial: 'Memorial',
  'diagrama-unifilar': 'Diagrama Unifilar',
}

function statusProjeto(health) {
  return health?.status || health?.statusGeral || health?.overallStatus || 'ALERTA'
}

export default function FloatingAssistant({
  open,
  onOpen,
  onClose,
  onMinimize,
  messages,
  inputValue,
  onInputChange,
  onSend,
  loading,
  abaAtiva,
  projeto,
  health,
  setInputMsg,
}) {
  const listRef = useRef(null)
  const quickActions = QUICK_ACTIONS_BY_TAB[abaAtiva] || ['Resumir projeto', 'Explicar esta aba', 'Verificar pendências']
  const abaLabel = TAB_LABELS[abaAtiva] || 'Projeto'
  const projetoNome = projeto?.nome || 'Projeto atual'
  const status = useMemo(() => statusProjeto(health), [health])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, loading, open])

  function usarAtalho(texto) {
    setInputMsg?.(texto)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend?.()
    }
  }

  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="fixed bottom-5 right-5 z-40 group"
        title="Assistente CalcCabos"
        aria-label="Abrir Assistente CalcCabos"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-xl transition-all group-hover:bg-blue-500/50" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-slate-950 text-white shadow-2xl ring-4 ring-slate-900/5 transition-all group-hover:-translate-y-1 group-hover:scale-105">
            <Bot size={28} />
            <span className="absolute right-1 top-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-slate-950 bg-emerald-400" />
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-lg group-hover:block">
            Assistente CalcCabos
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex w-[min(420px,calc(100vw-32px))] max-h-[min(720px,calc(100vh-40px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="bg-slate-950 px-4 py-3 text-white">
        <div className="flex items-start gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <Bot size={22} />
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold">Assistente CalcCabos</h3>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">online</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-300">{projetoNome} · {abaLabel}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onMinimize}
              className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Minimizar"
              aria-label="Minimizar assistente"
            >
              <Minus size={16} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Fechar"
              aria-label="Fechar assistente"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <Zap size={12} /> Contexto ativo
            </div>
            <div className="mt-1 truncate text-xs text-slate-200">Aba: {abaLabel}</div>
          </div>
          <div className="flex items-center">
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        Pergunte sobre o site, o projeto, circuitos, módulos técnicos, memorial, diagrama, PDF, Excel ou critérios de engenharia.
      </div>

      <div ref={listRef} className="min-h-[280px] flex-1 overflow-y-auto bg-slate-50/70 p-4">
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm whitespace-pre-wrap ${
                message.role === 'user'
                  ? 'rounded-br-md bg-slate-900 text-white'
                  : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
              }`}>
                {message.content}
                {message.modelo && (
                  <div className="mt-1 text-[10px] italic text-slate-400">via {message.modelo}</div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
                <Sparkles size={13} />
                Analisando contexto
                <span className="flex gap-1">
                  {[0, 1, 2].map((n) => (
                    <span key={n} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${n * 0.15}s` }} />
                  ))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-white p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {quickActions.map((text) => (
            <button
              key={text}
              onClick={() => usarAtalho(text)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:border-slate-900 hover:text-slate-900"
            >
              {text}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="input min-h-[40px] max-h-28 w-full resize-none pr-9 text-xs"
              placeholder="Pergunte ao assistente..."
            />
            <HelpCircle size={14} className="pointer-events-none absolute right-3 top-3 text-slate-300" />
          </div>
          <button
            onClick={onSend}
            disabled={loading || !inputValue.trim()}
            className="btn btn-primary flex h-10 items-center gap-2 px-3 disabled:cursor-not-allowed disabled:opacity-50"
            title="Enviar"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
