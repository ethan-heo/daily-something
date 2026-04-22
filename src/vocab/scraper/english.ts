import type { Page } from 'playwright';
import type { RawWordEntry } from '../../types';
import { scrapeNaverWords } from './naverWords';

const URL = 'https://search.naver.com/search.naver?where=nexearch&query=%EC%98%A4%EB%8A%98%EC%9D%98+%EC%98%81%EB%8B%A8%EC%96%B4';

export async function scrapeEnglishWords(page: Page): Promise<RawWordEntry[]> {
  return scrapeNaverWords(page, URL);
}
