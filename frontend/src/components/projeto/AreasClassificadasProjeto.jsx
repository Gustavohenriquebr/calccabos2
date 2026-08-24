import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Flame, Plus, Save, Trash2 } from 'lucide-react'
import api from '../../services/api'
import {
  Alert,
  Card,
  CardBody,
  MetricCard,
  SectionHeader,
  StatusBadge,
} from '../ui'

const TIPOS_SUBSTANCIA = ['gás', 'vapor', 'poeira']
const ZONAS = ['Zona 0', 'Zona 1', 'Zona 2', 'Zona 20', 'Zona 21', 'Zona 22']
const GRUPOS = ['IIA', 'IIB', 'IIC', 'IIIA', 'IIIB', 'IIIC', 'não aplicável']
const TEMPERATURAS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
const TIPOS_PROTECAO = ['Ex d', 'Ex e', 'Ex i', 'Ex p', 'nenhuma', 'outros']
const TIPOS_EQUIPAMENTO = ['motor', 'painel', 'luminária', 'instrumento', 'caixa de junção', 'outros']

function novoEquipamento(index = 1) {
  return {
    id: `E${Date.now()}-${index}`,
    nome_tag: '',
    tipo: 'motor',
    tipo_protecao_ex: 'Ex d',
    grupo: 'IIB',
    classe_temperatura: 'T4',
    certificado: '',
    observacoes: '',
  }
}

function novaArea(index = 1) {
  return {
    id: `A${Date.now()}-${index}`,
    nome: '',
    tipo_substancia: 'gás',
    zona: 'Zona 2',
    grupo: 'IIB',
    classe_temperatura: 'T4',
    descricao: '',
    observacoes: '',
    circuitos_associados: '',
    equipamentos: [novoEquipamento(1)],
  }
}

function normalizarStatus(status, padrao = 'ALERTA') {
  const texto = String(status || '').trim().toUpperCase()
  if (!texto) return padrao
  if (texto === 'OK') return 'OK'
  if (texto.includes('ALERTA')) return 'ALERTA'
  if (texto.includes('CR')) return 'CRITICO'
  return padrao
}

