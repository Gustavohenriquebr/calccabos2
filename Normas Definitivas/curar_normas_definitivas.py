from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


RAW_DIR = Path(r"C:\Users\GUSTAVO\Desktop\Normas Definitivas\bruto")
CURATED_DIR = Path(r"C:\Users\GUSTAVO\Desktop\Normas Definitivas\curado")

CODE_ORDER = [
    "N-1997",
    "N-2039",
    "N-2040",
    "N-2547",
    "N-2830",
    "N-2918",
    "N-2919",
    "N-2928",
]

TEXT_REPLACEMENTS = {
    "\u00a0": " ",
    "\uf0a3": "≤",
    "\uf0b3": "≥",
    "\uf020": "",
    "\uf057": "X",
    "\uf02d": "-",
    "\uf0d8": "",
    "\uf0fc": "",
    "": "Ω",
    "": "≤",
    "": "≥",
    "": "",
    "ºC": "°C",
    "“": "\"",
    "”": "\"",
    "’": "'",
    "‘": "'",
}

TITLE_OVERRIDES = {
    "N-1997": "Projeto de Redes Elétricas em Sistemas de Bandejamento para Cabos",
    "N-2040": "Elaboração, Apresentação e Gerenciamento de Documentos de Projetos de Eletricidade",
    "N-2918": "Atmosferas Explosivas - Classificação de Áreas",
    "N-2919": "Motores Elétricos Trifásicos de Indução ou Síncronos",
    "N-2928": "Transformadores de Potência",
}

TYPE_OVERRIDES = {
    "N-2918": "Procedimento",
    "N-2928": "Especificação",
}

ESCOPO_OVERRIDES = {
    "N-2918": (
        "Esta Norma estabelece critérios para classificação de áreas com atmosferas explosivas "
        "nas instalações da PETROBRAS, incluindo condições gerais, ventilação, zonas, "
        "documentação, gestão de mudanças e determinação de níveis de proteção EPL."
    ),
    "N-2928": (
        "Esta Norma fixa os requisitos para aquisição de transformadores de potência secos ou "
        "imersos em líquido isolante, com potência a partir de 500 kVA, para uso nas instalações "
        "da PETROBRAS."
    ),
}

TABLE_TITLE_OVERRIDES: dict[str, dict[int, str]] = {
    "N-2547": {
        1: "Tabela 1 - Temperatura Ambiente",
        2: "Tabela 2 - Terminologia para os Índices de Harmônicos",
    },
    "N-2830": {
        1: "Tabela 1 - Requisitos de Segurança",
        2: "Tabela 2 - Extração ou inserção de dispositivos",
        3: "Tabela 3 - EPI para Eletricista",
    },
    "N-2918": {
        24: (
            "Tabela 36 - EPL onde Somente Zonas Forem Determinadas para Áreas "
            "Classificadas com Gases ou Poeiras Combustíveis"
        ),
        60: (
            "Tabela D.3 - Distâncias Recomendadas para Aplicação para Juntas e "
            "Acessórios Roscados e Flangeados"
        ),
    },
    "N-2919": {
        2: (
            "Tabela 2 - Critérios de Seleção de Tipo de Proteção \"Ex\" e de EPL de "
            "Motor para Instalação em Áreas Classificadas de Poeiras Combustíveis"
        ),
        3: (
            "Tabela 3 - Critérios de Seleção de Tipo de Proteção \"Ex\" e de EPL de "
            "Motor com Controle por Conversor de Frequência para Instalação em Áreas "
            "Classificadas de Gases Inflamáveis"
        ),
        4: "Tabela 4 - Lista de Testes Aplicáveis a Motores do Tipo de Indução e Síncrono",
        7: "Tabela 5 - Lista de Testes Aplicáveis Somente a Motores do Tipo de Indução",
        8: "Tabela 6 - Lista de Testes Aplicáveis Somente a Motores do Tipo Síncrono",
        12: "Tabela 10 - Documentação a ser Fornecida após a Colocação do PC",
        13: "Tabela 10 - Documentação a ser Fornecida após a Colocação do PC (Continuação)",
    },
    "N-2928": {
        1: "Tabela 1 - Acessórios para Transformadores Imersos em Líquido Isolante",
    },
}

TABLE_INDEXES_TO_DROP = {
    "N-2919": {15},
}

