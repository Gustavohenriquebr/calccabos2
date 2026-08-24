import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.config import settings
from app.models.circuito import Circuito
from app.models.circuito import Circuito
from app.models.projeto import Projeto

class DictObj:
    def __init__(self, d):
        self.__dict__.update(d)
    def __getattr__(self, name):
        return None
from app.services.aterramento import calcular_aterramento
from app.services.areas_classificadas import calcular_areas_classificadas
from app.services.para_raios import calcular_para_raios
from app.services.projeto_eletrico import calcular_sistema_trifasico_projeto, calcular_transformador, carregar_json
from app.services.protecao import validar_protecao_geral
from app.services.status_utils import normalizar_status, normalizar_tipo_cabo, status_global, status_visual

router = APIRouter()


class MensagemHistorico(BaseModel):
    role: str
    content: str


class MensagemSchema(BaseModel):
    mensagem: str
    aba_atual: Optional[str] = None
    contexto_site: Optional[Dict[str, Any]] = Field(default_factory=dict)
    historico: Optional[List[MensagemHistorico]] = Field(default_factory=list)
    projeto: Optional[Dict[str, Any]] = None
    circuitos: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    usuario: Optional[Dict[str, Any]] = None


OPENROUTER_MODELOS_FALLBACK = [
    "openrouter/free",
    "tencent/hy3-preview:free",
    "nvidia/nemotron-3-super:free",
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-3-27b-it:free",
    "nous/hermes-3-405b-instruct:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-3-12b-it:free",
    "meta-llama/llama-3.2-3b-instruct:free",
]

GEMINI_MODELOS_FALLBACK = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

GROQ_MODELOS_PREFERIDOS = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "gemma2-9b-it",
]
SYSTEM_PROMPT = """
Voce e o Assistente CalcCabos, agente de engenharia eletrica e guia do produto.

Use sempre, nesta ordem:
1. CONTEXTO_CALCCABOS_JSON do projeto atual;
2. ARQUIVOS_MESTRES_CALCCABOS;
3. CONTEXTO_SITE_JSON, incluindo aba atual e rota;
4. historico recente;
5. pergunta do usuario.

Voce pode responder sobre:
- como usar o site CalcCabos;
- como importar planilhas;
- como preencher campos;
- circuitos, cabos, queda de tensao, Icc, Joule, protecoes e disjuntores;
- transformador, sistema trifasico, para-raios, aterramento e areas classificadas;
- memorial, diagrama, PDF e Excel;
- status OK, ALERTA e CRITICO/CRÍTICO.

Ao responder, priorize:
- validacao_status e validacao_mensagem ja calculados pelo backend;
- modo_dimensionamento manual/automatico e sugestoes automaticas de cabo/disjuntor;
- circuitos fora de norma ou em alerta;
- queda de tensao calculada e limite aplicavel;
- secao do cabo, ampacidade, Ib, Ib corrigida e disjuntor;
- criterio de Joule quando houver Icc e tempo de atuacao;
- melhoria objetiva para deixar o circuito conforme;
- áreas classificadas, equipamentos Ex e compatibilidade básica de grupo/classe térmica quando houver dados.

Formato preferencial:
[RESUMO OBJETIVO]
[ANALISE TECNICA]
[PONTOS CRITICOS]
[RECOMENDACAO]

Se a pergunta for sobre uso do site, responda como suporte do produto, com passos claros.
Se faltar dado para conclusao normativa, diga exatamente qual dado falta.
Nao invente valores normativos.
"""

def _enum_value(valor):
    return getattr(valor, "value", valor)


def _fmt(valor, unidade=""):
    if valor is None:
        return "-"
    return f"{valor}{unidade}"


def _status_final(c: Circuito) -> str:
    if c.status_final:
        return normalizar_status(c.status_final)
    if c.status == "ok":
        return "OK"
    if c.status == "erro":
        return "CRITICO"
    if c.status == "alerta":
        return "ALERTA"
    return "ALERTA"


