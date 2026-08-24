from pathlib import Path
import argparse
import datetime as dt
import platform
import subprocess
import sys
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]

IGNORE_DIRS = {
    ".git", ".github", "node_modules", "dist", "build", "__pycache__",
    ".venv", "venv", "env", ".pytest_cache", ".mypy_cache",
    "exports", "exports_teste_final", "uploads", ".idea", ".vscode",
}
IGNORE_FILES = {
    ".env", ".env.local", ".env.production", ".env.development",
    "secrets.json", "secret.json",
}
TEXT_EXTS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".html",
    ".md", ".txt", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".ps1", ".bat",
}
KEY_GLOBS = [
    "frontend/package.json",
    "frontend/vite.config.*",
    "frontend/tailwind.config.*",
    "frontend/src/App.*",
    "frontend/src/main.*",
    "frontend/src/index.css",
    "frontend/src/api*",
    "frontend/src/pages/*.jsx",
    "frontend/src/pages/*.js",
    "frontend/src/components/ui/*",
    "frontend/src/components/projeto/*.jsx",
    "frontend/src/components/projeto/*.js",
    "backend/main.py",
    "backend/app/main.py",
    "backend/app/routers/*.py",
    "backend/app/models/*.py",
    "backend/app/schemas/*.py",
    "backend/app/services/*.py",
    "backend/requirements.txt",
    "backend/pyproject.toml",
    "render.yaml",
]

def is_ignored(path: Path) -> bool:
    if set(path.parts) & IGNORE_DIRS:
        return True
    if path.name in IGNORE_FILES:
        return True
    return False

