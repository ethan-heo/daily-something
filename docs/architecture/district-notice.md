# 지역 공지사항 기능 아키텍처

## 목적

지자체 공지사항 페이지에서 당일(KST) 게시된 공지 목록을 수집하여 Google Calendar에 **카테고리별 별도 종일 이벤트**로 등록한다.
카테고리 하나가 캘린더 카드 하나에 대응하며, 카테고리 안에 여러 소스를 묶을 수 있다.

현재 카테고리 구성:

| 카테고리 | 소스 |
|----------|------|
| 노원 | 노원구 공지사항 |
| 양평 | 강하면 공지사항 · 이장 공문함 · 양평 공지사항 |
| 서울시 | 서울 미디어허브 뉴스 |

---

## 실행 흐름

```
src/districtNotice/index.ts
  └─ runDistrictNotice()
       └─ 각 카테고리를 Promise.all로 병렬 처리
            ├─ 카테고리 내 소스들을 Promise.all로 병렬 스크래핑
            ├─ 결과를 flat()으로 병합
            ├─ items.length === 0 → 해당 카테고리 업서트 생략 (로그만 출력)
            └─ upsertDistrictNoticeEvent()  # 카테고리별 1개 캘린더 이벤트 업서트
```

카테고리 단위로 이벤트를 생성하므로, 양평의 3개 소스는 하나의 캘린더 카드에 묶여 등록된다.

---

## 파일 구조

```
src/districtNotice/
├── index.ts                  # 진입점
├── run.ts                    # 오케스트레이터 (카테고리별 병렬 실행)
├── calendar.ts               # 카테고리별 이벤트 생성 + 캘린더 업서트
└── scraper/
    ├── index.ts              # 카테고리·소스 레지스트리 ← 추가 시 여기만 수정
    ├── nowon.ts              # 노원구 독립 스크래퍼
    ├── yp21.ts               # 양평군 yp21.go.kr 공통 BBS 스크래퍼
    └── seoulMediahub.ts      # 서울시 미디어허브 스크래퍼
```

---

## 파일별 역할

### `src/districtNotice/index.ts`

진입점. `runDistrictNotice()`를 호출하고 에러를 처리한다.

### `src/districtNotice/run.ts`

```ts
export async function runDistrictNotice(): Promise<void> {
  const date = getTodayInSeoul();

  await Promise.all(
    DISTRICT_NOTICE_CATEGORIES.map(async (category) => {
      const results = await Promise.all(category.sources.map((s) => s.scrape(date)));
      const items = results.flat();

      if (items.length === 0) {
        console.log(`No notices for ${category.name} on ${date}, skipping.`);
        return;
      }

      await upsertDistrictNoticeEvent(date, category, items);
      console.log(`Done: ${category.name}, items=${items.length}`);
    }),
  );
}
```

카테고리 내 소스들은 병렬로 실행하고, 결과를 합쳐 카테고리 단위로 캘린더에 업서트한다.

---

### `src/districtNotice/scraper/index.ts`

카테고리·소스 두 단계 레지스트리. 새 소스 추가 시 해당 카테고리의 `sources` 배열에, 새 카테고리 추가 시 `DISTRICT_NOTICE_CATEGORIES`에 항목을 추가한다.