def _alertas_circuito(c: Circuito) -> List[str]:
    alertas = []
    status = _status_final(c)
    if status != "OK":
        alertas.append(f"status_final={status}")

    qt = c.queda_tensao_acumulada if c.queda_tensao_acumulada is not None else c.queda_tensao_pct
    if qt is not None and c.queda_tensao_max is not None and qt > c.queda_tensao_max:
        alertas.append(f"queda_tensao {qt}% acima do limite {c.queda_tensao_max}%")

    corrente_corrigida = c.corrente_corrigida or c.corrente_nominal or 0
    formacao = max(c.formacao or 1, 1)
    corrente_por_cabo = corrente_corrigida / formacao
    ampacidade = c.corrente_condutor or c.ampacidade or 0
    if corrente_por_cabo and ampacidade and ampacidade < corrente_por_cabo:
        alertas.append(f"ampacidade {ampacidade}A menor que Ib corrigida por cabo {round(corrente_por_cabo, 2)}A")

    if c.isc_local is None:
        alertas.append("Icc do barramento nao informado; criterio de Joule fica limitado")

    protecao_status = getattr(c, "protecao_status", None)
    protecao_status = normalizar_status(protecao_status, "OK") if protecao_status else None
    if protecao_status and protecao_status != "OK":
        alertas.append(f"protecao={protecao_status}: {getattr(c, 'protecao_nota', None) or 'verificar disjuntor'}")

    validacao_status = getattr(c, "validacao_status", None)
    validacao_status = normalizar_status(validacao_status, "OK") if validacao_status else None
    if validacao_status and validacao_status != "OK":
        alertas.append(f"validacao_normativa={validacao_status}: {getattr(c, 'validacao_mensagem', None) or 'verificar criterios normativos'}")

    selecao_status = getattr(c, "selecao_componentes_status", None)
    selecao_status = normalizar_status(selecao_status, "OK") if selecao_status else None
    if selecao_status and selecao_status != "OK":
        alertas.append(f"selecao_componentes={selecao_status}: {getattr(c, 'selecao_componentes_justificativa', None) or 'verificar selecao automatica'}")

    return alertas


