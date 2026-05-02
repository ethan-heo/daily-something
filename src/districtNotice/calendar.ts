import { upsertAllDayCalendarEvent } from '../shared/googleCalendar';
import type { NewsItem } from '../types';
import type { DistrictNoticeCategory } from './scraper';

export async function upsertDistrictNoticeEvent(
  date: string,
  category: DistrictNoticeCategory,
  items: NewsItem[],
): Promise<void> {
  const calendarId = process.env.CALENDAR_ID;

  if (!calendarId) throw new Error('CALENDAR_ID is required');

  await upsertAllDayCalendarEvent({
    calendarId,
    eventId: `${category.eventKey}${date.replace(/-/g, '')}`,
    summary: `🏛️ ${category.name} 공지사항 (${date})`,
    date,
    attendeeEmail: process.env.ATTENDEE_EMAIL,
    description: buildDescription(items, category.sources.length),
  });
}

function buildDescription(items: NewsItem[], sourceCount: number): string {
  if (sourceCount <= 1) {
    return formatItems(items);
  }

  const groupedItems = new Map<string, NewsItem[]>();

  for (const item of items) {
    const source = item.source.trim() || '기타';
    const currentItems = groupedItems.get(source) ?? [];
    currentItems.push(item);
    groupedItems.set(source, currentItems);
  }

  return Array.from(groupedItems.entries())
    .map(([source, sourceItems]) => `${source}\n${'-'.repeat(source.length)}\n${formatItems(sourceItems)}`)
    .join('\n\n================================\n\n');
}

function formatItems(items: NewsItem[]): string {
  return items.map((item, index) => `${index + 1}. ${item.title}\n링크: ${item.url}`).join('\n\n');
}
