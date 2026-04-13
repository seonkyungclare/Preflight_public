#!/bin/bash
cd "$(dirname "$0")"

# 이미 실행 중이면 종료 후 재시작
EXISTING=$(lsof -t -i:3000)
if [ -n "$EXISTING" ]; then
  kill "$EXISTING"
  sleep 1
fi

# 터미널과 분리해서 백그라운드 실행 (터미널 꺼도 서버 유지)
nohup npm run dev > /tmp/preflight.log 2>&1 &

# 서버가 뜰 때까지 대기 후 브라우저 오픈
sleep 4
open http://localhost:3000