```ts
export interface DistrictNoticeSource {
  name: string;                                         // description 섹션 헤더
  scrape: (targetDate: string) => Promise<NewsItem[]>;
}

export interface DistrictNoticeCategory {
  name: string;        // 이벤트 summary에 사용 (예: "노원", "양평")
  eventKey: string;    // 이벤트 ID prefix — base32hex 문자만 사용
  sources: DistrictNoticeSource[];
}

export const DISTRICT_NOTICE_CATEGORIES: DistrictNoticeCategory[] = [
  {
    name: '노원',
    eventKey: 'noron',
    sources: [
      { name: '노원구', scrape: scrapeNowon },
    ],
  },
  {
    name: '양평',
    eventKey: 'angpeng',
    sources: [
      { name: '강하면 공지사항', scrape: (date) => fetchYp21Bbs({ bbsNo: 206, key: 128, source: '강하면 공지사항', targetDate: date }) },
      { name: '이장 공문함',     scrape: (date) => fetchYp21Bbs({ bbsNo: 207, key: 129, source: '이장 공문함',     targetDate: date }) },
      { name: '양평 공지사항',   scrape: (date) => fetchYp21Bbs({ bbsNo: 1,   key: 130, source: '양평 공지사항',   targetDate: date }) },
    ],
  },
  {
    name: '서울시',
    eventKey: 'seoul',
    sources: [
      { name: '서울 미디어허브', scrape: scrapeSeoulMediahub },
    ],
  },
];
```

---

### `src/districtNotice/scraper/nowon.ts` — 노원구

- 대상: `https://www.nowon.kr/www/user/bbs/BD_selectBbsList.do?q_bbsCode=1001&q_estnColumn1=11`
- 방식: `fetch()`로 HTML 가져오기 → 정규식으로 BBS 테이블 파싱
- 날짜 필터: 날짜 컬럼(`YYYY.MM.DD` / `YYYY-MM-DD` 포맷)과 `targetDate` 비교
- URL: `<a href>` 상대경로를 `https://www.nowon.kr` 기준 절대 URL로 변환
- 인코딩: charset 감지 후 EUC-KR 대응 (`naverNews.ts` 패턴 동일)
- 반환: `source: '노원구'`로 설정된 `NewsItem[]`

#### 페이지네이션 고려 사항

사이트 특성상 URL 파라미터로 2페이지 이상 직접 접근이 불가능하다. 구현 시에는 첫 번째 페이지만 수집하는 방식으로 처리한다. 최신순 정렬이므로 당일 공지는 첫 페이지 안에 포함되며, 현실적으로 하루 게시물이 한 페이지를 초과하는 경우는 없다. 향후 다수 게시물이 확인되는 경우 Playwright 기반으로 내부 구현만 교체할 수 있다.

---

### `src/districtNotice/scraper/yp21.ts` — 양평군 공통 BBS

양평군 강하면 3개 게시판이 동일한 BBS 시스템을 공유하므로 단일 공통 함수로 구현한다.

#### 대상 게시판

| 게시판 | bbsNo | key | URL |
|--------|-------|-----|-----|
| 강하면 공지사항 | 206 | 128 | `https://www.yp21.go.kr/gh/selectBbsNttList.do?bbsNo=206&key=128` |
| 이장 공문함     | 207 | 129 | `https://www.yp21.go.kr/gh/selectBbsNttList.do?bbsNo=207&key=129` |
| 양평 공지사항   | 1   | 130 | `https://www.yp21.go.kr/gh/selectBbsNttList.do?bbsNo=1&key=130`   |

#### HTML 구조 (실제 분석 결과)

- 인코딩: **UTF-8**
- 테이블 컬럼 순서: `번호 | 제목 | 작성자 | 작성일 | 조회수 | 파일`
- 날짜 컬럼: **4번째 `<td>`**, 포맷 `YYYY-MM-DD`
- 제목·링크: **2번째 `<td>` 내부 `<a href>`**
- 링크 패턴 (상대경로):
  ```
  ./selectBbsNttView.do?key={key}&bbsNo={bbsNo}&nttNo={nttNo}&searchCtgry=&searchCnd=all&searchKrwd=&pageIndex=1&integrDeptCode=
  ```
- 절대 URL 변환 기준: `https://www.yp21.go.kr/gh/`
- 페이지당 게시물 수: **10개** (고정)
- 정렬: **최신순(내림차순)** — 오늘 날짜 게시물이 1페이지 상단에 위치
- 페이지 이동: `pageIndex=N` URL 파라미터로 직접 접근 가능 (**실제 검증 완료**)

#### 함수 시그니처

