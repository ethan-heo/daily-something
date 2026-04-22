import type { NotionTodoItem } from '../types';
import { upsertAllDayCalendarEvent, upsertTimedCalendarEvent } from '../shared/googleCalendar';

export async function upsertTodoEvent(item: NotionTodoItem): Promise<void> {
  const calendarId = process.env.ETHAN_CALENDAR_ID;

  if (!calendarId) {
    throw new Error('ETHAN_CALENDAR_ID is required');
  }

  if (!item.endDateTime) {
    await upsertAllDayCalendarEvent({
      calendarId,
      eventId: buildTodoEventId(item.pageId),
      summary: item.title,
      date: extractDate(item.startDateTime),
      attendeeEmail: process.env.ATTENDEE_EMAIL,
      description: item.pageUrl,
    });
    return;
  }

  await upsertTimedCalendarEvent({
    calendarId,
    eventId: buildTodoEventId(item.pageId),
    summary: item.title,
    startDateTime: item.startDateTime,
    endDateTime: item.endDateTime,
    attendeeEmail: process.env.ATTENDEE_EMAIL,
    description: item.pageUrl,
  });
}

function buildTodoEventId(pageId: string): string {
  return `notion${pageId.replace(/-/g, '').toLowerCase()}`;
}

function extractDate(dateTime: string): string {
  return dateTime.slice(0, 10);
}
