@echo off
setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

set "LOG=%cd%\run_final.log"
echo ==== START %date% %time% ==== > "%LOG%"

set "RETURN_RESET_TOKEN=true"

net session >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Please run this script AS ADMINISTRATOR. >> "%LOG%"
  echo [ERROR] Please run this script AS ADMINISTRATOR.
  pause
  exit /b 1
)

echo [INFO] Checking NVM... >> "%LOG%"
where nvm >nul 2>&1
if errorlevel 1 (
  echo [INFO] NVM not found, installing... >> "%LOG%"
  if exist "%cd%\nvm-setup.exe" (
    echo [INFO] Using local nvm-setup.exe >> "%LOG%"
    start /wait "" "%cd%\nvm-setup.exe" /S >> "%LOG%" 2>&1
  ) else (
    echo [INFO] Using winget to install NVM... >> "%LOG%"
    where winget >nul 2>&1 || (
      echo [ERROR] winget not found. Please place nvm-setup.exe next to this BAT. >> "%LOG%"
      echo [ERROR] winget not found. Place nvm-setup.exe next to this BAT and run again.
      pause
      exit /b 1
    )
    winget install -e --id CoreyButler.NVMforWindows --silent --accept-package-agreements --accept-source-agreements >> "%LOG%" 2>&1
  )
)

if not defined NVM_HOME (
  if exist "%ProgramFiles%\nvm\nvm.exe" set "NVM_HOME=%ProgramFiles%\nvm"
  if not defined NVM_SYMLINK set "NVM_SYMLINK=%ProgramFiles%\nodejs"
)
if not exist "%NVM_HOME%\nvm.exe" (
  echo [ERROR] NVM not installed correctly. >> "%LOG%"
  echo [ERROR] NVM not installed correctly. Re-run script or install manually.
  pause
  exit /b 1
)
set "PATH=%NVM_HOME%;%NVM_SYMLINK%;%PATH%"

echo [INFO] Ensuring Node v20.18.0... >> "%LOG%"
"%NVM_HOME%\nvm.exe" list 2>>"%LOG%" | findstr /i "20.18.0" >nul
if errorlevel 1 (
  "%NVM_HOME%\nvm.exe" install 20.18.0 >> "%LOG%" 2>&1
)
"%NVM_HOME%\nvm.exe" use 20.18.0 >> "%LOG%" 2>&1

echo [INFO] Node version: >> "%LOG%"
node -v >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] Node is not available in PATH. >> "%LOG%"
  echo [ERROR] Node is not available in PATH. Close this window and run again as Administrator.
  pause
  exit /b 1
)

echo [INFO] Installing npm packages... >> "%LOG%"
if exist "%cd%\package-lock.json" (
  call npm ci >> "%LOG%" 2>&1
) else (
  call npm install >> "%LOG%" 2>&1
)
if errorlevel 1 (
  echo [ERROR] npm install failed. See run_final.log >> "%LOG%"
  echo [ERROR] npm install failed. See run_final.log
  pause
  exit /b 1
)

if not exist "%cd%\data" mkdir "%cd%\data" >> "%LOG%" 2>&1

echo [INFO] Running DB migrations... >> "%LOG%"
node db.js migrate >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] migrations failed. See run_final.log >> "%LOG%"
  echo [ERROR] migrations failed. See run_final.log
  pause
  exit /b 1
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8080 .*LISTENING"') do (
  echo [INFO] Port 8080 busy by PID %%p, trying to terminate... >> "%LOG%"
  taskkill /PID %%p /F >> "%LOG%" 2>&1
)

echo [INFO] Starting server... >> "%LOG%"
start "" /b cmd /c "node server.js >> "%LOG%" 2>&1"

timeout /t 2 >nul
start "" http://localhost:8080

echo [OK] Server should be running at http://localhost:8080 >> "%LOG%"
echo [OK] Server should be running at http://localhost:8080
echo (If page doesn't load, open run_final.log) 
pause
