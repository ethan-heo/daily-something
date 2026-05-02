import type { NewsItem } from '../../types';
import { decodeHtmlEntities, fetchHtml, normalizeDate, toText } from './html';

const SEOUL_MEDIAHUB_URL = 'https://mediahub.seoul.go.kr/news/category/categoryNewsList.do';
const SEOUL_MEDIAHUB_BASE_URL = 'https://mediahub.seoul.go.kr';
const SOURCE = '서울 미디어허브';

export async function scrapeSeoulMediahub(targetDate: string): Promise<NewsItem[]> {
  const html = await fetchHtml(SEOUL_MEDIAHUB_URL);
  const latestNewsHtml = extractLatestNewsSection(html);
  const anchorPattern = /<a\b[^>]*href=(['"])(\/archives\/[^'"]+)\1[^>]*>([\s\S]*?)<\/a>/gi;
  const items: NewsItem[] = [];
  let match: RegExpExecArray | null = anchorPattern.exec(latestNewsHtml);

  while (match) {
    const block = match[0];
    const date = normalizeDate(toText(block));

    if (date === targetDate) {
      const title = extractTitle(block);
      const url = toAbsoluteUrl(decodeHtmlEntities(match[2]).trim());

      if (title && url) {
        items.push({ title, url, source: SOURCE, publishedAt: targetDate });
      }
    }

    match = anchorPattern.exec(latestNewsHtml);
  }

  return deduplicateByUrl(items);
}

function extractLatestNewsSection(html: string): string {
  const headingIndex = html.search(/최신\s*뉴스|최신뉴스/i);
  if (headingIndex < 0) return html;

  const nextSectionIndex = html.slice(headingIndex + 1).search(/<h[1-4]\b|<section\b/i);
  if (nextSectionIndex < 0) return html.slice(headingIndex);

  return html.slice(headingIndex, headingIndex + 1 + nextSectionIndex);
}

function extractTitle(block: string): string {
  const titleClassMatch = block.match(/<(?:strong|p|span|div)\b[^>]*class=(['"])[^'"]*(?:title|tit|subject)[^'"]*\1[^>]*>([\s\S]*?)<\/(?:strong|p|span|div)>/i);
  const title = titleClassMatch ? toText(titleClassMatch[2]) : toText(block);

  return title.replace(/\d{4}[.-]\d{1,2}[.-]\d{1,2}.*/, '').trim();
}

function toAbsoluteUrl(href: string): string | null {
  try {
    return new URL(href, SEOUL_MEDIAHUB_BASE_URL).toString();
  } catch {
    return null;
  }
}

function deduplicateByUrl(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.url)) return false;

    seen.add(item.url);
    return true;
  });
}
