# ROADMAP TÉCNICO — CALCCABOS VS AULAS 1 A 6

## 1. Executive summary
CalcCabos possesses a highly advanced backend aligned directly with the industrial engineering logic. It successfully implements the full cable calculation memorial, load list, three-phase systems, breaker verification, Ex equipment validation, and arrester margin validation. However, some areas require immediate attention: the SPDA/Grounding modules are too basic, breaker specifications are incomplete compared to Aula 4, and some Aula 5 arrester formulas need exact alignment. The immediate priority is closing the exact gap on Aula 5 (formulas) and Aula 4 (breaker specs) before building new heavy modules. The product is already defensible as a serious technical system.

## 2. Current system map
- **Backend services**: Fast and decoupled calculation engines (`calculo.py`, `protecao.py`, `areas_classificadas.py`, `para_raios.py`, `projeto_eletrico.py`, `aterramento.py`).
- **Routers**: FastAPI routes separating auth, projetos, circuitos, modulos_projeto, relatorios.
- **Models/Schemas**: SQLAlchemy models `Projeto`, `Circuito` with robust JSON fields for auxiliary modules (`transformador_dados`, `protecao_geral_dados`, etc.).
- **Frontend pages/components**: React/Vite with `Projeto.jsx` holding the core UI, `Dashboard.jsx`, and a floating AI assistant.
- **PDF/Excel exporters**: Advanced `relatorio_pdf.py` (ReportLab) and `relatorio_excel.py` (openpyxl) implementing Petrobras N-2040 style deliverables.
- **AI assistant/knowledge files**: Dedicated backend modules `normas_engine` and `context_detector`.

## 3. Coverage matrix

| Aula | Overall coverage | Strong points | Critical gaps | Best next action | Priority |
|---|---|---|---|---|---|
| 1 | PARCIAL | Memorial de cabos, PDF/Excel reports, lista de cargas | SPDA, iluminação, dissipação térmica, harmônicos | Deixar itens complexos como FUTURE_MODULE | MÉDIA |
| 2 | PARCIAL | Sistema trifásico, transformador (Icc secundário) | Banco de capacitores não modelado | Adicionar cálculo de banco de capacitores | MÉDIA |
| 3 | PRECISA VALIDAR | Ampacidade, queda de tensão, Icc térmico, correção K1/K2/K3 | Nenhum gap aparente | Comparar com materiais da Aula 3 quando liberados | ALTA |
| 4 | PARCIAL | Validação In vs Ib/Iz e Icu vs Icc | NBI, TAFI, extinção de arco não mapeados | Adicionar campos ao JSON `protecao_geral_dados` | ALTA |
| 5 | PRECISA VALIDAR | Vn mínimo, escoamento, margens parciais | Fórmula de MP3 difere ligeiramente | Ajustar cálculo de MP1, MP2, MP3 | ALTA |
| 6 | FEITO | Validação de Grupos, T-Classes, Zonas | IP para poeira, status de inspeção periódica | Adicionar ciclo de vida/manutenção | BAIXA |

## 4. Detailed diagnosis by aula

### AULA 1 — Industrial electrical project documentation
| Topic | Status | Evidence in code | Files/functions/components | Missing work | Migration? | Readiness | Risk | Priority |
|---|---|---|---|---|---|---|---|---|
| Load list & Memorial | FEITO | Full table calculations | `calculo.py`, `relatorio_pdf.py` | None | No | READY_NOW | Low | ALTA |
| Single-line diagram | NÃO FEITO | UI export missing | Frontend UI | Diagram drawing logic | No | FUTURE_MODULE | High | BAIXA |
| Short-circuit / Voltage | FEITO | `queda_tensao_pct`, `secao_joule` | `calculo.py` | Full network load flow | No | FUTURE_MODULE | Low | MÉDIA |
| Harmonics / Arc-flash | NÃO FEITO | No fields | - | All | Yes | FUTURE_MODULE | High | BAIXA |
| Grounding | PARCIAL | Wenner method | `aterramento.py` | Grid sizing | No | FUTURE_MODULE | High | BAIXA |

