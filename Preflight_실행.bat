@echo off
REM Preflight for Windows

setlocal enabledelayedexpansion

echo.
echo ======================================
echo   Preflight - PRD Analyzer
echo ======================================
echo.

REM 1. Node.js 확인
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js가 설치되지 않았습니다.
    echo 설치: https://nodejs.org/ ^(LTS 버전^)
    pause
    exit /b 1
)

REM 2. .env.local 확인
if not exist ".env.local" (
    echo ERROR: .env.local 파일이 없습니다.
    echo 1. .env.local.example 을 참고해서 .env.local 파일을 생성하세요.
    echo 2. ANTHROPIC_API_KEY 를 입력하세요.
    echo 3. 이 파일을 다시 실행하세요.
    pause
    exit /b 1
)

REM 3. node_modules 확인
if not exist "node_modules" (
    echo 패키지 설치 중...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: npm install 실패
        pause
        exit /b 1
    )
)

REM 4. 서버 시작
echo.
echo 서버 시작 중...
echo http://localhost:3000 에 접속하세요.
echo.
call npm run dev

pause
