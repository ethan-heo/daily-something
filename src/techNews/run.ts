import { chromium } from 'playwright';
import { scrapeCssWeekly } from './scraper/cssWeekly';
import { scrapeFrontendWeekly } from './scraper/frontendWeekly';
import { scrapeJavaScriptWeekly } from './scraper/javascriptWeekly';
import { scrapeNodeWeekly } from './scraper/nodeWeekly';
import { scrapeReactStatus } from './scraper/reactStatus';
import { scrapeSmashingMagazine } from './scraper/smashingMagazine';
import { scrapeYozm } from './scraper/yozm';
import { getTodayInSeoul, getYesterdayInSeoul } from '../shared/date';
import { upsertNewsEvent } from './calendar';
import type { NewsItem } from '../types';

type Scraper = (page: import('playwright').Page, targetDate: string) => Promise<NewsItem[]>;

const dailyScrapers = [
  scrapeYozm,
  scrapeSmashingMagazine,
] satisfies Scraper[];

const weeklyScrapers = [
  scrapeJavaScriptWeekly,
  scrapeFrontendWeekly,
  scrapeNodeWeekly,
  scrapeCssWeekly,
  scrapeReactStatus,
] satisfies Scraper[];

export interface TechNewsCollection {
  date: string;
  items: NewsItem[];
}

export async function collectNews(): Promise<TechNewsCollection[]> {
  const browser = await chromium.launch({ headless: true });
  const { uploadDate, dailyTargetDate, weeklyTargetDates } = getCollectionDates();

  try {
    const collections = await Promise.all([
      collectForDate(browser, dailyScrapers, dailyTargetDate),
      ...weeklyTargetDates.map((targetDate) => collectForDate(browser, weeklyScrapers, targetDate)),
    ]);

    return [{ date: uploadDate, items: deduplicateByUrl(collections.flatMap((collection) => collection.items)) }];
  } finally {
    await browser.close();
  }
}

async function collectForDate(
  browser: import('playwright').Browser,
  scrapers: Scraper[],
  targetDate: string,
): Promise<TechNewsCollection> {
  const results = await Promise.all(
    scrapers.map(async (scraper) => {
      const page = await browser.newPage();

      try {
        return await scraper(page, targetDate);
      } catch (error) {
        console.warn(`Skipping ${scraper.name} for ${targetDate} due to scraper error: ${formatError(error)}`);
        return [];
      } finally {
        await page.close();
      }
    }),
  );

  return { date: targetDate, items: deduplicateByUrl(results.flat()) };
}

function getCollectionDates(): { uploadDate: string; dailyTargetDate: string; weeklyTargetDates: string[] } {
  const overrideDate = process.env.TECH_NEWS_TARGET_DATE?.trim();
  const today = getTodayInSeoul();
  if (!overrideDate) {
    return { uploadDate: today, dailyTargetDate: today, weeklyTargetDates: [getYesterdayInSeoul(), today] };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
    throw new Error('TECH_NEWS_TARGET_DATE must be in YYYY-MM-DD format');
  }

  return { uploadDate: overrideDate, dailyTargetDate: overrideDate, weeklyTargetDates: [overrideDate] };
}

export async function saveNews(date: string, items: NewsItem[]): Promise<void> {
  await upsertNewsEvent(date, items);
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function deduplicateByUrl(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