CURATED_CRITERIA = {
    "N-1997": [
        "Bandejamento em fibra de vidro não deve ser usado acima da temperatura ambiente de certificação do fabricante.",
        "Em instalações offshore, bandejamento em fibra de vidro não deve ser usado em locais confinados nem em áreas externas com temperatura prevista acima do limite do fabricante.",
        "Sistemas de bandejamento metálicos podem atuar como condutor de proteção desde que atendam à seção metálica mínima da Tabela 1 e tenham cordoalhas de interligação nas duas laterais, dimensionadas conforme ABNT NBR 5410.",
        "Se a área metálica disponível da eletrocalha ou leito não atender à Tabela 1, deve ser instalado condutor de aterramento em separado.",
        "A seção mínima das cordoalhas de aterramento deve seguir a Tabela 2.",
        "O aterramento entre trechos deve ser feito com cabos de cobre nu de seção nominal mínima de 25 mm².",
        "No dimensionamento de cargas distribuídas devem ser consideradas as cargas dos cabos instalados e dos cabos futuros, assumindo a seção reserva totalmente ocupada.",
        "O comprimento do trecho reto para dilatação térmica deve ser definido pela diferença entre as temperaturas extremas da região, conforme Tabela 3 e NEMA VE2.",
        "A ocupação total de cabos em eletrocalha ou leito não deve ultrapassar a seção transversal útil interna.",
        "O espaçamento entre bandejamentos de força e sinal deve seguir as Tabelas 4 e 5 conforme o tipo de sinal.",
    ],
    "N-2039": [
        "Barramentos aéreos e derivações devem ser preferencialmente de cabos nus, sem alma de aço, do mesmo material e seção dos cabos da linha de transmissão que chega à subestação.",
        "As distâncias mínimas da Tabela 1 devem ser obedecidas, com atendimento adicional à concessionária local e à coordenação de isolamento conforme ABNT NBR 6939.",
        "Barramentos e derivações devem ser calculados para suportar esforços de curto-circuito, ventos e demais condições climáticas e ambientais.",
        "O sistema de HVAC deve manter temperatura, umidade, pressurização, filtragem e renovação de ar adequadas aos equipamentos instalados.",
        "Em subestações pressurizadas, a pressão positiva mínima deve ser de 2,5 mm de coluna d'água, com cascata de pressão entre ambientes quando houver comunicação interna.",
        "A vazão de ar de pressurização deve considerar acréscimo de 25% para compensar frestas não identificadas.",
        "A temperatura máxima no interior da sala de painéis não deve ultrapassar 40 °C e a média diária não deve exceder 35 °C.",
        "Para baterias chumbo-ácidas ventiladas e alcalinas, a temperatura máxima da sala não deve ultrapassar 40 °C e a média diária não deve exceder 35 °C.",
        "Para baterias chumbo-ácidas de recombinação reguladas a válvula, a sala de baterias deve ter temperatura máxima controlada em 25 °C.",
        "A distribuição de ar deve garantir temperatura e movimentação de ar homogêneas nos ambientes da subestação.",
    ],
    "N-2040": [
        "A documentação do projeto elétrico deve incluir lista de cargas elétricas, unifilar geral da subestação, lista de cabos de força e controle e memória de cálculo de dimensionamento de TCs ou sensores de corrente e tensão.",
        "Deve ser apresentada memória de cálculo de dimensionamento de TCs ou sensores de corrente e tensão.",
        "Deve ser apresentada memória de cálculo do dimensionamento do sistema de corrente contínua.",
    ],
    "N-2547": [
        "O conversor de frequência deve operar continuamente nas condições de temperatura ambiente da Tabela 1, sem perda de vida útil.",
        "O projeto deve considerar temperaturas de armazenagem e transporte entre -25 °C e 55 °C.",
        "O conversor deve operar continuamente com umidade relativa entre 15 % e 90 %, sem condensação.",
        "Fiações de controle devem ser de cobre, encordoadas, com seção nominal mínima de 0,5 mm² para conexões internas e 1,5 mm² para conexões externas, com isolação de regime igual ou superior a 70 °C.",
        "A fiação de controle deve ser separada da fiação de força e toda tensão alternada deve ser separada de toda tensão contínua por septos, distâncias adequadas ou uso de cabos blindados.",
        "Conversores de 37,5 kW até 150 kW devem possuir rendimento nominal mínimo de 96 % quando alimentados diretamente e de 95 % quando alimentados via transformador.",
        "Conversores de baixa tensão entre 150 kW e 1 000 kW devem possuir rendimento nominal mínimo de 97 % quando alimentados diretamente e de 95 % quando alimentados via transformador.",
        "Conversores de média tensão devem possuir rendimento nominal mínimo de 96 %, considerando perdas no transformador, ventilação e controle.",
        "Conversores utilizados em unidades marítimas ou terrestres isoladas de concessionária devem possuir fator de deslocamento mínimo de 0,8, e em instalações supridas por concessionária, mínimo de 0,92.",
        "Não é permitido banco de capacitores para correção do fator de deslocamento, exceto quando integrado a filtro passivo de harmônicos.",
        "O conversor deve suportar 110 % da corrente nominal durante 60 s a cada 10 min.",
        "Para conversores de média tensão ou de baixa tensão com potência superior a 75 kW, a especificação harmônica deve considerar estudo específico e atender aos limites das Tabelas 2 e 3.",
        "Quando a potência nominal do conversor for igual ou superior a 375 kW, só são aceitas soluções com 12 ou mais pulsos, retificador ativo/regenerativo ou filtro ativo incorporado ao retificador.",
        "Em qualquer situação, a distorção harmônica da corrente de entrada do conversor deve ser menor ou igual a 15 %.",
        "Na compatibilização entre conversor e motor devem ser considerados o comprimento, o tipo, a formação e a seção dos cabos, conforme IEC TS 60034-25.",
    ],
    "N-2830": [
        "Alterações no sistema de geração, na topologia da rede de distribuição ou nos ajustes de proteção exigem reavaliação da energia incidente de arco dos painéis elétricos.",
        "Para atividades de manobra devem ser usados EPI compatíveis com o nível de energia incidente calculado.",
        "Intervenções em circuitos e dispositivos do compartimento de controle de baixa tensão com tensão de 440 V ou superior exigem protetor facial de nível AE-2, mesmo com energia incidente abaixo de 8 cal/cm².",
        "Para cubículos ou painéis de tensões até 220 V não é exigido protetor facial.",
        "A extração ou inserção completa de disjuntor, contator ou gaveta só deve ser executada com o dispositivo devidamente aberto.",
    ],
    "N-2918": [
        "Quando houver produtos com diferentes pontos de fulgor e classes de temperatura, a classificação de áreas deve seguir a condição mais rigorosa.",
        "Os dutos de saída do sistema de exaustão devem descarregar em ambiente aberto e distante de outras tomadas de ar.",
        "O arranjo de dutos deve favorecer extração no teto e insuflamento ou entrada natural de ar por baixo.",
        "Os critérios de potência de recarga para locação, ventilação e classificação de áreas são os definidos na Tabela 35.",
        "Os estudos de classificação de áreas devem indicar, quando aplicável, os níveis de proteção EPL necessários para os equipamentos a serem instalados em cada local.",
        "A especificação do EPL pode seguir o método tradicional de seleção de equipamentos, com base na relação entre tipo de proteção e zona de aplicação da ABNT NBR IEC 60079-14.",
        "Para equipamentos com correntes de produção com mais de 15 % de amônia, a área pode ser considerada não classificada.",
    ],
    "N-2919": [
        "Motores para instalação em áreas classificadas com partida direta na rede devem obedecer aos critérios de seleção de tipo de proteção Ex e EPL da Tabela 1.",
        "Motores para instalação em áreas classificadas de poeiras combustíveis devem obedecer aos critérios de seleção de tipo de proteção Ex e EPL da Tabela 2.",
        "Motores acionados por conversor de frequência ou soft-starter em áreas classificadas de gases inflamáveis devem obedecer aos critérios da Tabela 3.",
        "Para motores trifásicos com potência nominal até 55 kW, a relação de corrente de partida deve atender IA/IN ≤ 8,0.",
        "Para motores trifásicos com potência nominal acima de 55 kW até 150 kW, a relação de corrente de partida deve atender IA/IN ≤ 7,5.",
        "Para motores trifásicos com potência nominal acima de 150 kW até 375 kW, a relação de corrente de partida deve atender IA/IN ≤ 7,0.",
        "O tempo de rotor bloqueado a tensão nominal deve atender TRB ≥ 1,5 TP ou TRB ≥ TP + 5 s, prevalecendo o maior.",
        "Para a condição de tensão mínima especificada, o tempo de rotor bloqueado deve atender TRB ≥ TP + 2 s.",
        "Para motores Ex \"e\", o tempo tE deve atender tE ≥ TP + 2 s.",
        "Os testes aplicáveis aos motores de indução e síncronos devem seguir as Tabelas 4 a 7 e a documentação técnica deve seguir as Tabelas 8 a 11.",
    ],
    "N-2928": [
        "A designação da ligação do transformador deve atender às características de projeto e, quando aplicável, às exigências da concessionária.",
        "Para transformadores imersos em líquido isolante, os acessórios obrigatórios e opcionais devem seguir a Tabela 1 conforme a classe de tensão e a potência nominal.",
        "Para transformadores com classe de tensão maior que 36 kV, o rendimento mínimo deve seguir os valores por faixa de potência nominal definidos no item 4.5.2.",
        "O sistema local de supervisão e controle deve monitorar OLTC, ventilação forçada, temperaturas e eventos de alarme e trip.",
        "Os recursos de supervisão e controle para a sala de controle devem ser disponibilizados via rede de comunicação em protocolo IEC 61850.",
        "Quando solicitado, o OLTC deve atender à IEC 60214-1 e possuir chave local/remoto e manual/automático.",
        "O OLTC deve possuir recursos para operação em paralelo, permitindo modos mestre/escravo e individualizado.",
    ],
}

