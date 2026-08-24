# main.spec
# Roda com: pyinstaller main.spec --clean

import os
import sys

from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

datas = []
binaries = []
hiddenimports = []

for pkg in ["fastapi", "uvicorn", "sqlalchemy", "alembic", "pydantic", "pydantic_settings", "passlib", "bcrypt", "jose", "multipart", "reportlab", "openpyxl", "pandas", "psycopg"]:
    pkg_datas, pkg_binaries, pkg_hiddenimports = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hiddenimports

hiddenimports += collect_submodules("uvicorn")
hiddenimports += collect_submodules("passlib")
hiddenimports += collect_submodules("pydantic_settings")

hiddenimports += [
    "uvicorn",
    "uvicorn.main",
    "uvicorn.config",
    "uvicorn.server",
    "uvicorn.logging",
    "uvicorn.importer",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.supervisors",
    "uvicorn.supervisors.basereload",
    "uvicorn.supervisors.multiprocess",
    "passlib.handlers.bcrypt",
    "passlib.handlers.sha2_crypt",
    "passlib.utils",
    "passlib.utils.pbkdf2",
    "passlib.crypto",
    "passlib.crypto.digest",
    "bcrypt",
    "bcrypt._bcrypt",
    "email.mime.text",
    "email.mime.multipart",
]

datas += [
    ("app", "app"),
    ("alembic", "alembic"),
    ("alembic.ini", "."),
    (".env.example", "."),
]

a = Analysis(
    ["main.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="main",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="main",
)
