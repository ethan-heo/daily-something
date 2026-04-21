import type { NewsItem } from '../../types';

const NAVER_SOURCE = '네이버';
const NAVER_NEWS_BASE_URL = 'https://news.naver.com';
const ARTICLE_URL_PATTERN = /https?:\/\/(?:n\.)?news\.naver\.com\/(?:mnews\/)?article\//i;
const MAX_ITEMS_PER_CATEGORY = 5;

interface FetchNaverNewsParams {
  category: string;
  sectionId: string;
  subSectionId?: string;
  targetDate: string;
}

interface ParsedSectionItem {
  title: string;
  url: string;
}

export async function fetchNaverNewsRss({
  category,
  sectionId,
  subSectionId,
  targetDate,
}: FetchNaverNewsParams): Promise<NewsItem[]> {
  const url = buildSectionListUrl(sectionId, targetDate, subSectionId);
  const response = await fetch(url, {
    headers: {
      'user-agent': 'daily-news-bot/1.0',
      referer: 'https://www.naver.com/',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Naver news section for ${category}: ${response.status} ${response.statusText}`,
    );
  }

  const html = await decodeResponseBody(response);
  const items = parseSectionItems(html);

  return items
    .map((item) => ({
      title: item.title,
      url: item.url,
      source: NAVER_SOURCE,
      category,
      publishedAt: targetDate,
    }))
    .filter((item, index, allItems) => allItems.findIndex((candidate) => candidate.url === item.url) === index)
    .slice(0, MAX_ITEMS_PER_CATEGORY);
}

function buildSectionListUrl(sectionId: string, date: string, subSectionId?: string): string {
  const url = new URL(`${NAVER_NEWS_BASE_URL}/main/list.naver`);
  url.searchParams.set('mode', 'LSD');
  url.searchParams.set('mid', 'sec');
  url.searchParams.set('sid1', sectionId);
  url.searchParams.set('date', date.replace(/-/g, ''));

  if (subSectionId) {
    url.searchParams.set('sid2', subSectionId);
  }

  return url.toString();
}

async function decodeResponseBody(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type');
  const charset = normalizeCharset(extractCharset(contentType));

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

function extractCharset(contentType: string | null): string | null {
  if (!contentType) {
    return null;
  }

  const match = contentType.match(/charset=([^;]+)/i);
  return match?.[1]?.trim() ?? null;
}

function normalizeCharset(charset: string | null): string {
  if (!charset) {
    return 'utf-8';
  }

  const normalized = charset.toLowerCase();

  if (normalized === 'ks_c_5601-1987' || normalized === 'ksc5601') {
    return 'euc-kr';
  }

  return normalized;
}

function parseSectionItems(html: string): ParsedSectionItem[] {
  const anchorPattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const items: ParsedSectionItem[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null = anchorPattern.exec(html);

  while (match) {
    const rawHref = decodeHtmlEntities(match[1]);
    const innerHtml = match[2];
    const title = normalizeWhitespace(stripHtmlTags(decodeHtmlEntities(innerHtml)));

    if (title && ARTICLE_URL_PATTERN.test(rawHref)) {
      const url = toAbsoluteUrl(rawHref);

      if (url && !seen.has(url)) {
        seen.add(url);
        items.push({ title, url });
      }
    }

    match = anchorPattern.exec(html);
  }

  return items;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function toAbsoluteUrl(value: string): string | null {
  try {
    return new URL(value, NAVER_NEWS_BASE_URL).toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
}
