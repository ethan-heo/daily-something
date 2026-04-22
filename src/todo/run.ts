import { getTodayInSeoul } from '../shared/date';
import type { NotionTodoItem } from '../types';
import { upsertTodoEvent } from './calendar';
import { queryTodosFromNotion } from './notionClient';

export async function fetchTodayTodos(): Promise<{ date: string; items: NotionTodoItem[] }> {
  const date = getTodayInSeoul();
  const items = await queryTodosFromNotion(date);

  return { date, items };
}

export async function upsertTodoEvents(items: NotionTodoItem[]): Promise<void> {
  for (const item of items) {
    await upsertTodoEvent(item);
  }
}
