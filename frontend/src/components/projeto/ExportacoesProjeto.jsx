import { AlertTriangle, FileArchive, FileSpreadsheet, FileText, Lock } from 'lucide-react'
import { Button, SectionHeader } from '../ui'

function LinhaRelatorio({ icon: Icon, titulo, descricao, onClick, disabled, label }) {
  return <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 last:border-0 sm:flex-row sm:items-center"><Icon size={19} className="shrink-0 text-slate-500" /><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-slate-900">{titulo}</h3><p className="text-sm text-slate-500">{descricao}</p></div><Button size="sm" variant={disabled ? 'secondary' : 'primary'} onClick={onClick} disabled={disabled} icon={disabled ? Lock : Icon}>{label}</Button></div>
}
export default function ExportacoesProjeto({ fluxo, onExportPdf, onExportExcel, onExportPreliminarPdf, onExportPreliminarExcel }) {
  const bloqueado = !fluxo?.relatorioFinalLiberado
  return <div className="mx-auto max-w-[1100px] space-y-5">
    <SectionHeader title="Relatórios" description="Emissão documental e arquivos técnicos do projeto." />
    <div className="flex gap-3 border border-slate-300 bg-white p-4"><AlertTriangle size={18} className={bloqueado ? 'text-amber-700' : 'text-slate-500'} /><div><p className="text-sm font-semibold text-slate-900">{bloqueado ? 'Emissão final bloqueada' : 'Emissão final disponível'}</p><p className="mt-0.5 text-sm text-slate-600">{bloqueado ? 'Complete os dados mínimos e resolva os circuitos bloqueados.' : fluxo?.naoAvaliados ? `${fluxo.naoAvaliados} verificação(ões) não avaliada(s) devem constar como ressalva.` : 'Dados mínimos completos para gerar os documentos.'}</p></div></div>
    <div className="border border-slate-200 bg-white"><LinhaRelatorio icon={FileText} titulo="Memorial final em PDF" descricao="Documento técnico consolidado para revisão e registro final." onClick={onExportPdf} disabled={bloqueado} label="Gerar PDF final" /><LinhaRelatorio icon={FileSpreadsheet} titulo="Planilha final Excel" descricao="Dados de projeto e circuitos em formato tabular final." onClick={onExportExcel} disabled={bloqueado} label="Gerar Excel final" /><LinhaRelatorio icon={FileArchive} titulo="Pacote técnico" descricao="Agrupamento de documentos e anexos; previsto para versão futura." disabled label="Indisponível" /></div>
    {fluxo?.relatorioPreliminarDisponivel && bloqueado && <div className="border border-amber-200 bg-amber-50"><LinhaRelatorio icon={FileText} titulo="Relatório preliminar em PDF" descricao="Documento identificado como preliminar e não liberado para emissão final." onClick={onExportPreliminarPdf} label="Gerar preliminar" /><LinhaRelatorio icon={FileSpreadsheet} titulo="Planilha preliminar Excel" descricao="Abas de controle, projeto, circuitos, alertas e validação usando o snapshot atual." onClick={onExportPreliminarExcel} label="Gerar preliminar" /></div>}
  </div>
}
