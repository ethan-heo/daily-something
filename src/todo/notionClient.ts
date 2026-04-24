import { Client, collectPaginatedAPI, isFullPage, type PageObjectResponse } from '@notionhq/client';
import type { NotionTodoItem } from '../types';

const DEFAULT_DATE_PROPERTY = '날짜';
const DEFAULT_STATUS_PROPERTY = 'Status';
const DEFAULT_TODO_STATUSES = ['할 일', '진행 중'];
const TODO_STATUS = '할 일';
const IN_PROGRESS_STATUS = '진행 중';

export async function queryTodosFromNotion(date: string): Promise<NotionTodoItem[]> {
  const notion = createNotionClient();
  const dataSourceId = await resolveDataSourceId(notion, getTodoDatabaseId());
  const statusProperty = getStatusPropertyName();
  const dateProperty = getDatePropertyName();
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
    .map((page) => mapPageToTodoItem(page, dateProperty, statusProperty))
    .filter((item): item is NotionTodoItem => item !== null);
}

export async function markTodoInProgress(pageId: string): Promise<void> {
  const notion = createNotionClient();
  const statusProperty = getStatusPropertyName();

  await notion.pages.update({
    page_id: pageId,
    properties: {
      [statusProperty]: {
        status: {
          name: IN_PROGRESS_STATUS,
        },
      },
    },
  });
}

async function resolveDataSourceId(notion: Client, databaseId: string): Promise<string> {
  const database = await notion.databases.retrieve({ database_id: databaseId });

  if (!('data_sources' in database) || database.data_sources.length === 0) {
    throw new Error(`No data source found for Notion database: ${databaseId}`);
  }

  return database.data_sources[0].id;
}

function mapPageToTodoItem(
  page: PageObjectResponse,
  datePropertyName: string,
  statusPropertyName: string,
): NotionTodoItem | null {
  const title = extractTitle(page);
  const dateRange = page.properties[datePropertyName];
  const status = extractStatus(page, statusPropertyName);

  if (!dateRange || dateRange.type !== 'date' || !dateRange.date?.start || !status) {
    return null;
  }

  return {
    pageId: page.id,
    title,
    status,
    startDateTime: dateRange.date.start,
    endDateTime: dateRange.date.end ?? undefined,
    pageUrl: page.url,
  };
}

function extractStatus(page: PageObjectResponse, statusPropertyName: string): string | null {
  const statusProperty = page.properties[statusPropertyName];

  if (!statusProperty || statusProperty.type !== 'status' || !statusProperty.status?.name) {
    return null;
  }

  return statusProperty.status.name;
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

function getTodoDatabaseId(): string {
  const databaseId = process.env.NOTION_TODO_DATABASE_ID;

  if (!databaseId) {
    throw new Error('NOTION_TODO_DATABASE_ID is required');
  }

  return databaseId;
}

function getDatePropertyName(): string {
  return process.env.NOTION_DATE_PROPERTY || DEFAULT_DATE_PROPERTY;
}

function getStatusPropertyName(): string {
  return process.env.NOTION_STATUS_PROPERTY || DEFAULT_STATUS_PROPERTY;
}

function createNotionClient(): Client {
  const apiKey = process.env.NOTION_API_KEY;

  if (!apiKey) {
    throw new Error('NOTION_API_KEY is required');
  }

  return new Client({ auth: apiKey });
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
