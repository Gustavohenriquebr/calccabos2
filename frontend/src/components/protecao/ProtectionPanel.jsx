import React, { memo } from 'react';
import { Card, Tooltip } from '../ui';
import { Shield, AlertCircle, CheckCircle, Info, Zap } from 'lucide-react';

const ProtectionPanel = memo(({ circuito }) => {
  if (!circuito) return null;

  const fmtSafe = (val, dec = 2, suffix = '') => {
    if (val === undefined || val === null || Number.isNaN(Number(val)) || !isFinite(val)) {
      return 'N/A';
    }
    return `${Number(val).toFixed(dec)}${suffix}`;
  };

  const getStatusColor = (status) => {
    const s = String(status || '').toUpperCase();
    if (s.includes('CRITICO')) return 'bg-danger-50 text-danger-700 border border-danger-200';
    if (s.includes('ALERTA')) return 'bg-warning-50 text-warning-700 border border-warning-200';
    if (s.includes('OK')) return 'bg-success-50 text-success-700 border border-success-200';
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  };

  const getStatusIcon = (status) => {
    const s = String(status || '').toUpperCase();
    if (s.includes('CRITICO')) return <AlertCircle size={16} className="text-danger-600" />;
    if (s.includes('ALERTA')) return <Info size={16} className="text-warning-600" />;
    if (s.includes('OK')) return <CheckCircle size={16} className="text-success-600" />;
    return <Shield size={16} className="text-slate-500" />;
  };

  const statusNormalizado = String(circuito.protecao_status || circuito.status_final || 'OK').toUpperCase();
  const curva = circuito.disjuntor_curva || circuito.disjuntor_sugerido_curva || 'C';

  const curvaTooltip = curva === 'D' 
    ? 'Proteção para motores e partidas com alto pico de corrente.' 
    : 'Proteção para cargas gerais e iluminação.';

  const isMt = circuito.tensao >= 1000;

  return (
    <Card className="mb-4 bg-white shadow-sm border-slate-200" data-testid="protection-panel">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <Zap size={18} className="text-primary-600" />
          <h3 className="text-sm">Painel de Proteção {isMt ? 'MT/AT' : 'Industrial'} - {circuito.tag || circuito.descricao}</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${getStatusColor(statusNormalizado)}`} data-testid="badge-status-protecao">
          {getStatusIcon(statusNormalizado)}
          {statusNormalizado}
        </div>
      </div>
      
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Corrente de Projeto</span>
          <span className="text-sm font-semibold text-slate-800 mt-1">
            {fmtSafe(circuito.corrente_projeto, 2, ' A')}
          </span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Icc Local (Calculada)</span>
          <span className="text-sm font-semibold text-slate-800 mt-1" data-testid="valor-icc">
            {fmtSafe(circuito.isc_local, 2, ' kA')}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Disjuntor Selecionado</span>
          <span className="text-sm font-semibold text-slate-800 mt-1" data-testid="valor-disjuntor">
            {fmtSafe(circuito.disjuntor_a || circuito.disjuntor_sugerido_in, 0, ' A')}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1">
            Curva
            <Tooltip content={curvaTooltip}>
              <Info size={12} className="text-slate-400 cursor-help" />
            </Tooltip>
          </span>
          <span className="text-sm font-semibold text-slate-800 mt-1" data-testid="valor-curva">
            {curva}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Cap. Interrupção (Icu)</span>
          <span className="text-sm font-semibold text-slate-800 mt-1">
            {fmtSafe(circuito.disjuntor_icu || circuito.disjuntor_sugerido_icu, 2, ' kA')}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Fabricante / Modelo</span>
          <span className="text-sm font-semibold text-slate-800 mt-1 truncate">
            {circuito.disjuntor_fabricante || 'Padrão'} {circuito.modelo ? `/ ${circuito.modelo}` : ''}
          </span>
        </div>
      </div>
      
      <div className="px-4 pb-4 pt-2">
        <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
          <span className="text-xs font-semibold text-slate-600 block mb-1">Justificativa Técnica:</span>
          <p className="text-xs text-slate-700 leading-relaxed">
            {circuito.protecao_nota || circuito.selecao_componentes_justificativa || 'Proteção adequada para os requisitos normativos do projeto.'}
          </p>
        </div>
      </div>
    </Card>
  );
});

export default ProtectionPanel;
