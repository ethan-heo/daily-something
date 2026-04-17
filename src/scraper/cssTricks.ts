import type { Locator, Page } from 'playwright';
import type { NewsItem } from '../types';
import { getTodayInSeoul } from '../shared/date';

const LIST_URL = 'https://css-tricks.com/category/articles/';
const CONTAINER = '.article-card';
const SOURCE = 'CSS-Tricks';

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export async function scrapeCssTricks(page: Page): Promise<NewsItem[]> {
  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(CONTAINER, { timeout: 30000 });

  const today = getTodayInSeoul();
  const items = await page.locator(CONTAINER).all();
  const results: NewsItem[] = [];

  for (const item of items) {
    const publishedAt = await extractPublishedDate(item, today);
    if (publishedAt !== today) continue;

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

async function extractPublishedDate(item: Locator, today: string): Promise<string | null> {
  const time = item.locator('time').first();
  if ((await time.count()) === 0) return null;

  const rawText = ((await time.textContent()) ?? '').trim();
  return normalizeDateFromText(rawText, today);
}

function normalizeDateFromText(value: string, today: string): string | null {
  const normalized = value.replace(/\s+/g, ' ').replace(/,\s*/g, ', ').trim();
  if (!normalized) return null;

  const isoMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const currentYear = Number(today.slice(0, 4));
  const parsed =
    parseMonthFirst(normalized, currentYear) ??
    parseDayFirst(normalized, currentYear);

  if (!parsed) return null;

  return formatDate(parsed.year, parsed.month, parsed.day);
}

function parseMonthFirst(value: string, fallbackYear: number) {
  const match = value.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*|\s+)(\d{4})?$/);
  if (!match) return null;

  const month = MONTHS[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3] ?? fallbackYear);

  return isValidDateParts(year, month, day) ? { year, month, day } : null;
}

function parseDayFirst(value: string, fallbackYear: number) {
  const match = value.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+|,\s*)(\d{4})?$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTHS[match[2].toLowerCase()];
  const year = Number(match[3] ?? fallbackYear);

  return isValidDateParts(year, month, day) ? { year, month, day } : null;
}

function isValidDateParts(year: number, month: number | undefined, day: number): boolean {
  if (!Number.isInteger(year) || month == null || !Number.isInteger(day)) return false;

  const date = new Date(Date.UTC(year, month, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month &&
    date.getUTCDate() === day
  );
}

function formatDate(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, '0'),
    String(month + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}