```ts
interface FetchYp21BbsParams {
  bbsNo: number;
  key: number;
  source: string;     // NewsItem.source 값 (예: "강하면 공지사항")
  targetDate: string; // YYYY-MM-DD
}

export async function fetchYp21Bbs(params: FetchYp21BbsParams): Promise<NewsItem[]>
```

#### 페이지네이션 고려 사항

URL 파라미터 방식으로 페이지 접근이 가능하다(검증 완료). 오늘 날짜 게시물이 여러 페이지에 걸칠 수 있으므로, 구현 시에는 페이지를 순차적으로 수집하되 오늘 이전 날짜 항목이 등장하는 시점을 종료 조건으로 삼아 불필요한 요청을 줄인다. 무한 루프 방지를 위한 최대 페이지 수 상한을 설정한다.

#### 파싱 로직

1. `fetch()`로 `pageIndex=N` 페이지 요청 (UTF-8이므로 charset 감지 불필요)
2. 정규식으로 `<tr>` 단위로 분리 후 각 행에서:
   - 2번째 `<td>`의 `<a href>` → 제목·상대경로 URL 추출
   - 4번째 `<td>` → 날짜 추출 (`YYYY-MM-DD`)
3. 날짜 비교 후 수집 및 조기 종료 여부 판단
4. 상대경로 → `https://www.yp21.go.kr/gh/selectBbsNttView.do?...` 로 절대 URL 변환
5. `{ title, url, source, publishedAt: targetDate }` 형태로 반환

---

### `src/districtNotice/scraper/seoulMediahub.ts` — 서울시 미디어허브

- 대상: `https://mediahub.seoul.go.kr/news/category/categoryNewsList.do`
- 방식: `fetch()`로 HTML 가져오기 → 카드형 레이아웃 파싱 (테이블 구조 아님)
- 수집 대상: **최신 뉴스** 섹션 내 항목
- 날짜 필터: 날짜 포맷 `YYYY.MM.DD`를 `YYYY-MM-DD`로 정규화 후 `targetDate`와 비교
- URL: `/archives/{id}` 상대경로를 `https://mediahub.seoul.go.kr` 기준 절대 URL로 변환
- 인코딩: UTF-8
- 반환: `source: '서울 미디어허브'`로 설정된 `NewsItem[]`

#### 페이지네이션 고려 사항

페이지네이션 방식은 구현 시 실제 HTML을 확인해야 한다. URL 파라미터 방식이 동작하지 않을 경우 최신 뉴스 섹션에 노출된 항목만 수집하는 방식으로 처리한다. 서울시 뉴스는 하루 게시 건수가 많지 않으며 최신 뉴스 섹션이 당일 기사를 우선 노출하는 구조이므로 단일 페이지 수집으로도 충분하다.

---

### `src/districtNotice/calendar.ts`

카테고리별로 개별 캘린더 이벤트를 생성한다. 카테고리 내 소스가 여럿이면 `source` 필드 기준으로 description을 섹션 분리한다.

```ts
export async function upsertDistrictNoticeEvent(
  date: string,
  category: DistrictNoticeCategory,
  items: NewsItem[],
): Promise<void> {
  const calendarId = process.env.CALENDAR_ID;
  if (!calendarId) throw new Error('CALENDAR_ID is required');

  await upsertAllDayCalendarEvent({
    calendarId,
    eventId: `${category.eventKey}${date.replace(/-/g, '')}`,
    summary: `🏛️ ${category.name} 공지사항 (${date})`,
    date,
    attendeeEmail: process.env.ATTENDEE_EMAIL,
    description: buildDescription(items, category.sources.length),
  });
}
```

#### description 포맷

소스가 1개인 카테고리 (예: 노원):
```
1. 공지 제목
링크: https://...

2. 공지 제목
링크: https://...
```

소스가 여러 개인 카테고리 (예: 양평 — `source` 필드 기준으로 섹션 분리):
```
강하면 공지사항
--------------
1. 공지 제목
링크: https://...

이장 공문함
----------
1. 공지 제목
링크: https://...

양평 공지사항
-----------
1. 공지 제목
링크: https://...
```