def _circuito_payload(c: Circuito) -> Dict[str, Any]:
    return {
        "id": c.id,
        "ordem": c.ordem,
        "tag": c.tag,
        "descricao": c.descricao,
        "from": c.from_barramento,
        "to": c.to_equipamento,
        "protection_device": c.protection_device,
        "modo_dimensionamento": getattr(c, "modo_dimensionamento", None) or getattr(c, "modo_selecao_componentes", None),
        "modo_selecao_componentes": getattr(c, "modo_selecao_componentes", None),
        "disjuntor_tensao_nominal_v": getattr(c, "disjuntor_tensao_nominal", None),
        "disjuntor_corrente_nominal_a": getattr(c, "disjuntor_corrente_nominal", None),
        "disjuntor_icu_ka": getattr(c, "disjuntor_icu", None),
        "disjuntor_curva": getattr(c, "disjuntor_curva", None),
        "disjuntor_fabricante": getattr(c, "disjuntor_fabricante", None),
        "protecao_status": normalizar_status(getattr(c, "protecao_status", None)) if getattr(c, "protecao_status", None) else None,
        "protecao_nota": getattr(c, "protecao_nota", None),
        "validacao_status": normalizar_status(getattr(c, "validacao_status", None)) if getattr(c, "validacao_status", None) else None,
        "validacao_mensagem": getattr(c, "validacao_mensagem", None),
        "validacao_detalhes": getattr(c, "validacao_detalhes", None),
        "cabo_sugerido_secao_mm2": getattr(c, "cabo_sugerido_secao", None),
        "cabo_sugerido_tipo_comercial": getattr(c, "cabo_sugerido_tipo_comercial", None),
        "cabo_sugerido_ampacidade_a": getattr(c, "cabo_sugerido_ampacidade", None),
        "disjuntor_sugerido_in_a": getattr(c, "disjuntor_sugerido_in", None),
        "disjuntor_sugerido_icu_ka": getattr(c, "disjuntor_sugerido_icu", None),
        "disjuntor_sugerido_curva": getattr(c, "disjuntor_sugerido_curva", None),
        "selecao_componentes_status": normalizar_status(getattr(c, "selecao_componentes_status", None)) if getattr(c, "selecao_componentes_status", None) else None,
        "selecao_componentes_justificativa": getattr(c, "selecao_componentes_justificativa", None),
        "tensao_v": c.tensao,
        "fases": c.fases,
        "corrente_ac_dc": c.corrente_ac_dc,
        "potencia_kw": c.potencia_kw,
        "potencia_kva": c.potencia_kva,
        "usar_kva_informado": getattr(c, "usar_kva_informado", False),
        "fator_potencia": c.fator_potencia,
        "fator_demanda": c.fator_demanda,
        "fator_eficiencia": c.fator_eficiencia,
        "distancia_m": c.distancia_m,
        "comprimento_real_m": c.comprimento_real,
        "metodo_instalacao": c.metodo_instalacao,
        "temperatura_ambiente_c": c.temp_ambiente,
        "tipo_cabo": normalizar_tipo_cabo(_enum_value(c.tipo_cabo)),
        "agrupamento": c.agrupamento,
        "formacao": c.formacao,
        "corrente_nominal_a": c.corrente_nominal,
        "corrente_projeto_a": c.corrente_projeto,
        "corrente_corrigida_a": c.corrente_corrigida,
        "fator_k1": c.fator_k1,
        "fator_k2": c.fator_k2,
        "fator_k3": c.fator_k3,
        "secao_mm2": c.secao_mm2,
        "secao_pe_mm2": c.secao_pe_mm2,
        "disjuntor_a": c.disjuntor_a,
        "queda_tensao_pct": c.queda_tensao_pct,
        "queda_tensao_acumulada_pct": c.queda_tensao_acumulada,
        "queda_tensao_max_pct": c.queda_tensao_max,
        "ampacidade_a": c.ampacidade,
        "corrente_condutor_a": c.corrente_condutor,
        "isc_local_ka": c.isc_local,
        "isc_cabo_ka": c.isc_cabo,
        "tempo_atuacao_s": c.tempo_atuacao,
        "secao_joule_mm2": c.secao_joule,
        "impedancia_rdc_ohm_km": c.impedancia_rdc,
        "impedancia_rac_ohm_km": c.impedancia_rac,
        "impedancia_xl_ohm_km": c.impedancia_xl,
        "tipo_cabo_comercial": c.tipo_cabo_comercial,
        "status": c.status,
        "status_final": _status_final(c),
        "status_final_visual": status_visual(_status_final(c)),
        "nota_tecnica": c.nota_tecnica,
        "alertas": _alertas_circuito(c),
    }


