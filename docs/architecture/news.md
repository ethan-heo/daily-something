# News 기능 아키텍처

## 목적

기술 아티클 사이트에서 최신 글 목록을 스크래핑하여 Google Calendar에 종일 이벤트로 등록한다.

---

## 실행 흐름

```
src/news/index.ts
  └─ collectNews()              # 모든 스크래퍼 병렬 실행 + 중복 제거
       └─ scrapeYozm(page)      # 요즘IT 아티클 스크래핑
       └─ scrapeSmashingMagazine(page) # Smashing Magazine 오늘 게시물 스크래핑
  └─ items.length === 0 → 종료  # 수집 결과 없으면 캘린더 업로드 생략
  └─ saveNews()                 # Google Calendar upsert
```

---

## 파일별 역할

### `src/news/index.ts`
진입점. 수집된 아이템이 없으면 캘린더 업로드 없이 종료한다.

### `src/news/run.ts`
- `collectNews()`: Playwright 브라우저를 열고 스크래퍼별 새 페이지를 만든 뒤 `Promise.all`로 병렬 실행. URL 기준으로 중복 제거 후 반환
- `saveNews()`: calendar.ts의 `upsertNewsEvent()` 호출

### `src/news/calendar.ts`
- 이벤트 ID: `mag{YYYYMMDD}` (`news`의 `w`는 base32hex 범위 초과로 사용 불가)
- 이벤트 구조:
  - summary: `📰 오늘의 뉴스 (YYYY-MM-DD)`
  - description: 아티클 목록 (소스·제목·URL)
- 각 아이템 포맷:
  ```
  [소스명] 아티클 제목
  https://...
  ```
- `NEWS_CALENDAR_ID`가 설정되어 있으면 해당 캘린더 사용, 없으면 `CALENDAR_ID` 폴백

### `src/scraper/yozm.ts`
- 대상: `https://yozm.wishket.com/magazine/list/new/`
- 컨테이너 셀렉터: `[data-testid="article-column-item--container"]`
- 제목: 컨테이너 내 `h1~h4` 첫 번째 요소
- URL: 컨테이너 내 첫 번째 `<a>` 태그의 `href` → 절대 URL로 변환

### `src/scraper/smashingMagazine.ts`
- 대상: `https://www.smashingmagazine.com/articles/`
- 컨테이너 셀렉터: `.article--post`
- 게시일: 컨테이너 내부 `time[date]` 우선, 없으면 `time[datetime]` fallback
- 필터: 게시일을 `YYYY-MM-DD`로 정규화한 뒤 오늘 날짜(KST)와 일치하는 항목만 수집
- 제목/URL: 컨테이너 내부 제목 링크(`h1~h4 a`) 기준으로 추출

---

## 타입

```ts
// src/types.ts
interface NewsItem {
  title: string;
  url: string;
  source: string;       // 스크래퍼 소스명 (예: "요즘IT")
  publishedAt?: string;
}
```

---

## 환경변수

| 변수 | 설명 |
|------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` or `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Google 서비스 계정 인증 |
| `CALENDAR_ID` | 기본 Google Calendar ID |
| `NEWS_CALENDAR_ID` | (선택) news 전용 캘린더 ID. 설정 시 `CALENDAR_ID` 대신 사용 |
| `ATTENDEE_EMAIL` | (선택) 이벤트 초대할 이메일 |

---

## 새 스크래퍼 추가 방법

1. `src/scraper/`에 새 파일 생성 (`(page: Page) => Promise<NewsItem[]>` 시그니처)
2. `src/news/run.ts`의 `scrapers` 배열에 추가

```ts
// src/news/run.ts
const scrapers = [scrapeYozm, scrapeNewSource];
```
