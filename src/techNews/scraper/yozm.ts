import type { Page } from 'playwright';
import type { NewsItem } from '../../types';

const BASE_URL = 'https://yozm.wishket.com';
const LIST_URL = `${BASE_URL}/magazine/list/new/`;
const CONTAINER = '[data-testid="article-column-item--container"]';
const SOURCE = '요즘IT';

export async function scrapeYozm(page: Page, targetDate: string): Promise<NewsItem[]> {
  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(CONTAINER, { timeout: 30000 });

  const items = await page.locator(CONTAINER).evaluateAll((elements) =>
    elements.flatMap((element) => {
      const anchor = element.querySelector('a');
      const heading = element.querySelector('h1, h2, h3, h4');
      const href = anchor?.getAttribute('href');
      const title = heading?.textContent?.trim();

      if (!href || !title) return [];

      return [{ href, title }];
    }),
  );
  const results: NewsItem[] = [];

  for (const item of items) {
    const url = item.href.startsWith('http') ? item.href : `${BASE_URL}${item.href}`;
    const publishedAt = await extractPublishedDate(page, url);
    if (publishedAt !== targetDate) continue;

    results.push({ title: item.title, url, source: SOURCE, publishedAt });
  }

  return results;
}

async function extractPublishedDate(page: Page, url: string): Promise<string | null> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const raw = await page.locator('meta[name="date"]').first().getAttribute('content');
  return normalizeDate(raw);
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;

  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}
