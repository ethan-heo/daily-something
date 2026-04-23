# 아키텍처 개요

## 목적

매일 자동으로 정보를 수집하여 Google Calendar에 종일 이벤트로 등록하는 Node.js 배치 작업 모음.

현재 제공하는 기능:

| 기능 | 설명 | 스크립트 |
|------|------|----------|
| `vocab` | 네이버 오늘의 영단어/일본어 → Claude API로 예문 생성 → 캘린더 등록 | `npm run start:vocab` |
| `tech-news` | 요즘IT / Smashing Magazine / JavaScript Weekly / Frontend Weekly / Node Weekly / CSS Weekly 당일 게시물 수집 → 캘린더 등록 | `npm run start:tech-news` |
| `news` | 네이버 뉴스 RSS 오늘자 기사 수집 → 캘린더 등록 | `npm run start:news` |
| `todo` | Notion DB에서 Status="할 일"/"진행 중" & 오늘 날짜 항목 수집 → `end`가 있으면 시간 지정, 없으면 종일 이벤트로 캘린더 업서트 | `npm run start:todo` |

---

## 프로젝트 구조

```
src/
├── types.ts                  # 공유 타입 (NewsItem, WordEntry 등)
├── shared/                   # 기능 간 공통 유틸
│   ├── date.ts               # 서울 기준 날짜 계산
│   └── googleCalendar.ts     # Google Calendar 종일 이벤트 upsert
├── vocab/                    # 오늘의 단어 기능
│   ├── index.ts              # 진입점
│   ├── run.ts                # 오케스트레이터
│   ├── calendar.ts           # vocab 설명 생성 + 공통 캘린더 업로드 호출
│   ├── scraper/
│   │   ├── naverWords.ts     # 네이버 오늘의 단어 공통 스크래핑
│   │   ├── english.ts        # 네이버 영단어
│   │   └── japanese.ts       # 네이버 일본어 단어
│   └── formatter/
│       ├── index.ts          # Claude API 호출 및 파싱
│       └── prompt.ts         # 언어별 프롬프트 정의
├── techNews/                 # 당일 기술 뉴스 수집 기능
│   ├── index.ts              # 진입점
│   ├── run.ts                # 오케스트레이터
│   ├── calendar.ts           # 기술 뉴스 설명 생성 + 공통 캘린더 업로드 호출
│   └── scraper/
│       ├── smashingMagazine.ts
│       ├── yozm.ts
│       ├── javascriptWeekly.ts
│       ├── frontendWeekly.ts
│       ├── nodeWeekly.ts
│       └── cssWeekly.ts
├── news/                     # 오늘의 일반 뉴스 수집 기능
│   ├── index.ts              # 진입점
│   ├── run.ts                # 오케스트레이터
│   ├── calendar.ts           # news 설명 생성 + 공통 캘린더 업로드 호출
│   └── scraper/
│       ├── index.ts          # RSS 카테고리 레지스트리
│       └── naverNews.ts      # 네이버 뉴스 RSS 공통 파서
└── todo/                     # Notion 할 일 → 캘린더 동기화 기능
    ├── index.ts              # 진입점
    ├── run.ts                # 오케스트레이터
    ├── notionClient.ts       # Notion API 조회
    └── calendar.ts           # 종일/시간 이벤트 분기 + 공통 캘린더 업로드 호출
```

각 기능(`vocab`, `tech-news`, `news`, `todo`)은 독립적인 진입점을 가진다.

---

## 공통 실행 흐름

```
index.ts  →  run.ts  →  각 기능 디렉토리의 scraper/*.ts (데이터 수집)
                     →  shared/date.ts           (서울 기준 날짜 계산)
                     →  calendar.ts              (기능별 description 구성)
                     →  shared/googleCalendar.ts (Google Calendar 업로드)
```

1. `index.ts`: 진입점. 전체 흐름 조율 및 에러 처리
2. `run.ts`: Playwright 브라우저 생성, 스크래퍼 실행, 결과 가공
3. `scraper/*.ts`: 페이지별 스크래핑 로직
4. `calendar.ts`: 기능별 summary/description 생성
5. `shared/googleCalendar.ts`: Google Calendar API로 종일 이벤트 upsert

> `news`는 Playwright 없이 RSS fetch 기반으로 데이터를 구성한다.

---

## Google Calendar 이벤트 구조

| 기능 | 이벤트 ID 형식 | 예시 |
|------|---------------|------|
| vocab | `vocab{YYYYMMDD}` | `vocab20260417` |
| tech-news | `mag{YYYYMMDD}` | `mag20260417` |
| news | `link{YYYYMMDD}` | `link20260417` |
| todo | `notion{pageId}` (하이픈 제거) | `notion123e4567e89b12d3a456426614174000` |

> Google Calendar 이벤트 ID는 base32hex 문자(`0-9`, `a-v`)만 허용한다.

이벤트는 `src/shared/googleCalendar.ts`에서 patch → 404 시 insert 방식으로 upsert 처리되어 중복 등록을 방지한다.

---

## GitHub Actions

GitHub Actions 워크플로는 기능별로 분리한다.

- `daily-vocab.yml`: vocab 전용
- `daily-tech-news.yml`: tech news 전용
- `daily-news.yml`: news 전용
- `daily-todo.yml`: todo 전용
- vocab 실행 시각: 매일 **05:30 KST** (전일 20:30 UTC)
- tech-news 실행 시각: 매일 **09:10 KST** (00:10 UTC), **18:00 KST** (09:00 UTC), **23:00 KST** (14:00 UTC)
- news 실행 시각: 매일 **09:00 KST** (00:00 UTC)
- todo 실행 시각: 매일 **06:00 KST** (전일 21:00 UTC)
- 트리거: 각 워크플로별 `schedule` + `workflow_dispatch`

---

## 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | vocab/tech-news/news 공통 | 서비스 계정 키 JSON 문자열 (GitHub Actions용) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | 로컬 개발용 | 서비스 계정 키 파일 경로 |
| `CALENDAR_ID` | vocab/news 공통 | Google Calendar ID |
| `DAILY_NEWS_CALENDAR_ID` | news 선택 | news 전용 캘린더 ID. 없으면 `NEWS_CALENDAR_ID`, `CALENDAR_ID` 순서로 사용 |
| `NEWS_CALENDAR_ID` | news 선택 | news 전용 캘린더 ID. 없으면 `CALENDAR_ID` 사용 |
| `ATTENDEE_EMAIL` | 선택 | 이벤트 초대 이메일 |
| `ANTHROPIC_API_KEY` | vocab 전용 | Claude API 키 |
| `ANTHROPIC_MODEL` | vocab 선택 | 사용할 Claude 모델 (기본값: `claude-3-5-sonnet-latest`) |
| `NOTION_API_KEY` | todo 전용 | Notion Integration 시크릿 토큰 |
| `NOTION_TODO_DATABASE_ID` | todo 전용 | 대상 Notion DB ID |
| `NOTION_TODO_STATUS_VALUES` | todo 선택 | 업서트 대상 Status 목록. 기본값: `"할 일,진행 중"` |
| `ETHAN_CALENDAR_ID` | tech-news/todo 전용 | tech-news, todo 전용 Google Calendar ID |

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
npm run start:tech-news
npm run start:news
```
