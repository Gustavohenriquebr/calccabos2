import json
import math
from typing import Any, Dict, Iterable, Optional

from app.services.status_utils import numero_finito


def _float(valor: Any, padrao: Optional[float] = None) -> Optional[float]:
    return numero_finito(valor, padrao)


def _str(valor: Any, padrao: str = "") -> str:
    return str(valor or padrao).strip()


def _round(valor: Optional[float], casas: int = 3) -> Optional[float]:
    return round(valor, casas) if valor is not None else None


def normalizar_tensao_primaria(valor: Any) -> Optional[float]:
    tensao = _float(valor)
    if tensao is None or tensao <= 0:
        return None
    return tensao * 1000 if tensao < 100 else tensao


def formatar_tensao(valor: Any) -> str:
    tensao = _float(valor)
    if tensao is None:
        return "N/D"
    if tensao >= 1000:
        kv = tensao / 1000
        texto = f"{kv:.3f}".rstrip("0").rstrip(".").replace(".", ",")
        return f"{texto} kV"
    return f"{tensao:g} V"


def carregar_json(valor: Any) -> Dict[str, Any]:
    if not valor:
        return {}
    if isinstance(valor, dict):
        return valor
    try:
        dados = json.loads(valor)
        return dados if isinstance(dados, dict) else {}
    except (TypeError, ValueError):
        return {}


def dump_json(dados: Dict[str, Any]) -> str:
    return json.dumps(dados, ensure_ascii=False, default=str)


def calcular_transformador(dados: Dict[str, Any]) -> Dict[str, Any]:
    potencia_kva = _float(dados.get("potencia_kva"))
    tensao_primaria = normalizar_tensao_primaria(dados.get("tensao_primaria"))
    tensao_secundaria = _float(dados.get("tensao_secundaria"))
    impedancia_percentual = _float(dados.get("impedancia_percentual"))

    relacao = None
    in_primario = None
    in_secundario = None
    icc_secundario = None

    if tensao_primaria and tensao_secundaria:
        relacao = tensao_primaria / tensao_secundaria

    if potencia_kva and tensao_primaria:
        in_primario = (potencia_kva * 1000) / (math.sqrt(3) * tensao_primaria)

    if potencia_kva and tensao_secundaria:
        in_secundario = (potencia_kva * 1000) / (math.sqrt(3) * tensao_secundaria)

    if in_secundario and impedancia_percentual and impedancia_percentual > 0:
        icc_secundario = in_secundario / (impedancia_percentual / 100)

    entrada = {
        "potencia_kva": potencia_kva,
        "tensao_primaria": tensao_primaria,
        "tensao_primaria_kv": _round(tensao_primaria / 1000, 4) if tensao_primaria else None,
        "tensao_primaria_formatada": formatar_tensao(tensao_primaria),
        "tensao_secundaria": tensao_secundaria,
        "tensao_secundaria_formatada": formatar_tensao(tensao_secundaria),
        "impedancia_percentual": impedancia_percentual,
        "ligacao_primaria": _str(dados.get("ligacao_primaria"), "estrela"),
        "ligacao_secundaria": _str(dados.get("ligacao_secundaria"), "estrela"),
        "frequencia": _float(dados.get("frequencia"), 60.0),
        "observacoes": _str(dados.get("observacoes")),
    }

    return {
        **entrada,
        "relacao_transformacao": _round(relacao, 4),
        "corrente_nominal_primario": _round(in_primario, 3),
        "corrente_nominal_secundario": _round(in_secundario, 3),
        "corrente_curto_secundario": _round(icc_secundario, 3),
        "corrente_curto_secundario_ka": _round(icc_secundario / 1000, 3) if icc_secundario is not None else None,
    }


def calcular_sistema_trifasico(dados: Dict[str, Any]) -> Dict[str, Any]:
    p_kw = _float(dados.get("potencia_ativa_kw"))
    s_kva = _float(dados.get("potencia_aparente_kva"))
    q_kvar = _float(dados.get("potencia_reativa_kvar"))
    tensao_linha = _float(dados.get("tensao_linha"))
    corrente_linha = _float(dados.get("corrente_linha"))
    fp = _float(dados.get("fator_potencia"))
    rendimento = _float(dados.get("rendimento"), 1.0)
    ligacao = _str(dados.get("ligacao"), "estrela").lower()

    if rendimento and rendimento > 1:
        rendimento = rendimento / 100
    if fp and fp > 1:
        fp = fp / 100

    fp_calc = fp if fp and 0 < fp <= 1 else None
    rendimento_calc = rendimento if rendimento and rendimento > 0 else 1.0

    if s_kva is None and tensao_linha and corrente_linha:
        s_kva = math.sqrt(3) * tensao_linha * corrente_linha / 1000

    if p_kw is None and s_kva is not None and fp_calc:
        p_kw = s_kva * fp_calc

    if fp_calc is None and p_kw is not None and s_kva and s_kva > 0:
        fp_calc = min(max(p_kw / s_kva, 0), 1)

    if q_kvar is None and s_kva is not None and fp_calc is not None:
        q_kvar = s_kva * math.sin(math.acos(fp_calc))

    if corrente_linha is None and p_kw is not None and tensao_linha and fp_calc:
        corrente_linha = (p_kw * 1000) / (math.sqrt(3) * tensao_linha * fp_calc * rendimento_calc)

    if s_kva is None and p_kw is not None and fp_calc:
        s_kva = p_kw / fp_calc

    tensao_fase = None
    corrente_fase = None
    if tensao_linha:
        tensao_fase = tensao_linha / math.sqrt(3) if ligacao == "estrela" else tensao_linha
    if corrente_linha is not None:
        corrente_fase = corrente_linha if ligacao == "estrela" else corrente_linha / math.sqrt(3)

    return {
        "potencia_ativa_kw": _round(p_kw, 3),
        "potencia_aparente_kva": _round(s_kva, 3),
        "potencia_reativa_kvar": _round(q_kvar, 3),
        "tensao_linha": _round(tensao_linha, 3),
        "corrente_linha": _round(corrente_linha, 3),
        "fator_potencia": _round(fp_calc, 4),
        "rendimento": _round(rendimento_calc, 4),
        "ligacao": ligacao if ligacao in ("estrela", "triangulo") else "estrela",
        "tensao_fase": _round(tensao_fase, 3),
        "corrente_fase": _round(corrente_fase, 3),
    }


