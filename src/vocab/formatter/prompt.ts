import type { RawWordEntry } from '../../types';

export type Language = 'en' | 'ja';

const PROMPTS: Record<Language, (items: RawWordEntry[]) => string> = {
  en: (items) => `아래 영어 단어와 의미를 보고, 각 단어에 대해 다음을 JSON 배열로 반환해줘.
- pronunciation: 단어의 한국어 발음 (예: 어밴던)
- example: 해당 단어를 포함한 자연스러운 영어 예문 1개
- examplePronunciation: 예문의 한국어 발음
- exampleTranslation: 예문의 자연스럽고 부드러운 한국어 해석

해석 규칙:
- 직역보다 한국어로 자연스럽게 들리는 표현을 우선해줘
- 번역투, 교과서체, 딱딱한 문장은 피해줘
- 한국인이 일상적으로 말할 법한 문장으로 써줘
- 의미는 유지하되 필요하면 부드럽게 의역해도 돼
- 문장 끝은 반드시 존댓말로 마무리해줘 (예: ~해요, ~했어요, ~입니다)

입력:
${JSON.stringify(items, null, 2)}

출력 형식 (JSON만, 마크다운 없이):
[
 {
  "pronunciation": "어밴던",
  "example": "She decided to abandon the project.",
  "examplePronunciation": "쉬 디사이디드 투 어밴던 더 프로젝트",
  "exampleTranslation": "그녀는 그 프로젝트를 그만두기로 했어요."
 }
]`,
  ja: (items) => `아래 일본어 단어와 의미를 보고, 각 단어에 대해 다음을 JSON 배열로 반환해줘.
- pronunciation: 단어의 한국어 발음 (예: 간바루)
- example: 해당 단어를 포함한 자연스러운 일본어 예문 1개
- examplePronunciation: 예문의 한국어 발음
- exampleTranslation: 예문의 자연스럽고 부드러운 한국어 해석

해석 규칙:
- 직역보다 한국어로 자연스럽게 들리는 표현을 우선해줘
- 번역투, 교과서체, 딱딱한 문장은 피해줘
- 한국인이 일상적으로 말할 법한 문장으로 써줘
- 의미는 유지하되 필요하면 부드럽게 의역해도 돼
- 문장 끝은 반드시 존댓말로 마무리해줘 (예: ~해요, ~했어요, ~입니다)

입력:
${JSON.stringify(items, null, 2)}

출력 형식 (JSON만, 마크다운 없이):
[
 {
  "pronunciation": "간바루",
  "example": "毎日頑張ることが大切です。",
  "examplePronunciation": "마이니치 간바루 코토가 타이세츠데스",
  "exampleTranslation": "매일 꾸준히 해나가는 게 중요해요."
 }
]`,
};

export function buildFormattingPrompt(items: RawWordEntry[], language: Language): string {
  return PROMPTS[language](items);
}
