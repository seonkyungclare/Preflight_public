#!/bin/bash

# Preflight for Linux

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd "$(dirname "$0")"

echo -e "${YELLOW}🚀 Preflight 시작 중...${NC}"

# 1. Node.js 설치 확인
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js가 설치되지 않았습니다.${NC}"
  echo "   Ubuntu/Debian: sudo apt install nodejs npm"
  echo "   또는 https://nodejs.org/ 에서 다운로드"
  exit 1
fi

# 2. .env.local 파일 확인
if [ ! -f ".env.local" ]; then
  echo -e "${RED}❌ .env.local 파일이 없습니다.${NC}"
  echo "   1. .env.local.example 을 참고해서 .env.local 파일을 생성하세요."
  echo "   2. ANTHROPIC_API_KEY 를 입력하세요."
  exit 1
fi

# 3. 의존성 설치 확인
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 패키지 설치 중...${NC}"
  npm install
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ npm install 실패${NC}"
    exit 1
  fi
fi

# 4. 기존 포트 프로세스 종료
echo -e "${YELLOW}⚙️  포트 확인 중...${NC}"
EXISTING=$(lsof -t -i:3000 2>/dev/null || fuser 3000/tcp 2>/dev/null)
if [ -n "$EXISTING" ]; then
  echo "   기존 프로세스 종료 중..."
  kill $EXISTING 2>/dev/null
  sleep 2
fi

# 5. 서버 시작
echo -e "${GREEN}✅ 서버 시작 중...${NC}"
echo -e "${YELLOW}브라우저에서 http://localhost:3000 을 열어주세요.${NC}"
echo -e "${YELLOW}서버 중지: Ctrl + C${NC}"
echo ""

npm run dev
