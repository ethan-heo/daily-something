import { google } from 'googleapis';
import type { DailyWords, WordEntry } from '../types';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export async function upsertCalendarEvent(words: DailyWords): Promise<void> {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const calendarId = process.env.CALENDAR_ID;

  if (!keyJson && !keyFile) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_PATH is required');
  if (!calendarId) throw new Error('CALENDAR_ID is required');

  const authOptions = keyJson
    ? { credentials: JSON.parse(keyJson) as object, scopes: SCOPES }
    : { keyFile: keyFile!, scopes: SCOPES };

  const auth = new google.auth.GoogleAuth(authOptions);

  const calendar = google.calendar({ version: 'v3', auth });
  const eventId = `vocab${words.date.replace(/-/g, '')}`;
  const attendeeEmail = process.env.ATTENDEE_EMAIL;

  const event = {
    summary: `📚 오늘의 단어 (${words.date})`,
    start: { date: words.date },
    end: { date: getNextDate(words.date) },
    attendees: attendeeEmail ? [{ email: attendeeEmail }] : undefined,
    description: buildDescription(words),
  };

  try {
    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: event,
    });
  } catch (error) {
    const status = (error as { code?: number }).code;
    if (status !== 404) throw error;

    await calendar.events.insert({
      calendarId,
      requestBody: {
        id: eventId,
        ...event,
      },
    });
  }
}

function buildDescription(words: DailyWords): string {
  const english = words.english.map((entry) => formatEntry(entry)).join('\n\n');
  const japanese = words.japanese.map((entry) => formatEntry(entry)).join('\n\n');

  return [english, '────────────────', japanese].filter(Boolean).join('\n\n');
}

function formatEntry(entry: WordEntry): string {
  return [
    `📌 ${entry.word} (${entry.pronunciation})`,
    `의미: ${entry.meaning}`,
    '',
    `${entry.example}`,
    `${entry.examplePronunciation}`,
    `해석: ${entry.exampleTranslation}`,
  ].join('\n');
}

function getNextDate(date: string): string {
  const next = new Date(`${date}T00:00:00+09:00`);
  next.setDate(next.getDate() + 1);

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(next);
}
