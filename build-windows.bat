@echo off
REM Windows build script for Backstorie
REM Usage: build-windows.bat [filename]
REM Example: build-windows.bat examples\boxes.nim

echo ========================================
echo Backstorie Windows Build
echo ========================================
echo.

REM Check if Nim is installed
where nim >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Nim compiler not found!
    echo Please install Nim from https://nim-lang.org/
    exit /b 1
)

REM Set default file
set USERFILE=index
if NOT "%~1"=="" (
    set USERFILE=%~1
)

echo Building: %USERFILE%.nim
echo Target: Windows Console
echo.

REM Compile for Windows
nim c -d:release -d:userFile=%USERFILE% --out:backstorie.exe backstorie.nim

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Build successful!
    echo ========================================
    echo.
    echo Run with: backstorie.exe
    echo.
    echo NOTE: For best results, use Windows Terminal
    echo       Legacy CMD may have limited support
) else (
    echo.
    echo ========================================
    echo Build failed!
    echo ========================================
    exit /b 1
)
