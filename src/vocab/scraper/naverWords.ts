import type { Page } from 'playwright';
import type { RawWordEntry } from '../../types';

const CONTAINER = '.sc_new.cs_dicstudy._fe_language_study';

export async function scrapeNaverWords(page: Page, url: string): Promise<RawWordEntry[]> {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector(CONTAINER, { timeout: 15000 });

  const words = await page.locator(`${CONTAINER} .word`).allInnerTexts();
  const meanings = await page.locator(`${CONTAINER} .mean`).allInnerTexts();

  return words
    .map((word, index) => ({
      word: word.trim(),
      meaning: (meanings[index] || '').trim(),
    }))
    .filter((entry) => entry.word && entry.meaning);
}
