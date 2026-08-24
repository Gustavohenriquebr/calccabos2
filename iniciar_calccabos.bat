@echo off
chcp 65001 > nul
title CalcCabos Launcher

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "URL=http://127.0.0.1:5173"

echo.
echo ==========================================
echo  Iniciando CalcCabos Local
echo ==========================================
echo.

if exist "%ROOT%\calccabos_launcher.py" (
    python "%ROOT%\calccabos_launcher.py"
    goto end
)

if not exist "%BACKEND%" (
  echo [ERRO] Pasta backend nao encontrada: %BACKEND%
  pause
  exit /b 1
)

if not exist "%FRONTEND%" (
  echo [ERRO] Pasta frontend nao encontrada: %FRONTEND%
  pause
  exit /b 1
)

echo [1/3] Iniciando backend FastAPI em http://127.0.0.1:8000 ...
start "CalcCabos Backend" cmd /k "cd /d "%BACKEND%" && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 5 /nobreak > nul

echo [2/3] Iniciando frontend Vite em %URL% ...
start "CalcCabos Frontend" cmd /k "cd /d "%FRONTEND%" && npm run dev"

timeout /t 4 /nobreak > nul

echo [3/3] Abrindo navegador em %URL% ...
start "" "%URL%"

echo.
echo CalcCabos iniciado com sucesso!
echo.
echo Backend:  http://127.0.0.1:8000
echo Frontend: %URL%
echo.
:end
pause
