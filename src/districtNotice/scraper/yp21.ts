import type { NewsItem } from '../../types';
import {
  decodeHtmlEntities,
  extractTableCells,
  extractTableRows,
  fetchHtml,
  normalizeDate,
  toText,
} from './html';

const YP21_LIST_BASE_URL = 'https://www.yp21.go.kr/gh/selectBbsNttList.do';
const YP21_URL_BASE = 'https://www.yp21.go.kr/gh/';
const MAX_PAGES = 10;

interface FetchYp21BbsParams {
  bbsNo: number;
  key: number;
  source: string;
  targetDate: string;
}

export async function fetchYp21Bbs({
  bbsNo,
  key,
  source,
  targetDate,
}: FetchYp21BbsParams): Promise<NewsItem[]> {
  const items: NewsItem[] = [];

  for (let pageIndex = 1; pageIndex <= MAX_PAGES; pageIndex += 1) {
    const html = await fetchHtml(buildListUrl({ bbsNo, key, pageIndex }));
    const { pageItems, shouldStop } = parseYp21Page(html, { source, targetDate });
    items.push(...pageItems);

    if (shouldStop) break;
  }

  return deduplicateByUrl(items);
}

function parseYp21Page(
  html: string,
  { source, targetDate }: Pick<FetchYp21BbsParams, 'source' | 'targetDate'>,
): { pageItems: NewsItem[]; shouldStop: boolean } {
  const pageItems: NewsItem[] = [];
  let sawOlderItem = false;

  for (const row of extractTableRows(html)) {
    const cells = extractTableCells(row);
    if (cells.length < 4) continue;

    const date = normalizeDate(toText(cells[3]));
    if (!date) continue;

    if (date < targetDate) {
      sawOlderItem = true;
      continue;
    }

    if (date !== targetDate) continue;

    const anchorMatch = cells[1].match(/<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
    if (!anchorMatch) continue;

    const title = toText(anchorMatch[3]);
    const href = decodeHtmlEntities(anchorMatch[2]).trim();
    const url = toAbsoluteUrl(href);

    if (!title || !url) continue;
    pageItems.push({ title, url, source, publishedAt: targetDate });
  }

  return { pageItems, shouldStop: sawOlderItem };
}

function buildListUrl({ bbsNo, key, pageIndex }: { bbsNo: number; key: number; pageIndex: number }): string {
  const url = new URL(YP21_LIST_BASE_URL);
  url.searchParams.set('bbsNo', bbsNo.toString());
  url.searchParams.set('key', key.toString());
  url.searchParams.set('pageIndex', pageIndex.toString());

  return url.toString();
}

function toAbsoluteUrl(href: string): string | null {
  try {
    return new URL(href, YP21_URL_BASE).toString();
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
