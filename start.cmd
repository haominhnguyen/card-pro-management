@echo off
setlocal enabledelayedexpansion

set GREEN=[92m
set RED=[91m
set YELLOW=[93m
set BLUE=[94m
set NC=[0m

cls
echo.
echo %BLUE%╔══════════════════════════════════════════════════════╗%NC%
echo %BLUE%║  All-In-One Development Environment                  ║%NC%
echo %BLUE%║  MongoDB + Backend + Frontend                        ║%NC%
echo %BLUE%╚══════════════════════════════════════════════════════╝%NC%
echo.

REM ── .env check ───────────────────────────────────────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo %GREEN%[OK]   .env created from template%NC%
    ) else (
        echo %RED%[FAIL] .env.example not found%NC%
        exit /b 1
    )
)

REM ── Prerequisite checks ───────────────────────────────────────────────────────
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %RED%[FAIL] Docker not found. Install Docker Desktop.%NC%
    exit /b 1
)
echo %GREEN%[OK]   Docker found%NC%

node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %RED%[FAIL] Node.js not found. Install from https://nodejs.org/%NC%
    exit /b 1
)
echo %GREEN%[OK]   Node.js found%NC%

REM ── Install deps if missing ───────────────────────────────────────────────────
if not exist "backend\node_modules" (
    echo %YELLOW%[WAIT] Installing backend dependencies...%NC%
    cd backend && call npm install >nul 2>&1 && cd ..
    echo %GREEN%[OK]   Backend dependencies installed%NC%
)
if not exist "frontend\node_modules" (
    echo %YELLOW%[WAIT] Installing frontend dependencies...%NC%
    cd frontend && call npm install >nul 2>&1 && cd ..
    echo %GREEN%[OK]   Frontend dependencies installed%NC%
)

REM ── Kill processes on dev ports ───────────────────────────────────────────────
echo.
echo %BLUE%[INFO] Freeing ports 3000 and 5173...%NC%

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    if not "%%P"=="0" ( taskkill /PID %%P /F >nul 2>&1 )
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    if not "%%P"=="0" ( taskkill /PID %%P /F >nul 2>&1 )
)
echo %GREEN%[OK]   Ports cleared%NC%

REM ── Start MongoDB ─────────────────────────────────────────────────────────────
echo.
echo %BLUE%[INFO] Starting MongoDB...%NC%
docker ps --format "{{.Names}}" 2>nul | findstr /x "credit_card_mongo" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo %GREEN%[OK]   MongoDB already running%NC%
) else (
    docker-compose -f docker-compose.mongodb.yml up -d >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo %RED%[FAIL] Could not start MongoDB%NC%
        exit /b 1
    )
    echo %GREEN%[OK]   MongoDB started%NC%
    timeout /t 3 /nobreak >nul
)

REM ── Launch Backend + Frontend in separate windows ─────────────────────────────
echo.
echo %YELLOW%[....] Opening Backend  (port 3000)...%NC%
start cmd /k "title Backend ^| Credit Card & cd /d "%cd%\backend" & npm run start:dev"

timeout /t 2 /nobreak >nul

echo %YELLOW%[....] Opening Frontend (port 5173)...%NC%
start cmd /k "title Frontend ^| Credit Card & cd /d "%cd%\frontend" & npm run dev"

echo.
echo %GREEN%╔══════════════════════════════════════════════════════╗%NC%
echo %GREEN%║  All services launched!                              ║%NC%
echo %GREEN%╚══════════════════════════════════════════════════════╝%NC%
echo.
echo %YELLOW%   Frontend : http://localhost:5173%NC%
echo %YELLOW%   Backend  : http://localhost:3000%NC%
echo %YELLOW%   Health   : http://localhost:3000/health%NC%
echo.
echo %BLUE%To stop: close the Backend/Frontend windows, then run:%NC%
echo %YELLOW%   docker compose -f docker-compose.mongodb.yml down%NC%
echo.
