'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import {
  Locale,
  dirOf,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
  intlLocale,
  pickFor,
  trFor,
  weekdayName,
  withLocale,
} from './locale';

interface Ctx {
  locale: Locale;
  arabicIndic: boolean;
  currency: string;
}
const LocaleContext = createContext<Ctx>({ locale: 'fr', arabicIndic: false, currency: 'EUR' });

export function LocaleProvider({
  locale,
  arabicIndic = false,
  currency = 'EUR',
  children,
}: {
  locale: Locale;
  arabicIndic?: boolean;
  currency?: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, arabicIndic, currency }), [locale, arabicIndic, currency]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Tout ce qu'il faut pour afficher du texte, des dates et des montants dans la langue courante. */
export function useLocale() {
  const { locale, arabicIndic, currency: defaultCurrency } = useContext(LocaleContext);
  const loc = intlLocale(locale, arabicIndic);
  const t = useMemo(() => trFor(locale), [locale]);
  const pick = useMemo(() => pickFor(locale), [locale]);
  const href = useCallback((p: string) => withLocale(locale, p), [locale]);
  return useMemo(
    () => ({
      locale,
      loc,
      dir: dirOf(locale),
      isAr: locale === 'ar',
      t,
      pick,
      href,
      date: (v?: string | Date | null, style?: 'short' | 'medium' | 'long') => formatDate(v, loc, style),
      dateTime: (v?: string | Date | null) => formatDateTime(v, loc),
      currency: defaultCurrency,
      money: (c?: number | null, currency?: string) => formatMoney(c, loc, currency || defaultCurrency),
      num: (n?: number | null) => formatNumber(n, loc),
      time: (v?: string | null) => formatTime(v, loc),
      weekday: (iso: number, style: 'long' | 'short' = 'long') => weekdayName(iso, loc, style),
    }),
    [locale, loc, t, pick, href, defaultCurrency],
  );
}
