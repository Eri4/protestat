import type { Incident, Report } from '../model/types';
import { ago, t } from '../i18n/i18n.svelte';
import { LIFETIME_H } from '../engine/incidents';

export const isPeopleIncident = (i: Incident) => i.sourceIds.includes('crowd');

/**
 * Plain-language sentences for an event, most important first:
 * who reports what and where · whether anyone official confirmed it · how old it is · any conflict.
 */
export function explain(i: Incident, reports: Report[]): string[] {
  const what = t(`explain.what.${i.category}`);
  const place = i.place.name;
  const out: string[] = [];
  const a = i.assessment;

  if (isPeopleIncident(i) && a.people) {
    const n = a.people.seen;
    out.push(n === 1 ? t('explain.onePerson', { what, place }) : t('explain.people', { n, what, place }));
  } else if (a.independentSources === 1) {
    const src = reports.find((r) => r.sourceId === i.sourceIds[0])?.sourceName ?? reports[0]?.sourceName ?? '';
    out.push(t('explain.oneSource', { source: src, what, place }));
  } else {
    out.push(t('explain.sources', { n: a.independentSources, what, place }));
  }

  if (a.reasons.some((r) => r.key === 'reason.authoritative')) out.push(t('explain.confirmed'));
  else if (isPeopleIncident(i) && !a.reasons.some((r) => r.key === 'reason.newsAlso')) out.push(t('explain.peopleOnly'));
  else out.push(t('explain.notConfirmed'));

  if (a.reasons.some((r) => r.key === 'reason.goneEnded')) out.push(t('explain.ended'));
  else if (i.status === 'active') out.push(t('explain.fresh', { ago: ago(i.lastSeen) }));
  else out.push(t('explain.old', { ago: ago(i.lastSeen) }));

  if (a.conflict || a.occurred === 'disputed') out.push(t('explain.conflict'));
  return out;
}

export type AgeLevel = 'fresh' | 'recent' | 'old';

/** "New" under 1 hour, "Recent" while still current, "Old" after the event type's lifetime. */
export function ageInfo(i: Incident): { level: AgeLevel; label: string } {
  const h = (Date.now() - Date.parse(i.lastSeen)) / 3600e3;
  const life = isPeopleIncident(i) ? Math.min(LIFETIME_H[i.category], 6) : LIFETIME_H[i.category];
  const level: AgeLevel = i.status !== 'active' || h > life ? 'old' : h < 1 ? 'fresh' : 'recent';
  return { level, label: `${t(`age.${level}`)} · ${ago(i.lastSeen)}` };
}
