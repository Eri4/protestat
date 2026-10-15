import sq from './sq.json';
import en from './en.json';

export type Lang = 'sq' | 'en';
const DICTS: Record<Lang, Record<string, string>> = { sq, en };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'sq' || saved === 'en') return saved;
  } catch {
    /* storage may be unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'sq';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'sq';
}

export const i18n = $state({ lang: initialLang() as Lang });

export function setLang(l: Lang) {
  i18n.lang = l;
  try {
    localStorage.setItem('lang', l);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const s = DICTS[i18n.lang][key] ?? DICTS.sq[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : s;
}

const locale = () => (i18n.lang === 'sq' ? 'sq-AL' : 'en-GB');

export function ago(iso?: string, now = Date.now()): string {
  if (!iso) return t('time.noDate');
  const diff = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return t('ago.now');
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function when(iso?: string): string {
  if (!iso) return t('time.noDate');
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat(locale(), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(sameDay ? {} : { day: 'numeric', month: 'short' }),
  }).format(d);
}
