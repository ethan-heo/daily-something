export interface NewsRssSource {
  category: string;
  sectionId: string;
  subSectionId?: string;
}

export const NEWS_RSS_SOURCES: NewsRssSource[] = [
  {
    category: '경제',
    sectionId: '101',
  },
  {
    category: '사회',
    sectionId: '102',
  },
  {
    category: 'IT',
    sectionId: '105',
  },
  {
    category: '건강',
    sectionId: '103',
  },
  {
    category: '부동산',
    sectionId: '101',
    subSectionId: '260',
  },
];
