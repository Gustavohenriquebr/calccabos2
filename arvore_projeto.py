"""
arvore_projeto.py
Gera a árvore de diretórios do projeto e salva em arvore.txt
Uso: python arvore_projeto.py
     python arvore_projeto.py C:/Users/GUSTAVO/Desktop/88
"""

import os
import sys

# ── Pastas/arquivos para ignorar ──────────────────────────────────────────────
IGNORAR = {
    "__pycache__", ".git", ".venv", "venv", "node_modules",
    ".pytest_cache", "dist", "build", ".mypy_cache", "htmlcov",
    ".idea", ".vscode", "*.pyc", "*.pyo", "*.egg-info",
}

def deve_ignorar(nome: str) -> bool:
    if nome in IGNORAR:
        return True
    for padrao in IGNORAR:
        if padrao.startswith("*") and nome.endswith(padrao[1:]):
            return True
    return False

def gerar_arvore(raiz: str, prefixo: str = "") -> list[str]:
    linhas = []
    try:
        entradas = sorted(os.scandir(raiz), key=lambda e: (not e.is_dir(), e.name.lower()))
    except PermissionError:
        return [prefixo + "  [sem permissão]"]

    entradas = [e for e in entradas if not deve_ignorar(e.name)]

    for i, entrada in enumerate(entradas):
        ultimo = (i == len(entradas) - 1)
        conector = "└── " if ultimo else "├── "
        icone = "📁 " if entrada.is_dir() else "📄 "
        linhas.append(prefixo + conector + icone + entrada.name)

        if entrada.is_dir():
            extensao = "    " if ultimo else "│   "
            linhas.extend(gerar_arvore(entrada.path, prefixo + extensao))

    return linhas

def main():
    # Pega o caminho da linha de comando ou usa o diretório atual
    raiz = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    raiz = os.path.abspath(raiz)

    if not os.path.isdir(raiz):
        print(f"❌ Caminho inválido: {raiz}")
        sys.exit(1)

    print(f"\n📂 Gerando árvore de: {raiz}\n")

    linhas = [f"📂 {os.path.basename(raiz)}/"]
    linhas += gerar_arvore(raiz)

    saida = "\n".join(linhas)

    # Exibe no terminal
    print(saida)

    # ── Descobre a Área de Trabalho (Windows normal e OneDrive) ──────────────
    if os.name == "nt":
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        onedrive_desktop = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop")
        if not os.path.isdir(desktop) and os.path.isdir(onedrive_desktop):
            desktop = onedrive_desktop
    else:
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")

    arquivo_saida = os.path.join(desktop, "arvore.txt")

    with open(arquivo_saida, "w", encoding="utf-8") as f:
        f.write(f"Projeto: {raiz}\n")
        f.write("=" * 60 + "\n")
        f.write(saida)

    print(f"\n✅ Árvore salva em: {arquivo_saida}")

    # Conta arquivos e pastas
    total_arquivos = sum(1 for l in linhas if "📄" in l)
    total_pastas   = sum(1 for l in linhas if "📁" in l)
    print(f"📊 {total_pastas} pastas | {total_arquivos} arquivos encontrados\n")

if __name__ == "__main__":
    main()
