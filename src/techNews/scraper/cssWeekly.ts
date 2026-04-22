import type { Page } from 'playwright';
import type { NewsItem } from '../../types';

const FEED_URL = 'https://feedpress.me/cssweekly';
const SOURCE = 'CSS Weekly';
const ISSUE_TITLE_PATTERN = /^Issue\s+#\d+/i;
const NEWSLETTER_CATEGORY = 'Newsletter';
const INCLUDED_SECTION_KEYWORDS = ['Headlines', 'Quick Tips', 'Articles', 'Tools', 'Inspiration'];
const EXCLUDED_SECTION_KEYWORDS = ['Sponsor', 'Sponsored', 'YouTube', 'Friends'];
const EXCLUDED_URL_PATTERNS = [
  'youtube.com',
  'youtu.be',
  'css-weekly.com/advertise',
  'patreon.com',
  'cssw.io/',
];

export async function scrapeCssWeekly(_page: Page, targetDate: string): Promise<NewsItem[]> {
  const response = await fetch(FEED_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch CSS Weekly RSS: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const items = extractItems(xml);
  const newsletter = items.find((item) => isTargetDateNewsletter(item, targetDate));

  if (!newsletter) return [];

  const publishedAt = normalizeDate(extractTagValue(newsletter, 'pubDate'));
  if (!publishedAt) return [];

  const content = extractTagValue(newsletter, 'content:encoded');

  return extractNewsletterLinks(content).map((item) => ({
    ...item,
    source: SOURCE,
    publishedAt,
  }));
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

function isTargetDateNewsletter(item: string, targetDate: string): boolean {
  const publishedAt = normalizeDate(extractTagValue(item, 'pubDate'));
  if (publishedAt !== targetDate) return false;

  const title = decodeXml(stripHtml(extractTagValue(item, 'title'))).trim();
  const category = decodeXml(stripHtml(extractTagValue(item, 'category'))).trim();

  return ISSUE_TITLE_PATTERN.test(title) || category === NEWSLETTER_CATEGORY;
}

function extractNewsletterLinks(content: string): Array<Pick<NewsItem, 'title' | 'url'>> {
  const sections = splitSections(content);
  const results: Array<Pick<NewsItem, 'title' | 'url'>> = [];
  const seen = new Set<string>();

  for (const section of sections) {
    if (!isIncludedSection(section.heading)) continue;

    for (const match of section.body.matchAll(/<h3\b[^>]*>\s*<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi)) {
      const url = normalizeUrl(match[1]);
      const title = decodeXml(stripHtml(match[2])).trim();

      if (!url || !title) continue;
      if (isExcludedUrl(url)) continue;
      if (seen.has(url)) continue;

      seen.add(url);
      results.push({ title, url });
    }
  }

  return results;
}

function splitSections(content: string): Array<{ heading: string; body: string }> {
  const headingMatches = [...content.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const sections: Array<{ heading: string; body: string }> = [];

  for (let index = 0; index < headingMatches.length; index += 1) {
    const current = headingMatches[index];
    const next = headingMatches[index + 1];
    const bodyStart = (current.index ?? 0) + current[0].length;
    const bodyEnd = next?.index ?? content.length;

    sections.push({
      heading: decodeXml(stripHtml(current[1])).trim(),
      body: content.slice(bodyStart, bodyEnd),
    });
  }

  return sections;
}

function isIncludedSection(heading: string): boolean {
  if (EXCLUDED_SECTION_KEYWORDS.some((keyword) => heading.includes(keyword))) return false;
  return INCLUDED_SECTION_KEYWORDS.some((keyword) => heading.includes(keyword));
}

function isExcludedUrl(url: string): boolean {
  return EXCLUDED_URL_PATTERNS.some((pattern) => url.includes(pattern));
}

function normalizeUrl(value: string): string {
  const decoded = decodeXml(value).trim();

  try {
    const url = new URL(decoded);
    url.searchParams.delete('utm_source');
    url.searchParams.delete('utm_campaign');
    url.searchParams.delete('utm_medium');
    return url.toString();
  } catch {
    return '';
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '');
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