def _montar_contexto(p: Projeto, circuitos: List[Circuito]) -> Dict[str, Any]:
    payload_circuitos = [_circuito_payload(c) for c in circuitos]
    transformador = calcular_transformador(carregar_json(getattr(p, "transformador_dados", None)))
    sistema_trifasico = calcular_sistema_trifasico_projeto(
        carregar_json(getattr(p, "sistema_trifasico_dados", None)),
        circuitos,
        getattr(p, "tensao_ref", None),
    )
    protecao_geral = validar_protecao_geral(carregar_json(getattr(p, "protecao_geral_dados", None)), transformador)
    para_raios = calcular_para_raios(carregar_json(getattr(p, "para_raios_dados", None)))
    aterramento = calcular_aterramento(carregar_json(getattr(p, "aterramento_dados", None)))
    areas_classificadas = calcular_areas_classificadas(carregar_json(getattr(p, "areas_classificadas_dados", None)))
    protecoes_circuitos = [normalizar_status(getattr(c, "protecao_status", None), "OK") for c in circuitos]
    status_geral = status_global(
        *[_status_final(c) for c in circuitos],
        *protecoes_circuitos,
        protecao_geral.get("status"),
        para_raios.get("status"),
        aterramento.get("status"),
        areas_classificadas.get("status"),
    )
    modulos_criticos = []
    modulos_alerta = []
    for nome, dados in [
        ("Proteção geral", protecao_geral),
        ("Para-raios", para_raios),
        ("Aterramento", aterramento),
        ("Áreas Classificadas", areas_classificadas),
    ]:
        status = normalizar_status(dados.get("status"), "ALERTA")
        if status == "CRITICO":
            modulos_criticos.append({"modulo": nome, "mensagem": dados.get("mensagem")})
        elif status == "ALERTA":
            mensagem = "Para-raios não informado ou incompleto." if nome == "Para-raios" else dados.get("mensagem")
            modulos_alerta.append({"modulo": nome, "mensagem": mensagem})
    return {
        "projeto": {
            "id": p.id,
            "nome": p.nome,
            "cliente": p.cliente,
            "contexto_normativo": _enum_value(p.contexto),
            "tensao_ref_v": p.tensao_ref,
            "total_circuitos": len(circuitos),
        },
        "transformador_entrada": transformador,
        "sistema_trifasico": sistema_trifasico,
        "sistema_protecao": {
            "disjuntor_geral": protecao_geral,
        },
        "para_raios_linha": para_raios,
        "sistema_aterramento": aterramento,
        "areas_classificadas": areas_classificadas,
        "resumo": {
            "ok": sum(1 for c in circuitos if _status_final(c) == "OK"),
            "alerta": sum(1 for c in circuitos if _status_final(c) == "ALERTA"),
            "critico": sum(1 for c in circuitos if normalizar_status(_status_final(c)) == "CRITICO"),
            "nao_calculado": 0,
            "status_geral": status_geral,
            "status_geral_visual": status_visual(status_geral),
            "protecoes_circuitos_ok": sum(1 for status in protecoes_circuitos if status == "OK"),
            "protecoes_circuitos_alerta": sum(1 for status in protecoes_circuitos if status == "ALERTA"),
            "protecoes_circuitos_critico": sum(1 for status in protecoes_circuitos if status == "CRITICO"),
            "modulos_criticos": modulos_criticos,
            "modulos_alerta": modulos_alerta,
        },
        "memorial_tecnico": _memorial_resumo(circuitos, status_geral, modulos_criticos, modulos_alerta),
        "circuitos": payload_circuitos,
        "alertas_normativos": [
            {"circuito": c.get("tag") or c.get("descricao"), "alertas": c["alertas"]}
            for c in payload_circuitos
            if c["alertas"]
        ],
    }


def _historico_sanitizado(historico: Optional[List[MensagemHistorico]]) -> List[Dict[str, str]]:
    mensagens = []
    for item in (historico or [])[-8:]:
        role = item.role if item.role in ("user", "assistant") else "user"
        content = (item.content or "").strip()
        if content:
            mensagens.append({"role": role, "content": content[:4000]})
    return mensagens