### AULA 2 — Three-phase systems and transformers
| Topic | Status | Evidence in code | Files/functions/components | Missing work | Migration? | Readiness | Risk | Priority |
|---|---|---|---|---|---|---|---|---|
| 3-phase power | FEITO | Apparent/Active/Reactive | `projeto_eletrico.py` | None | No | READY_NOW | Low | ALTA |
| Transformer Z% / Icc | FEITO | `corrente_curto_secundario` | `projeto_eletrico.py` | None | No | READY_NOW | Low | ALTA |
| Capacitor bank | NÃO FEITO | No logic | `projeto_eletrico.py` | Calculation logic | No | READY_NOW | Low | MÉDIA |

### AULA 3 — (Content not provided, based on current code)
| Topic | Status | Evidence in code | Files/functions/components | Missing work | Migration? | Readiness | Risk | Priority |
|---|---|---|---|---|---|---|---|---|
| Cable sizing | FEITO | `AMPACIDADE`, `FATOR_TEMP` | `calculo.py` | Await Aula 3 | No | READY_NOW | Low | ALTA |

### AULA 4 — Medium/high voltage circuit breakers
| Topic | Status | Evidence in code | Files/functions/components | Missing work | Migration? | Readiness | Risk | Priority |
|---|---|---|---|---|---|---|---|---|
| In / Icu capacity | FEITO | `validar_protecao_geral` | `protecao.py` | None | No | READY_NOW | Low | ALTA |
| NBI / BIL / TAFI | NÃO FEITO | No variables | `protecao.py` | Add to JSON/UI | No | READY_NOW | Low | ALTA |
| Extinction medium | NÃO FEITO | No variables | `protecao.py` | Add to JSON/UI | No | READY_NOW | Low | MÉDIA |

### AULA 5 — Line surge arresters
| Topic | Status | Evidence in code | Files/functions/components | Missing work | Migration? | Readiness | Risk | Priority |
|---|---|---|---|---|---|---|---|---|
| Vn_min = FA × VMAX | FEITO | `vn_minimo = fa * vmax` | `para_raios.py` | None | No | READY_NOW | Low | ALTA |
| Margins MP1/MP2/MP3 | PRECISA VALIDAR| `margem_protecao = min(...)` | `para_raios.py` | Fix MP3 formula to `0.83*NBI/freq_spark` | No | READY_NOW | Low | ALTA |

### AULA 6 — Classified areas and Ex asset management
| Topic | Status | Evidence in code | Files/functions/components | Missing work | Migration? | Readiness | Risk | Priority |
|---|---|---|---|---|---|---|---|---|
| Zones/Groups/T-Class | FEITO | `_validar_equipamento` | `areas_classificadas.py` | None | No | READY_NOW | Low | ALTA |
| IP dust requirement | NÃO FEITO | Missing | `areas_classificadas.py` | Add IP check for Zone 20-22 | No | NEEDS_MAPPING | Low | MÉDIA |
| Inspection/Maintenance | NÃO FEITO | Missing | `areas_classificadas.py` | Add lifecycle fields | No | NEEDS_MAPPING | Low | BAIXA |

## 5. What is truly implemented
- **Circuits / Cables**: Section sizing (ampacity, voltage drop, Joule integral), grouping/temperature derating (k1/k2/k3), method factors. (Evidence: `calculo.py`)
- **Transformer**: Z%, ratio, secondary Icc, primary/secondary In. (Evidence: `projeto_eletrico.py`)
- **Three-phase System**: Apparent/active/reactive power, power factor, efficiency, phase/line conversion. (Evidence: `projeto_eletrico.py`)
- **Protections (Basic)**: Overcurrent coordination (In >= Ib, In <= Iz, Icu >= Icc) for main and circuits. (Evidence: `protecao.py`)
- **Classified Areas**: Ex compatibility verification matching Zones vs Equipment groups (IIA/B/C) and T-classes (T1-T6). (Evidence: `areas_classificadas.py`)
- **Arresters**: Vn_min, minimum creepage distance based on Vmax, specific distance, and kD. (Evidence: `para_raios.py`)
- **Reports**: Outstanding PDF/Excel deliverables consolidating all calculation logs. (Evidence: `relatorio_pdf.py`, `relatorio_excel.py`)

## 6. What is partial
- **Breakers (Aula 4)**: Only low-voltage traits (In, Icu, Curve) are validated. Missing NBI, TAFI, and operating sequence parameters for MT/AT.
- **Grounding (Aula 1)**: Only computes soil resistivity (Wenner method). No touch/step voltage grid calculations.

