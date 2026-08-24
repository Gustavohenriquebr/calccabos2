# backend/app/services/protecao_mtat.py
"""MT/AT protection validation utilities.

Provides a lightweight validator that accepts both new field names and legacy
aliases, never raises exceptions and returns a structured result suitable for
DTOs and PDF rendering.
"""

from functools import reduce
from typing import Any, Dict
import logging

from app.services.status_utils import normalizar_status, status_mais_grave

logger = logging.getLogger(__name__)


def validar_mtat(dados: Dict[str, Any]) -> Dict[str, Any]:
    """Validate minimal MT/AT protection parameters.

    The function checks for the presence of required values and performs very
    simple sanity checks. It never raises; all problems are reported via the
    returned ``status``/``mensagem`` fields.

    Accepted keys (both new names and legacy aliases):
        - classe_tensao_kv / Vn
        - nbi_kv / NBI
        - tafi_ka / TAFI
        - sequencia_operacao / seq_op
        - meio_extincao / meio
        - tipo_acionamento / acionamento
        - acessorios
        - modelo
        - norma_referencia
        - corrente_nominal_in (alias of disjuntor_corrente_nominal)
        - corrente_curto_icc (alias of isc_local)
        - duracao_curto_s (alias of tempo_atuacao)
        - fabricante (alias of disjuntor_fabricante)
    """
    # Defensive getters
    def _g(key: str, default=None):
        return dados.get(key, default)

    # Gather values (new names first, then aliases)
    classe_tensao_kv = _g('classe_tensao_kv') or _g('Vn')
    nbi_kv = _g('nbi_kv') or _g('NBI')
    tafi_ka = _g('tafi_ka') or _g('TAFI')
    sequencia_operacao = _g('sequencia_operacao')
    meio_extincao = _g('meio_extincao')
    tipo_acionamento = _g('tipo_acionamento')
    acessorios = _g('acessorios')
    modelo = _g('modelo')
    norma_referencia = _g('norma_referencia')
    corrente_nominal_in = _g('corrente_nominal_in') or _g('disjuntor_corrente_nominal')
    corrente_curto_icc = _g('corrente_curto_icc') or _g('isc_local')
    duracao_curto_s = _g('duracao_curto_s') or _g('tempo_atuacao')
    fabricante = _g('fabricante') or _g('disjuntor_fabricante')
    frequencia = _g('frequencia')
    duracao = duracao_curto_s

    detalhes: Dict[str, Any] = {
        'classe_tensao_kv': classe_tensao_kv,
        'nbi_kv': nbi_kv,
        'tafi_ka': tafi_ka,
        'sequencia_operacao': sequencia_operacao,
        'meio_extincao': meio_extincao,
        'tipo_acionamento': tipo_acionamento,
        'acessorios': acessorios,
        'modelo': modelo,
        'norma_referencia': norma_referencia,
        'corrente_nominal_in': corrente_nominal_in,
        'corrente_curto_icc': corrente_curto_icc,
        'duracao_curto_s': duracao_curto_s,
        'fabricante': fabricante,
    }

    # Validation logic – light and permissive
    mensagens = []
    status_levels = []

    if classe_tensao_kv is None:
        mensagens.append('Tensão nominal (classe_tensao_kv) ausente')
        status_levels.append('ALERTA')
    if corrente_nominal_in is None:
        mensagens.append('Corrente nominal do disjuntor ausente')
        status_levels.append('ALERTA')
    if corrente_curto_icc is None:
        mensagens.append('Corrente de curto‑circuito (isc) ausente')
        status_levels.append('ALERTA')
    if frequencia is not None:
        if not (45 <= frequencia <= 65):
            mensagens.append('Frequência fora do intervalo 45‑65 Hz')
            status_levels.append('ALERTA')
    else:
        mensagens.append('Frequência não informada')
        status_levels.append('ALERTA')
    if duracao is not None:
        if duracao <= 0:
            mensagens.append('Duração do curto‑circuito deve ser > 0')
            status_levels.append('ALERTA')
    else:
        mensagens.append('Duração do curto‑circuito ausente')
        status_levels.append('ALERTA')

    # Simple fictitious checks for NBI/TAFI values
    if nbi_kv is not None and nbi_kv <= 0:
        mensagens.append('NBI deve ser positivo')
        status_levels.append('ALERTA')
    if tafi_ka is not None and tafi_ka <= 0:
        mensagens.append('TAFI deve ser positivo')
        status_levels.append('ALERTA')

    # FIX: status_mais_grave takes exactly 2 args. Calling it with *status_levels
    # (variadic unpack) would fail with TypeError when len != 2.
    # Use reduce() to fold the list correctly, handling empty lists via initializer.
    overall_status = reduce(status_mais_grave, status_levels, 'OK') if status_levels else 'OK'
    overall_status = normalizar_status(overall_status)

    if not mensagens:
        mensagem = 'Validação MT/AT OK'
    else:
        mensagem = '; '.join(mensagens)

    logger.debug('validar_mtat result: %s - %s', overall_status, mensagem)

    return {
        'status': overall_status,
        'mensagem': mensagem,
        'detalhes': detalhes,
    }
