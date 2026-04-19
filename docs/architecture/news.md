# News 기능 아키텍처

## 목적

사용자가 직접 관리하는 뉴스 링크 목록을 카테고리와 함께 매일 Google Calendar에 종일 이벤트로 등록한다.

---

## 실행 흐름

```
src/news/index.ts
  └─ collectNewsLinks()         # 링크 파일 로드 + 검증 + 중복 제거
  └─ saveNewsLinks()            # Google Calendar upsert
```

---

## 파일별 역할

### `src/news/index.ts`
진입점. 링크가 없으면 캘린더 업로드 없이 종료한다.

### `src/news/run.ts`
- `collectNewsLinks()`: 서울 기준 오늘 날짜를 계산하고 `data/news-links.json`을 읽어 링크 목록을 수집
- `saveNewsLinks()`: calendar.ts의 `upsertNewsLinksEvent()` 호출

### `src/news/links.ts`
- `data/news-links.json` 파일을 읽어 JSON 배열을 파싱
- 각 항목의 `title`, `url`, `source`, `category`를 검증
- 잘못된 URL이 있으면 즉시 에러
- URL 기준으로 중복 제거
- `source`가 비어 있으면 기본값 `직접 제공` 사용
- `category`가 비어 있으면 기본값 `기타` 사용

### `src/news/calendar.ts`
- 이벤트 ID: `link{YYYYMMDD}`
- 역할: news용 description 문자열을 만들고 `src/shared/googleCalendar.ts`의 `upsertAllDayCalendarEvent()`를 호출
- 이벤트 구조:
  - summary: `🔗 나의 뉴스 링크 (YYYY-MM-DD)`
  - description: 카테고리별 링크 목록 (소스·제목·URL)
- 카테고리 헤더 포맷:
  ```
  ## IT
  ```
- 각 아이템 포맷:
  ```
  [소스명] 링크 제목
  https://...
  ```

### `data/news-links.json`
- 사용자가 직접 관리하는 링크 목록 데이터 파일
- 형식:
  ```json
  [
    {
      "title": "링크 제목",
      "url": "https://example.com/article",
      "source": "직접 제공",
      "category": "IT"
    }
  ]
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

```ts
// src/types.ts
interface NewsLink {
  title: string;
  url: string;
  source?: string;
  category?: string;
}
```

---

## 환경변수

| 변수 | 설명 |
|------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` or `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Google 서비스 계정 인증 |
| `NEWS_CALENDAR_ID` | news 전용 캘린더 ID. 없으면 `CALENDAR_ID` 사용 |
| `CALENDAR_ID` | 기본 Google Calendar ID |
| `ATTENDEE_EMAIL` | (선택) 이벤트 초대할 이메일 |

---

## 링크 수정 방법

1. `data/news-links.json`에 항목 추가 또는 수정
2. `title`, `url`은 필수
3. `source`는 선택이며 비우면 `직접 제공`으로 저장
4. `category`는 선택이며 비우면 `기타`로 저장
5. 같은 URL이 여러 번 있으면 1건만 캘린더에 반영
