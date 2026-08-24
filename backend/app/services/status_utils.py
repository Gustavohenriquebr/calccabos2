import math
import re
import unicodedata
from typing import Any, Optional


STATUS_OK = "OK"
STATUS_ALERTA = "ALERTA"
STATUS_CRITICO = "CRITICO"
STATUS_NAO_CALCULADO = "NAO_CALCULADO"


REPAROS_TEXTO = {
    "Consist?ncia": "Consistência",
    "consist?ncia": "consistência",
    "subesta??o": "subestação",
    "Subesta??o": "Subestação",
    "Medi??es": "Medições",
    "medi??es": "medições",
    "N?OAPLIC?VEL": "NÃO APLICÁVEL",
    "N?O APLIC?VEL": "NÃO APLICÁVEL",
    "n?o aplic?vel": "não aplicável",
    "N?O CALCULADO": "NÃO CALCULADO",
    "nao informado": "não informado",
    "Nao informado": "Não informado",
    "NAO INFORMADO": "NÃO INFORMADO",
    "n?o informado": "não informado",
    "N?o informado": "Não informado",
    "N?O INFORMADO": "NÃO INFORMADO",
    "Respons?vel": "Responsável",
    "respons?vel": "responsável",
    "RESPONS?VEL": "RESPONSÁVEL",
    "Responsavel": "Responsável",
    "responsavel": "responsável",
    "RESPONSAVEL": "RESPONSÁVEL",
    "Eng. Respons?vel": "Eng. Responsável",
    "Engenheiro respons?vel": "Engenheiro responsável",
    "respons?vel t?cnico": "responsável técnico",
    "Respons?vel t?cnico": "Responsável técnico",
    "respons?vel tecnico": "responsável técnico",
    "Responsavel tecnico": "Responsável técnico",
    "Descri??o": "Descrição",
    "descri??o": "descrição",
    "identifica??o": "identificação",
    "Identifica??o": "Identificação",
    "emiss?o": "emissão",
    "Emiss?o": "Emissão",
    "revis?o": "revisão",
    "Revis?o": "Revisão",
    "Prote??es": "Proteções",
    "prote??es": "proteções",
    "Observa??es": "Observações",
    "observa??es": "observações",
    "mem?ria": "memória",
    "Mem?ria": "Memória",
    "c?lculo": "cálculo",
    "C?lculo": "Cálculo",
    "t?cnico": "técnico",
    "T?cnico": "Técnico",
    "t?cnica": "técnica",
    "T?cnica": "Técnica",
    "el?trico": "elétrico",
    "El?trico": "Elétrico",
    "el?trica": "elétrica",
    "El?trica": "Elétrica",
    "pot?ncia": "potência",
    "Pot?ncia": "Potência",
    "tens?o": "tensão",
    "Tens?o": "Tensão",
    "frequ?ncia": "frequência",
    "Frequ?ncia": "Frequência",
    "efici?ncia": "eficiência",
    "Efici?ncia": "Eficiência",
    "dist?ncia": "distância",
    "Dist?ncia": "Distância",
    "resist?ncia": "resistência",
    "Resist?ncia": "Resistência",
    "liga??o": "ligação",
    "Liga??o": "Ligação",
    "instala??o": "instalação",
    "Instala??o": "Instalação",
    "prote??o": "proteção",
    "Prote??o": "Proteção",
    "cr?tico": "crítico",
    "Cr?tico": "Crítico",
    "pend?ncia": "pendência",
    "Pend?ncia": "Pendência",
}


def normalizar_status(status: Any, padrao: str = STATUS_ALERTA) -> str:
    if status is None:
        return padrao
    texto = str(status).strip().upper()
    if not texto:
        return padrao
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    texto = texto.replace("Ã", "A").replace(" ", "_")
    if "OK" == texto:
        return STATUS_OK
    if "ALERTA" in texto or "WARNING" in texto:
        return STATUS_ALERTA
    if "CR" in texto or "ERRO" in texto or "ERROR" in texto:
        return STATUS_CRITICO
    if "NAO" in texto or "N/D" in texto:
        return STATUS_NAO_CALCULADO
    return padrao


def status_mais_grave(atual: Any, novo: Any) -> str:
    ordem = {STATUS_OK: 0, STATUS_ALERTA: 1, STATUS_CRITICO: 2, STATUS_NAO_CALCULADO: 1}
    atual_norm = normalizar_status(atual, STATUS_OK)
    novo_norm = normalizar_status(novo, STATUS_ALERTA)
    return novo_norm if ordem.get(novo_norm, 0) > ordem.get(atual_norm, 0) else atual_norm


def status_visual(status: Any) -> str:
    status_norm = normalizar_status(status)
    if status_norm == STATUS_CRITICO:
        return "CRÍTICO"
    if status_norm == STATUS_NAO_CALCULADO:
        return "NÃO CALCULADO"
    return status_norm


def limpar_texto(valor: Any, padrao: str = "N/D") -> str:
    if valor is None:
        return padrao
    texto = str(valor)
    if not texto:
        return padrao
    for origem, destino in REPAROS_TEXTO.items():
        texto = texto.replace(origem, destino)
    texto = texto.replace("\ufffd", "?")
    for origem, destino in REPAROS_TEXTO.items():
        texto = texto.replace(origem, destino)
    texto = re.sub(r"(?<=\w)\?+(?=\w)", "", texto)
    return texto


def normalizar_tipo_cabo(tipo: Any, padrao: str = "CU-PVC") -> str:
    if hasattr(tipo, "value"):
        tipo = tipo.value
    texto_original = str(tipo or padrao)
    if "." in texto_original:
        texto_original = texto_original.split(".")[-1]
    sem_acento = unicodedata.normalize("NFKD", texto_original).encode("ascii", "ignore").decode("ascii")
    texto = sem_acento.upper().replace("_", " ").replace("-", " ").replace("/", " ")
    tokens = set(texto.split())
    junto = "".join(texto.split())

    condutor = "AL" if ("AL" in tokens or "ALUMINIO" in tokens or "ALUMINUM" in tokens or "ALUMINIO" in junto) else "CU"
    if "COBRE" in tokens or "COPPER" in tokens or "CU" in tokens:
        condutor = "CU"
    isolacao = "XLPE" if "XLPE" in tokens or "EPR" in tokens or "XLPE" in junto else "PVC"
    resultado = f"{condutor}-{isolacao}"
    return resultado if resultado in {"CU-PVC", "CU-XLPE", "AL-PVC", "AL-XLPE"} else padrao


def status_global(*statuses: Any) -> str:
    geral = STATUS_OK
    for status in statuses:
        status_norm = normalizar_status(status, STATUS_ALERTA)
        if status_norm == STATUS_NAO_CALCULADO:
            status_norm = STATUS_ALERTA
        geral = status_mais_grave(geral, status_norm)
    return geral


def is_critico(status: Any) -> bool:
    return normalizar_status(status) == STATUS_CRITICO


def numero_finito(valor: Any, padrao: Optional[float] = None) -> Optional[float]:
    try:
        if valor is None or valor == "":
            return padrao
        if isinstance(valor, str):
            valor = valor.replace(",", ".")
        numero = float(valor)
        return numero if math.isfinite(numero) else padrao
    except (TypeError, ValueError):
        return padrao


def limpar_numero(valor: Any, casas: int = 3) -> Optional[float]:
    numero = numero_finito(valor)
    if numero is None:
        return None
    return round(numero, casas)
