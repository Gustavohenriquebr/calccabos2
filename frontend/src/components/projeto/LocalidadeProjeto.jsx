import { useEffect, useState } from 'react'

const vazio = { uf: '', cidade: '', concessionaria: '', tensaoPadrao: '', observacoes: '' }

export default function LocalidadeProjeto({ projeto }) {
  const chave = `calccabos:localidade:${projeto?.id || projeto?._id || 'novo'}`
  const [dados, setDados] = useState(vazio)
  const [editando, setEditando] = useState(false)
  useEffect(() => {
    try { setDados({ ...vazio, ...JSON.parse(localStorage.getItem(chave) || '{}') }) } catch { setDados(vazio) }
  }, [chave])
  function salvar(event) {
    event.preventDefault()
    localStorage.setItem(chave, JSON.stringify(dados))
    setEditando(false)
  }
  return <section className="border border-slate-200 bg-white">
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h3 className="text-sm font-semibold text-slate-900">Localidade e concessionária</h3><p className="text-xs text-slate-500">Referências locais sem alterar a lógica geral do projeto.</p></div><button type="button" onClick={() => setEditando(!editando)} className="text-sm font-medium text-blue-800">{editando ? 'Cancelar' : 'Editar'}</button></div>
    {editando ? <form onSubmit={salvar} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-medium text-slate-600">Estado/UF<input maxLength={2} className="input mt-1 w-full uppercase" value={dados.uf} onChange={(e) => setDados({ ...dados, uf: e.target.value.toUpperCase() })} /></label>
      <label className="text-xs font-medium text-slate-600">Cidade<input className="input mt-1 w-full" value={dados.cidade} onChange={(e) => setDados({ ...dados, cidade: e.target.value })} /></label>
      <label className="text-xs font-medium text-slate-600">Concessionária<input className="input mt-1 w-full" value={dados.concessionaria} onChange={(e) => setDados({ ...dados, concessionaria: e.target.value })} /></label>
      <label className="text-xs font-medium text-slate-600">Tensão padrão<input className="input mt-1 w-full" placeholder="Ex.: 127/220 V" value={dados.tensaoPadrao} onChange={(e) => setDados({ ...dados, tensaoPadrao: e.target.value })} /></label>
      <label className="text-xs font-medium text-slate-600 sm:col-span-2 lg:col-span-4">Observações/regras locais<textarea rows="2" className="input mt-1 w-full" value={dados.observacoes} onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} /></label>
      <div className="sm:col-span-2 lg:col-span-4"><button className="rounded bg-blue-800 px-4 py-2 text-sm font-medium text-white">Salvar referência local</button><span className="ml-3 text-xs text-slate-500">Salvo neste navegador.</span></div>
    </form> : <dl className="grid gap-x-6 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
      {[['UF / cidade', [dados.uf, dados.cidade].filter(Boolean).join(' · ')], ['Concessionária', dados.concessionaria], ['Tensão padrão', dados.tensaoPadrao], ['Observações locais', dados.observacoes]].map(([label, value]) => <div key={label} className="py-2"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 text-sm font-medium text-slate-800">{value || 'Não informado'}</dd></div>)}
    </dl>}
  </section>
}