def _memorial_resumo(
    circuitos: List[Circuito],
    status_geral: str = "ALERTA",
    modulos_criticos: Optional[List[Dict[str, Any]]] = None,
    modulos_alerta: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    qt_fora = 0
    protecao_critica = 0
    selecao_critica = 0
    validacao_critica = 0
    conclusoes = []

    for c in circuitos:
        qt = c.queda_tensao_acumulada if c.queda_tensao_acumulada is not None else c.queda_tensao_pct
        if qt is not None and c.queda_tensao_max is not None and qt > c.queda_tensao_max:
            qt_fora += 1
        if normalizar_status(getattr(c, "protecao_status", None), "OK") == "CRITICO":
            protecao_critica += 1
        if normalizar_status(getattr(c, "selecao_componentes_status", None), "OK") == "CRITICO":
            selecao_critica += 1
        if normalizar_status(getattr(c, "validacao_status", None), "OK") == "CRITICO":
            validacao_critica += 1

    modulos_criticos = modulos_criticos or []
    modulos_alerta = modulos_alerta or []

    if status_geral == "CRITICO":
        conclusoes.append("Projeto NÃO está liberado para emissão final pelo CalcCabos.")
    elif status_geral == "ALERTA":
        conclusoes.append("Projeto requer revisão técnica antes da emissão final.")
    elif not circuitos:
        conclusoes.append("Nenhum circuito cadastrado.")
    else:
        conclusoes.append("Projeto atende aos critérios de dimensionamento calculados.")
    if modulos_criticos:
        conclusoes.append("Módulos críticos: " + "; ".join(f"{m.get('modulo')}: {m.get('mensagem')}" for m in modulos_criticos))
    if modulos_alerta:
        conclusoes.append("Pendências em alerta: " + "; ".join(f"{m.get('modulo')}: {m.get('mensagem')}" for m in modulos_alerta))
    if qt_fora:
        conclusoes.append(f"{qt_fora} circuito(s) fora do limite de queda de tensao.")
    if protecao_critica:
        conclusoes.append(f"{protecao_critica} circuito(s) com protecao/disjuntor inadequado.")
    if selecao_critica:
        conclusoes.append(f"{selecao_critica} circuito(s) sem selecao automatica compativel.")
    if validacao_critica:
        conclusoes.append(f"{validacao_critica} circuito(s) com validacao normativa critica.")

    return {
        "qt_fora_limite": qt_fora,
        "protecao_critica": protecao_critica,
        "selecao_critica": selecao_critica,
        "validacao_critica": validacao_critica,
        "status_geral": status_geral,
        "modulos_criticos": modulos_criticos,
        "modulos_alerta": modulos_alerta,
        "conclusoes_automaticas": conclusoes,
    }



def _env_file_value(nome: str) -> Optional[str]:
    """Lê chaves simples de .env sem depender de python-dotenv."""
    candidatos = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parents[2] / ".env",
    ]
    for caminho in candidatos:
        if not caminho.exists():
            continue
        try:
            for linha in caminho.read_text(encoding="utf-8").splitlines():
                linha = linha.strip()
                if not linha or linha.startswith("#") or "=" not in linha:
                    continue
                chave, valor = linha.split("=", 1)
                if chave.strip() == nome:
                    return valor.strip().strip('"').strip("'") or None
        except OSError:
            continue
    return None


def _secret(nome: str) -> Optional[str]:
    valor = getattr(settings, nome, None)
    if valor:
        return str(valor).strip()
    valor = os.getenv(nome)
    if valor:
        return valor.strip()
    return _env_file_value(nome)


def _lista_env(nome: str, padrao: List[str]) -> List[str]:
    bruto = os.getenv(nome) or _env_file_value(nome)
    if not bruto:
        return padrao
    itens = [item.strip() for item in bruto.split(",") if item.strip()]
    return itens or padrao


