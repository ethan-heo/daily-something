import { chromium } from 'playwright';
import { scrapeSmashingMagazine } from '../scraper/smashingMagazine';
import { scrapeYozm } from '../scraper/yozm';
import { upsertNewsEvent } from './calendar';
import type { NewsItem } from '../types';

const scrapers = [scrapeYozm, scrapeSmashingMagazine];

export async function collectNews(): Promise<{ date: string; items: NewsItem[] }> {
  const browser = await chromium.launch({ headless: true });

  try {
    const results = await Promise.all(
      scrapers.map(async (scraper) => {
        const page = await browser.newPage();

        try {
          return await scraper(page);
        } finally {
          await page.close();
        }
      }),
    );
    const items = deduplicateByUrl(results.flat());
    const date = getTodayInSeoul();

    return { date, items };
  } finally {
    await browser.close();
  }
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

function getTodayInSeoul(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
