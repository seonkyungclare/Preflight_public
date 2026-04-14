# 🚀 Preflight 배포 체크리스트

다른 사람의 맥북에서 Preflight를 실행하기 위해 필요한 모든 것을 준비했습니다.

## ✅ 완료된 항목

| 항목 | 파일 | 설명 |
|------|------|------|
| **README** | `README.md` | 프로젝트 설명 및 빠른 시작 가이드 |
| **설치 가이드** | `INSTALL.md` | 단계별 설치 및 공유 방법 |
| **macOS 실행 스크립트** | `Preflight 실행.command` | 클릭으로 자동 실행 (개선됨) |
| **Windows 실행 스크립트** | `Preflight_실행.bat` | Windows용 배치 파일 |
| **Linux 실행 스크립트** | `preflight-run.sh` | Linux/Unix용 셸 스크립트 |

---

## 🎯 다음 단계 (공유하기 전에)

### 1단계: Git 커밋 (GitHub로 공유하려면)
```bash
cd /Users/musinsa/Documents/ClaudeCode/Preflight_public/Preflight_public
git add README.md INSTALL.md "Preflight 실행.command" Preflight_실행.bat preflight-run.sh
git commit -m "docs: Add setup guides and run scripts for all platforms"
git push origin main
```

### 2단계: GitHub 저장소 링크 공유
- 저장소 URL을 다른 사람에게 전달
- 또는 이 `DEPLOY.md` 파일 자체를 공유

---

## ☁️ Vercel 배포 (권장: 웹으로 공유)

이 프로젝트는 Next.js(App Router) 기반이라 **Vercel에 바로 배포**할 수 있습니다.

### 1) Vercel에 배포
- 로컬에서:

```bash
npx vercel deploy --prod
```

### 2) Claude API 키(ANTHROPIC) 연결
Vercel에서는 서버 함수(`/api/analyze`, `/api/mockup`)가 **환경변수 `ANTHROPIC_API_KEY`** 를 읽어서 Claude API를 호출합니다.

- Vercel 대시보드에서 설정:
  - Project → Settings → Environment Variables
  - `ANTHROPIC_API_KEY` 추가 (Production/Preview/Development 필요 범위 선택)

또는 CLI로 설정(대화형 입력):

```bash
npx vercel env add ANTHROPIC_API_KEY production
```

### 3) 환경변수 반영 배포
환경변수 추가/수정 후에는 다시 배포하면 됩니다.

```bash
npx vercel deploy --prod
```

## 📖 사용자별 가이드

### 🍎 macOS 사용자
1. `Preflight 실행.command` 파일 더블클릭
   - 또는: `chmod +x Preflight\ 실행.command && ./Preflight\ 실행.command`

### 🪟 Windows 사용자
1. `Preflight_실행.bat` 파일 더블클릭
2. 또는: 터미널에서 `Preflight_실행.bat` 실행

### 🐧 Linux 사용자
```bash
./preflight-run.sh
```

---

## 🔐 필수 요구사항

### 환경 설정
- **Node.js 14+** 필요
- **Anthropic API 키** 필수 ([여기서 발급](https://console.anthropic.com/account/keys))

### 파일 요구사항
- `.env.local` 파일에 API 키 저장 (예시: `.env.local.example`)
- `.gitignore`에 `.env.local` 포함 ✅

---

## 📋 공유 방법

### 방법 1: GitHub (권장)
```bash
# 저장소 주소만 전달
https://github.com/[사용자명]/Preflight_public
```

### 방법 2: ZIP 파일
```bash
# node_modules와 .git 제외하고 압축
zip -r Preflight.zip . -x "node_modules/*" ".git/*" ".*"
```

### 방법 3: 직접 폴더 전달
- 전체 프로젝트 폴더 공유
- `.env.local` 제외 (개인 API 키)

---

## 🆘 트러블슈팅

| 문제 | 해결 |
|------|------|
| Node.js 없음 | https://nodejs.org/ 에서 LTS 설치 |
| API 키 에러 | `.env.local` 파일 생성 및 키 입력 |
| 포트 3000 사용 중 | `lsof -ti:3000 \| xargs kill -9` |
| npm install 실패 | `npm cache clean --force` 후 재실행 |

---

##  최종 확인사항

- [ ] `.env.local` 파일이 `.gitignore`에 포함되어 있나요?
- [ ] 모든 스크립트 파일 권한이 설정되었나요?
- [ ] `package.json`이 최신인가요?
- [ ] README와 INSTALL.md가 명확한가요?

---

**준비 완료! 📦 이제 누구나 간단히 설치해서 쓸 수 있습니다.**
