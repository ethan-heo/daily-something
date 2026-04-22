import { chromium } from 'playwright';
import { scrapeCssWeekly } from './scraper/cssWeekly';
import { scrapeFrontendWeekly } from './scraper/frontendWeekly';
import { scrapeJavaScriptWeekly } from './scraper/javascriptWeekly';
import { scrapeNodeWeekly } from './scraper/nodeWeekly';
import { scrapeSmashingMagazine } from './scraper/smashingMagazine';
import { scrapeYozm } from './scraper/yozm';
import { getTodayInSeoul } from '../shared/date';
import { upsertNewsEvent } from './calendar';
import type { NewsItem } from '../types';

const scrapers = [
  scrapeYozm,
  scrapeSmashingMagazine,
  scrapeJavaScriptWeekly,
  scrapeFrontendWeekly,
  scrapeNodeWeekly,
  scrapeCssWeekly,
];

export async function collectNews(): Promise<{ date: string; items: NewsItem[] }> {
  const browser = await chromium.launch({ headless: true });
  const targetDate = getTargetDate();

  try {
    const results = await Promise.all(
      scrapers.map(async (scraper) => {
        const page = await browser.newPage();

        try {
          return await scraper(page, targetDate);
        } finally {
          await page.close();
        }
      }),
    );
    const items = deduplicateByUrl(results.flat());

    return { date: targetDate, items };
  } finally {
    await browser.close();
  }
}

function getTargetDate(): string {
  const overrideDate = process.env.TECH_NEWS_TARGET_DATE?.trim();
  if (!overrideDate) return getTodayInSeoul();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) {
    throw new Error('TECH_NEWS_TARGET_DATE must be in YYYY-MM-DD format');
  }

  return overrideDate;
}

export async function saveNews(date: string, items: NewsItem[]): Promise<void> {
  await upsertNewsEvent(date, items);
}

function deduplicateByUrl(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
