# 아키텍처 개요

## 목적

매일 자동으로 정보를 수집하여 Google Calendar에 종일 이벤트로 등록하는 Node.js 배치 작업 모음.

현재 제공하는 기능:

| 기능 | 설명 | 스크립트 |
|------|------|----------|
| `vocab` | 네이버 오늘의 영단어/일본어 → Claude API로 예문 생성 → 캘린더 등록 | `npm run start:vocab` |
| `news` | 요즘IT / Smashing Magazine / JavaScript Weekly 오늘 게시물 수집 → 캘린더 등록 | `npm run start:news` |

---

## 프로젝트 구조

```
src/
├── types.ts                  # 공유 타입 (NewsItem, WordEntry 등)
├── shared/                   # 기능 간 공통 유틸
│   ├── date.ts               # 서울 기준 날짜 계산
│   └── googleCalendar.ts     # Google Calendar 종일 이벤트 upsert
├── scraper/                  # 스크래퍼 (기능 간 공유)
│   ├── naverWords.ts         # 네이버 오늘의 단어 공통 스크래핑
│   ├── english.ts            # 네이버 영단어
│   ├── japanese.ts           # 네이버 일본어 단어
│   ├── smashingMagazine.ts   # Smashing Magazine 아티클
│   └── yozm.ts               # 요즘IT 아티클
├── vocab/                    # 오늘의 단어 기능
│   ├── index.ts              # 진입점
│   ├── run.ts                # 오케스트레이터
│   ├── calendar.ts           # vocab 설명 생성 + 공통 캘린더 업로드 호출
│   └── formatter/
│       ├── index.ts          # Claude API 호출 및 파싱
│       └── prompt.ts         # 언어별 프롬프트 정의
└── news/                     # 오늘의 뉴스 기능
    ├── index.ts              # 진입점
    ├── run.ts                # 오케스트레이터
    └── calendar.ts           # news 설명 생성 + 공통 캘린더 업로드 호출
```

각 기능(`vocab`, `news`)은 독립적인 진입점을 가지며 동일한 구조를 따른다.

---

## 공통 실행 흐름

```
index.ts  →  run.ts  →  scraper/*.ts             (데이터 수집)
                     →  shared/date.ts           (서울 기준 날짜 계산)
                     →  calendar.ts              (기능별 description 구성)
                     →  shared/googleCalendar.ts (Google Calendar 업로드)
```

1. `index.ts`: 진입점. 전체 흐름 조율 및 에러 처리
2. `run.ts`: Playwright 브라우저 생성, 스크래퍼 실행, 결과 가공
3. `scraper/*.ts`: 페이지별 스크래핑 로직
4. `calendar.ts`: 기능별 summary/description 생성
5. `shared/googleCalendar.ts`: Google Calendar API로 종일 이벤트 upsert

---

## Google Calendar 이벤트 구조

| 기능 | 이벤트 ID 형식 | 예시 |
|------|---------------|------|
| vocab | `vocab{YYYYMMDD}` | `vocab20260417` |
| news | `mag{YYYYMMDD}` | `mag20260417` |

> Google Calendar 이벤트 ID는 base32hex 문자(`0-9`, `a-v`)만 허용한다.

이벤트는 `src/shared/googleCalendar.ts`에서 patch → 404 시 insert 방식으로 upsert 처리되어 중복 등록을 방지한다.

---

## GitHub Actions

`.github/workflows/daily.yml` 하나로 vocab과 news를 순차 실행한다.

- 실행 시각: 매일 **05:30 KST** (20:30 UTC)
- 트리거: 스케줄 + `workflow_dispatch` (수동 실행 가능)
- 실행 순서: vocab → news

---

## 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | vocab/news 공통 | 서비스 계정 키 JSON 문자열 (GitHub Actions용) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | 로컬 개발용 | 서비스 계정 키 파일 경로 |
| `CALENDAR_ID` | vocab/news 공통 | Google Calendar ID |
| `ATTENDEE_EMAIL` | 선택 | 이벤트 초대 이메일 |
| `ANTHROPIC_API_KEY` | vocab 전용 | Claude API 키 |
| `ANTHROPIC_MODEL` | vocab 선택 | 사용할 Claude 모델 (기본값: `claude-3-5-sonnet-latest`) |

---

## 로컬 실행

```bash
# 의존성 설치
npm install
npx playwright install chromium

# .env 파일 생성 (.env.example 참고)
cp .env.example .env

# 실행
npm run start:vocab
npm run start:news
```
