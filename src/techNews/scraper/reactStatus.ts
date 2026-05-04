import type { Page } from 'playwright';
import type { NewsItem } from '../../types';

const FEED_URL = 'https://react.statuscode.com/rss/';
const SOURCE = 'React Status';

export async function scrapeReactStatus(_page: Page, targetDate: string): Promise<NewsItem[]> {
  const response = await fetch(FEED_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch React Status RSS: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const items = extractItems(xml);
  const results: NewsItem[] = [];

  for (const item of items) {
    const publishedAt = normalizeDate(extractTagValue(item, 'pubDate'));
    if (publishedAt !== targetDate) continue;

    const title = decodeXml(extractTagValue(item, 'title')).trim();
    const url = decodeXml(extractTagValue(item, 'link')).trim();
    if (!title || !url) continue;

    results.push({ title, url, source: SOURCE, publishedAt });
  }

  return results;
}

function extractItems(xml: string): string[] {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
}

function extractTagValue(xml: string, tagName: string): string {
  const match = xml.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  if (!match) return '';

  return stripCdata(match[1]).trim();
}

function stripCdata(value: string): string {
  const cdataMatch = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdataMatch ? cdataMatch[1] : value;
}

function normalizeDate(value: string): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)));
}
