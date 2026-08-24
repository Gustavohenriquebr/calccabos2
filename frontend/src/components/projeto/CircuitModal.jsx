import React from 'react';
import { Save, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { SectionHeader, StatusBadge, Alert } from '../ui';
import { ProtecaoMTATSection } from './ProtecaoMTATSection';

const CircuitModalComponent = ({
  modalC,
  setModalC,
  salvarCircuito,
  fmt,
  tipoCabo,
  normalizarStatus,
  statusLabel,
  statusFinal,
  C_VAZIO,
  TIPOS,
  TENSOES,
  METODOS,
  DISPOSITIVOS,
  CURVAS_DISJUNTOR,
  REPAROS_TEXTO,
  Campo,
  LabelWithTooltip
}) => {
  const [draftC, setDraftC] = React.useState(modalC || {});

  React.useEffect(() => {
    if (!modalC) return;
    // FIX: Guard by circuit identity, not object reference.
    // The parent creates a new { ...c } on every setModalC call, so the previous
    // unconditional sync would reset the entire draft on ANY parent re-render,
    // silently discarding the user's uncommitted edits.
    // Only sync when the circuit actually changes (different id, or new circuit).
    const prevId = draftC?.id ?? null;
    const nextId = modalC?.id ?? null;
    if (prevId !== nextId) {
      setDraftC(modalC);
    }
  }, [modalC]);

  if (!draftC || !modalC) return null;

  const calcKva = (draftC.potencia_kw && draftC.fator_potencia && draftC.fator_eficiencia) ? 
    (Number(draftC.potencia_kw) / (Number(draftC.fator_potencia) * Number(draftC.fator_eficiencia))) : 0;
  
  const diffKva = calcKva > 0 && draftC.potencia_kva && !draftC.usar_kva_informado ? 
    Math.abs(Number(draftC.potencia_kva) - calcKva) / calcKva : 0;
  const kvaIncoerente = diffKva > 0.20;

  const eff = draftC.fator_eficiencia !== '' && draftC.fator_eficiencia !== undefined && draftC.fator_eficiencia !== null ? Number(draftC.fator_eficiencia) * 100 : null;
  const effError = eff !== null && (eff <= 0 || eff > 100);
  const effWarning = eff !== null && eff < 50 && eff > 0;

  const fp = draftC.fator_potencia !== '' && draftC.fator_potencia !== undefined && draftC.fator_potencia !== null ? Number(draftC.fator_potencia) : null;
  const fpError = fp !== null && (fp <= 0 || fp > 1);
  const fpWarning = fp !== null && fp < 0.7 && fp > 0;

  const icu = Number(draftC.disjuntor_icu || 0);
  const icc = Number(draftC.isc_local || 0);
  const icuCritico = icu > 0 && icc > 0 && icu < icc;
  const icuAlerta = icu > 0 && icc > 0 && icu >= icc && icu <= icc * 1.10;

  const dist = Number(draftC.distancia_m || 0);
  const distZero = draftC.distancia_m !== '' && draftC.distancia_m !== undefined && draftC.distancia_m !== null && dist === 0;
  const distElevada = dist > 500;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
      <div className="card w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden bg-white shadow-2xl rounded-xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">{draftC.id ? 'Editar Circuito' : 'Novo Circuito'}</h3>
          <div className="flex items-center gap-3">
            <StatusBadge status={statusLabel(statusFinal(draftC))} />
            <button
              onClick={() => setModalC(null)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md p-1 transition-colors"
              title="Fechar"
              aria-label="Fechar modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <div className="grid grid-cols-5 gap-2">
            {['Identificação', 'Carga elétrica', 'Cabo e instalação', 'Proteção', 'Resultado'].map((etapa, index) => (
              <a key={etapa} href={`#circuito-etapa-${index + 1}`} className="rounded-lg bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">{index + 1}</span>
                <span className="hidden sm:inline">{etapa}</span>
              </a>
            ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30">
          {/* SEÇÃO 1 — Identificação */}
          <section id="circuito-etapa-1" className="scroll-mt-4 space-y-4">
            <SectionHeader title="1. Identificação" description="Dados básicos de identificação do circuito." />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Campo label="TAG do circuito">
                <input className="input w-full" value={draftC.tag || ''} onChange={(e) => setDraftC((m) => ({ ...m, tag: e.target.value }))} />
              </Campo>
              <Campo label="Descrição" className="md:col-span-3">
                <input className="input w-full" data-testid="input-descricao" value={draftC.descricao || ''} onChange={(e) => setDraftC((m) => ({ ...m, descricao: e.target.value }))} />
              </Campo>
              <Campo label="De (FROM)" className="md:col-span-2">
                <input className="input w-full" value={draftC.from_barramento || ''} onChange={(e) => setDraftC((m) => ({ ...m, from_barramento: e.target.value }))} />
              </Campo>
              <Campo label="Para (TO)" className="md:col-span-2">
                <input className="input w-full" value={draftC.to_equipamento || ''} onChange={(e) => setDraftC((m) => ({ ...m, to_equipamento: e.target.value }))} />
              </Campo>
              <Campo label="Revisão">
                <input className="input w-full" value={draftC.revisao || ''} onChange={(e) => setDraftC((m) => ({ ...m, revisao: e.target.value }))} />
              </Campo>
              <Campo label="Nota técnica" className="md:col-span-3">
                <textarea className="input w-full min-h-[80px] resize-y" value={draftC.nota_tecnica || ''} onChange={(e) => setDraftC((m) => ({ ...m, nota_tecnica: e.target.value }))} />
              </Campo>
            </div>
          </section>

          {/* SEÇÃO 2 — Carga Elétrica */}
          <section id="circuito-etapa-2" className="scroll-mt-4 space-y-4">
            <SectionHeader title="2. Carga Elétrica" description="Parâmetros elétricos e potência do equipamento." />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Campo label="Tensão (V)">
                <select className="input w-full" data-testid="select-tensao" value={draftC.tensao ?? 380} onChange={(e) => setDraftC((m) => ({ ...m, tensao: e.target.value }))}>
                  {TENSOES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Campo>
              <Campo label="Fases">
                <select className="input w-full" value={draftC.fases ?? 3} onChange={(e) => setDraftC((m) => ({ ...m, fases: e.target.value }))}>
                  <option value={1}>Monofásico</option>
                  <option value={3}>Trifásico</option>
                </select>
              </Campo>
              <Campo label="Corrente (AC/DC)">
                <select className="input w-full" value={draftC.corrente_ac_dc || 'AC'} onChange={(e) => setDraftC((m) => ({ ...m, corrente_ac_dc: e.target.value }))}>
                  <option value="AC">AC</option>
                  <option value="DC">DC</option>
                </select>
              </Campo>
              <Campo label="Potência (kW)">
                <input type="number" className="input w-full" data-testid="input-potencia-kw" value={draftC.potencia_kw ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, potencia_kw: e.target.value }))} />
              </Campo>
              <Campo label={<LabelWithTooltip label="Potência Aparente (kVA)" tooltip="Se kW, FP e eficiência forem informados, o sistema calcula o kVA automaticamente. Use kVA manual apenas quando tiver esse valor validado." />}>
                <input type="number" className="input w-full" placeholder="auto" value={draftC.potencia_kva ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, potencia_kva: e.target.value }))} />
                <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer w-fit">
                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={Boolean(draftC.usar_kva_informado)} onChange={(e) => setDraftC((m) => ({ ...m, usar_kva_informado: e.target.checked }))} />
                  Fixar kVA informado
                </label>
              </Campo>
              <Campo label={<LabelWithTooltip label="Fator de Potência (FP)" tooltip="Fator de potência entre 0 e 1. Motores industriais costumam ficar entre 0,80 e 0,95." />}>
                <input type="number" step="0.01" min="0.1" max="1" className="input w-full" data-testid="input-fator-potencia" value={draftC.fator_potencia ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, fator_potencia: e.target.value }))} />
              </Campo>
              <Campo label={<LabelWithTooltip label="Eficiência (η %)" tooltip="Informe em porcentagem. Exemplo: 91 significa 91%, não 0,91." />}>
                <input type="number" step="0.1" min="1" max="100" className="input w-full" data-testid="input-fator-eficiencia" value={draftC.fator_eficiencia === '' ? '' : Number(draftC.fator_eficiencia ?? 1) * 100} onChange={(e) => setDraftC((m) => ({ ...m, fator_eficiencia: e.target.value === '' ? '' : Number(e.target.value) / 100 }))} />
              </Campo>
              <Campo label="Fator de Demanda (n)">
                <input type="number" step="0.01" min="0" className="input w-full" value={draftC.fator_demanda ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, fator_demanda: e.target.value }))} />
              </Campo>
              
              {kvaIncoerente && (
                <div className="col-span-full">
                  <Alert variant="warning" icon={AlertTriangle} title="Atenção">
                    O kVA informado parece incompatível com kW, FP e eficiência. O cálculo usará kW/FP/η, salvo se você marcar 'Fixar kVA informado'.
                  </Alert>
                </div>
              )}
              {(fpError || effError) && (
                <div className="col-span-full">
                  <Alert variant="danger" icon={AlertCircle} title="Erro">
                    {fpError ? "Fator de potência deve estar entre 0 e 1." : "Eficiência deve ser informada em porcentagem. Exemplo: 91 para 91%."}
                  </Alert>
                </div>
              )}
              {(!fpError && !effError && (fpWarning || effWarning)) && (
                <div className="col-span-full">
                  <Alert variant="info" icon={Info} title="Dica">
                    {fpWarning ? "FP baixo. Verifique se o valor está correto para este tipo de carga." : "Eficiência muito baixa. Verifique se o valor informado está correto para este equipamento."}
                  </Alert>
                </div>
              )}
            </div>
          </section>

          {/* SEÇÃO 3 — Instalação / Cabo */}
          <section id="circuito-etapa-3" className="scroll-mt-4 space-y-4">
            <SectionHeader title="3. Instalação e Condutores" description="Dados construtivos e de trajeto para o dimensionamento térmico." />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <Campo label="Distância Elétrica (m)">
                <input type="number" className="input w-full" data-testid="input-distancia-m" value={draftC.distancia_m ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, distancia_m: e.target.value }))} />
              </Campo>
              <Campo label="Comprimento Real (m)">
                <input type="number" className="input w-full" placeholder="Igual à distância" value={draftC.comprimento_real ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, comprimento_real: e.target.value }))} />
              </Campo>
              <Campo label="Tipo de Isolante/Cabo">
                <select className="input w-full" data-testid="select-tipo-cabo" value={tipoCabo(draftC.tipo_cabo) || 'CU-PVC'} onChange={(e) => setDraftC((m) => ({ ...m, tipo_cabo: e.target.value }))}>
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Campo>
              <Campo label={<LabelWithTooltip label="Método de Instalação" tooltip="Método de instalação conforme normas (Ex: Bandejamento, Eletroduto embutido)." />}>
                <select className="input w-full" value={draftC.metodo_instalacao || 'TRAY'} onChange={(e) => setDraftC((m) => ({ ...m, metodo_instalacao: e.target.value }))}>
                  {METODOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Campo>
              <Campo label="Temp. Ambiente (°C)">
                <input type="number" className="input w-full" value={draftC.temp_ambiente ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, temp_ambiente: e.target.value }))} />
              </Campo>
              <Campo label={<LabelWithTooltip label="Agrupamento (K2)" tooltip="Quantidade de circuitos agrupados no mesmo trajeto." />}>
                <input type="number" min="1" max="20" className="input w-full" value={draftC.agrupamento ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, agrupamento: e.target.value }))} />
              </Campo>
              <Campo label={<LabelWithTooltip label="Cabos por Fase" tooltip="Formação de cabos em paralelo por fase." />}>
                <input type="number" min="1" max="12" className="input w-full" value={draftC.formacao ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, formacao: e.target.value }))} />
              </Campo>
              <Campo label={<LabelWithTooltip label="QT Acumulada (%)" tooltip="Queda de tensão já acumulada no alimentador antes deste circuito." />}>
                <input type="number" step="0.01" className="input w-full text-slate-500" value={draftC.queda_tensao_alimentador ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, queda_tensao_alimentador: e.target.value }))} />
              </Campo>

              {(distZero || distElevada) && (
                <div className="col-span-full">
                  <Alert variant="warning" icon={AlertTriangle} title="Aviso">
                    {distZero ? "Distância igual a zero pode invalidar o cálculo de queda de tensão." : "Distância elevada. Verifique queda de tensão e seção do cabo."}
                  </Alert>
                </div>
              )}
            </div>
          </section>

          {/* SEÇÃO 4 — Proteção / Curto-circuito */}
          <section id="circuito-etapa-4" className="scroll-mt-4 space-y-4">
            <SectionHeader title="4. Proteção e Curto-circuito" description="Dispositivos de proteção e esforços dinâmicos." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Dispositivo de Proteção">
                <select className="input w-full" value={draftC.protection_device || 'MCCB'} onChange={(e) => setDraftC((m) => ({ ...m, protection_device: e.target.value }))}>
                  {DISPOSITIVOS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Campo>
              <Campo label="In Disjuntor (A)">
                <input type="number" className="input w-full" placeholder="Automático quando vazio" value={draftC.disjuntor_corrente_nominal ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, disjuntor_corrente_nominal: e.target.value }))} />
              </Campo>
            </div>
            <details className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer list-none font-semibold text-slate-800">Avançado <span className="ml-2 text-xs font-normal text-slate-500">curva, fabricante, Icc, Icu, tempo e MT/AT</span></summary>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <Campo label="Curva (Disjuntor)">
                <select className="input w-full" value={draftC.disjuntor_curva || 'C'} onChange={(e) => setDraftC((m) => ({ ...m, disjuntor_curva: e.target.value }))}>
                  {CURVAS_DISJUNTOR.map((curva) => <option key={curva} value={curva}>{curva}</option>)}
                </select>
              </Campo>
              <Campo label="Vn Disjuntor (V)">
                <input type="number" className="input w-full" placeholder="Auto" value={draftC.disjuntor_tensao_nominal ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, disjuntor_tensao_nominal: e.target.value }))} />
              </Campo>
              <Campo label={<LabelWithTooltip label="Icc Barramento (kA)" tooltip="Corrente de curto-circuito no ponto do circuito, em kA." />}>
                <input type="number" step="0.01" className="input w-full" value={draftC.isc_local ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, isc_local: e.target.value }))} />
              </Campo>
              <Campo label={<LabelWithTooltip label="Icu Disjuntor (kA)" tooltip="Capacidade de interrupção do disjuntor. Deve ser maior ou igual ao Icc local." />}>
                <input type="number" step="0.1" className="input w-full" placeholder="Sugerido por Icc" value={draftC.disjuntor_icu ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, disjuntor_icu: e.target.value }))} />
              </Campo>
              <Campo label={<LabelWithTooltip label="Tempo de Atuação (s)" tooltip="Tempo esperado para o disjuntor atuar em curto-circuito." />}>
                <input type="number" step="0.01" className="input w-full" value={draftC.tempo_atuacao ?? ''} onChange={(e) => setDraftC((m) => ({ ...m, tempo_atuacao: e.target.value }))} />
              </Campo>
              <Campo label="Fabricante">
                <input className="input w-full" value={draftC.disjuntor_fabricante || ''} onChange={(e) => setDraftC((m) => ({ ...m, disjuntor_fabricante: e.target.value }))} />
              </Campo>

              {icuCritico && (
                <div className="col-span-full">
                  <Alert variant="danger" icon={AlertCircle} title="Crítico">
                    Icu menor que Icc local. A proteção pode não suportar a corrente de curto-circuito.
                  </Alert>
                </div>
              )}
              {icuAlerta && !icuCritico && (
                <div className="col-span-full">
                  <Alert variant="warning" icon={AlertTriangle} title="Atenção">
                    Margem baixa entre Icu e Icc. Recomenda-se revisar a capacidade de interrupção.
                  </Alert>
                </div>
              )}
              </div>
              <div className="mt-6 border-t border-slate-100 pt-5">
                <ProtecaoMTATSection draftC={draftC} setDraftC={setDraftC} />
              </div>
            </details>
          </section>

          {/* SEÇÕES DE RESULTADO */}
          <div id="circuito-etapa-5" className="scroll-mt-4 space-y-4 pt-4">
            <SectionHeader title="5. Como chegamos neste resultado?" description="Resultado, critério dominante e verificações disponíveis para este circuito." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SEÇÃO 6 — Dimensionamento */}
            <section className="space-y-4">
              <SectionHeader title="Resultado do dimensionamento" description="Cabo sugerido e justificativa técnica." />
              <div className="bg-slate-100 rounded-lg p-4 border border-slate-200 grid grid-cols-1 gap-4">
                <Campo label={<LabelWithTooltip label="Modo de Seleção" tooltip="Se automático, o sistema selecionará cabo e proteção. Se manual, usará os valores informados." />}>
                  <select className="input w-full bg-white" value={draftC.modo_dimensionamento || draftC.modo_selecao_componentes || 'manual'} onChange={(e) => setDraftC((m) => ({ ...m, modo_dimensionamento: e.target.value, modo_selecao_componentes: e.target.value }))}>
                    <option value="manual">Manual</option>
                    <option value="automatico">Automático (Sugerido)</option>
                  </select>
                </Campo>
                <Campo label="Cabo Sugerido (Calculado)">
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 font-mono font-medium shadow-inner">
                    {draftC.cabo_sugerido_tipo_comercial || draftC.tipo_cabo_comercial || 'Aguardando cálculo...'}
                  </div>
                </Campo>
                <Campo label="Disjuntor Sugerido (Calculado)">
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 font-mono font-medium shadow-inner">
                    {draftC.disjuntor_sugerido_in ? `${fmt(draftC.disjuntor_sugerido_in, 'A', 0)} / ${fmt(draftC.disjuntor_sugerido_icu, 'kA', 1)} / ${draftC.disjuntor_sugerido_curva || '-'}` : 'Aguardando cálculo...'}
                  </div>
                </Campo>
                <Campo label="Justificativa da Seleção (Gargalo Técnico)">
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 shadow-inner min-h-[42px] break-words">
                    {draftC.selecao_componentes_justificativa || '-'}
                  </div>
                </Campo>
                {draftC.decisao?.sections_mm2 && (
                  <Campo label="Comparação dos critérios">
                    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs sm:grid-cols-2">
                      {Object.entries(draftC.decisao.sections_mm2).map(([criterio, secao]) => (
                        <div key={criterio} className="flex justify-between gap-3"><span className="text-slate-500">{criterio.replaceAll('_', ' ')}</span><strong>{secao} mm²</strong></div>
                      ))}
                    </div>
                  </Campo>
                )}
                {draftC.memorial?.steps?.length > 0 && (
                  <Campo label="Fórmulas e substituições">
                    <div className="space-y-2">
                      {draftC.memorial.steps.map((passo) => (
                        <div key={passo.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                          <p className="font-semibold text-slate-800">{passo.title}</p>
                          <p className="mt-1 font-mono text-slate-600">{passo.formula}</p>
                          <p className="mt-1 text-slate-500">{passo.substitution}</p>
                        </div>
                      ))}
                    </div>
                  </Campo>
                )}
              </div>
            </section>

            {/* SEÇÃO 7 — Validação técnica */}
            <section className="space-y-4">
              <SectionHeader title="Alertas e limitações" description="Verificações técnicas retornadas pelo cálculo." />
              <div className="bg-slate-100 rounded-lg p-4 border border-slate-200 grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Campo label="Status da Proteção">
                    <div className="mt-1">
                      {draftC.protecao_status ? <StatusBadge status={normalizarStatus(draftC.protecao_status)} /> : <span className="text-slate-400 text-sm">Pendente</span>}
                    </div>
                  </Campo>
                  <Campo label="Validação Normativa">
                    <div className="mt-1">
                      {draftC.validacao_status ? <StatusBadge status={normalizarStatus(draftC.validacao_status)} /> : <span className="text-slate-400 text-sm">Pendente</span>}
                    </div>
                  </Campo>
                </div>
                <Campo label="Nota da Proteção">
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 shadow-inner min-h-[42px] break-words">
                    {draftC.protecao_nota || '-'}
                  </div>
                </Campo>
                <Campo label="Justificativa Técnica (Alertas)">
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 shadow-inner min-h-[42px] break-words">
                    {draftC.validacao_mensagem || '-'}
                  </div>
                </Campo>
              </div>
            </section>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-200 flex gap-3 justify-end">
          <button onClick={() => setModalC(null)} className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={() => salvarCircuito(draftC)} data-testid="btn-salvar-circuito" className="px-5 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-2">
            <Save size={16} /> Salvar Circuito
          </button>
        </div>
      </div>
    </div>
  );
};

export const CircuitModal = React.memo(CircuitModalComponent);
