# Todo → Google Calendar 기능 아키텍처

## 목적

Notion DB에서 Status가 `"할 일"` 또는 `"진행 중"`인 항목을 수집하여 날짜가 오늘과 일치하면 Google Calendar에 업서트한다.
날짜 속성이 비어 있으면 제외한다.
날짜에 `end`가 있으면 시간 지정 이벤트로, `end`가 없으면 종일 이벤트로 등록한다.

---

## 실행 흐름

```
src/todo/index.ts
  └─ fetchTodayTodos()       # Notion DB 조회 → 오늘이 [start, end] 범위에 속하는 항목 수집
  └─ upsertTodoEvents()      # 항목별 Google Calendar 업서트
       ├─ end 있음  → upsertTimedCalendarEvent()
       └─ end 없음  → upsertAllDayCalendarEvent()
```

---

## 파일별 역할

### `src/todo/index.ts`
진입점. `fetchTodayTodos()`로 항목을 수집하고, 없으면 종료, 있으면 `upsertTodoEvents()` 호출.

### `src/todo/run.ts`
- `fetchTodayTodos()`: Notion DB를 조회해 Status가 `"할 일"` 또는 `"진행 중"`이고 날짜가 오늘인 항목만 반환
- 날짜 속성이 비어 있는 페이지는 반환 대상에서 제외
- `upsertTodoEvents()`: 각 항목을 순회하며 `calendar.ts`의 upsert 함수 호출

### `src/todo/notionClient.ts`
- `@notionhq/client`로 Notion API 클라이언트 생성
- `queryTodosFromNotion(date: string): Promise<NotionTodoItem[]>` 구현
  - 필터: `(Status == "할 일" OR Status == "진행 중")` AND `date.is_not_empty == true` AND `date.on_or_before(date)` AND `date.on_or_after(date)`
  - `on_or_before`는 `end` 기준, `on_or_after`는 `start` 기준으로 비교 → 오늘이 범위 내 항목만 반환
  - 날짜 속성이 없거나 `start`가 비어 있는 항목은 안전하게 제외
  - 응답에서 `title`, `date.start`, `date.end`, `pageId` 추출

### `src/todo/calendar.ts`
- `upsertTodoEvent(item: NotionTodoItem): Promise<void>`
  - `ETHAN_CALENDAR_ID`를 todo 전용 캘린더 ID로 사용
  - `item.endDateTime`이 있으면 `upsertTimedCalendarEvent()` 호출
  - `item.endDateTime`이 없으면 `item.startDateTime`의 날짜 부분(`YYYY-MM-DD`)으로 `upsertAllDayCalendarEvent()` 호출
- 이벤트 summary: Notion 페이지 제목 그대로 사용
- 이벤트 description: (선택) Notion 페이지 URL

### `src/shared/googleCalendar.ts` — 변경 사항
기존 `upsertAllDayCalendarEvent()`에 더해 아래 함수를 추가한다.

```ts
export interface TimedCalendarEventInput {
  calendarId: string;
  eventId: string;
  summary: string;
  startDateTime: string;  // ISO 8601, e.g. "2026-04-22T14:00:00+09:00"
  endDateTime: string;    // ISO 8601, Notion date.end 값 그대로 사용
  description?: string;
  attendeeEmail?: string;
}

export async function upsertTimedCalendarEvent(input: TimedCalendarEventInput): Promise<void>
```

- `start: { dateTime, timeZone: 'Asia/Seoul' }`, `end: { dateTime, timeZone: 'Asia/Seoul' }` 형태로 전달
- patch → 404 시 insert 방식은 기존과 동일

---

## 타입 추가 (`src/types.ts`)

```ts
export interface NotionTodoItem {
  pageId: string;         // Notion 페이지 ID (하이픈 포함 UUID)
  title: string;          // 페이지 제목
  startDateTime: string;  // ISO 8601, Notion date.start
  endDateTime?: string;   // ISO 8601, Notion date.end (없으면 종일 일정)
  pageUrl: string;        // https://notion.so/...
}
```

