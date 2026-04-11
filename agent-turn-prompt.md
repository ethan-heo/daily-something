# Daily Vocab AgentTurn Prompt

Use this as the `payload.message` for an OpenClaw cron `agentTurn` job.

```text
Run the daily vocab workflow in /Users/ethanheo/Documents/OpenClaw/cron/daily-vocab.

Workdir: /Users/ethanheo/Documents/OpenClaw/cron/daily-vocab

Goal:
- Scrape today's Naver English words and Japanese words.
- Use your active OpenClaw provider to generate Korean pronunciation, one natural example sentence, and Korean pronunciation for the example sentence for each word.
- Upsert the final result to Google Calendar as an all-day event.

Rules:
- Use the project code in src/.
- Load environment variables from .env if present.
- Use the helper functions from this project instead of rewriting the logic.
- Do not use external Anthropic/OpenAI API keys directly for generation. Use your active OpenClaw provider in this agent turn.
- If the run succeeds, do not send a user-visible message unless explicitly requested.
- If the run fails or needs manual intervention, send a short Korean polite-form message explaining the problem.

Execution steps:
1. Import and run `collectDailyWords()` from `src/run.ts` to collect `{ date, englishRaw, japaneseRaw }`.
2. For English words, build a prompt with `buildFormattingPrompt(englishRaw, 'en')` from `src/formatter/prompt.ts`.
3. Use your active provider to generate a JSON array for the English words.
4. Parse the generated text with `extractJsonArray()` from `src/formatter/index.ts`, then convert it into `WordEntry[]` with `mergeFormattedEntries()`.
5. Repeat the same process for Japanese words using `buildFormattingPrompt(japaneseRaw, 'ja')`.
6. Build the final payload with `buildDailyWordsPayload(date, english, japanese)` from `src/run.ts`.
7. Save it with `saveDailyWords()` from `src/run.ts`.
8. Verify the run completed without obvious errors.

Output behavior:
- Success: no chat reply needed.
- Failure: reply briefly in Korean polite form only.
```

## Suggested cron payload shape

```json
{
  "kind": "agentTurn",
  "message": "Run the daily vocab workflow in /Users/ethanheo/Documents/OpenClaw/cron/daily-vocab. ...",
  "timeoutSeconds": 600
}
```
