'use server';

import {cookies, headers} from 'next/headers';
import {locales, defaultLocale, type Locale} from '@/i18n/config';

const COOKIE_NAME = 'NEXT_LOCALE';

function negotiateLocale(acceptLanguage: string): Locale {
  try {
    const ranges = acceptLanguage
      .split(',')
      .map((part) => {
        const [tagPart, qPart] = part.trim().split(';');
        const q = qPart ? Number(qPart.split('=')[1]) || 1 : 1;
        return {tag: tagPart.toLowerCase(), q};
      })
      .sort((a, b) => b.q - a.q);

    for (const {tag} of ranges) {
      if (tag === '*') continue;
      // Try exact match first
      const exact = locales.find((l) => l.toLowerCase() === tag);
      if (exact) return exact;
      // Try language-only match (e.g., en-US -> en)
      const base = tag.split('-')[0];
      const baseMatch = locales.find((l) => l.toLowerCase() === base);
      if (baseMatch) return baseMatch;
    }
  } catch {}
  return defaultLocale;
}

export async function getUserLocale(): Promise<Locale> {
  const c = await cookies();
  const fromCookie = c.get(COOKIE_NAME)?.value as Locale | undefined;
  if (fromCookie && locales.includes(fromCookie)) return fromCookie;

  const h = await headers();
  const accept = h.get('accept-language') || '';
  return negotiateLocale(accept);
}

export async function setUserLocale(locale: Locale): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, locale, {
    path: '/',
    // 1 year persistence
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  });
}