CURATED_FORMULAS = {
    "N-1997": [],
    "N-2039": [],
    "N-2040": [],
    "N-2547": [
        "37,5 kW ≤ P < 150 kW",
        "150 kW ≤ P ≤ 1 000 kW",
        "fator de deslocamento ≥ 0,8",
        "fator de deslocamento ≥ 0,92",
        "corrente nominal ≤ 16 A",
        "16 A < corrente nominal ≤ 75 A",
        "Vn ≤ 1,0 kV",
        "1,0 kV < Vn < 69 kV",
        "69 kV ≤ Vn < 230 kV",
        "potência nominal do conversor ≥ 375 kW",
        "distorção harmônica da corrente de entrada ≤ 15 %",
    ],
    "N-2830": [
        "100 V x 0,85 = 85 V c.a.",
        "tensão ≥ 440 V",
        "energia incidente < 8 cal/cm²",
    ],
    "N-2918": [
        "Densidade < 0,8",
        "0,8 < Densidade < 1,0",
        "MIC = 28 µJ",
        "Tig = 560 °C",
        "IDLH = 300 ppm",
    ],
    "N-2919": [
        "IA/IN ≤ 8,0",
        "IA/IN ≤ 7,5",
        "IA/IN ≤ 7,0",
        "TRB ≥ 1,5 TP",
        "TRB ≥ TP + 5 s",
        "TRB ≥ TP + 2 s",
        "tE ≥ TP + 2 s",
        "UN ≤ 1,0 kV",
        "1,0 kV < UN < 11,0 kV",
        "UN ≥ 11,0 kV",
        "UN ≥ 6,0 kV",
    ],
    "N-2928": [
        "Um ≤ 36 kV",
        "Um > 36 kV",
        "Sn < 5 000 kVA",
        "Sn ≥ 5 000 kVA",
        "5 MVA < Sn < 30 MVA",
        "30 MVA ≤ Sn < 50 MVA",
        "50 MVA ≤ Sn < 100 MVA",
        "100 MVA ≤ Sn < 200 MVA",
        "Sn ≥ 200 MVA",
        "rendimento ≥ 99,30 %",
        "rendimento ≥ 99,40 %",
        "rendimento ≥ 99,50 %",
        "rendimento ≥ 99,60 %",
        "rendimento ≥ 99,70 %",
    ],
}

