# Preflight 새 버전 Vercel 배포 가이드

> 기존 Preflight 배포는 그대로 두고, 새 버전을 로컬이 아닌 공유 URL로 하나 더 올리기 위한 절차입니다.
> PM이 PRD(위키 URL·PDF)를 대량으로 넣어 테스트하는 것이 목적입니다.
> 작성 2026-08-14. 실행자는 Vercel·GitHub 계정 접근 권한이 필요합니다.
> 배경·결정 근거는 `Preflight-변경-기록.md` 37번 참조.

---

## 0. 먼저 정리해 둘 사실 두 가지

### ① 요금제 — 무료(Hobby) 플랜으로도 됩니다

기존 배포가 이미 무료 플랜에서 돌고 있었습니다. `maxDuration = 300`이 코드에 있지만, **Vercel은 플랜 상한(무료 60초)을 넘는 값을 빌드에서 막지 않고 상한으로 잘라서 적용**합니다. 따라서 무료로도 배포됩니다.

문제는 **함수 실행이 60초를 넘기면 그 요청만 실패**한다는 것입니다. 경로별로 정리하면:

| 경로 | 60초 안에 끝나나 | 조치 |
| :--- | :--- | :--- |
| 채점(`/api/analyze`) | 대체로 끝남. 기존에도 무료로 돌던 경로 | 그대로 사용 |
| 목업 Lo-Fi | 화면 수 상한(6개)·경량 설정으로 대체로 끝남 | 그대로 사용 |
| **목업 Hi-Fi** | 스펙 추출→화면 병렬 생성→조립이 직렬로 이어져 길다. 2026-06 대비 무거워짐(37번) | **이번 배포에서 생성 버튼을 비활성화함** |

Hi-Fi가 6월보다 무거워진 이유: 화면 생성 모델이 Haiku에서 메인 모델로 되돌아갔고, max_tokens가 커졌으며, hi-fi가 MCDS 룰북 기반으로 바뀌었습니다(변경 기록 37번).

- **무료로 Hi-Fi까지 켜고 싶다면**: 환경변수 `ANTHROPIC_SCREEN_MODEL=claude-haiku-4-5-20251001`을 넣어 화면 생성을 다시 가볍게 하고, `ResultScreen.tsx`의 `SHOW_HIFI_MOCKUP`을 `true`로 바꿉니다.
- **안정적으로 무겁게 돌리고 싶다면**: Pro 플랜(함수 상한 300초). 필수는 아니고 선택지입니다.

### ② GitHub 저장소 소유권 — 옮길 필요 없습니다

- 원격 저장소는 `github.com/seonkyungclare/Preflight_public`입니다(본인 소유가 아니어도 됩니다).
- Vercel은 **연결된 GitHub 계정이 그 저장소에 접근할 수 있으면** Import할 수 있습니다. 소유권 이전은 되돌리기 번거롭고 상대 동의가 필요하므로 하지 않습니다.
- 배포 주체별 방법:
  - **seonkyung/팀이 계속 관리**: 그쪽 Vercel 계정에서 새 프로젝트를 추가하고, 본인은 URL만 공유받습니다. (가장 단순)
  - **본인이 직접 관리**: seonkyung이 본인을 저장소 Collaborator로 추가 → 본인 GitHub로 Vercel 로그인 → Import. 저장소는 그대로 둡니다.
  - (비권장) Fork: 배포는 되지만 원본과 매번 동기화가 필요합니다.

---

## 1. 배포 절차 — 기존 것 두고 "새 프로젝트로 하나 더"

기존 배포와 별개의 URL을 얻으려면, **같은 저장소를 가리키는 Vercel 프로젝트를 하나 더** 만듭니다.

