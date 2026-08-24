import unicodedata
from typing import Any, Dict, List

from app.services.status_utils import normalizar_status, status_mais_grave


GRUPOS_GAS = {"IIA": 1, "IIB": 2, "IIC": 3}
GRUPOS_POEIRA = {"IIIA": 1, "IIIB": 2, "IIIC": 3}
CLASSES_TEMPERATURA = {"T1": 1, "T2": 2, "T3": 3, "T4": 4, "T5": 5, "T6": 6}
ZONAS_GAS = {"Zona 0", "Zona 1", "Zona 2", "0", "1", "2"}
ZONAS_POEIRA = {"Zona 20", "Zona 21", "Zona 22", "20", "21", "22"}
PROTECOES_VAZIAS = {"", "nenhuma", "nao aplicavel", "não aplicável", "n/a", "nd", "n/d"}


def _str(valor: Any, padrao: str = "") -> str:
    return str(valor or padrao).strip()


def _lista(valor: Any) -> List[Any]:
    return valor if isinstance(valor, list) else []


def _item(criterio: str, status: str, mensagem: str) -> Dict[str, str]:
    return {"criterio": criterio, "status": normalizar_status(status), "mensagem": mensagem}


def _normalizar_zona(zona: Any) -> str:
    texto = _str(zona)
    if not texto:
        return ""
    if texto.lower().startswith("zona"):
        partes = texto.split()
        return f"Zona {partes[-1]}" if partes else texto
    return f"Zona {texto}"


def _normalizar_grupo(grupo: Any) -> str:
    texto = _str(grupo)
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    compacto = sem_acento.upper().replace(" ", "")
    compacto_seguro = compacto.replace("?", "A").replace("�", "A")
    if compacto in {"NAOAPLICAVEL", "NA", "N/A", "ND", "N/D"} or (
        compacto_seguro.startswith("NA") and "APLIC" in compacto_seguro
    ):
        return "NÃO APLICÁVEL"
    return texto.upper().replace(" ", "")


def _normalizar_temperatura(classe: Any) -> str:
    texto = _str(classe).upper().replace(" ", "")
    return texto if texto.startswith("T") else f"T{texto}" if texto else ""


def _familia_area(tipo_substancia: str) -> str:
    tipo = tipo_substancia.lower()
    if tipo.startswith("poeira"):
        return "poeira"
    if tipo.startswith("g") or tipo.startswith("vapor"):
        return "gas"
    return ""


def _grupos_por_familia(familia: str) -> Dict[str, int]:
    return GRUPOS_POEIRA if familia == "poeira" else GRUPOS_GAS if familia == "gas" else {}


