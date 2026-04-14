# Preflight - PRD 검증 시뮬레이터

PRD(Product Requirements Document) 문서를 업로드하면 Claude AI가 Preflight 검증 프로토콜에 따라 점수를 매기고 개선 사항을 제시하는 도구입니다.

## 🌐 Vercel 배포 (웹으로 공유)

- **배포 URL(프로덕션)**: `https://preflight-public.vercel.app`
- **필수 환경변수**: `ANTHROPIC_API_KEY`
  - Vercel Project → Settings → Environment Variables 에서 추가

## 🚀 빠른 시작

### 1. 사전 준비물

#### Node.js 설치 확인
```bash
node --version
npm --version
```

Node.js 미설치 시: https://nodejs.org/ (LTS 버전 다운로드)

#### Anthropic API 키 발급
1. https://console.anthropic.com/account/keys에서 API 키 생성
2. 복사해 놓기

### 2. 프로젝트 설치

```bash
# 프로젝트 폴더로 이동
cd [프로젝트_경로]

# 패키지 설치
npm install
```

### 3. 환경 설정

```bash
# .env.local 파일 생성
cp .env.local.example .env.local

# .env.local 파일을 텍스트 에디터로 열어서 API 키 입력
# ANTHROPIC_API_KEY=sk-ant-... (발급받은 키 붙여넣기)
```

### 4. 실행

#### 방법 1: 자동 실행 (macOS)
```bash
./Preflight\ 실행.command
```
또는 Finder에서 `Preflight 실행.command` 파일 더블클릭

#### 방법 2: 터미널 수동 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000` 접속

## 📋 사용 방법

1. **PRD 문서 선택**: PDF 또는 텍스트 형식의 PRD 문서 업로드
2. **분석 대기**: Claude AI가 검증 프로토콜에 따라 분석
3. **결과 확인**:
   - **점수**: 0-100 (80 이상 Ready)
   - **누락 항목**: 디자이너/개발자별 체크리스트
   - **질문**: PO가 확인해야 할 모호한 항목
   - **개선안**: UX 최적화 제안

## 🛠️ 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **AI**: Claude 3 (Anthropic)
- **Code Preview**: Sandpack

## 📝 문제 해결

### "API 키가 필요합니다" 에러
- `.env.local` 파일이 존재하는지 확인
- `ANTHROPIC_API_KEY` 값이 올바르게 입력되었는지 확인
- 파일 수정 후 브라우저 새로고침

### 포트 3000이 이미 사용 중
```bash
# 기존 프로세스 종료 후 다시 시작
npm run dev
```

### npm install 실패
```bash
# npm 캐시 초기화
npm cache clean --force

# 다시 설치
npm install
```

## 🔧 프로덕션 빌드 (선택사항)

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 모드 실행
npm start
```

---

**문의/버그 신고**: 개발자에게 연락주세요.
