export interface NewsItem {
  title: string;
  url: string;
  source: string;
  category?: string;
  publishedAt?: string;
}

export interface NewsLink {
  title: string;
  url: string;
  source?: string;
  category?: string;
}

export interface RawWordEntry {
  word: string;
  meaning: string;
}

export interface WordEntry {
  word: string;
  meaning: string;
  pronunciation: string;
  example: string;
  exampleTranslation: string;
  examplePronunciation: string;
}

export interface DailyWords {
  date: string;
  english: WordEntry[];
  japanese: WordEntry[];
}

export interface NotionTodoItem {
  pageId: string;
  title: string;
  status: string;
  startDateTime: string;
  endDateTime?: string;
  pageUrl: string;
}
