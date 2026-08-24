"""
CalcCabos — Circuit 500 error diagnostic script.
Run from backend/ directory: python diag_circuitos.py
"""
import sys
import traceback
import json

sys.path.insert(0, ".")

from app.database import SessionLocal
from app.models.circuito import Circuito
from app.models.projeto import Projeto
from app.schemas.circuito import CircuitoRead
from app.services.calculo import calcular_circuito

db = SessionLocal()

# ── 1. List all projects ─────────────────────────────────────────────────────
projs = db.query(Projeto).all()
print(f"Total projects: {len(projs)}")
for p in projs:
    cnt = db.query(Circuito).filter(Circuito.projeto_id == p.id).count()
    print(f"  id={p.id} nome={p.nome!r} circuits={cnt} contexto={p.contexto!r}")

# ── 2. Find project with circuits ────────────────────────────────────────────
target_id = None
for p in projs:
    if db.query(Circuito).filter(Circuito.projeto_id == p.id).count() > 0:
        target_id = p.id
        target_proj = p
        break

if target_id is None:
    # try all projects
    target_proj = projs[0] if projs else None
    target_id = target_proj.id if target_proj else None

if target_id is None:
    print("No projects found. DB may be empty.")
    db.close()
    sys.exit(0)

print(f"\n--- Testing project id={target_id} ---")
circuitos = (
    db.query(Circuito)
    .filter(Circuito.projeto_id == target_id)
    .order_by(Circuito.ordem)
    .all()
)
print(f"Circuits found: {len(circuitos)}")

# ── 3. Test Pydantic serialization for each circuit ──────────────────────────
failures = []
for c in circuitos:
    try:
        r = CircuitoRead.model_validate(c)
        # Test full JSON round-trip (catches Decimal, datetime, Enum issues)
        j = r.model_dump_json()
    except Exception as e:
        failures.append(
            {
                "id": c.id,
                "desc": c.descricao,
                "error": str(e),
                "tb": traceback.format_exc(),
            }
        )

if failures:
    print(f"\n!!! SERIALIZATION FAILURES: {len(failures)}")
    for f in failures:
        print(f"  Circuit id={f['id']} desc={f['desc']!r}")
        print(f"  ERROR: {f['error']}")
        print(f"  TRACEBACK:\n{f['tb']}")
else:
    print("All circuits serialize OK (Pydantic)")

# ── 4. Test calcular_circuito for each circuit ───────────────────────────────
print("\n--- Testing calcular_circuito ---")
calc_failures = []
for c in circuitos:
    try:
        resultado = calcular_circuito(c, target_proj.contexto)
        # Check for non-serializable values in resultado
        for k, v in resultado.items():
            try:
                json.dumps(v)
            except (TypeError, ValueError) as je:
                raise TypeError(f"Field '{k}' returned non-JSON value {type(v).__name__}: {v!r}") from je
    except Exception as e:
        calc_failures.append(
            {
                "id": c.id,
                "desc": c.descricao,
                "error": str(e),
                "tb": traceback.format_exc(),
            }
        )

if calc_failures:
    print(f"!!! CALC FAILURES: {len(calc_failures)}")
    for f in calc_failures:
        print(f"  Circuit id={f['id']} desc={f['desc']!r}")
        print(f"  ERROR: {f['error']}")
        print(f"  TRACEBACK:\n{f['tb']}")
else:
    print("All circuits calculate OK")

# ── 5. Raw DB column inspection for first circuit ────────────────────────────
print("\n--- Raw DB inspection (first circuit) ---")
if circuitos:
    c = circuitos[0]
    cols = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    for k, v in cols.items():
        typ = type(v).__name__
        # Flag suspicious values
        flag = ""
        if v is None:
            flag = "  [NULL]"
        elif typ not in ("str", "int", "float", "bool", "NoneType"):
            flag = f"  [!!! TYPE={typ}]"
        print(f"  {k}: {v!r}{flag}")

# ── 6. Check for NULL in non-nullable schema fields ──────────────────────────
print("\n--- NULL field check (non-optional schema fields) ---")
REQUIRED_FIELDS = ["descricao", "potencia_kw", "distancia_m", "projeto_id"]
null_errors = []
for c in circuitos:
    for field in REQUIRED_FIELDS:
        val = getattr(c, field, "MISSING")
        if val is None:
            null_errors.append(f"Circuit id={c.id}: required field '{field}' is NULL")

if null_errors:
    print("!!! NULL REQUIRED FIELDS:")
    for e in null_errors:
        print(f"  {e}")
else:
    print("All required fields populated OK")

# ── 7. Check acessorios JSON column ─────────────────────────────────────────
print("\n--- acessorios JSON column check ---")
for c in circuitos:
    val = getattr(c, "acessorios", None)
    if val is not None:
        try:
            if isinstance(val, str):
                json.loads(val)
                print(f"  id={c.id}: acessorios is STRING (expected dict) — may cause issues")
        except Exception as e:
            print(f"  id={c.id}: acessorios JSON INVALID: {e}")

print("\n--- Diagnostic complete ---")
db.close()
