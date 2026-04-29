import type { Page } from 'playwright';
import type { NewsItem } from '../../types';

const FEED_URL = 'https://yozm.wishket.com/magazine/feed/';
const SOURCE = '요즘IT';
const REQUEST_TIMEOUT_MS = 15000;
const REQUEST_HEADERS = {
  'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, text/html;q=0.7',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

export async function scrapeYozm(_page: Page, targetDate: string): Promise<NewsItem[]> {
  const response = await fetchYozm(withCacheBust(FEED_URL));

  if (!response.ok) {
    throw new Error(`Failed to fetch Yozm RSS: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const items = extractItems(xml);
  const results: NewsItem[] = [];

  for (const item of items) {
    const title = decodeXml(extractTagValue(item, 'title')).trim();
    const url = normalizeUrl(extractTagValue(item, 'link'));

    if (!title || !url) continue;
    const publishedAt = await extractPublishedDate(url);
    if (publishedAt !== targetDate) continue;

    results.push({ title, url, source: SOURCE, publishedAt });
  }

  return results;
}

function extractItems(xml: string): string[] {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
}

function extractTagValue(xml: string, tagName: string): string {
  const escapedTagName = escapeRegExp(tagName);
  const match = xml.match(new RegExp(`<${escapedTagName}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTagName}>`, 'i'));
  if (!match) return '';

  return stripCdata(match[1]).trim();
}

function stripCdata(value: string): string {
  const cdataMatch = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdataMatch ? cdataMatch[1] : value;
}

function normalizeDate(value: string): string | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

function normalizeUrl(value: string): string {
  const decoded = decodeXml(value).trim();

  try {
    return new URL(decoded).toString();
  } catch {
    return '';
  }
}

function withCacheBust(url: string): string {
  const cacheBustedUrl = new URL(url);
  cacheBustedUrl.searchParams.set('_', Date.now().toString());
  return cacheBustedUrl.toString();
}

async function extractPublishedDate(url: string): Promise<string | null> {
  const response = await fetchYozm(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Yozm article: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const metaDate = extractMetaDate(html);

  return normalizeDate(metaDate);
}

async function fetchYozm(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractMetaDate(html: string): string {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = extractAttribute(tag, 'name');
    if (name !== 'date') continue;

    return extractAttribute(tag, 'content').trim();
  }

  return '';
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractAttribute(tag: string, attributeName: string): string {
  const escapedAttributeName = escapeRegExp(attributeName);
  const match = tag.match(new RegExp(`\\b${escapedAttributeName}\\s*=\\s*(['"])(.*?)\\1`, 'i'));
  return match?.[2] ?? '';
}
