import type { NewsItem } from '../../types';
import {
  decodeHtmlEntities,
  extractTableCells,
  extractTableRows,
  fetchHtml,
  normalizeDate,
  toText,
} from './html';

const NOWON_URL = 'https://www.nowon.kr/www/user/bbs/BD_selectBbsList.do?q_bbsCode=1001&q_estnColumn1=11';
const SOURCE = '노원구';

export async function scrapeNowon(targetDate: string): Promise<NewsItem[]> {
  const html = await fetchHtml(NOWON_URL, 'euc-kr');
  const rows = extractTableRows(html);
  const items: NewsItem[] = [];

  for (const row of rows) {
    const cells = extractTableCells(row);
    if (cells.length < 2) continue;

    const date = normalizeDate(toText(row));
    if (date !== targetDate) continue;

    const anchorMatch = row.match(/<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
    if (!anchorMatch) continue;

    const title = toText(anchorMatch[3]);
    const href = decodeHtmlEntities(anchorMatch[2]).trim();
    const url = toAbsoluteUrl(href);

    if (!title || !url) continue;
    items.push({ title, url, source: SOURCE, publishedAt: targetDate });
  }

  return deduplicateByUrl(items);
}

function toAbsoluteUrl(href: string): string | null {
  try {
    return new URL(href, NOWON_URL).toString();
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