def _validar_equipamento(equipamento: Dict[str, Any], area: Dict[str, Any]) -> Dict[str, Any]:
    familia = _familia_area(area.get("tipo_substancia", ""))
    grupo_area = _normalizar_grupo(area.get("grupo"))
    grupo_equipamento = _normalizar_grupo(equipamento.get("grupo"))
    temp_area = _normalizar_temperatura(area.get("classe_temperatura"))
    temp_equipamento = _normalizar_temperatura(equipamento.get("classe_temperatura"))
    tipo_protecao = _str(equipamento.get("tipo_protecao_ex"))
    certificado = _str(equipamento.get("certificado"))

    status = "OK"
    itens: List[Dict[str, str]] = []

    if not _str(equipamento.get("nome_tag")):
        itens.append(_item("Identificação", "ALERTA", "Equipamento sem nome ou TAG."))
        status = status_mais_grave(status, "ALERTA")

    if tipo_protecao.lower() in PROTECOES_VAZIAS:
        itens.append(_item("Tipo de proteção Ex", "CRITICO", "Equipamento sem proteção Ex cadastrado em área classificada."))
        status = status_mais_grave(status, "CRITICO")

    if not certificado:
        itens.append(_item("Certificado Ex", "ALERTA", "Certificado Ex não informado."))
        status = status_mais_grave(status, "ALERTA")

    grupos_validos = _grupos_por_familia(familia)
    if not grupo_area or not grupo_equipamento:
        itens.append(_item("Grupo Ex", "ALERTA", "Grupo da área ou do equipamento não informado."))
        status = status_mais_grave(status, "ALERTA")
    elif grupo_area not in grupos_validos:
        itens.append(_item("Grupo Ex", "ALERTA", f"Grupo da área ({grupo_area}) incompatível com o tipo de substância informado."))
        status = status_mais_grave(status, "ALERTA")
    elif grupo_equipamento not in grupos_validos:
        itens.append(_item("Grupo Ex", "CRITICO", f"Grupo do equipamento ({grupo_equipamento}) incompatível com área de {familia}."))
        status = status_mais_grave(status, "CRITICO")
    elif grupos_validos[grupo_equipamento] < grupos_validos[grupo_area]:
        itens.append(_item("Grupo Ex", "CRITICO", f"Grupo do equipamento ({grupo_equipamento}) não atende à área {grupo_area}."))
        status = status_mais_grave(status, "CRITICO")

    if not temp_area or not temp_equipamento:
        itens.append(_item("Classe de temperatura", "ALERTA", "Classe de temperatura da área ou do equipamento não informada."))
        status = status_mais_grave(status, "ALERTA")
    elif temp_area not in CLASSES_TEMPERATURA or temp_equipamento not in CLASSES_TEMPERATURA:
        itens.append(_item("Classe de temperatura", "ALERTA", "Classe de temperatura deve estar entre T1 e T6."))
        status = status_mais_grave(status, "ALERTA")
    elif CLASSES_TEMPERATURA[temp_equipamento] < CLASSES_TEMPERATURA[temp_area]:
        itens.append(_item("Classe de temperatura", "CRITICO", f"Classe {temp_equipamento} não atende à exigência {temp_area} da área."))
        status = status_mais_grave(status, "CRITICO")

    if not itens:
        itens.append(_item("Compatibilidade Ex", "OK", "Equipamento compatível com grupo e classe de temperatura da área."))

    status = normalizar_status(status)
    return {
        "id": _str(equipamento.get("id")),
        "nome_tag": _str(equipamento.get("nome_tag")),
        "tipo": _str(equipamento.get("tipo")),
        "tipo_protecao_ex": tipo_protecao,
        "grupo": grupo_equipamento,
        "classe_temperatura": temp_equipamento,
        "certificado": certificado,
        "observacoes": _str(equipamento.get("observacoes")),
        "status": status,
        "mensagem": next((item["mensagem"] for item in itens if item["status"] == status), itens[0]["mensagem"]),
        "itens": itens,
    }


