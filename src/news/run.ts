import { getTodayInSeoul } from '../shared/date';
import type { NewsItem } from '../types';
import { upsertNewsLinksEvent } from './calendar';
import { NEWS_RSS_SOURCES } from './scraper';
import { fetchNaverNewsRss } from './scraper/naverNews';

export async function collectNewsLinks(): Promise<{ date: string; items: NewsItem[] }> {
  const date = getTodayInSeoul();
  const results = await Promise.all(
    NEWS_RSS_SOURCES.map(({ category, sectionId, subSectionId }) =>
      fetchNaverNewsRss({ category, sectionId, subSectionId, targetDate: date }),
    ),
  );
  const items = deduplicateByUrl(results.flat());

  return { date, items };
}

export async function saveNewsLinks(date: string, items: NewsItem[]): Promise<void> {
  await upsertNewsLinksEvent(date, items);
}

function deduplicateByUrl(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.url)) {
      return false;
    }

    seen.add(item.url);
    return true;
  });
}