## 7. What needs validation
- **Arrester Protection Margins (Aula 5)**: The current code calculates a generic `margens.append((nbi - tensao_residual) / nbi * 100)`. It must be aligned exactly to `MP1 = ((1.15 × NBI / front) - 1) × 100`, `MP2 = ((NBI / res) - 1) × 100`, and `MP3 = ((0.83 × NBI / freq) - 1) × 100`.
- **Cable calculations (Aula 3)**: Will need full correlation once Aula 3 is available.

## 8. What is not implemented
- Single-line diagram generation.
- Capacitor Bank calculation.
- Short-circuit load flow across multiple buses.
- Ex periodic inspection tracking.
- SPDA, lighting, battery banks, thermal dissipation, harmonics, arc-flash.

## 9. Missing fields by module
- **Transformer**: -
- **Three-phase system**: Capacitor bank target PF.
- **Protections / Breakers**: `nbi`, `tafi`, `rated_short_time_current`, `arc_extinction_medium`.
- **Surge arresters**: `front_wave_sparkover_voltage`, `power_frequency_sparkover_voltage`.
- **Classified areas / Ex**: `ip_rating`, `inspection_status`.

## 10. Improvements without migration
- Update formulas in `para_raios.py` to match Aula 5 exactly.
- Add MT/AT breaker specs to the generic JSON `protecao_geral_dados` without changing database schema.
- Add IP validation logic in `areas_classificadas.py`.

## 11. Improvements requiring migration
- None immediately. All current missing module data can be stored inside the existing JSON model fields (`protecao_geral_dados`, `para_raios_dados`, etc.).

## 12. Technical risks
- **Calculation regressions**: Modifying `para_raios.py` could break the frontend payload expectations if the dictionary keys change.
- **PDF Report breakage**: Changing the keys returned by backend modules might cause `relatorio_pdf.py` to print blank spaces or crash if keys are hardcoded.

## 13. Recommended implementation order
1. **Finish Aula 5 surge arrester logic** (Impact: High. Diff: Easy. Migration: No. Files: `para_raios.py`, `Projeto.jsx`. Risk: Low).
2. **Add Aula 4 MT/AT breaker specification** (Impact: High. Diff: Medium. Migration: No. Files: `protecao.py`, `Projeto.jsx`. Risk: Low).
3. **Upgrade Aula 6 classified areas IP logic** (Impact: Med. Diff: Easy. Migration: No. Files: `areas_classificadas.py`. Risk: Low).
4. **Add capacitor bank** (Impact: Med. Diff: Medium. Migration: No. Files: `projeto_eletrico.py`. Risk: Med).

## 14. Recommended first sprint
**Finish Aula 5 surge arrester logic**
- **Why**: It is the closest to being fully mathematically aligned with the course. The file `para_raios.py` already exists, it just needs the precise MP1, MP2, MP3 formulas applied.
- **Files to change**: `backend/app/services/para_raios.py`, `frontend/src/pages/Projeto.jsx` (to add the new voltage inputs).
- **Migration needed**: No (saved in `para_raios_dados` JSON text column).
- **Acceptance criteria**: MP1 > 20%, MP2 > 20%, MP3 > 15% logics throw `ALERTA` or `CRITICO` correctly, UI shows the new fields.

## 15. Test plan
- **Backend compile test**: `python -m pytest` or manually run `main.py`.
- **Frontend build test**: `npm run build` in `frontend/`.
- **Manual UI test**: Open Projeto > Para-raios, input test values, verify margin results.
- **PDF/Excel test**: Export project, verify if margins render correctly in the report.
- **Regression risk**: Low, restricted to the `para_raios` module.
- **Sample data needed**: NBI=125kV, Vmax=15kV, FA=0.8, front_wave=90kV, res_20ka=40kV, power_freq=60kV.

## 16. Commit strategy
- `docs: add tech roadmap vs aulas 1 to 6`
- `feat(backend): implement aula 5 arrester formulas MP1, MP2, MP3`
- `feat(frontend): add arrester sparkover voltage fields to UI`
- `feat(reports): update PDF/Excel to display new arrester margins`
