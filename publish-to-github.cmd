@echo off
setlocal
cd /d "%~dp0"

echo Arbeitsordner: %CD%
echo.

if not exist "index.html" (
  echo FEHLER: index.html fehlt.
  echo Du bist im falschen Ordner oder das ZIP wurde nicht vollstaendig entpackt.
  echo Das Skript muss im Ordner mit index.html, assets und data liegen.
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo Git ist nicht installiert. Bitte Git fuer Windows installieren:
  echo https://git-scm.com/download/win
  pause
  exit /b 1
)

set "REPO=%~1"
if "%REPO%"=="" set /p "REPO=GitHub-Repository-URL (https://github.com/NAME/REPO.git): "
if "%REPO%"=="" (
  echo Keine Repository-URL angegeben.
  pause
  exit /b 1
)

if not exist ".git" (
  git init
  git branch -M main
)

git config user.name >nul 2>&1
if errorlevel 1 git config user.name "SEAF Feldhandbuch"
git config user.email >nul 2>&1
if errorlevel 1 git config user.email "fanprojekt@example.invalid"

echo.
echo Dateien werden vorgemerkt...
git add -A

set "COUNT=0"
for /f %%c in ('git ls-files ^| find /c /v ""') do set "COUNT=%%c"
echo Vorgemerkte/verfolgte Dateien: %COUNT%

if %COUNT% LSS 10 (
  echo.
  echo FEHLER: Es wurden nur %COUNT% Dateien gefunden.
  echo Pruefe, ob du wirklich im entpackten Ordner mit index.html bist.
  echo Aktueller Ordner: %CD%
  git status --short
  pause
  exit /b 1
)

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "SEAF Feldhandbuch: Blue-Terminal-Website"
) else (
  echo Keine neuen Aenderungen zum Committen.
)

git remote remove origin >nul 2>&1
git remote add origin "%REPO%"
git config http.postBuffer 524288000

echo.
echo Push nach %REPO% ...
git push -u origin main
if errorlevel 1 (
  echo.
  echo Der Push ist fehlgeschlagen.
  echo.
  echo Haeufigste Ursachen:
  echo 1. Das GitHub-Repo ist nicht leer und hat schon einen Commit.
  echo    Dann entweder neues leeres Repo anlegen oder:
  echo       git pull --rebase origin main
  echo       git push -u origin main
  echo 2. Falscher Branch: Das Repo nutzt master statt main.
  echo 3. Login fehlgeschlagen: Personal Access Token statt Passwort verwenden.
  echo.
  echo Lokal vorgemerkt sind %COUNT% Dateien. Auf GitHub sichtbar sein muessen:
  echo index.html, assets/, data/, .github/, README.md ...
  pause
  exit /b 1
)

echo.
echo Fertig. %COUNT% Dateien wurden nach %REPO% gepusht.
set "REPO_WEB=%REPO:.git=%"
start "" "%REPO_WEB%"
pause
