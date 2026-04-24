import { getTodayInSeoul } from '../shared/date';
import type { NotionTodoItem } from '../types';
import { upsertTodoEvent } from './calendar';
import { markTodoInProgress, queryTodosFromNotion } from './notionClient';

const TODO_STATUS = '할 일';

export async function fetchTodayTodos(): Promise<{ date: string; items: NotionTodoItem[] }> {
  const date = getTodayInSeoul();
  const items = await queryTodosFromNotion(date);

  return { date, items };
}

export async function upsertTodoEvents(items: NotionTodoItem[]): Promise<void> {
  for (const item of items) {
    if (item.status === TODO_STATUS) {
      await markTodoInProgress(item.pageId);
      item.status = '진행 중';
    }

    await upsertTodoEvent(item);
  }
}