> `news/calendar.ts`의 카테고리 분리 패턴과 동일한 방식. `buildDescription(items, sourceCount)`에서 `sourceCount > 1`이면 섹션 헤더를 출력한다.

---

## 이벤트 ID 규칙

| 카테고리 | eventKey | 이벤트 ID 형식 | 예시 |
|----------|----------|---------------|------|
| 노원 | `noron` | `noron{YYYYMMDD}` | `noron20260502` |
| 양평 | `angpeng` | `angpeng{YYYYMMDD}` | `angpeng20260502` |
| 서울시 | `seoul` | `seoul{YYYYMMDD}` | `seoul20260502` |

> Google Calendar 이벤트 ID는 base32hex 문자(`0-9`, `a-v`)만 허용한다. `w`, `x`, `y`, `z`는 사용 불가.
>
> 각 `eventKey` 문자 검증:
> - `noron` — n(13)✓ o(14)✓ r(17)✓ o(14)✓ n(13)✓
> - `angpeng` — a(0)✓ n(13)✓ g(6)✓ p(15)✓ e(4)✓ n(13)✓ g(6)✓
> - `seoul` — s(18)✓ e(4)✓ o(14)✓ u(20)✓ l(11)✓

---

## 타입

`src/types.ts`의 `NewsItem` 타입을 재사용한다.

```ts
interface NewsItem {
  title: string;
  url: string;
  source: string;      // 소스명 (예: "노원구", "강하면 공지사항") — description 섹션 헤더로 사용
  category?: string;   // 미사용
  publishedAt?: string;
}
```

---

## 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | 공통 | 서비스 계정 키 JSON 문자열 (GitHub Actions용) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | 로컬용 | 서비스 계정 키 파일 경로 |
| `CALENDAR_ID` | 필수 | Google Calendar ID |
| `ATTENDEE_EMAIL` | 선택 | 이벤트 초대 이메일 |

---

## GitHub Actions

- 워크플로 파일: `.github/workflows/daily-district-notice.yml`
- 실행 시각: 매일 **18:00 KST** (09:00 UTC) — 업무 종료 후 당일 공지 수집
- 트리거: `schedule` + `workflow_dispatch`

---

## 새 항목 추가 방법

### 기존 카테고리에 소스 추가 (yp21.go.kr 게시판)

`scraper/index.ts`의 해당 카테고리 `sources` 배열에 한 줄 추가:

```ts
{ name: '강하면 복지', scrape: (date) => fetchYp21Bbs({ bbsNo: 999, key: 200, source: '강하면 복지', targetDate: date }) },
```

### 새 카테고리 추가 (새 사이트)

1. `src/districtNotice/scraper/{사이트}.ts` 생성
   - `(targetDate: string) => Promise<NewsItem[]>` 시그니처의 함수 구현
2. `scraper/index.ts`의 `DISTRICT_NOTICE_CATEGORIES`에 추가:
   ```ts
   {
     name: '강남',
     eventKey: 'gangnam',   // base32hex 문자만, 기존 키와 중복 불가
     sources: [
       { name: '강남구', scrape: scrapeGangnam },
     ],
   },
   ```

---

## 구현 순서

1. `src/districtNotice/scraper/yp21.ts` 구현 (양평군 공통 BBS 스크래퍼)
2. `src/districtNotice/scraper/nowon.ts` 구현 (노원구 스크래퍼)
3. `src/districtNotice/scraper/index.ts` 구현 (카테고리·소스 레지스트리)
4. `src/districtNotice/calendar.ts` 구현 (카테고리별 이벤트 upsert)
5. `src/districtNotice/run.ts` 구현 (오케스트레이터)
6. `src/districtNotice/index.ts` 구현 (진입점)
7. `package.json`에 `start:district-notice` 스크립트 추가
8. `.github/workflows/daily-district-notice.yml` 추가
9. `docs/architecture/overview.md` 업데이트
