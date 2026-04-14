# 다른 사람 맥북에서 Preflight 실행하는 방법

## 📱 공유 방법 선택지

### 방법 1️⃣ GitHub로 공유 (권장)

#### 1단계: GitHub에 업로드 (첫 번째 사람만)
```bash
git add .
git commit -m "Initial commit: Preflight app ready for sharing"
git push origin main
```

#### 2단계: 다른 사람에게 공유
- GitHub 저장소 링크 전달
- 또는: `git clone [저장소_URL]`

---

### 방법 2️⃣ ZIP 파일로 공유

```bash
# 프로젝트 폴더를 ZIP으로 압축 (node_modules 제외)
zip -r Preflight.zip . -x "node_modules/*" ".git/*" ".*" "*.log"
```

- `Preflight.zip` 파일을 다른 사람과 공유
- 받은 사람이 압축 해제 후 아래 3단계 진행

---

## 🚀 받는 사람(다른 맥북) 설치 절차

### 1단계: 프로젝트 받기

**GitHub인 경우:**
```bash
git clone [저장소_URL]
cd Preflight_public
```

**ZIP 파일인 경우:**
- 받은 ZIP 파일 압축 해제
- 터미널에서 해당 폴더로 진입

### 2단계: Node.js 설치 확인
```bash
node --version
npm --version
```

- 없으면: https://nodejs.org/ 에서 **LTS** 버전 다운로드 및 설치

### 3단계: API 키 설정
```bash
# .env.local 파일 생성
cp .env.local.example .env.local

# 텍스트 에디터에서 열어서 API 키 입력
# (VS Code 추천: code .env.local)
# ANTHROPIC_API_KEY=sk-ant-[여기에_발급받은_키_붙여넣기]
```

### 4단계: 실행

**자동 실행 (클릭 한 번):**
```bash
./Preflight\ 실행.command
```
또는 Finder에서 `Preflight 실행.command` 파일 더블클릭

**또는 수동 실행:**
```bash
npm install
npm run dev
# 브라우저에서 http://localhost:3000 접속
```

---

## ⚠️ 필수사항

| 항목 | 필수 | 비고 |
|------|------|------|
| macOS/Linux/Windows | ✅ | - |
| Node.js 14+ | ✅ | [설치](https://nodejs.org/) |
| Anthropic API 키 | ✅ | 무료: https://console.anthropic.com |
| 터미널/CLI | ✅ | - |

---

## 🆘 FAQ

**Q: "node: command not found" 에러**  
A: Node.js 설치 후 터미널 재시작 (`cmd + q` → 재열기)

**Q: API 키는 어디서 얻나요?**  
A: https://console.anthropic.com/account/keys 에서 로그인 후 발급

**Q: 포트 3000이 이미 사용 중이라는 에러**  
A: 기존 프로세스 종료:
```bash
lsof -ti:3000 | xargs kill -9
```

**Q: npm install이 오래 걸려요**  
A: 정상입니다. 첫 실행 시만 오래 걸립니다. (2~5분)

**Q: 성능이 느린데?**  
A: 가장 먼저 API 응답 시간 확인:
```bash
tail -f /tmp/preflight.log
```

---

## 📞 도움말

README.md 파일에서 더 자세한 정보를 확인하세요.