def _carregar_arquivos_mestres() -> str:
    pasta = Path(__file__).resolve().parents[1] / "knowledge"
    fallback = """
# Arquivo mestre funcional — CalcCabos

O CalcCabos é uma plataforma SaaS de memorial elétrico industrial.
Módulos principais:
- projetos;
- circuitos e lista de cargas;
- transformador / entrada;
- sistema trifásico;
- proteções;
- para-raios;
- aterramento;
- áreas classificadas;
- diagrama unifilar;
- memorial técnico;
- exportação PDF e Excel;
- assistente de engenharia.

Fluxo recomendado:
1. criar projeto;
2. configurar transformador/entrada;
3. importar ou cadastrar circuitos;
4. calcular lote;
5. revisar críticos e alertas;
6. preencher módulos técnicos;
7. validar memorial;
8. gerar PDF/Excel.

Status:
- OK: aprovado pelos critérios calculados;
- ALERTA: dado incompleto, margem baixa ou revisão necessária;
- CRÍTICO: impedimento técnico ou inconsistência relevante.

Conceitos:
- Ib: corrente de projeto;
- Ib corrigida: corrente ajustada por fatores;
- ICOND/ampacidade: capacidade do condutor;
- Icc local: curto-circuito no ponto;
- Icu: capacidade de interrupção do disjuntor;
- ΔV: queda de tensão;
- S_Joule: seção mínima pelo critério térmico de curto;
- kVA pode ser calculado por kW / (FP × eficiência).
"""
    if not pasta.exists():
        return fallback
    blocos = []
    for arquivo in sorted(pasta.glob("*.md")):
        try:
            conteudo = arquivo.read_text(encoding="utf-8").strip()
        except OSError:
            continue
        if conteudo:
            blocos.append(f"# {arquivo.name}\n\n{conteudo}")
    return "\n\n---\n\n".join(blocos) if blocos else fallback


def _openai_messages(system_prompt: str, arquivos_mestres: str, contexto_site: Dict[str, Any], contexto: Dict[str, Any], historico, pergunta: str) -> List[Dict[str, str]]:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": "ARQUIVOS_MESTRES_CALCCABOS=" + arquivos_mestres},
        {"role": "system", "content": "CONTEXTO_SITE_JSON=" + json.dumps(contexto_site, ensure_ascii=False, default=str)},
        {"role": "system", "content": "CONTEXTO_CALCCABOS_JSON=" + json.dumps(contexto, ensure_ascii=False, default=str)},
    ]
    messages.extend(_historico_sanitizado(historico))
    messages.append({"role": "user", "content": pergunta.strip()})
    return messages


def _gemini_payload(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    system_parts = []
    contents = []

    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if not content:
            continue
        if role == "system":
            system_parts.append(content)
        elif role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})
        else:
            contents.append({"role": "user", "parts": [{"text": content}]})

    return {
        "systemInstruction": {"parts": [{"text": "\n\n".join(system_parts)}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.25,
            "maxOutputTokens": 1400,
        },
    }


async def _chamar_gemini(client: httpx.AsyncClient, messages: List[Dict[str, str]]) -> Optional[Dict[str, str]]:
    key = _secret("GEMINI_API_KEY") or _secret("GOOGLE_API_KEY")
    if not key:
        return None

    erros = []
    for modelo in _lista_env("GEMINI_MODELS", GEMINI_MODELOS_FALLBACK):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
        try:
            r = await client.post(url, params={"key": key}, json=_gemini_payload(messages))
        except httpx.HTTPError as exc:
            erros.append({"provider": "gemini", "modelo": modelo, "erro": str(exc)})
            continue

        try:
            data = r.json()
        except ValueError:
            data = {"raw": r.text}

        if r.status_code == 200:
            candidates = data.get("candidates") or []
            parts = (candidates[0].get("content", {}).get("parts", []) if candidates else [])
            resposta = "\n".join((part.get("text") or "").strip() for part in parts if part.get("text")).strip()
            if resposta:
                return {"resposta": resposta, "modelo": modelo, "provider": "gemini"}
            erros.append({"provider": "gemini", "modelo": modelo, "erro": "resposta vazia"})
        else:
            erros.append({"provider": "gemini", "modelo": modelo, "status": r.status_code, "erro": data})

    return {"erro": erros}


async def _groq_modelos(client: httpx.AsyncClient, key: str) -> List[str]:
    try:
        r = await client.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {key}"},
        )
        if r.status_code != 200:
            return []
        data = r.json()
        return [item.get("id") for item in data.get("data", []) if item.get("id")]
    except Exception:
        return []


