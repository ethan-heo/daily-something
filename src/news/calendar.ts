import type { NewsItem } from '../types';
import { upsertAllDayCalendarEvent } from '../shared/googleCalendar';

export async function upsertNewsLinksEvent(date: string, items: NewsItem[]): Promise<void> {
  const calendarId =
    process.env.DAILY_NEWS_CALENDAR_ID || process.env.NEWS_CALENDAR_ID || process.env.CALENDAR_ID;

  if (!calendarId) {
    throw new Error('DAILY_NEWS_CALENDAR_ID, NEWS_CALENDAR_ID, or CALENDAR_ID is required');
  }

  await upsertAllDayCalendarEvent({
    calendarId,
    eventId: `link${date.replace(/-/g, '')}`,
    summary: `📰 오늘의 뉴스 (${date})`,
    date,
    attendeeEmail: process.env.ATTENDEE_EMAIL,
    description: buildDescription(items),
  });
}

function buildDescription(items: NewsItem[]): string {
  const groupedItems = new Map<string, NewsItem[]>();

  for (const item of items) {
    const category = item.category?.trim() || '기타';
    const currentItems = groupedItems.get(category) ?? [];
    currentItems.push(item);
    groupedItems.set(category, currentItems);
  }

  return Array.from(groupedItems.entries())
    .map(([category, categoryItems]) => {
      const lines = categoryItems.map(
        (item, index) => `${index + 1}. ${item.title}\n출처: ${item.source}\n링크: ${item.url}`,
      );
      return `${category}\n${'-'.repeat(category.length)}\n${lines.join('\n\n')}`;
    })
    .join('\n\n================================\n\n');
}
