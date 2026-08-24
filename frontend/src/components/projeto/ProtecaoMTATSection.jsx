import React from 'react';
import { SectionHeader } from '../ui';
import { Info } from 'lucide-react';

// Reusing the same helper components for visual consistency
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
    <div className="flex items-center gap-1.5 group cursor-help w-fit relative">
      <span>{label}</span>
      <Info size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-slate-100 text-[11px] leading-tight rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] pointer-events-none shadow-xl text-center">
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  )
}

export function ProtecaoMTATSection({ draftC, setDraftC }) {
  return (
    <section className="space-y-4">
      <SectionHeader title="5. Proteção MT/AT (Média/Alta Tensão)" description="Parâmetros opcionais para disjuntores e equipamentos MT/AT." />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Campo label={<LabelWithTooltip label="Classe de Tensão (kV)" tooltip="Tensão nominal do equipamento. Ex: 0.6, 3.6, 7.2, 15, 24, 36 kV." />}>
          <input type="number" step="0.01" min="0" className="input w-full" placeholder="Ex: 15" value={draftC.classe_tensao_kv ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, classe_tensao_kv: e.target.value }))} />
        </Campo>
        <Campo label={<LabelWithTooltip label="NBI (kV)" tooltip="Nível Básico de Isolamento. Coordenação de isolamento conforme norma." />}>
          <input type="number" step="0.1" min="0" className="input w-full" placeholder="Ex: 95" value={draftC.nbi_kv ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, nbi_kv: e.target.value }))} />
        </Campo>
        <Campo label={<LabelWithTooltip label="TAFI (kA)" tooltip="Corrente suportável de curta duração (capacidade térmica). Conforme IEC 62271." />}>
          <input type="number" step="0.1" min="0" className="input w-full" placeholder="Ex: 25" value={draftC.tafi_ka ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, tafi_ka: e.target.value }))} />
        </Campo>
        <Campo label="Sequência de Operação">
          <select className="input w-full" value={draftC.sequencia_operacao || ''} onChange={(e) => setDraftC((m) => ({ ...m, sequencia_operacao: e.target.value }))}>
            <option value="">Selecione...</option>
            <option value="O-0,3s-CO-3min-CO">O-0,3s-CO-3min-CO</option>
            <option value="CO-15s-CO">CO-15s-CO</option>
            <option value="CO-1min-CO">CO-1min-CO</option>
            <option value="O-CO">O-CO</option>
          </select>
        </Campo>
        <Campo label="Meio de Extinção">
          <select className="input w-full" value={draftC.meio_extincao || ''} onChange={(e) => setDraftC((m) => ({ ...m, meio_extincao: e.target.value }))}>
            <option value="">Selecione...</option>
            <option value="SF6">SF6 (Hexafluoreto de Enxofre)</option>
            <option value="Vácuo">Vácuo</option>
            <option value="Óleo">Óleo Mineral</option>
            <option value="Ar">Ar Comprimido</option>
          </select>
        </Campo>
        <Campo label="Tipo de Acionamento">
          <select className="input w-full" value={draftC.tipo_acionamento || ''} onChange={(e) => setDraftC((m) => ({ ...m, tipo_acionamento: e.target.value }))}>
            <option value="">Selecione...</option>
            <option value="Mola">Mola</option>
            <option value="Magnético">Magnético</option>
            <option value="Pneumático">Pneumático</option>
            <option value="Manual">Manual</option>
            <option value="Motorizado">Motorizado</option>
          </select>
        </Campo>
        <Campo label="Modelo do Equipamento">
          <input className="input w-full" placeholder="Ex: VD4/P 17.06.16" value={draftC.modelo || ''} onChange={(e) => setDraftC((m) => ({ ...m, modelo: e.target.value }))} />
        </Campo>
        <Campo label={<LabelWithTooltip label="Norma de Referência" tooltip="Norma técnica aplicável. Ex: IEC 62271-100, NBR IEC 62271-200." />}>
          <input className="input w-full" placeholder="Ex: IEC 62271-100" value={draftC.norma_referencia || ''} onChange={(e) => setDraftC((m) => ({ ...m, norma_referencia: e.target.value }))} />
        </Campo>
        <Campo label={<LabelWithTooltip label="Acessórios (JSON)" tooltip="Acessórios opcionais em formato JSON. Ex: {&quot;bobina_abertura&quot;: true}" />}>
          <textarea className="input w-full min-h-[60px] resize-y font-mono text-xs" placeholder='{"bobina_abertura": true}' value={draftC.acessorios ? JSON.stringify(draftC.acessorios, null, 2) : ''} onChange={(e) => {
            const raw = e.target.value
            if (!raw.trim()) { setDraftC((m) => ({ ...m, acessorios: null })); return }
            try { setDraftC((m) => ({ ...m, acessorios: JSON.parse(raw) })) } catch { /* keep raw until valid JSON */ }
          }} />
        </Campo>
      </div>
    </section>
  );
}