def rel(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")

def iter_files():
    for p in ROOT.rglob("*"):
        if p.is_file() and not is_ignored(p):
            yield p

def run_command(command, cwd: Path, timeout=240):
    try:
        result = subprocess.run(
            command, cwd=str(cwd), shell=True, text=True,
            capture_output=True, timeout=timeout
        )
        return {
            "command": command,
            "cwd": str(cwd),
            "returncode": result.returncode,
            "stdout": result.stdout[-12000:],
            "stderr": result.stderr[-12000:],
        }
    except Exception as e:
        return {
            "command": command,
            "cwd": str(cwd),
            "returncode": -999,
            "stdout": "",
            "stderr": repr(e),
        }

def make_tree(max_depth=6):
    lines = [ROOT.name]

    def walk(path: Path, prefix="", depth=0):
        if depth > max_depth:
            return
        try:
            entries = sorted(
                [x for x in path.iterdir() if not is_ignored(x)],
                key=lambda x: (not x.is_dir(), x.name.lower())
            )
        except PermissionError:
            return

        for i, entry in enumerate(entries):
            connector = "└── " if i == len(entries) - 1 else "├── "
            lines.append(f"{prefix}{connector}{entry.name}")
            if entry.is_dir():
                extension = "    " if i == len(entries) - 1 else "│   "
                walk(entry, prefix + extension, depth + 1)

    walk(ROOT)
    return "\n".join(lines)

def detect_key_files():
    found = []
    for pattern in KEY_GLOBS:
        for p in ROOT.glob(pattern):
            if p.exists() and p.is_file() and not is_ignored(p):
                found.append(p)
    unique, seen = [], set()
    for p in found:
        r = rel(p)
        if r not in seen:
            seen.add(r)
            unique.append(p)
    return unique

def read_text_safe(path: Path, max_chars=45000):
    try:
        data = path.read_text(encoding="utf-8", errors="replace")
        if len(data) > max_chars:
            return data[:max_chars] + "\n\n/* ARQUIVO TRUNCADO PARA DIAGNÓSTICO */\n"
        return data
    except Exception as e:
        return f"/* ERRO AO LER ARQUIVO: {repr(e)} */"

def scan_suspicious_patterns(files):
    patterns = [
        "TODO", "FIXME", "console.log", "undefined", "NaN",
        "CRÃ", "Respons?vel", "Consist?ncia", "null",
        "api/projetos", "CRITICO", "CRÍTICO",
    ]
    hits = []
    for p in files:
        if p.suffix.lower() not in TEXT_EXTS:
            continue
        text = read_text_safe(p, max_chars=200000)
        for pattern in patterns:
            if pattern in text:
                hits.append((rel(p), pattern, text.count(pattern)))
    return hits

def write_diagnostic(run_checks=False):
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    files = list(iter_files())
    ext_counter = Counter(p.suffix.lower() or "[sem extensão]" for p in files)
    key_files = detect_key_files()
    suspicious = scan_suspicious_patterns(key_files)

    checks = []
    if run_checks:
        frontend = ROOT / "frontend"
        backend = ROOT / "backend"
        if frontend.exists():
            checks.append(run_command("npm run build", frontend))
        if backend.exists():
            target = "app" if (backend / "app").exists() else "."
            checks.append(run_command(f'"{sys.executable}" -m compileall {target}', backend))

    output = []
    output.append("# Diagnóstico CalcCabos\n")
    output.append(f"- Gerado em: `{now}`")
    output.append(f"- Sistema: `{platform.platform()}`")
    output.append(f"- Python: `{sys.version.split()[0]}`")
    output.append(f"- Raiz: `{ROOT}`\n")

    output.append("## 1. Árvore do projeto\n")
    output.append("```text")
    output.append(make_tree())
    output.append("```\n")

    output.append("## 2. Contagem por extensão\n")
    output.append("| Extensão | Quantidade |")
    output.append("|---|---:|")
    for ext, count in sorted(ext_counter.items()):
        output.append(f"| `{ext}` | {count} |")
    output.append("")

    output.append("## 3. Arquivos-chave detectados\n")
    for p in key_files:
        output.append(f"- `{rel(p)}`")
    output.append("")

    output.append("## 4. Padrões suspeitos\n")
    if suspicious:
        output.append("| Arquivo | Padrão | Ocorrências |")
        output.append("|---|---|---:|")
        for file, pattern, count in suspicious:
            output.append(f"| `{file}` | `{pattern}` | {count} |")
    else:
        output.append("Nenhum padrão suspeito encontrado nos arquivos-chave.")
    output.append("")

    if run_checks:
        output.append("## 5. Checks executados\n")
        for check in checks:
            status = "OK" if check["returncode"] == 0 else "FALHOU"
            output.append(f"### {status} — `{check['command']}`")
            output.append(f"- cwd: `{check['cwd']}`")
            output.append(f"- return code: `{check['returncode']}`")
            output.append("\n#### STDOUT\n```text")
            output.append(check["stdout"] or "[vazio]")
            output.append("```\n#### STDERR\n```text")
            output.append(check["stderr"] or "[vazio]")
            output.append("```\n")

    out_path = ROOT / "CALCCABOS_DIAGNOSTICO.md"
    out_path.write_text("\n".join(output), encoding="utf-8")
    return out_path

def write_collected_files():
    key_files = detect_key_files()
    output = []
    output.append("# Arquivos-chave do CalcCabos\n")
    output.append("Não inclui `.env`, `node_modules`, `venv` ou binários.\n")

    lang_map = {
        ".py": "python", ".js": "javascript", ".jsx": "jsx",
        ".ts": "typescript", ".tsx": "tsx", ".css": "css",
        ".json": "json", ".md": "markdown", ".yml": "yaml",
        ".yaml": "yaml", ".html": "html",
    }

    for p in key_files:
        language = lang_map.get(p.suffix.lower(), "text")
        output.append(f"\n## `{rel(p)}`\n")
        output.append(f"```{language}")
        output.append(read_text_safe(p))
        output.append("```")

    out_path = ROOT / "CALCCABOS_ARQUIVOS_CHAVE.md"
    out_path.write_text("\n".join(output), encoding="utf-8")
    return out_path

def main():
    parser = argparse.ArgumentParser(description="Diagnóstico local do CalcCabos")
    parser.add_argument("--check", action="store_true", help="Executa npm build e compileall")
    parser.add_argument("--collect", action="store_true", help="Coleta conteúdo dos arquivos-chave")
    args = parser.parse_args()

    diag = write_diagnostic(run_checks=args.check)
    print(f"[OK] Diagnóstico gerado: {diag}")

    if args.collect:
        collected = write_collected_files()
        print(f"[OK] Arquivos-chave gerados: {collected}")

if __name__ == "__main__":
    main()