1. [vercel.com](https://vercel.com) 로그인 → GitHub 연결.
2. **Add New… → Project** → `Preflight_public` 저장소를 **다시** Import(기존과 다른 새 프로젝트명, 예: `preflight-pm-test`).
3. Framework Preset이 **Next.js**로 자동 감지되는지 확인.
4. **Production Branch를 기존 프로젝트와 다르게 지정**합니다(Settings → Git → Production Branch). 같은 브랜치를 보면 두 프로젝트가 같은 커밋을 배포해 사실상 복제가 됩니다.
   - 예: 기존이 `main`을 본다면, 새 프로젝트용 브랜치(`pm-test` 등)를 만들어 그 브랜치를 Production으로 지정.
5. **Environment Variables** 등록(아래 2번).
6. **Deploy**. 완료 후 `https://<새프로젝트명>.vercel.app` 형태의 주소가 나옵니다. 이게 공유용 URL입니다.
7. 배포 후 **3번(접근 제한)**과 **4번(Atlassian 콜백)**을 처리합니다.

---

## 2. 환경변수 — Vercel Project → Settings → Environment Variables

로컬 `.env.local` 값을 옮깁니다. **`.env.local` 파일 자체는 커밋하지 않습니다**(이미 .gitignore로 막혀 있음).

| 변수 | 값 | 비고 |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | 회사 Anthropic 키 | **PRD 본문이 이 키로 Anthropic에 전송됨** — 보안 확인 별도 필요(아래 5번) |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | 채점 모델. 코드 기본값을 이 값이 이김 |
| `ANTHROPIC_THINKING` | `disabled` | 점수 흔들림 억제. 지우면 켜져 편차가 커짐 |
| `ATLASSIAN_CLIENT_ID` | OAuth 앱 Client ID | Confluence URL 탭용(PDF 탭은 없어도 동작) |
| `ATLASSIAN_CLIENT_SECRET` | OAuth 앱 Secret | 위와 세트 |
| `ATLASSIAN_SESSION_SECRET` | 임의 문자열 | 아래 명령으로 생성. 로컬과 같을 필요 없음 |
| `ANTHROPIC_SCREEN_MODEL` (선택) | `claude-haiku-4-5-20251001` | 목업 Hi-Fi를 켤 때만. 화면 생성을 경량 모델로 고정 |

세션 시크릿 생성:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> 값은 **Production** 환경에 넣습니다.

---

## 3. 접근 제한 — 반드시 켜기

배포 URL을 아는 사람은 누구나 접속해 회사 Anthropic 키로 채점을 돌릴 수 있습니다. 비용·오남용 노출면입니다.

- Vercel Project → **Settings → Deployment Protection** → **Vercel Authentication**(팀 멤버만) 또는 **Password Protection**(공유 비밀번호) 중 하나를 켭니다.
- PM에게는 **URL + 비밀번호**를 함께 전달하는 방식이 간단합니다.
- Password Protection은 플랜에 따라 유료 기능일 수 있습니다. 무료에서 안 되면 Vercel Authentication(팀 멤버 초대)으로 대체합니다.

---

## 4. Atlassian(Confluence URL 탭) 콜백 등록

PDF 업로드 탭은 이 설정 없이도 됩니다. **Confluence URL로 PRD를 불러오는 기능만** 필요합니다.

1. https://developer.atlassian.com/console/myapps/ → 쓰던 OAuth 앱 열기.
2. **Authorization → OAuth 2.0 (3LO) → Callback URL**에 **배포 도메인 콜백을 한 줄 추가**:
   ```
   https://<새프로젝트명>.vercel.app/api/auth/atlassian/callback
   ```
   - 기존 로컬용(`http://localhost:3000/...`)은 지우지 말고 그대로 두고 추가만 합니다(최대 30개).
   - **한 글자도 달라선 안 됩니다.** 배포 후 실제 접속 주소를 그대로 복사해 붙입니다.
3. 콜백은 코드가 접속 주소에서 자동 조립합니다(`buildCallbackUri`). 이번 준비에서 이 함수가 **Vercel 프록시 뒤에서도 공개 도메인·https로 정확히 조립되도록 `x-forwarded-*` 헤더를 우선하게 보강**했습니다.

### Preview 배포 URL은 위키 로그인이 안 됩니다
- Vercel은 커밋마다 고유한 **Preview URL**을 새로 만듭니다.
- 콜백은 접속 도메인에서 조립되는데 매번 바뀌는 Preview URL을 다 등록할 수 없습니다.
- → **PM에게는 고정 Production 도메인 하나만 공유**하고, 위키 테스트도 그 주소에서만 하도록 안내합니다. (PDF 탭은 Preview에서도 됩니다.)

---

## 5. 데이터 흐름·보안 확인 (별도 트랙)

코드로 확인한 사실:

- PDF는 텍스트만 추출해 메모리에서 처리하고 **서버에 저장하지 않습니다.**
- Confluence는 **사용자 본인 OAuth 토큰**으로 본인 접근권한 페이지만 읽습니다.
- 채점 시 **추출한 PRD 본문 전체가 Anthropic API로 전송**됩니다. DB·파일·외부 로깅은 없습니다.

→ 사내 PRD가 외부 LLM API로 나가는 것이므로, **보안/정보보호팀에 "사내 PRD를 Anthropic API로 보내도 되는지" 정책 확인**을 권장합니다. 이건 코드로 막을 수 없는 조직 정책 문제입니다.

---

## 6. 배포 후 동작 확인

배포 URL에서:

1. **모델 확인** — `https://<배포주소>/api/analyze?probe=model` → `requested`와 `actual`이 `claude-sonnet-5`로 일치하는지(불일치 사고 이력, 변경 기록 21번).
2. **PDF 채점 1건** — 실제 PRD PDF 하나를 넣어 끝까지 도는지(무료면 60초 안에 끝나는지).
3. (Confluence 쓰면) **위키 URL 1건** — 계정 연결 → 페이지 로드 → 채점.
4. **목업 화면** — Hi-Fi 카드가 "준비 중"으로 비활성인지, Lo-Fi는 정상 동작하는지.

---

## 요약 체크리스트

- [ ] 무료 플랜으로 진행(Hi-Fi 비활성 상태). 무겁게 켤 거면 Pro + `ANTHROPIC_SCREEN_MODEL`
- [ ] 저장소 접근 가능한 계정으로 Vercel 연결(소유권 이전 불필요)
- [ ] **새 프로젝트로 하나 더** 만들고, 기존과 다른 Production 브랜치 지정
- [ ] 환경변수 6(+1)개 Production 등록
- [ ] Deployment Protection(비밀번호/멤버) 켜기
- [ ] Atlassian 콜백에 배포 도메인 한 줄 추가(로컬용 유지)
- [ ] `/api/analyze?probe=model` 모델 확인 + PDF 채점 1건 통과 + Hi-Fi 비활성 확인
- [ ] (별도 트랙) 보안팀에 "사내 PRD → Anthropic API 전송" 정책 확인