CURATION_NOTES = {
    "N-1997": [
        "Título oficial padronizado em caixa normal.",
        "Critérios foram reescritos para eliminar cabeçalhos de tabela capturados como falso positivo.",
    ],
    "N-2039": [
        "Fragmentos de HVAC foram consolidados em critérios completos e verificáveis.",
    ],
    "N-2040": [
        "Conteúdo foi mantido como requisitos de documentação técnica relevantes ao memorial de cálculo.",
    ],
    "N-2547": [
        "Títulos genéricos de tabelas foram substituídos pelos títulos oficiais das páginas 6 e 22.",
        "Critérios e fórmulas foram filtrados para remover nomes de normas em inglês e linhas de formulário.",
    ],
    "N-2830": [
        "Títulos genéricos das três tabelas foram corrigidos pelos títulos oficiais do sumário e do corpo da norma.",
    ],
    "N-2918": [
        "Título oficial e tipo documental foram corrigidos a partir da capa real.",
        "Tabelas de páginas 99 e 230 receberam seus títulos reais; critérios ruidosos de anexos e sumário foram removidos.",
    ],
    "N-2919": [
        "Títulos genéricos das tabelas 2, 3, 4, 5, 6 e 10 foram corrigidos.",
        "A tabela-formulário do anexo foi removida por duplicar o conteúdo documental já representado pelas tabelas 10 e 11.",
        "Critérios foram reduzidos ao conjunto técnico de seleção Ex, partida e documentação mandatória.",
    ],
    "N-2928": [
        "Título oficial, tipo documental e escopo foram recompostos a partir das páginas iniciais.",
        "A tabela de acessórios foi limpa e a lista de fórmulas passou a refletir as faixas reais de tensão, potência e rendimento.",
    ],
}

