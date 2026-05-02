import { getTodayInSeoul } from '../shared/date';
import type { NewsItem } from '../types';
import { upsertDistrictNoticeEvent } from './calendar';
import { DISTRICT_NOTICE_CATEGORIES } from './scraper';

export async function runDistrictNotice(): Promise<void> {
  const date = process.env.DISTRICT_NOTICE_TARGET_DATE || getTodayInSeoul();

  await Promise.all(
    DISTRICT_NOTICE_CATEGORIES.map(async (category) => {
      const results = await Promise.all(category.sources.map((source) => source.scrape(date)));
      const items = deduplicateByUrl(results.flat());

      if (items.length === 0) {
        console.log(`No notices for ${category.name} on ${date}, skipping.`);
        return;
      }

      await upsertDistrictNoticeEvent(date, category, items);
      console.log(`Done: ${category.name}, items=${items.length}`);
    }),
  );
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
