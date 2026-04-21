# News 기능 아키텍처

## 목적

네이버 뉴스 RSS를 카테고리별로 수집해 오늘자 기사만 Google Calendar에 종일 이벤트로 등록한다.

---

## 실행 흐름

```
src/news/index.ts
  └─ collectNewsLinks()         # RSS 병렬 수집 + 오늘자 필터 + 중복 제거
  └─ saveNewsLinks()            # Google Calendar upsert
```

---

## 파일별 역할

### `src/news/index.ts`
진입점. 당일 뉴스가 없으면 캘린더 업로드 없이 종료한다.

### `src/news/run.ts`
- `collectNewsLinks()`: 서울 기준 오늘 날짜를 계산하고 네이버 RSS를 카테고리별로 병렬 수집
- URL 기준으로 중복 제거
- `saveNewsLinks()`: calendar.ts의 `upsertNewsLinksEvent()` 호출

### `src/news/scraper/index.ts`
- 네이버 뉴스 RSS 카테고리 목록 관리
- 새 카테고리 추가 시 이 파일만 수정하면 됨

### `src/news/scraper/naverNews.ts`
- RSS XML을 `fetch()`로 가져와 `<item>` 단위로 파싱
- `title`, `link`, `pubDate`를 추출하고 서울 날짜(`YYYY-MM-DD`)로 정규화
- 오늘 날짜와 일치하는 기사만 `NewsItem[]`으로 반환

### `src/news/calendar.ts`
- 이벤트 ID: `link{YYYYMMDD}`
- 역할: news용 description 문자열을 만들고 `src/shared/googleCalendar.ts`의 `upsertAllDayCalendarEvent()`를 호출
- 이벤트 구조:
  - summary: `📰 오늘의 뉴스 (YYYY-MM-DD)`
- description: 카테고리별 뉴스 목록 (소스·제목·URL)
- 카테고리 헤더 포맷:
  ```
  ## IT
  ```
- 각 아이템 포맷:
  ```
  [소스명] 기사 제목
  https://...
  ```

### `src/shared/date.ts`
서울 기준 오늘/전날/다음 날짜를 `YYYY-MM-DD` 형식으로 계산하는 공통 유틸. news는 `getTodayInSeoul()`를 사용한다.

### `src/shared/googleCalendar.ts`
Google Calendar 종일 이벤트 upsert 공통 모듈.
- 서비스 계정 인증 생성
- `start.date`, `end.date` 계산
- patch 후 404면 insert로 재시도

---

## 타입

`src/types.ts`의 `NewsItem` 타입을 재사용한다.

---

## 환경변수

| 변수 | 설명 |
|------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` or `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Google 서비스 계정 인증 |
| `DAILY_NEWS_CALENDAR_ID` | news 전용 캘린더 ID. 없으면 `NEWS_CALENDAR_ID`, `CALENDAR_ID` 순서로 사용 |
| `NEWS_CALENDAR_ID` | news 전용 캘린더 ID. 없으면 `CALENDAR_ID` 사용 |
| `CALENDAR_ID` | 기본 Google Calendar ID |
| `ATTENDEE_EMAIL` | (선택) 이벤트 초대할 이메일 |