REFERENCE_MARKERS = (
    "PETROBRAS",
    "ABNT",
    "IEC",
    "IEEE",
    "ISO",
    "ASTM",
    "NEMA",
    "API",
    "NFPA",
    "NR-",
    "IGEM",
)

VALUE_PATTERN = re.compile(
    r"(?:\d{1,3}(?:[ .]\d{3})*|\d+)(?:[.,]\d+)?\s*"
    r"(?:mm²|mm2|A|V|kV|kW|kVA|MVA|°C|%|ppm|µJ|cal/cm²|cal/cm2|dBA|dbA|m|mm|s)\b",
    re.IGNORECASE,
)


def normalize_text(value: Any) -> str:
    text = "" if value is None else str(value)
    for old, new in TEXT_REPLACEMENTS.items():
        text = text.replace(old, new)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.;:%)])", r"\1", text)
    text = re.sub(r"([(])\s+", r"\1", text)
    return text.strip()


def unique_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        normalized = normalize_text(item)
        if not normalized:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def clean_table(code: str, index: int, table: dict[str, Any]) -> dict[str, Any]:
    title = normalize_text(table.get("titulo_tabela", ""))
    title = TABLE_TITLE_OVERRIDES.get(code, {}).get(index, title)

    headers = [normalize_text(header) for header in table.get("cabecalho", [])]
    headers = [header for header in headers if header]

    rows: list[dict[str, str]] = []
    for row in table.get("linhas", []):
        if not isinstance(row, dict):
            continue
        cleaned_row = {
            normalize_text(key): normalize_text(value)
            for key, value in row.items()
            if normalize_text(key)
        }
        if any(value for value in cleaned_row.values()):
            rows.append(cleaned_row)

    return {
        "titulo_tabela": title,
        "cabecalho": headers,
        "linhas": rows,
    }


def collect_values(code: str, raw_values: list[str], criteria: list[str], formulas: list[str]) -> list[str]:
    values = [normalize_text(value) for value in raw_values]
    for source in criteria + formulas:
        values.extend(VALUE_PATTERN.findall(normalize_text(source)))

    if code == "N-2928":
        values.extend(["99,30 %", "99,40 %", "99,50 %", "99,60 %", "99,70 %"])

    return unique_preserve_order(values)


def curate_references(raw_references: list[str]) -> list[str]:
    curated: list[str] = []
    for item in raw_references:
        text = normalize_text(item)
        if not text:
            continue
        if len(text) > 220:
            continue
        upper = text.upper()
        if any(marker in upper for marker in REFERENCE_MARKERS):
            curated.append(text)
    return unique_preserve_order(curated)


