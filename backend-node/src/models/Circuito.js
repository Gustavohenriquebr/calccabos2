'use strict'

const mongoose = require('mongoose')

/**
 * Circuito — espelho exato do model Python (circuito.py)
 * 52 campos mapeados 1:1 com tipos Mongoose equivalentes
 */
const CircuitoSchema = new mongoose.Schema(
  {
    projetoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Projeto',
      required: true,
      index: true,
      immutable: true,
    },
    ordem:    { type: Number, default: 0, min: 0 },
    descricao: { type: String, required: true, trim: true, maxlength: 200 },

    // ── Dados elétricos de entrada ─────────────────────────────────────────
    tensao:       { type: Number, default: 380, min: 1, max: 2000000 },
    tensao_unidade: { type: String, enum: ['V', 'kV'], default: 'V' },
    tipo_sistema_tensao: { type: String, enum: ['AC', 'DC'], default: 'AC' },
    referencia_tensao_dc: { type: String, default: null, trim: true, maxlength: 80 },
    contexto_aplicacao: { type: String, default: null, trim: true, maxlength: 120 },
    potencia_kw:  { type: Number, required: true, min: 0, max: 1000000 },
    potencia_kva: { type: Number, default: null, min: 0, max: 1000000 },
    fator_potencia:       { type: Number, default: 0.85, min: 0.01, max: 1 },
    distancia_m:          { type: Number, required: true, min: 0, max: 100000 },
    tipo_cabo: {
      type: String,
      enum: ['CU-PVC', 'CU-XLPE', 'AL-PVC', 'AL-XLPE'],
      default: 'CU-PVC',
    },
    temp_ambiente:  { type: Number, default: 30, min: -50, max: 120 },
    fases:          { type: Number, default: 3, enum: [1, 2, 3] },
    agrupamento:    { type: Number, default: 1, min: 1, max: 200 },
    corrente_ac_dc: { type: String, enum: ['AC', 'DC'], default: 'AC' },
    fator_demanda:           { type: Number, default: 1.0, min: 0, max: 1 },
    fator_eficiencia:        { type: Number, default: 1.0, min: 0.01, max: 1 },
    metodo_instalacao:       { type: String, default: 'TRAY', trim: true, maxlength: 80 },
    formacao:                { type: Number, default: 1, min: 1, max: 20 },
    comprimento_real:        { type: Number, default: null, min: 0 },
    queda_tensao_alimentador:{ type: Number, default: 0.0, min: 0 },
    isc_local:               { type: Number, default: null, min: 0 },
    usar_kva_informado:      { type: Boolean, default: false },
    configuracao_eletrica:   { type: String, default: null, trim: true, maxlength: 200 },
    referencia_tensao:       { type: String, default: null, trim: true, maxlength: 200 },
    modo_entrada:            { type: String, default: null, trim: true, maxlength: 200 },
    base_potencia:           { type: String, default: null, trim: true, maxlength: 200 },
    corrente_informada:      { type: Number, default: null, min: 0 },
    aplicacao_circuito:      { type: String, default: null, trim: true, maxlength: 200 },
    secao_minima_aplicacao:  { type: Number, default: null, min: 0 },
    secao_minima_mecanica:   { type: Number, default: null, min: 0 },
    queda_tensao_limite:     { type: Number, default: null, min: 0 },

    // ── Dados executivos de entrada ────────────────────────────────────────
    tag:              { type: String, default: null, trim: true, maxlength: 200 },
    from_barramento:  { type: String, default: null, trim: true, maxlength: 200 },
    to_equipamento:   { type: String, default: null, trim: true, maxlength: 200 },
    protection_device:{ type: String, default: null, trim: true, maxlength: 200 },
    modo_dimensionamento:       { type: String, default: 'manual', trim: true, maxlength: 80 },
    modo_selecao_componentes:   { type: String, default: 'manual', trim: true, maxlength: 80 },
    disjuntor_tensao_nominal:   { type: Number, default: null, min: 0 },
    disjuntor_corrente_nominal: { type: Number, default: null, min: 0 },
    disjuntor_icu:              { type: Number, default: null, min: 0 },
    disjuntor_curva:            { type: String, default: null, trim: true, maxlength: 80 },
    disjuntor_fabricante:       { type: String, default: null, trim: true, maxlength: 200 },
    protecao_curva_fonte:       { type: String, default: null, trim: true, maxlength: 500 },
    protecao_curva_pontos:      { type: [mongoose.Schema.Types.Mixed], default: [] },

    // ── Campos MT/AT ───────────────────────────────────────────────────────
    classe_tensao_kv:   { type: Number, default: null, min: 0 },
    nbi_kv:             { type: Number, default: null, min: 0 },
    tafi_ka:            { type: Number, default: null, min: 0 },
    sequencia_operacao: { type: String, default: null, trim: true, maxlength: 200 },
    meio_extincao:      { type: String, default: null, trim: true, maxlength: 200 },
    tipo_acionamento:   { type: String, default: null, trim: true, maxlength: 200 },
    acessorios:         { type: mongoose.Schema.Types.Mixed, default: null },
    modelo:             { type: String, default: null, trim: true, maxlength: 200 },
    norma_referencia:   { type: String, default: null, trim: true, maxlength: 200 },

    // ── Resultados calculados (preenchidos pelo FastAPI) ───────────────────
    corrente_nominal:  { type: Number, default: null },
    secao_mm2:         { type: Number, default: null },
    disjuntor_a:       { type: Number, default: null },
    queda_tensao_pct:  { type: Number, default: null },
    secao_pe_mm2:      { type: Number, default: null },
    ampacidade:        { type: Number, default: null },
    status:            { type: String, default: null },

    corrente_projeto:   { type: Number, default: null },
    corrente_corrigida: { type: Number, default: null },
    fator_k1:           { type: Number, default: null },
    fator_k2:           { type: Number, default: null },
    fator_k3:           { type: Number, default: null },
    corrente_condutor:  { type: Number, default: null },
    ampacidade_corrigida_total: { type: Number, default: null },
    tensao_fase:        { type: Number, default: null },
    isc_cabo:           { type: Number, default: null },
    tempo_atuacao:      { type: Number, default: null },
    secao_joule:        { type: Number, default: null },
    impedancia_rdc:     { type: Number, default: null },
    impedancia_rac:     { type: Number, default: null },
    impedancia_xl:      { type: Number, default: null },
    queda_tensao_max:       { type: Number, default: null },
    queda_tensao_acumulada: { type: Number, default: null },
    tipo_cabo_comercial:    { type: String, default: null },
    nota_tecnica:           { type: String, default: null },
    revisao:                { type: String, default: null },
    status_final:           { type: String, default: null },
    protecao_status:        { type: String, default: null },
    protecao_nota:          { type: String, default: null },
    protecao_avaliacao_status: { type: String, default: null },
    protecao_verificacoes:  { type: mongoose.Schema.Types.Mixed, default: null },
    validacao_status:       { type: String, default: null },
    validacao_mensagem:     { type: String, default: null },
    validacao_detalhes:     { type: mongoose.Schema.Types.Mixed, default: null },

    cabo_sugerido_secao:          { type: Number, default: null },
    cabo_sugerido_tipo_comercial: { type: String, default: null },
    cabo_sugerido_ampacidade:     { type: Number, default: null },
    disjuntor_sugerido_in:        { type: Number, default: null },
    disjuntor_sugerido_icu:       { type: Number, default: null },
    disjuntor_sugerido_curva:     { type: String, default: null },
    selecao_componentes_status:         { type: String, default: null },
    selecao_componentes_justificativa:  { type: String, default: null },

    // Snapshot auditável aditivo; campos planos legados continuam disponíveis.
    resultado:          { type: mongoose.Schema.Types.Mixed, default: null },
    criterios:          { type: mongoose.Schema.Types.Mixed, default: null },
    decisao:            { type: mongoose.Schema.Types.Mixed, default: null },
    memorial:           { type: mongoose.Schema.Types.Mixed, default: null },
    alertas:            { type: [mongoose.Schema.Types.Mixed], default: [] },
    premissas:          { type: [mongoose.Schema.Types.Mixed], default: [] },
    limitacoes:         { type: [String], default: [] },
    metadados_calculo:  { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: 'criado_em', updatedAt: 'atualizado_em' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Cobrindo index: WHERE projetoId = ? ORDER BY ordem  (idêntico ao Python)
CircuitoSchema.index({ projetoId: 1, ordem: 1 })
CircuitoSchema.index({ projetoId: 1, tag: 1 }, { sparse: true })
CircuitoSchema.index({ projetoId: 1, status_final: 1 })

module.exports = mongoose.model('Circuito', CircuitoSchema)
