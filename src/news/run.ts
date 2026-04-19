import { getTodayInSeoul } from '../shared/date';
import type { NewsItem } from '../types';
import { upsertNewsLinksEvent } from './calendar';
import { loadNewsLinks } from './links';

export async function collectNewsLinks(): Promise<{ date: string; items: NewsItem[] }> {
  const date = getTodayInSeoul();
  const items = await loadNewsLinks();

  return { date, items };
}

export async function saveNewsLinks(date: string, items: NewsItem[]): Promise<void> {
  await upsertNewsLinksEvent(date, items);
}