def curate_norma(code: str) -> tuple[dict[str, Any], dict[str, int]]:
    raw_path = RAW_DIR / f"{code}.json"
    raw = json.loads(raw_path.read_text(encoding="utf-8"))

    curated_tables: list[dict[str, Any]] = []
    tables_to_drop = TABLE_INDEXES_TO_DROP.get(code, set())
    for index, table in enumerate(raw.get("tabelas", []), start=1):
        if index in tables_to_drop:
            continue
        curated_tables.append(clean_table(code, index, table))

    title = TITLE_OVERRIDES.get(code, normalize_text(raw.get("titulo", "")))
    tipo_documento = TYPE_OVERRIDES.get(code, normalize_text(raw.get("tipo_documento", "")))
    escopo = ESCOPO_OVERRIDES.get(code, normalize_text(raw.get("escopo", "")))
    criteria = unique_preserve_order(CURATED_CRITERIA[code])
    formulas = unique_preserve_order(CURATED_FORMULAS[code])
    references = curate_references(raw.get("referencias_normativas", []))
    values = collect_values(code, raw.get("valores_minimos", []), criteria, formulas)

    curated = {
        "codigo_norma": normalize_text(raw.get("codigo_norma", code)),
        "titulo": title,
        "tipo_documento": tipo_documento,
        "revisao": normalize_text(raw.get("revisao", "")),
        "data_norma": normalize_text(raw.get("data_norma", "")),
        "escopo": escopo,
        "tabelas": curated_tables,
        "criterios_dimensionamento": criteria,
        "formulas": formulas,
        "valores_minimos": values,
        "referencias_normativas": references,
    }

    stats = {
        "raw_tabelas": len(raw.get("tabelas", [])),
        "curated_tabelas": len(curated_tables),
        "raw_criterios": len(raw.get("criterios_dimensionamento", [])),
        "curated_criterios": len(criteria),
        "raw_formulas": len(raw.get("formulas", [])),
        "curated_formulas": len(formulas),
        "raw_valores": len(raw.get("valores_minimos", [])),
        "curated_valores": len(values),
        "raw_refs": len(raw.get("referencias_normativas", [])),
        "curated_refs": len(references),
    }
    return curated, stats


def build_report(curated_stats: dict[str, dict[str, int]]) -> str:
    lines = [
        "RELATORIO DE CURADORIA - TIER 1 DEFINITIVO",
        "",
        f"Pasta bruta: {RAW_DIR}",
        f"Pasta curada: {CURATED_DIR}",
        "",
    ]

    for code in CODE_ORDER:
        stats = curated_stats[code]
        lines.append(code)
        lines.append(
            f"- tabelas: {stats['raw_tabelas']} -> {stats['curated_tabelas']}"
        )
        lines.append(
            f"- criterios_dimensionamento: {stats['raw_criterios']} -> {stats['curated_criterios']}"
        )
        lines.append(
            f"- formulas: {stats['raw_formulas']} -> {stats['curated_formulas']}"
        )
        lines.append(
            f"- valores_minimos: {stats['raw_valores']} -> {stats['curated_valores']}"
        )
        lines.append(
            f"- referencias_normativas: {stats['raw_refs']} -> {stats['curated_refs']}"
        )
        for note in CURATION_NOTES[code]:
            lines.append(f"- nota: {note}")
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def main() -> None:
    CURATED_DIR.mkdir(parents=True, exist_ok=True)

    consolidated: list[dict[str, Any]] = []
    curated_stats: dict[str, dict[str, int]] = {}

    total = len(CODE_ORDER)
    print(f"Iniciando curadoria de {total} normas...")

    for position, code in enumerate(CODE_ORDER, start=1):
        print(f"[{position}/{total}] Curando {code}...")
        curated, stats = curate_norma(code)
        curated_stats[code] = stats
        consolidated.append(curated)

        output_path = CURATED_DIR / f"{code}.json"
        output_path.write_text(
            json.dumps(curated, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(
            f"  -> tabelas {stats['raw_tabelas']}->{stats['curated_tabelas']}, "
            f"criterios {stats['raw_criterios']}->{stats['curated_criterios']}, "
            f"formulas {stats['raw_formulas']}->{stats['curated_formulas']}"
        )

    consolidated_path = CURATED_DIR / "tier1_definitivo_normas_curado.json"
    consolidated_path.write_text(
        json.dumps(consolidated, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    report_path = CURATED_DIR / "relatorio_curadoria.txt"
    report_path.write_text(build_report(curated_stats), encoding="utf-8")

    print("Curadoria concluída.")
    print(f"JSON consolidado: {consolidated_path}")
    print(f"Relatório: {report_path}")


if __name__ == "__main__":
    main()
