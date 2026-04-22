import { Client, collectPaginatedAPI, isFullPage, type PageObjectResponse } from '@notionhq/client';
import type { NotionTodoItem } from '../types';

const DEFAULT_DATE_PROPERTY = '날짜';
const DEFAULT_STATUS_PROPERTY = 'Status';
const DEFAULT_TODO_STATUSES = ['할 일', '진행 중'];

export async function queryTodosFromNotion(date: string): Promise<NotionTodoItem[]> {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_TODO_DATABASE_ID;

  if (!apiKey) {
    throw new Error('NOTION_API_KEY is required');
  }

  if (!databaseId) {
    throw new Error('NOTION_TODO_DATABASE_ID is required');
  }

  const notion = new Client({ auth: apiKey });
  const dataSourceId = await resolveDataSourceId(notion, databaseId);
  const statusProperty = process.env.NOTION_STATUS_PROPERTY || DEFAULT_STATUS_PROPERTY;
  const dateProperty = process.env.NOTION_DATE_PROPERTY || DEFAULT_DATE_PROPERTY;
  const todoStatusValues = getTodoStatusValues();

  const results = await collectPaginatedAPI(notion.dataSources.query, {
    data_source_id: dataSourceId,
    result_type: 'page',
    filter: {
      and: [
        {
          or: todoStatusValues.map((status) => ({
            property: statusProperty,
            status: {
              equals: status,
            },
          })),
        },
        {
          property: dateProperty,
          date: {
            is_not_empty: true,
          },
        },
        {
          property: dateProperty,
          date: {
            on_or_before: date,
          },
        },
        {
          property: dateProperty,
          date: {
            on_or_after: date,
          },
        },
      ],
    },
  });

  return results
    .filter(isFullPage)
    .map((page) => mapPageToTodoItem(page, dateProperty))
    .filter((item): item is NotionTodoItem => item !== null);
}

async function resolveDataSourceId(notion: Client, databaseId: string): Promise<string> {
  const database = await notion.databases.retrieve({ database_id: databaseId });

  if (!('data_sources' in database) || database.data_sources.length === 0) {
    throw new Error(`No data source found for Notion database: ${databaseId}`);
  }

  return database.data_sources[0].id;
}

function mapPageToTodoItem(page: PageObjectResponse, datePropertyName: string): NotionTodoItem | null {
  const title = extractTitle(page);
  const dateRange = page.properties[datePropertyName];

  if (!dateRange || dateRange.type !== 'date' || !dateRange.date?.start) {
    return null;
  }

  return {
    pageId: page.id,
    title,
    startDateTime: dateRange.date.start,
    endDateTime: dateRange.date.end ?? undefined,
    pageUrl: page.url,
  };
}

function getTodoStatusValues(): string[] {
  const configuredValues = process.env.NOTION_TODO_STATUS_VALUES;

  if (!configuredValues) {
    return DEFAULT_TODO_STATUSES;
  }

  return configuredValues
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractTitle(page: PageObjectResponse): string {
  const titleProperty = Object.values(page.properties).find(
    (property): property is Extract<PageObjectResponse['properties'][string], { type: 'title' }> =>
      property.type === 'title',
  );

  const title = titleProperty?.title.map((item) => item.plain_text).join('').trim();

  if (!title) {
    throw new Error(`Page "${page.id}" is missing a title`);
  }

  return title;
}