async def _chamar_groq(client: httpx.AsyncClient, messages: List[Dict[str, str]]) -> Optional[Dict[str, str]]:
    key = _secret("GROQ_API_KEY")
    if not key:
        return None

    modelos_env = _lista_env("GROQ_MODELS", [])
    disponiveis = await _groq_modelos(client, key)
    modelos = modelos_env or [m for m in GROQ_MODELOS_PREFERIDOS if not disponiveis or m in disponiveis]

    if not modelos and disponiveis:
        prioridade = ["llama", "qwen", "gemma", "mixtral"]
        modelos = [m for m in disponiveis if any(p in m.lower() for p in prioridade)][:3]

    if not modelos:
        modelos = GROQ_MODELOS_PREFERIDOS

    erros = []
    for modelo in modelos:
        try:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": modelo,
                    "messages": messages,
                    "max_tokens": 1400,
                    "temperature": 0.25,
                },
            )
        except httpx.HTTPError as exc:
            erros.append({"provider": "groq", "modelo": modelo, "erro": str(exc)})
            continue

        try:
            data = r.json()
        except ValueError:
            data = {"raw": r.text}

        if r.status_code == 200:
            resposta = (data["choices"][0]["message"].get("content") or "").strip()
            if resposta:
                return {"resposta": resposta, "modelo": data.get("model", modelo), "provider": "groq"}
            erros.append({"provider": "groq", "modelo": modelo, "erro": "resposta vazia"})
        else:
            erros.append({"provider": "groq", "modelo": modelo, "status": r.status_code, "erro": data})

    return {"erro": erros}


async def _chamar_openrouter(client: httpx.AsyncClient, messages: List[Dict[str, str]]) -> Optional[Dict[str, str]]:
    key = _secret("OPENROUTER_API_KEY")
    if not key:
        return None

    erros = []
    for modelo in _lista_env("OPENROUTER_MODELS", OPENROUTER_MODELOS_FALLBACK):
        try:
            r = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "HTTP-Referer": "https://calccabos.onrender.com",
                    "X-Title": "CalcCabos",
                },
                json={
                    "model": modelo,
                    "messages": messages,
                    "max_tokens": 1400,
                    "temperature": 0.25,
                },
            )
        except httpx.HTTPError as exc:
            erros.append({"provider": "openrouter", "modelo": modelo, "erro": str(exc)})
            continue

        try:
            data = r.json()
        except ValueError:
            data = {"raw": r.text}

        if r.status_code == 200:
            resposta = (data["choices"][0]["message"].get("content") or "").strip()
            if resposta:
                return {"resposta": resposta, "modelo": data.get("model", modelo), "provider": "openrouter"}
            erros.append({"provider": "openrouter", "modelo": modelo, "erro": "resposta vazia"})
        else:
            erros.append({"provider": "openrouter", "modelo": modelo, "status": r.status_code, "erro": data})

    return {"erro": erros}


def _top_circuitos_com_alerta(contexto: Dict[str, Any], limite: int = 8) -> List[str]:
    linhas = []
    for item in (contexto.get("alertas_normativos") or [])[:limite]:
        nome = item.get("circuito") or "Circuito sem TAG"
        alertas = "; ".join(item.get("alertas") or [])
        linhas.append(f"- {nome}: {alertas}")
    return linhas