---

## Notion API 연동

- 패키지: `@notionhq/client`
- 날짜 속성 설정: `include time` 사용을 권장. `end date`가 없어도 동작해야 한다.
- 필터 조건: 오늘 날짜가 범위 `[start, end]` 안에 포함되며, 날짜 속성이 비어 있지 않고, 상태가 `"할 일"` 또는 `"진행 중"`인 항목만 수집
  ```json
  {
    "and": [
      {
        "or": [
          { "property": "Status", "status": { "equals": "할 일" } },
          { "property": "Status", "status": { "equals": "진행 중" } }
        ]
      },
      { "property": "날짜", "date": { "is_not_empty": true } },
      { "property": "날짜", "date": { "on_or_before": "2026-04-22" } },
      { "property": "날짜", "date": { "on_or_after": "2026-04-22" } }
    ]
  }
  ```
  > `on_or_before`는 `end`를, `on_or_after`는 `start`를 기준으로 비교한다. 두 조건을 AND로 묶으면 오늘이 범위 안에 속하는 항목만 반환된다.
- Notion Date 응답 구조 예시:
  ```
  {
    start: "2026-04-22T14:00:00.000+09:00",
    end:   "2026-04-22T16:00:00.000+09:00",
    time_zone: null
  }
  ```
- `end`가 있으면 시간 지정 이벤트로 업서트
- `end`가 없으면 `start` 날짜 기준으로 종일 이벤트로 업서트
- 날짜 속성 전체가 비어 있으면 업서트하지 않음

---

## 이벤트 ID 규칙

| 규칙 | 형식 | 예시 |
|------|------|------|
| `notion` + Notion 페이지 ID (하이픈 제거) | `notion{pageId}` | `notion123e4567e89b12d3a456426614174000` |

> Notion 페이지 ID는 UUID(0–9, a–f)이며, Google Calendar 허용 문자(base32hex: 0–9, a–v)의 부분집합이므로 그대로 사용 가능.

---

## 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `NOTION_API_KEY` | 필수 | Notion Integration 시크릿 토큰 |
| `NOTION_TODO_DATABASE_ID` | 필수 | 대상 Notion DB ID |
| `NOTION_DATE_PROPERTY` | 선택 | 날짜 속성 이름 (기본값: `"날짜"`) |
| `NOTION_STATUS_PROPERTY` | 선택 | Status 속성 이름 (기본값: `"Status"`) |
| `NOTION_TODO_STATUS_VALUES` | 선택 | 업서트 대상 상태 목록. 콤마로 구분 (기본값: `"할 일,진행 중"`) |
| `ETHAN_CALENDAR_ID` | 필수 | todo 전용 Google Calendar ID |
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | 공통 | 서비스 계정 키 JSON 문자열 |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | 로컬용 | 서비스 계정 키 파일 경로 |
| `ATTENDEE_EMAIL` | 선택 | 이벤트 초대 이메일 |

---

## GitHub Actions

- 워크플로 파일: `.github/workflows/daily-todo.yml`
- 실행 시각: 매일 **00:00 KST** (전일 15:00 UTC) — 자정에 당일 할 일 전체 동기화
- 트리거: `schedule` + `workflow_dispatch`

---

## 구현 순서

1. `@notionhq/client` 패키지 설치
2. `src/types.ts`에 `NotionTodoItem` 타입 추가
3. `src/shared/googleCalendar.ts`에 `upsertTimedCalendarEvent()` 추가
4. `src/todo/notionClient.ts` 구현 (Notion DB 조회)
5. `src/todo/calendar.ts` 구현 (이벤트 upsert 분기)
6. `src/todo/run.ts` 구현 (오케스트레이터)
7. `src/todo/index.ts` 구현 (진입점)
8. `package.json`에 `start:todo` 스크립트 추가
9. `.env.example`에 신규 환경변수 추가
10. `.github/workflows/daily-todo.yml` 추가
11. `docs/architecture/overview.md` 업데이트
