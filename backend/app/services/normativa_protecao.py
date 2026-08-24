from typing import Dict, Any, Tuple

def validar_protecao(
    corrente_projeto: float, 
    icc_calculada: float, 
    disjuntor: Dict[str, Any]
) -> Tuple[bool, list[str]]:
    """
    Aplica as regras obrigatórias:
    - In disjuntor >= corrente_projeto
    - Icc disjuntor >= Icc calculada
    - bloquear NaN/Infinity/divisão por zero (já tratados antes da chamada, mas garantidos aqui pelas comparações seguras)
    """
    erros = []
    
    if not disjuntor:
        erros.append("Nenhum disjuntor selecionado para validação.")
        return False, erros

    try:
        in_a = float(disjuntor.get("corrente_nominal", 0.0))
        icc_ka = float(disjuntor.get("capacidade_interrupcao", 0.0))
    except (TypeError, ValueError):
        erros.append("Dados do disjuntor inválidos (valores numéricos esperados).")
        return False, erros

    if in_a < corrente_projeto:
        erros.append(f"In do disjuntor ({in_a} A) é menor que a corrente de projeto ({corrente_projeto:.2f} A).")
    
    if icc_ka < icc_calculada:
         erros.append(f"Icc do disjuntor ({icc_ka} kA) é menor que a Icc calculada ({icc_calculada:.2f} kA).")

    is_valid = len(erros) == 0
    return is_valid, erros