def _resposta_offline(contexto: Dict[str, Any], dados: MensagemSchema, erros: List[Dict[str, Any]]) -> str:
    projeto = contexto.get("projeto") or {}
    resumo = contexto.get("resumo") or {}
    memorial = contexto.get("memorial_tecnico") or {}
    aba = dados.aba_atual or (dados.contexto_site or {}).get("aba_atual") or "não informada"

    linhas = [
        "[RESUMO OBJETIVO]",
        "Não consegui acessar os provedores externos de IA agora, mas analisei os dados estruturados do CalcCabos.",
        "",
        "[ANALISE TECNICA]",
        f"- Projeto: {projeto.get('nome') or 'não informado'}",
        f"- Cliente: {projeto.get('cliente') or 'não informado'}",
        f"- Aba atual: {aba}",
        f"- Total de circuitos: {projeto.get('total_circuitos', 0)}",
        f"- Status geral: {resumo.get('status_geral_visual') or resumo.get('status_geral') or 'não informado'}",
        f"- Circuitos OK: {resumo.get('ok', 0)}",
        f"- Circuitos em alerta: {resumo.get('alerta', 0)}",
        f"- Circuitos críticos: {resumo.get('critico', 0)}",
        f"- Proteções de circuito OK/ALERTA/CRÍTICO: {resumo.get('protecoes_circuitos_ok', 0)}/{resumo.get('protecoes_circuitos_alerta', 0)}/{resumo.get('protecoes_circuitos_critico', 0)}",
        "",
        "[PONTOS CRITICOS]",
    ]

    top = _top_circuitos_com_alerta(contexto)
    if top:
        linhas.extend(top)
    else:
        linhas.append("- Nenhum alerta normativo detalhado foi encontrado no contexto atual.")

    conclusoes = memorial.get("conclusoes_automaticas") or []
    if conclusoes:
        linhas.extend(["", "[CONCLUSOES AUTOMATICAS]"])
        linhas.extend(f"- {c}" for c in conclusoes)

    linhas.extend([
        "",
        "[RECOMENDACAO]",
        "1. Revise primeiro os circuitos críticos e as proteções com status CRÍTICO.",
        "2. Depois revise circuitos em ALERTA por queda de tensão, Icc ausente, margem baixa ou dado incompleto.",
        "3. Gere novamente o memorial PDF/Excel após corrigir as pendências.",
        "",
        "Observação: esta é uma resposta offline do próprio CalcCabos; quando Gemini/Groq/OpenRouter voltarem, o assistente fará uma análise textual mais completa.",
    ])

    return "\n".join(linhas)


async def _chamar_modelo_com_fallback(messages: List[Dict[str, str]], contexto: Dict[str, Any], dados: MensagemSchema) -> Dict[str, str]:
    erros = []

    async with httpx.AsyncClient(timeout=45) as client:
        for nome, func in [
            ("gemini", _chamar_gemini),
            ("groq", _chamar_groq),
            ("openrouter", _chamar_openrouter),
        ]:
            resultado = await func(client, messages)
            if not resultado:
                erros.append({"provider": nome, "erro": "API key ausente ou provedor não configurado"})
                continue
            if resultado.get("resposta"):
                return {
                    "resposta": resultado["resposta"],
                    "modelo": resultado.get("modelo") or nome,
                    "provider": resultado.get("provider") or nome,
                    "fallback_offline": False,
                }
            erros.extend(resultado.get("erro") or [{"provider": nome, "erro": "falha não especificada"}])

    return {
        "resposta": _resposta_offline(contexto, dados, erros),
        "modelo": "offline-calccabos",
        "provider": "offline",
        "fallback_offline": True,
        "erros": erros[-8:],
    }


@router.post("/chat")
async def chat(dados: MensagemSchema):
    p = DictObj(dados.projeto) if dados.projeto else None
    if p and dados.projeto:
        p.id = dados.projeto.get("id") or dados.projeto.get("_id")
    
    circuitos = [DictObj(c) for c in (dados.circuitos or [])]
    contexto = _montar_contexto(p, circuitos) if p else {}
    
    contexto_site = {
        "aba_atual": dados.aba_atual,
        "contexto_site": dados.contexto_site or {},
    }

    messages = _openai_messages(
        SYSTEM_PROMPT,
        _carregar_arquivos_mestres(),
        contexto_site,
        contexto,
        dados.historico,
        dados.mensagem,
    )

    resultado = await _chamar_modelo_com_fallback(messages, contexto, dados)
    return resultado
