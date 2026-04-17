import 'dotenv/config';
import { collectDailyWords, saveDailyWords, buildDailyWordsPayload } from './run';
import { generateFormatted } from './formatter';

async function main(): Promise<void> {
  const { date, englishRaw, japaneseRaw } = await collectDailyWords();
  const english = await generateFormatted(englishRaw, 'en');
  const japanese = await generateFormatted(japaneseRaw, 'ja');
  const payload = buildDailyWordsPayload(date, english, japanese);

  await saveDailyWords(payload);

  console.log(`Done: ${date}, english=${english.length}, japanese=${japanese.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