function Campo({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function normalizarArea(area) {
  return {
    id: area.id || '',
    nome: area.nome || '',
    tipo_substancia: area.tipo_substancia || '',
    zona: area.zona || '',
    grupo: area.grupo || '',
    classe_temperatura: area.classe_temperatura || '',
    descricao: area.descricao || '',
    observacoes: area.observacoes || '',
    circuitos_associados: area.circuitos_associados || '',
    equipamentos: (area.equipamentos || []).map((equipamento) => ({
      id: equipamento.id || '',
      nome_tag: equipamento.nome_tag || '',
      tipo: equipamento.tipo || '',
      tipo_protecao_ex: equipamento.tipo_protecao_ex || '',
      grupo: equipamento.grupo || '',
      classe_temperatura: equipamento.classe_temperatura || '',
      certificado: equipamento.certificado || '',
      observacoes: equipamento.observacoes || '',
    })),
  }
}

export default function AreasClassificadasProjeto({ projeto, onSaved }) {
  const [form, setForm] = useState({ areas: [novaArea()] })
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    carregar()
  }, [projeto?.id])

  async function carregar() {
    if (!projeto?.id) return
    setLoading(true)
    try {
      const r = await api.get(`/projetos/${projeto.id}/areas-classificadas`)
      const areas = r.data.areas?.length ? r.data.areas : [novaArea()]
      setResultado(r.data)
      setForm({ areas })
    } catch {
      toast.error('Erro ao carregar áreas classificadas')
    } finally {
      setLoading(false)
    }
  }

  function setArea(index, campo, valor) {
    setForm((atual) => ({
      areas: atual.areas.map((area, i) => i === index ? { ...area, [campo]: valor } : area),
    }))
  }

  function setEquipamento(areaIndex, equipamentoIndex, campo, valor) {
    setForm((atual) => ({
      areas: atual.areas.map((area, i) => i === areaIndex ? {
        ...area,
        equipamentos: (area.equipamentos || []).map((equipamento, j) => (
          j === equipamentoIndex ? { ...equipamento, [campo]: valor } : equipamento
        )),
      } : area),
    }))
  }

  function adicionarArea() {
    setForm((atual) => ({
      areas: [...(atual.areas || []), novaArea((atual.areas || []).length + 1)],
    }))
  }

  function removerArea(index) {
    setForm((atual) => ({
      areas: atual.areas.length > 1 ? atual.areas.filter((_, i) => i !== index) : [novaArea()],
    }))
  }

  function adicionarEquipamento(areaIndex) {
    setForm((atual) => ({
      areas: atual.areas.map((area, i) => i === areaIndex ? {
        ...area,
        equipamentos: [...(area.equipamentos || []), novoEquipamento((area.equipamentos || []).length + 1)],
      } : area),
    }))
  }

  function removerEquipamento(areaIndex, equipamentoIndex) {
    setForm((atual) => ({
      areas: atual.areas.map((area, i) => i === areaIndex ? {
        ...area,
        equipamentos: (area.equipamentos || []).length > 1
          ? area.equipamentos.filter((_, j) => j !== equipamentoIndex)
          : [novoEquipamento()],
      } : area),
    }))
  }

  async function salvar() {
    setLoading(true)
    try {
      const payload = { areas: (form.areas || []).map(normalizarArea) }
      const r = await api.put(`/projetos/${projeto.id}/areas-classificadas`, payload)
      const areas = r.data.areas?.length ? r.data.areas : [novaArea()]
      setResultado(r.data)
      setForm({ areas })
      await onSaved?.()
      toast.success('Áreas classificadas salvas')
    } catch {
      toast.error('Erro ao salvar áreas classificadas')
    } finally {
      setLoading(false)
    }
  }

  const status = resultado?.status || 'ALERTA'
  const resumo = resultado?.resumo || {}
  const areas = form.areas || []
  const equipamentosSemTag = areas.flatMap((area) => area.equipamentos || []).filter((eq) => !eq.nome_tag).length
  const equipamentosSemProtecao = areas.flatMap((area) => area.equipamentos || []).filter((eq) => eq.tipo_protecao_ex === 'nenhuma').length

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              title="Áreas Classificadas"
              description="Cadastro de zonas e verificação básica de compatibilidade de equipamentos Ex."
            />
            <StatusBadge status={normalizarStatus(status)} />
          </div>
        </div>

        <CardBody className="space-y-5">
          {(equipamentosSemTag > 0 || equipamentosSemProtecao > 0) && (
            <div className="space-y-3">
              {equipamentosSemTag > 0 && (
                <Alert variant="warning" icon={AlertTriangle} title="Equipamentos sem TAG">
                  Há {equipamentosSemTag} equipamento(s) sem TAG ou identificação. Isso dificulta rastreabilidade no memorial.
                </Alert>
              )}
              {equipamentosSemProtecao > 0 && (
                <Alert variant="danger" icon={AlertTriangle} title="Equipamento sem proteção Ex">
                  Há {equipamentosSemProtecao} equipamento(s) com proteção Ex marcada como “nenhuma”.
                </Alert>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <MetricCard label="Áreas" value={resumo.total_areas ?? areas.length} description="Zonas cadastradas" icon={Flame} />
            <MetricCard label="Equipamentos" value={resumo.total_equipamentos ?? areas.reduce((acc, area) => acc + (area.equipamentos || []).length, 0)} description="Itens avaliados" />
            <MetricCard label="OK" value={resumo.equipamentos_ok ?? 0} description="Compatíveis" status="OK" />
            <MetricCard label="Alertas" value={resumo.equipamentos_alerta ?? 0} description="Revisar" status="ALERTA" />
            <MetricCard label="Críticos" value={resumo.equipamentos_criticos ?? equipamentosSemProtecao} description="Não conformes" status="CRITICO" />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {resultado?.mensagem || 'Preencha as áreas e salve para consolidar a validação dos equipamentos Ex.'}
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <button onClick={adicionarArea} type="button" className="btn btn-secondary inline-flex items-center gap-2 text-xs">
          <Plus size={14} />Adicionar área
        </button>
      </div>

      {areas.map((area, areaIndex) => {
        const calculada = resultado?.areas?.[areaIndex] || area
        const equipamentos = area.equipamentos || []
        return (
          <Card key={area.id || areaIndex} className="overflow-hidden border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">{area.nome || `Área ${areaIndex + 1}`}</h3>
                  <p className="mt-1 text-xs text-slate-500">Classificação da zona, grupo e equipamentos associados.</p>
                </div>
                <StatusBadge status={normalizarStatus(calculada.status)} />
                <button onClick={() => removerArea(areaIndex)} type="button" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remover área">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <CardBody className="space-y-6">
              <section className="space-y-4">
                <SectionHeader title="Classificação da área" description="Dados básicos da zona classificada." />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Campo label="Nome / identificação">
                    <input className="input w-full" value={area.nome || ''} onChange={(e) => setArea(areaIndex, 'nome', e.target.value)} />
                  </Campo>
                  <Campo label="Tipo de substância">
                    <select className="input w-full" value={area.tipo_substancia || 'gás'} onChange={(e) => setArea(areaIndex, 'tipo_substancia', e.target.value)}>
                      {TIPOS_SUBSTANCIA.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Zona">
                    <select className="input w-full" value={area.zona || 'Zona 2'} onChange={(e) => setArea(areaIndex, 'zona', e.target.value)}>
                      {ZONAS.map((zona) => <option key={zona} value={zona}>{zona}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Grupo">
                    <select className="input w-full" value={area.grupo || 'IIB'} onChange={(e) => setArea(areaIndex, 'grupo', e.target.value)}>
                      {GRUPOS.map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Classe de temperatura">
                    <select className="input w-full" value={area.classe_temperatura || 'T4'} onChange={(e) => setArea(areaIndex, 'classe_temperatura', e.target.value)}>
                      {TEMPERATURAS.map((classe) => <option key={classe} value={classe}>{classe}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Circuitos associados" className="md:col-span-3">
                    <input className="input w-full" value={area.circuitos_associados || ''} onChange={(e) => setArea(areaIndex, 'circuitos_associados', e.target.value)} placeholder="Ex.: C-101, C-102" />
                  </Campo>
                  <Campo label="Descrição da área" className="md:col-span-2">
                    <textarea className="input min-h-[76px] w-full resize-y" value={area.descricao || ''} onChange={(e) => setArea(areaIndex, 'descricao', e.target.value)} />
                  </Campo>
                  <Campo label="Observações" className="md:col-span-2">
                    <textarea className="input min-h-[76px] w-full resize-y" value={area.observacoes || ''} onChange={(e) => setArea(areaIndex, 'observacoes', e.target.value)} />
                  </Campo>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionHeader title="Equipamentos Ex" description="Compatibilidade básica de proteção, grupo e temperatura." />
                  <button onClick={() => adicionarEquipamento(areaIndex)} type="button" className="btn btn-secondary inline-flex items-center gap-2 text-xs">
                    <Plus size={14} />Adicionar equipamento
                  </button>
                </div>

                <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[1080px] text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                      <tr>
                        {['TAG', 'Tipo', 'Proteção Ex', 'Grupo', 'Classe T', 'Certificado', 'Observações', 'Status', ''].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {equipamentos.map((equipamento, equipamentoIndex) => {
                        const calculado = calculada.equipamentos?.[equipamentoIndex] || equipamento
                        return (
                          <tr key={equipamento.id || equipamentoIndex} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <input className="input w-full" value={equipamento.nome_tag || ''} onChange={(e) => setEquipamento(areaIndex, equipamentoIndex, 'nome_tag', e.target.value)} />
                            </td>
                            <td className="px-3 py-2">
                              <select className="input w-full" value={equipamento.tipo || 'motor'} onChange={(e) => setEquipamento(areaIndex, equipamentoIndex, 'tipo', e.target.value)}>
                                {TIPOS_EQUIPAMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select className="input w-full" value={equipamento.tipo_protecao_ex || 'Ex d'} onChange={(e) => setEquipamento(areaIndex, equipamentoIndex, 'tipo_protecao_ex', e.target.value)}>
                                {TIPOS_PROTECAO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select className="input w-full" value={equipamento.grupo || 'IIB'} onChange={(e) => setEquipamento(areaIndex, equipamentoIndex, 'grupo', e.target.value)}>
                                {GRUPOS.map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select className="input w-full" value={equipamento.classe_temperatura || 'T4'} onChange={(e) => setEquipamento(areaIndex, equipamentoIndex, 'classe_temperatura', e.target.value)}>
                                {TEMPERATURAS.map((classe) => <option key={classe} value={classe}>{classe}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input className="input w-full" value={equipamento.certificado || ''} onChange={(e) => setEquipamento(areaIndex, equipamentoIndex, 'certificado', e.target.value)} />
                            </td>
                            <td className="px-3 py-2">
                              <input className="input w-full" value={equipamento.observacoes || ''} onChange={(e) => setEquipamento(areaIndex, equipamentoIndex, 'observacoes', e.target.value)} />
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge status={normalizarStatus(calculado.status, equipamento.tipo_protecao_ex === 'nenhuma' ? 'CRITICO' : 'ALERTA')} />
                              {calculado.mensagem && <div className="mt-1 max-w-[260px] text-[11px] text-slate-500">{calculado.mensagem}</div>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => removerEquipamento(areaIndex, equipamentoIndex)} type="button" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remover equipamento">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  {calculada.mensagem || 'Salve para atualizar a validação.'}
                </div>
              </section>
            </CardBody>
          </Card>
        )
      })}

      <div className="flex justify-end">
        <button onClick={salvar} disabled={loading} className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-50">
          <Save size={15} />
          {loading ? 'Salvando...' : 'Salvar áreas classificadas'}
        </button>
      </div>
    </div>
  )
}
