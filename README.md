# W2 Fee — Easy Commission

분양대행 수수료·비용 산출 대시보드 (React + Vite + **Firebase Realtime Database**).

> Convex → Firebase RTDB로 전환됨 (2026-07). 추후 다른 앱(동일하게 Firebase RTDB 사용 예정)과
> 병합해 메인 페이지에서 탭별로 각 앱을 연동하는 구조를 계획 중.

## 다른 PC에서 이어서 작업하기

입력 데이터는 이 저장소가 아니라 **Firebase RTDB**(project: `w2-fee`)에 저장됩니다.
로그인 계정에 역할(admin/editor/viewer)이 있어야 데이터가 보입니다.

### 1. 클론 및 의존성 설치

```bash
git clone https://github.com/BanaPapa/W2_fee.git
cd W2_fee/app
npm install
```

### 2. Firebase 설정 (최초 1회)

`app/.env.local` 파일을 만들고 Firebase 웹 앱 설정값을 넣는다
(Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정, 또는 기존 PC의 `.env.local` 복사):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=w2-fee.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://w2-fee-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=w2-fee
VITE_FIREBASE_STORAGE_BUCKET=w2-fee.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. 개발 서버 실행

```bash
npm run dev:web   # http://localhost:5173
```

별도의 백엔드 프로세스는 필요 없다 (Firebase는 클라이언트 SDK로 직접 접속).

## 로그인 · 권한

- 이메일/비밀번호 + Google 로그인 (Firebase Auth)
- 3단계 역할: **admin**(전체 + 사용자 관리) / **editor**(편집) / **viewer**(읽기 전용)
- 역할이 없는 신규 가입자는 "승인 대기" — admin이 설정 → 사용자 관리에서 역할 부여
- 최초 로그인 사용자는 자동으로 admin (부트스트랩)
- 서버측 강제는 `app/database.rules.json` (콘솔 → Realtime Database → 규칙에 게시)

## 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `npm run dev:web` | 개발 서버 (Vite) |
| `npm run build` | 타입체크 + 프로덕션 빌드 |
| `npm run lint` | oxlint |

## 구조 메모

- `app/src/lib/firebaseClient.ts` — RTDB 어댑터 (`loadDoc` / `saveDoc` / `subscribeDoc`).
  모듈러 SDK 전용(compat 금지), 버전 고정. RTDB의 `undefined` 거부·빈 배열→null 이슈를 여기서 방어
- `app/src/lib/firebaseAuth.ts` — 로그인/역할 관리, `app/src/store/authStore.ts` — 인증 상태
- `app/src/lib/hydrateData.ts` — 로그인 후 8개 문서를 로드해 스토어 하이드레이트
- `app/src/store/` — zustand 스토어. 입력 후 400ms 디바운스로 RTDB에 자동 저장
- RTDB 트리: `/project` `/labor` `/meal` `/fee` `/customCards` `/ledgers/{ad|operating|misc}` `/roles` `/users`
- 카테고리 카드 추가 시: `app/src/data/categories.ts` + `DetailPanel.tsx`의 MAP + `theme.css`의 `[data-c=...]`
- `app/scripts/export-convex-to-rtdb.mjs` — 과거 Convex 데이터 이전에 썼던 스크립트 (참고용)
