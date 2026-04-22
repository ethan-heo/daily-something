# Vocab 기능 아키텍처

## 목적

네이버 오늘의 단어(영어/일본어)를 스크래핑하고, Claude API로 발음·예문을 생성하여 Google Calendar에 종일 이벤트로 등록한다.

---

## 실행 흐름

```
src/vocab/index.ts
  └─ collectDailyWords()          # Playwright로 영어/일본어 단어 스크래핑
  └─ generateFormatted(en)        # Claude API: 영단어 발음·예문 생성
  └─ generateFormatted(ja)        # Claude API: 일본어 단어 발음·예문 생성
  └─ buildDailyWordsPayload()     # DailyWords 객체 조합
  └─ saveDailyWords()             # Google Calendar upsert
```

---

## 파일별 역할

### `src/vocab/index.ts`
전체 흐름을 순서대로 실행하는 진입점.

### `src/vocab/run.ts`
- `collectDailyWords()`: Playwright 브라우저를 열고 영어·일본어 스크래퍼를 순차 실행. 오늘 날짜(KST)는 `src/shared/date.ts`의 `getTodayInSeoul()`로 계산
- `saveDailyWords()`: calendar.ts의 `upsertCalendarEvent()` 호출
- `buildDailyWordsPayload()`: date + english + japanese를 `DailyWords`로 조합

### `src/vocab/calendar.ts`
- 이벤트 ID: `vocab{YYYYMMDD}`
- 역할: vocab용 description 문자열을 만들고 `src/shared/googleCalendar.ts`의 `upsertAllDayCalendarEvent()`를 호출
- 이벤트 구조:
  - summary: `📚 오늘의 단어 (YYYY-MM-DD)`
  - description: 영단어 목록 + 구분선 + 일본어 단어 목록
- 각 단어 포맷:
  ```
  📌 word (발음)
  의미: ...

  예문
  예문 발음
  해석: ...
  ```

### `src/vocab/formatter/index.ts`
Claude API를 호출하여 `RawWordEntry[]`를 `WordEntry[]`로 변환.
- 영어·일본어 각각 1회 호출
- 응답 JSON 파싱 및 길이 검증 포함

### `src/vocab/formatter/prompt.ts`
언어별(`en` / `ja`) 프롬프트를 반환. 프롬프트 변경 시 이 파일만 수정.

### `src/vocab/scraper/english.ts` / `src/vocab/scraper/japanese.ts`
언어별 네이버 검색 URL만 정의하고, 실제 스크래핑은 공통 함수 `src/vocab/scraper/naverWords.ts`에 위임한다.

### `src/vocab/scraper/naverWords.ts`
네이버 오늘의 단어 공통 스크래퍼.
- 공통 컨테이너 셀렉터에서 단어(`word`)와 의미(`meaning`)를 추출
- 영어/일본어 스크래퍼가 URL만 넘겨 재사용

### `src/shared/date.ts`
서울 기준 오늘 날짜와 다음 날짜를 `YYYY-MM-DD` 형식으로 계산하는 공통 유틸.

### `src/shared/googleCalendar.ts`
Google Calendar 종일 이벤트 upsert 공통 모듈.
- 서비스 계정 인증 생성
- `start.date`, `end.date` 계산
- patch 후 404면 insert로 재시도

---

## 타입

```ts
// src/types.ts
interface RawWordEntry {
  word: string;
  meaning: string;
}

interface WordEntry extends RawWordEntry {
  pronunciation: string;
  example: string;
  exampleTranslation: string;
  examplePronunciation: string;
}

interface DailyWords {
  date: string;       // YYYY-MM-DD (KST)
  english: WordEntry[];
  japanese: WordEntry[];
}
```

---

## 환경변수

| 변수 | 설명 |
|------|------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` or `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Google 서비스 계정 인증 |
| `CALENDAR_ID` | 이벤트를 등록할 Google Calendar ID |
| `ATTENDEE_EMAIL` | (선택) 이벤트 초대할 이메일 |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `ANTHROPIC_MODEL` | (선택) 사용할 모델. 기본값: `claude-3-5-sonnet-latest` |

---

## 새 언어 추가 방법

1. `src/vocab/scraper/`에 새 스크래퍼 파일 추가
2. `src/vocab/formatter/prompt.ts`의 `Language` 타입과 `PROMPTS` 맵에 항목 추가
3. `src/vocab/run.ts`에서 새 스크래퍼 호출 및 결과 포함
4. `src/vocab/calendar.ts`의 `buildDescription()`에 새 언어 블록 추가
5. 날짜 또는 캘린더 업로드 공통 동작이 필요하면 `src/shared/`에 추가하고 vocab/news에서 함께 사용
