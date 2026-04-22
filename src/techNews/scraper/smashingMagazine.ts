import type { Page } from 'playwright';
import type { NewsItem } from '../../types';

const LIST_URL = 'https://www.smashingmagazine.com/articles/';
const CONTAINER = '.article--post';
const SOURCE = 'Smashing Magazine';

export async function scrapeSmashingMagazine(page: Page, targetDate: string): Promise<NewsItem[]> {
  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(CONTAINER, { timeout: 30000 });

  const items = await page.locator(CONTAINER).all();
  const results: NewsItem[] = [];

  for (const item of items) {
    const publishedAt = await extractPublishedDate(item);
    if (publishedAt !== targetDate) continue;

    const anchor = item.locator('h1 a, h2 a, h3 a, h4 a, a').first();
    const href = await anchor.getAttribute('href');
    if (!href) continue;

    const title = ((await anchor.textContent()) ?? '').trim();
    if (!title) continue;

    const url = new URL(href, LIST_URL).toString();
    results.push({ title, url, source: SOURCE, publishedAt });
  }

  return results;
}

async function extractPublishedDate(item: ReturnType<Page['locator']>): Promise<string | null> {
  const time = item.locator('time[date], time[datetime]').first();
  if ((await time.count()) === 0) return null;

  const raw =
    (await time.getAttribute('date')) ??
    (await time.getAttribute('datetime'));

  return normalizeDate(raw);
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;

  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}
