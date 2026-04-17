import type { RawWordEntry, WordEntry } from '../../types';
import { buildFormattingPrompt, type Language } from './prompt';

interface ClaudeFormattedEntry {
  pronunciation: string;
  example: string;
  exampleTranslation: string;
  examplePronunciation: string;
}

export async function generateFormatted(items: RawWordEntry[], language: Language): Promise<WordEntry[]> {
  if (items.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 2400,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: buildFormattingPrompt(items, language),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = data.content?.find((item) => item.type === 'text')?.text?.trim();
  if (!text) {
    throw new Error('Anthropic response did not contain text content');
  }

  const parsed = JSON.parse(extractJsonArray(text)) as ClaudeFormattedEntry[];
  return mergeFormattedEntries(items, parsed);
}

export function mergeFormattedEntries(items: RawWordEntry[], formatted: ClaudeFormattedEntry[]): WordEntry[] {
  if (formatted.length !== items.length) {
    throw new Error(`Formatted response length mismatch: expected ${items.length}, got ${formatted.length}`);
  }

  return items.map((item, index) => ({
    ...item,
    pronunciation: formatted[index]?.pronunciation?.trim() || '',
    example: formatted[index]?.example?.trim() || '',
    exampleTranslation: formatted[index]?.exampleTranslation?.trim() || '',
    examplePronunciation: formatted[index]?.examplePronunciation?.trim() || '',
  }));
}

export function extractJsonArray(text: string): string {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');

  if (start === -1 || end === -1 || end < start) {
    throw new Error('Could not find JSON array in generated response');
  }

  return text.slice(start, end + 1);
}
