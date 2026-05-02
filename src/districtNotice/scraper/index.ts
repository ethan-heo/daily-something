import type { NewsItem } from '../../types';
import { scrapeNowon } from './nowon';
import { scrapeSeoulMediahub } from './seoulMediahub';
import { fetchYp21Bbs } from './yp21';

export interface DistrictNoticeSource {
  name: string;
  scrape: (targetDate: string) => Promise<NewsItem[]>;
}

export interface DistrictNoticeCategory {
  name: string;
  eventKey: string;
  sources: DistrictNoticeSource[];
}

export const DISTRICT_NOTICE_CATEGORIES: DistrictNoticeCategory[] = [
  {
    name: '노원',
    eventKey: 'noron',
    sources: [{ name: '노원구', scrape: scrapeNowon }],
  },
  {
    name: '양평',
    eventKey: 'angpeng',
    sources: [
      {
        name: '강하면 공지사항',
        scrape: (date) => fetchYp21Bbs({ bbsNo: 206, key: 128, source: '강하면 공지사항', targetDate: date }),
      },
      {
        name: '이장 공문함',
        scrape: (date) => fetchYp21Bbs({ bbsNo: 207, key: 129, source: '이장 공문함', targetDate: date }),
      },
      {
        name: '양평 공지사항',
        scrape: (date) => fetchYp21Bbs({ bbsNo: 1, key: 130, source: '양평 공지사항', targetDate: date }),
      },
    ],
  },
  {
    name: '서울시',
    eventKey: 'seoul',
    sources: [{ name: '서울 미디어허브', scrape: scrapeSeoulMediahub }],
  },
];
