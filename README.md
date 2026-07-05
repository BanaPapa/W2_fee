# W2 Fee — Easy Commission

분양대행 수수료·비용 산출 대시보드 (React + Vite + Convex).

## 다른 PC에서 이어서 작업하기

입력 데이터는 이 저장소가 아니라 **Convex 클라우드**(team: `polateria`, project: `fee`)에 저장됩니다.
같은 Convex 계정으로 로그인하면 어느 PC에서든 동일한 데이터가 보입니다.

### 1. 클론 및 의존성 설치

```bash
git clone https://github.com/BanaPapa/W2_fee.git
cd W2_fee/app
npm install
```

### 2. Convex 연결 (최초 1회)

```bash
npx convex dev
```

- 브라우저가 열리면 **기존과 같은 Convex 계정**으로 로그인
- team `polateria` → project `fee` 선택 (새 프로젝트를 만들지 말 것 — 새로 만들면 빈 데이터로 시작됨)
- 성공하면 `app/.env.local`이 자동 생성되고 기존 dev 배포(`adept-leopard-563`)에 연결됨

`npx convex dev`는 스키마/함수 변경을 실시간 동기화하므로 개발 중에는 켜 둔다.
(함수 수정 없이 화면만 볼 거라면, 기존 PC의 `app/.env.local` 파일을 복사해 넣는 것만으로도 동작)

### 3. 개발 서버 실행

```bash
npm run dev   # http://localhost:5173
```

## 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입체크 + 프로덕션 빌드 |
| `npm run lint` | oxlint |
| `npx convex dev --once` | Convex 스키마/함수 1회 배포 |

## 구조 메모

- `app/src/store/` — zustand 스토어. 입력 후 400ms 디바운스로 Convex에 자동 저장
- `app/src/store/feeStore.ts` — 목표분양률·조직수수료·MGM. D+n 기간은 분양일정(정당계약 첫날~완료일)에서 자동 생성
- `app/convex/` — 서버 스키마·함수 (`project` / `labor` / `meal` / `ledgers` / `fee` 테이블)
- 카테고리 카드 추가 시: `app/src/data/categories.ts` + `DetailPanel.tsx`의 MAP + `theme.css`의 `[data-c=...]`
