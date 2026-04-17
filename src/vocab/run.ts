import 'dotenv/config';
import { chromium } from 'playwright';
import { upsertCalendarEvent } from './calendar';
import { scrapeEnglishWords } from '../scraper/english';
import { scrapeJapaneseWords } from '../scraper/japanese';
import type { DailyWords, WordEntry } from '../types';

export async function collectDailyWords(): Promise<{ date: string; englishRaw: Array<{ word: string; meaning: string }>; japaneseRaw: Array<{ word: string; meaning: string }> }> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const englishRaw = await scrapeEnglishWords(page);
    const japaneseRaw = await scrapeJapaneseWords(page);
    const date = getTodayInSeoul();

    return { date, englishRaw, japaneseRaw };
  } finally {
    await browser.close();
  }
}

export async function saveDailyWords(words: DailyWords): Promise<void> {
  await upsertCalendarEvent(words);
}

export function buildDailyWordsPayload(date: string, english: WordEntry[], japanese: WordEntry[]): DailyWords {
  return { date, english, japanese };
}

function getTodayInSeoul(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
