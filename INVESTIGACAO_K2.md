# Investigação K2 — Fator de Agrupamento (NBR 5410 Tabela 42)

**Data:** 2026-08-17  
**Versão:** CalcCabos v2.0.0  
**Status:** ✅ Bug confirmado e corrigido

---

## 1. Contexto

O avaliador reportou divergência no fator de agrupamento K2:

| Parâmetro            | Valor Avaliador | Valor Software (antes) |
|----------------------|-----------------|------------------------|
| Circuitos agrupados  | 4               | 4                      |
| Método instalação    | Bandeja ventilada | (não diferenciado)   |
| K2 esperado          | **0.77**        | **0.65**               |

---

## 2. Tabela usada pelo software (antes da correção)

O código usava uma **única tabela plana** sem distinção por método de instalação:

```python
# calculo.py — ANTES da correção
FATOR_AGRUP = {1: 1.00, 2: 0.80, 3: 0.70, 4: 0.65, 5: 0.60, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.50}
```

Essa tabela corresponde à **Coluna B da NBR 5410 Tabela 42** — aplicável a **eletrodutos embutidos** (cabos encerrados). Ela foi aplicada para **todos** os métodos de instalação, incluindo bandejas.

---

## 3. Tabela normativa (NBR 5410:2004 Tabela 42)

A NBR 5410 Tabela 42 define dois grupos distintos:

### Coluna A — Bandeja / Ar Livre (camada única, cabos se tocando)
Métodos: Bandeja perfurada, Bandeja ventilada, Ar Livre  
Ref: NBR 5410:2004 Tab.42 col.1 / IEC 60364-5-52 Tab.A.52-17 col.1

| N° circuitos | K2   |
|:------------:|:----:|
| 1            | 1.00 |
| 2            | 0.88 |
| 3            | 0.82 |
| **4**        | **0.77** |
| 5            | 0.73 |
| 6            | 0.72 |
| 7            | 0.72 |
| 8            | 0.71 |
| 9            | 0.70 |

### Coluna B — Eletroduto Embutido / Enterrado (cabos encerrados)
Métodos: Eletroduto embutido em parede, Enterrado direto  
Ref: NBR 5410:2004 Tab.42 col.2 / IEC 60364-5-52 Tab.A.52-17 col.2

| N° circuitos | K2   |
|:------------:|:----:|
| 1            | 1.00 |
| 2            | 0.80 |
| 3            | 0.70 |
| **4**        | **0.65** |
| 5            | 0.60 |
| 6            | 0.57 |
| 7            | 0.54 |
| 8            | 0.52 |
| 9            | 0.50 |

---

## 4. Diagnóstico

**Tipo de problema:** Bug de indexação — **não** uma diferença de método legítima.

O código aplicava a Coluna B (eletroduto) para todos os métodos de instalação, inclusive bandejas. Para o cenário CP-001 (bandeja ventilada, 4 circuitos), o valor correto pela norma é **K2 = 0.77** (Coluna A), não 0.65.

```
Diferença absoluta: 0.77 - 0.65 = 0.12 (18,5% de erro no fator K2)
Impacto: corrente corrigida menor → seção subdimensionada → risco elétrico
```

---

## 5. Correção aplicada

Substituição da tabela única por tabelas diferenciadas por método:

```python
# calculo.py — DEPOIS da correção
_FATOR_AGRUP_BANDEJA = {
    1: 1.00, 2: 0.88, 3: 0.82, 4: 0.77, 5: 0.73,
    6: 0.72, 7: 0.72, 8: 0.71, 9: 0.70,
}

_FATOR_AGRUP_ELETRODUTO = {
    1: 1.00, 2: 0.80, 3: 0.70, 4: 0.65, 5: 0.60,
    6: 0.57, 7: 0.54, 8: 0.52, 9: 0.50,
}

FATOR_AGRUP_POR_METODO = {
    "TRAY":         _FATOR_AGRUP_BANDEJA,
    "BANDEJAMENTO": _FATOR_AGRUP_BANDEJA,
    "AIR":          _FATOR_AGRUP_BANDEJA,
    "AR_LIVRE":     _FATOR_AGRUP_BANDEJA,
    "CONDUIT":      _FATOR_AGRUP_ELETRODUTO,
    "ELETRODUTO":   _FATOR_AGRUP_ELETRODUTO,
    "DIRECT":       _FATOR_AGRUP_ELETRODUTO,
    "ENTERRADO":    _FATOR_AGRUP_ELETRODUTO,
}
```

---

## 6. Caso de teste — CP-001

| Campo               | Valor        |
|---------------------|--------------|
| Potência            | 75 kW        |
| Tensão              | 380 V        |
| Fator de potência   | 0.87         |
| Circuitos agrupados | 4            |
| Método instalação   | TRAY (bandeja)|
| K2 esperado         | **0.77**     |
| K2 antes da fix     | 0.65         |

Teste unitário em: `backend/tests/test_k2_agrupamento.py`

---

## 8. FASE 5 — Auditoria Completa (2026-08-17)

Auditoria de todos os métodos de instalação aceitos pelo sistema contra
`FATOR_AGRUP_POR_METODO` e a NBR 5410 Tabela 42.

### Métodos suportados

O campo `metodo_instalacao` é livre (`String(30)`, default `"TRAY"`).
A função `_normalizar_metodo()` normaliza o valor e checa contra `FATOR_METODO`.
Se o método não estiver em `FATOR_METODO`, o fallback é `"TRAY"` (bandeja).

### Tabela de auditoria

| Método de Instalação | Coluna NBR 5410 Tab.42 | K2 (1 circ.) | K2 (4 circ.) | Validado |
|----------------------|------------------------|:---:|:---:|:---:|
| TRAY | Coluna A (bandeja/ar livre) | 1.00 | **0.77** | ✅ sim |
| BANDEJAMENTO | Coluna A (bandeja/ar livre) | 1.00 | **0.77** | ✅ sim |
| AIR | Coluna A (bandeja/ar livre) | 1.00 | **0.77** | ✅ sim |
| AR_LIVRE | Coluna A (bandeja/ar livre) | 1.00 | **0.77** | ✅ sim |
| CONDUIT | Coluna B (eletroduto/enterrado) | 1.00 | **0.65** | ✅ sim |
| ELETRODUTO | Coluna B (eletroduto/enterrado) | 1.00 | **0.65** | ✅ sim |
| DIRECT | Coluna B (eletroduto/enterrado) | 1.00 | **0.65** | ✅ sim |
| ENTERRADO | Coluna B (eletroduto/enterrado) | 1.00 | **0.65** | ✅ sim |

**Total: 8/8 métodos validados. Nenhum método sem cobertura própria.**

### Resultado dos testes de auditoria

```
test_fase5_todos_metodos_cobertos        PASS
test_fase5_bandeja_nao_usa_tabela_eletroduto  PASS
test_fase5_eletroduto_nao_usa_tabela_bandeja  PASS
test_fase5_cobertura_simetrica           PASS
test_fase5_audit_tabela_completa         PASS

22 passed, 0 failed  (inclui todos os testes K2 anteriores)
```

### Normalização de métodos alternativos

A função `_normalizar_metodo()` aceita variações como `"ar-livre"` → `"AR_LIVRE"`,
`"eletroduto"` → `"ELETRODUTO"`, etc. Métodos desconhecidos fazem fallback para
`"TRAY"` (Coluna A), o que é conservador/seguro pois usa K2 mais alto.

