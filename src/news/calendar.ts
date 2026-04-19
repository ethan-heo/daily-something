import type { NewsItem } from '../types';
import { upsertAllDayCalendarEvent } from '../shared/googleCalendar';

export async function upsertNewsEvent(date: string, items: NewsItem[]): Promise<void> {
  const calendarId = process.env.CALENDAR_ID;

  if (!calendarId) throw new Error('CALENDAR_ID is required');

  // Google Calendar event IDs only allow base32hex chars (0-9, a-v). "news" contains 'w' which is invalid.
  await upsertAllDayCalendarEvent({
    calendarId,
    eventId: `mag${date.replace(/-/g, '')}`,
    summary: `📰 뉴스 모음 (${date})`,
    date,
    attendeeEmail: process.env.ATTENDEE_EMAIL,
    description: buildDescription(items),
  });
}

function buildDescription(items: NewsItem[]): string {
  return items
    .map((item) => `[${item.source}] ${item.title}\n${item.url}`)
    .join('\n\n');
}
