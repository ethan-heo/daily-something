const REQUEST_TIMEOUT_MS = 15000;

export const DEFAULT_REQUEST_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

export async function fetchHtml(url: string, charsetFallback = 'utf-8'): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_REQUEST_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type');
    const charset = normalizeCharset(extractCharset(contentType) || charsetFallback);

    try {
      return new TextDecoder(charset).decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function extractAttribute(tag: string, attributeName: string): string {
  const escapedAttributeName = escapeRegExp(attributeName);
  const match = tag.match(new RegExp(`\\b${escapedAttributeName}\\s*=\\s*(['"])(.*?)\\1`, 'i'));
  return match?.[2] ?? '';
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function stripHtmlTags(value: string): string {
  return value.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

export function normalizeDate(value: string): string | null {
  const match = value.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
  if (!match) return null;

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

export function extractTableRows(html: string): string[] {
  return [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

export function extractTableCells(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)].map((match) => match[0]);
}

export function toText(html: string): string {
  return normalizeWhitespace(stripHtmlTags(decodeHtmlEntities(html)));
}

function extractCharset(contentType: string | null): string | null {
  if (!contentType) return null;

  const match = contentType.match(/charset=([^;]+)/i);
  return match?.[1]?.trim() ?? null;
}

function normalizeCharset(charset: string): string {
  const normalized = charset.toLowerCase();

  if (normalized === 'ks_c_5601-1987' || normalized === 'ksc5601') {
    return 'euc-kr';
  }

  return normalized;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
