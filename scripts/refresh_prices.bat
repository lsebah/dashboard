@echo off
REM ===========================================================================
REM  refresh_prices.bat - Rafraichit les prix Bloomberg du portefeuille.
REM
REM  - Ne fait RIEN si le Terminal Bloomberg n'est pas lance (verifie bbcomm.exe).
REM  - Sinon : git pull, lance scripts\bloomberg_prices.py (met a jour lib\feed.json),
REM    puis commit + push si les prix ont change (-> redeploiement Vercel).
REM
REM  Placer ce fichier dans scripts\ : il se positionne tout seul a la racine du
REM  depot. Le clone du PC doit etre sur la branche `main` et avoir un acces push
REM  configure (PAT / identifiants git memorises) ainsi que git user.name/email.
REM
REM  Journal : scripts\refresh_prices.log
REM ===========================================================================
setlocal EnableExtensions
cd /d "%~dp0.."
set "LOG=scripts\refresh_prices.log"

REM --- Python : 'python' sinon 'py' ---
set "PY=python"
where python >NUL 2>&1 || set "PY=py"

REM --- 1) Bloomberg ouvert ? (bbcomm.exe = passerelle de l'API Desktop) ---
tasklist /FI "IMAGENAME eq bbcomm.exe" 2>NUL | find /I "bbcomm.exe" >NUL
if errorlevel 1 (
  echo [%date% %time%] Bloomberg non lance ^(bbcomm absent^) - abandon.>> "%LOG%"
  exit /b 0
)

REM --- 2) Derniere version du depot ---
git pull --quiet

REM --- 3) Collecte des prix -> lib\feed.json ---
echo [%date% %time%] Collecte des prix Bloomberg...>> "%LOG%"
%PY% scripts\bloomberg_prices.py >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%date% %time%] ECHEC du script Python - voir ci-dessus.>> "%LOG%"
  exit /b 1
)

REM --- 4) Commit + push si lib\feed.json a change ---
git diff --quiet -- lib/feed.json
if errorlevel 1 (
  git add lib/feed.json
  git commit -m "Prix Bloomberg %date%" --quiet
  git push --quiet
  echo [%date% %time%] Prix mis a jour et pousses.>> "%LOG%"
) else (
  echo [%date% %time%] Aucun changement de prix.>> "%LOG%"
)
endlocal