def _validar_area(area: Dict[str, Any], indice: int) -> Dict[str, Any]:
    tipo_substancia = _str(area.get("tipo_substancia"))
    familia = _familia_area(tipo_substancia)
    zona = _normalizar_zona(area.get("zona"))
    grupo = _normalizar_grupo(area.get("grupo"))
    classe_temperatura = _normalizar_temperatura(area.get("classe_temperatura"))
    equipamentos = [
        _validar_equipamento(e if isinstance(e, dict) else {}, {
            "tipo_substancia": tipo_substancia,
            "grupo": grupo,
            "classe_temperatura": classe_temperatura,
        })
        for e in _lista(area.get("equipamentos"))
    ]

    status = "OK"
    itens: List[Dict[str, str]] = []

    if not _str(area.get("nome")):
        itens.append(_item("Identificação da área", "ALERTA", "Área classificada sem nome ou identificação."))
        status = status_mais_grave(status, "ALERTA")

    if not familia:
        itens.append(_item("Substância", "ALERTA", "Tipo de substância deve ser gás, vapor ou poeira."))
        status = status_mais_grave(status, "ALERTA")
    elif familia == "gas" and zona not in ZONAS_GAS:
        itens.append(_item("Zona", "ALERTA", "Para gas/vapor, use Zona 0, Zona 1 ou Zona 2."))
        status = status_mais_grave(status, "ALERTA")
    elif familia == "poeira" and zona not in ZONAS_POEIRA:
        itens.append(_item("Zona", "ALERTA", "Para poeira, use Zona 20, Zona 21 ou Zona 22."))
        status = status_mais_grave(status, "ALERTA")

    if grupo not in _grupos_por_familia(familia):
        itens.append(_item("Grupo", "ALERTA", "Grupo da área não informado ou incompatível com a substância."))
        status = status_mais_grave(status, "ALERTA")

    if classe_temperatura not in CLASSES_TEMPERATURA:
        itens.append(_item("Classe de temperatura", "ALERTA", "Classe de temperatura da área deve estar entre T1 e T6."))
        status = status_mais_grave(status, "ALERTA")

    if not equipamentos:
        itens.append(_item("Equipamentos Ex", "ALERTA", "Nenhum equipamento Ex cadastrado para esta área."))
        status = status_mais_grave(status, "ALERTA")

    for equipamento in equipamentos:
        status = status_mais_grave(status, equipamento.get("status", "ALERTA"))

    equipamentos_criticos = sum(1 for equipamento in equipamentos if normalizar_status(equipamento.get("status")) == "CRITICO")
    equipamentos_alerta = sum(1 for equipamento in equipamentos if normalizar_status(equipamento.get("status")) == "ALERTA")
    if equipamentos_criticos:
        itens.append(_item("Equipamentos Ex", "CRITICO", f"{equipamentos_criticos} equipamento(s) incompativel(is) com a area."))
    elif equipamentos_alerta:
        itens.append(_item("Equipamentos Ex", "ALERTA", f"{equipamentos_alerta} equipamento(s) com dados incompletos."))

    if not itens and normalizar_status(status) == "OK":
        itens.append(_item("Área classificada", "OK", "Área cadastrada com equipamentos Ex compatíveis na verificação básica."))

    status = normalizar_status(status)
    return {
        "id": _str(area.get("id"), f"A{indice + 1}"),
        "nome": _str(area.get("nome"), f"Area {indice + 1}"),
        "tipo_substancia": tipo_substancia,
        "zona": zona,
        "grupo": grupo,
        "classe_temperatura": classe_temperatura,
        "descricao": _str(area.get("descricao")),
        "observacoes": _str(area.get("observacoes")),
        "circuitos_associados": _str(area.get("circuitos_associados")),
        "equipamentos": equipamentos,
        "status": status,
        "mensagem": next((item["mensagem"] for item in itens if item["status"] == status), itens[0]["mensagem"] if itens else "Area validada."),
        "itens": itens,
    }


def calcular_areas_classificadas(dados: Dict[str, Any]) -> Dict[str, Any]:
    areas_raw = _lista(dados.get("areas"))
    areas = [_validar_area(area if isinstance(area, dict) else {}, index) for index, area in enumerate(areas_raw)]

    status = "OK"
    for area in areas:
        status = status_mais_grave(status, area.get("status", "ALERTA"))

    if not areas:
        status = "ALERTA"
        mensagem = "Nenhuma area classificada cadastrada."
        itens = [_item("Areas classificadas", "ALERTA", mensagem)]
    else:
        criticas = sum(1 for area in areas if normalizar_status(area.get("status")) == "CRITICO")
        alertas = sum(1 for area in areas if normalizar_status(area.get("status")) == "ALERTA")
        if criticas:
            mensagem = f"{criticas} área(s) com incompatibilidade crítica em equipamentos Ex."
        elif alertas:
            mensagem = f"{alertas} área(s) com dados incompletos ou pendentes."
        else:
            mensagem = "Áreas classificadas cadastradas e compatíveis na verificação básica."
        itens = [_item("Resumo Ex", status, mensagem)]

    equipamentos = [equip for area in areas for equip in area.get("equipamentos", [])]
    status = normalizar_status(status)
    return {
        "areas": areas,
        "status": status,
        "mensagem": mensagem,
        "itens": itens,
        "resumo": {
            "total_areas": len(areas),
            "total_equipamentos": len(equipamentos),
            "areas_ok": sum(1 for area in areas if normalizar_status(area.get("status")) == "OK"),
            "areas_alerta": sum(1 for area in areas if normalizar_status(area.get("status")) == "ALERTA"),
            "areas_criticas": sum(1 for area in areas if normalizar_status(area.get("status")) == "CRITICO"),
            "equipamentos_ok": sum(1 for equip in equipamentos if normalizar_status(equip.get("status")) == "OK"),
            "equipamentos_alerta": sum(1 for equip in equipamentos if normalizar_status(equip.get("status")) == "ALERTA"),
            "equipamentos_criticos": sum(1 for equip in equipamentos if normalizar_status(equip.get("status")) == "CRITICO"),
        },
    }
