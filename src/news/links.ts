import { readFile } from 'fs/promises';
import path from 'path';
import type { NewsItem, NewsLink } from '../types';

const DEFAULT_SOURCE = '직접 제공';
const DEFAULT_CATEGORY = '기타';
const LINK_FILE_PATH = path.resolve(process.cwd(), 'data/news-links.json');

export async function loadNewsLinks(): Promise<NewsItem[]> {
  const raw = await readFile(LINK_FILE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('data/news-links.json must be a JSON array');
  }

  const items = parsed.map((entry, index) => normalizeLink(entry, index));

  return deduplicateByUrl(items);
}

function normalizeLink(entry: unknown, index: number): NewsItem {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`news link at index ${index} must be an object`);
  }

  const { title, url, source, category } = entry as NewsLink;

  if (!title || typeof title !== 'string') {
    throw new Error(`news link at index ${index} is missing a valid title`);
  }

  if (!url || typeof url !== 'string') {
    throw new Error(`news link at index ${index} is missing a valid url`);
  }

  assertValidUrl(url, index);

  return {
    title: title.trim(),
    url: url.trim(),
    source: typeof source === 'string' && source.trim() ? source.trim() : DEFAULT_SOURCE,
    category: typeof category === 'string' && category.trim() ? category.trim() : DEFAULT_CATEGORY,
  };
}

function assertValidUrl(url: string, index: number): void {
  try {
    new URL(url);
  } catch {
    throw new Error(`news link at index ${index} has an invalid url: ${url}`);
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
