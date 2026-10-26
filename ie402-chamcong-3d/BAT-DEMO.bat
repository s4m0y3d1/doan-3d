@echo off
REM ============================================================
REM  Bat he thong cham cong dinh vi 3D de demo.
REM  Lan dau sau khi clone repo: chay CAI-DAT.bat truoc.
REM ============================================================
setlocal enabledelayedexpansion
chcp 65001 >nul
title Cham cong 3D - dang khoi dong...

set "DUAN=%~dp0"
cd /d "%DUAN%"

REM ---------- 0. Thu vien Node da co chua ----------
if not exist "%DUAN%server\node_modules" (
  echo.
  echo  *** CHUA CAI THU VIEN Node ***
  echo  Hay chay CAI-DAT.bat truoc - chi can mot lan sau khi clone repo.
  pause
  exit /b 1
)

REM ---------- 1. PostgreSQL ----------
echo.
echo [1/3] Bat PostgreSQL + PostGIS (cong 55432)...
call "%DUAN%TIM-POSTGRES.bat"
if errorlevel 1 (
  echo  *** Khong tim thay PostgreSQL. Chay CAI-DAT.bat de duoc huong dan. ***
  pause
  exit /b 1
)

"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -p 55432 >nul 2>&1
if errorlevel 1 (
  "%PGBIN%\pg_ctl.exe" -D D:\pgportable\data -o "-p 55432 -c listen_addresses=127.0.0.1" -l D:\pgportable\server.log start
  ping -n 7 127.0.0.1 >nul
) else (
  echo       PostgreSQL da chay san.
)

REM ---------- 2. Kiem tra du lieu ----------
echo.
echo [2/3] Kiem tra co so du lieu...
"%PGBIN%\psql.exe" -h 127.0.0.1 -p 55432 -U postgres -d chamcong3d -c "SELECT count(*) AS so_nhan_vien FROM nhan_vien;"
if errorlevel 1 (
  echo.
  echo  *** KHONG DOC DUOC CSDL chamcong3d ***
  echo  Hay chay CAI-DAT.bat de tao va nap du lieu.
  pause
  exit /b 1
)

REM ---------- 3. May chu Node ----------
echo.
echo [3/3] Bat may chu Node (cong 3000)...
start "May chu cham cong 3D" cmd /k "cd /d %DUAN%server && npm start"
ping -n 7 127.0.0.1 >nul

echo.
echo Mo trinh duyet...
start "" http://127.0.0.1:3000

echo.
echo ============================================================
echo  DA SAN SANG:  http://127.0.0.1:3000
echo  Tai khoan:    khoi.nm / nhan.vt / vy.nt / tin.nh
echo  Mat khau:     123456
echo.
echo  De nguyen cua so "May chu cham cong 3D" - dong no la tat server.
echo  Tat he thong: chay TAT-DEMO.bat
echo ============================================================
ping -n 9 127.0.0.1 >nul
