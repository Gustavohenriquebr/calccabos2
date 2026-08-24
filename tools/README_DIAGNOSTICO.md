# Kit de Diagnóstico CalcCabos

Este kit cria relatórios para revisão manual sem depender do Codex.

## Arquivos

- `tools/diagnostico_calccabos.py`
- `tools/check_calccabos.ps1`

## Como usar

Na raiz do projeto:

```powershell
python tools\diagnostico_calccabos.py --check --collect
```

Isso gera:

- `CALCCABOS_DIAGNOSTICO.md`
- `CALCCABOS_ARQUIVOS_CHAVE.md`

Depois, com backend rodando, execute:

```powershell
powershell -ExecutionPolicy Bypass -File tools\check_calccabos.ps1
```

Isso gera:

- `logs/healthcheck_YYYYMMDD_HHMMSS.txt`

## O que enviar para revisão

- `CALCCABOS_DIAGNOSTICO.md`
- `CALCCABOS_ARQUIVOS_CHAVE.md`
- `logs/healthcheck_*.txt`
- prints da tela, se for bug visual

## Segurança

Os scripts ignoram:

- `.env`
- `node_modules`
- `venv`
- `.git`
- `dist`
- `build`
- `__pycache__`
- exports pesados