def _valor_circuito(circuito: Any, campo: str, padrao: Any = None) -> Any:
    if isinstance(circuito, dict):
        valor = circuito.get(campo, padrao)
    else:
        valor = getattr(circuito, campo, padrao)
    return padrao if valor is None else valor


def _kva_circuito(circuito: Any) -> Optional[float]:
    p_kw = _float(_valor_circuito(circuito, "potencia_kw"))
    if p_kw is None or p_kw <= 0:
        return None
    fp = _float(_valor_circuito(circuito, "fator_potencia"), 1.0) or 1.0
    eta = _float(_valor_circuito(circuito, "fator_eficiencia"), 1.0) or 1.0
    if fp > 1:
        fp = fp / 100
    if eta > 1:
        eta = eta / 100
    fp = fp if fp > 0 else 1.0
    eta = eta if eta > 0 else 1.0
    calculado = p_kw / (fp * eta)
    informado = _float(_valor_circuito(circuito, "potencia_kva"))
    usar_informado = bool(_valor_circuito(circuito, "usar_kva_informado", False))
    if informado and informado > 0:
        desvio = abs(informado - calculado) / calculado if calculado > 0 else 0
        if desvio <= 0.20 or usar_informado:
            return informado
    return calculado


def _fp_eta_circuito(circuito: Any) -> tuple[float, float]:
    fp = _float(_valor_circuito(circuito, "fator_potencia"), 1.0) or 1.0
    eta = _float(_valor_circuito(circuito, "fator_eficiencia"), 1.0) or 1.0
    if fp > 1:
        fp = fp / 100
    if eta > 1:
        eta = eta / 100
    return (fp if fp > 0 else 1.0, eta if eta > 0 else 1.0)


def calcular_sistema_trifasico_projeto(
    dados: Dict[str, Any],
    circuitos: Iterable[Any],
    tensao_padrao: Optional[float] = None,
) -> Dict[str, Any]:
    circuitos_validos = []
    for circuito in circuitos or []:
        p_kw = _float(_valor_circuito(circuito, "potencia_kw"))
        fp, eta = _fp_eta_circuito(circuito)
        p_eletrica_kw = p_kw / eta if eta > 0 else p_kw
        s_kva = _kva_circuito(circuito)
        if p_kw and p_kw > 0 and s_kva and s_kva > 0:
            circuitos_validos.append((p_kw, p_eletrica_kw, s_kva, circuito))

    if not circuitos_validos:
        resultado = calcular_sistema_trifasico(dados)
        resultado["potencia_nominal_cargas_kw"] = resultado.get("potencia_ativa_kw")
        resultado["potencia_ativa_eletrica_kw"] = resultado.get("potencia_ativa_kw")
        resultado["origem"] = "estimativa_manual"
        resultado["circuitos_considerados"] = 0
        return resultado

    p_nominal_total = sum(item[0] for item in circuitos_validos)
    p_eletrica_total = sum(item[1] for item in circuitos_validos)
    s_total = sum(item[2] for item in circuitos_validos)
    q_total = sum(math.sqrt(max(item[2] ** 2 - item[1] ** 2, 0.0)) for item in circuitos_validos)
    fp_medio = min(max(p_eletrica_total / s_total, 0), 1) if s_total > 0 else None

    tensoes = [_float(_valor_circuito(item[3], "tensao")) for item in circuitos_validos]
    tensoes_validas = [valor for valor in tensoes if valor and valor > 0]
    tensao_linha = tensoes_validas[0] if tensoes_validas else _float(tensao_padrao, 380.0)
    ligacao = _str(dados.get("ligacao"), "estrela").lower()
    if ligacao not in ("estrela", "triangulo"):
        ligacao = "estrela"

    corrente_linha = None
    tensao_fase = None
    corrente_fase = None
    if tensao_linha and tensao_linha > 0:
        corrente_linha = (s_total * 1000) / (math.sqrt(3) * tensao_linha)
        tensao_fase = tensao_linha / math.sqrt(3) if ligacao == "estrela" else tensao_linha
        corrente_fase = corrente_linha if ligacao == "estrela" else corrente_linha / math.sqrt(3)

    return {
        "potencia_nominal_cargas_kw": _round(p_nominal_total, 3),
        "potencia_ativa_eletrica_kw": _round(p_eletrica_total, 3),
        "potencia_ativa_kw": _round(p_eletrica_total, 3),
        "potencia_aparente_kva": _round(s_total, 3),
        "potencia_reativa_kvar": _round(q_total, 3),
        "tensao_linha": _round(tensao_linha, 3),
        "corrente_linha": _round(corrente_linha, 3),
        "fator_potencia": _round(fp_medio, 4),
        "rendimento": _round(_float(dados.get("rendimento"), 1.0), 4),
        "ligacao": ligacao,
        "tensao_fase": _round(tensao_fase, 3),
        "corrente_fase": _round(corrente_fase, 3),
        "origem": "circuitos",
        "circuitos_considerados": len(circuitos_validos),
    }
