 import type {
  Assessment,
  Authority,
  Category,
  ConfidenceState,
  Incident,
  PlaceRef,
  Reason,
  Report,
  Source,
} from '../model/types';
import { titleSimilarity } from './normalize';
import { peopleCell } from '../crowd/people';
import { fold } from '../geo/gazetteer';

/** How long (hours) a report of each kind stays current without a new report. */
export const LIFETIME_H: Record<Category, number> = {
  demonstration: 12,
  'road-closure': 24,
  traffic: 6,
  emergency: 24,
  hazard: 48,
  'police-notice': 72,
  'police-presence': 3,
  'official-notice': 168,
  other: 24,
};
const HISTORICAL_AFTER_H = 7 * 24;
/** People reports go stale faster: a checkpoint or crowd moves within hours. */
const PEOPLE_LIFETIME_H = (c: Category) => Math.min(LIFETIME_H[c], 6);
const CONF_ORDER: ConfidenceState[] = ['unverified', 'low', 'moderate', 'high', 'confirmed'];
const stronger = (a: ConfidenceState, b: ConfidenceState) =>
  CONF_ORDER.indexOf(b) > CONF_ORDER.indexOf(a) ? b : a;
const COPY_SIMILARITY = 0.85;

/**
 * Kinds of news where each story is its own event (one arrest, one fire, one crash), so reports are
 * grouped by story rather than by town. Protests, checkpoints and road blocks stay grouped by town.
 */
const STORY_CATS = new Set<Category>(['police-notice', 'official-notice', 'emergency', 'traffic', 'hazard', 'other']);
const STORY_STOP = new Set(
  'policia policise policine polici policie tirane tirana tiranes tiranen shqiperi shqiperise shqiptare sot dje pasi gjate kunder persona personi person shtetas shtetasit video foto lajm fundit ndaj duke ishte eshte jane kane eshte edhe pse kush cila cili mund nese deri prej rreth tjeter tjere disa shume vetem mire'.split(' '),
);
const storyWords = (r: Report) =>
  new Set(
    (fold(r.title).match(/[a-z0-9]+/g) ?? []).filter((w) => (w.length >= 4 || /^\d{2,}$/.test(w)) && !STORY_STOP.has(w)),
  );

/** Same story: same text, or headlines sharing at least two distinctive words. Earthquakes never merge. */
function sameStory(a: Report, b: Report): boolean {
  if (a.contentHash === b.contentHash) return true;
  if (a.sourceId === 'eu.emsc' || b.sourceId === 'eu.emsc') return a.canonicalUrl === b.canonicalUrl;
  if (titleSimilarity(a.title, b.title) >= 0.5) return true;
  const A = storyWords(a);
  const B = storyWords(b);
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared >= 2 && shared / (A.size + B.size - shared) >= 0.25;
}

export function splitByStory(reports: Report[]): Report[][] {
  const parent = reports.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < reports.length; i++)
    for (let j = i + 1; j < reports.length; j++) if (sameStory(reports[i], reports[j])) parent[find(i)] = find(j);
  const groups = new Map<number, Report[]>();
  reports.forEach((r, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), r]));
  return [...groups.values()];
}

/** How many reports name each place, most-named first (landmarks before the bare town on a tie). */
function countPlaces(reports: Report[]): { place: PlaceRef; reports: number }[] {
  const m = new Map<string, { place: PlaceRef; reports: number }>();
  for (const r of reports) {
    // A report counts towards its most specific place only, so "Tirana + Kryeministria" is a Kryeministria report.
    const p = r.places.find((x) => x.precision === 'landmark') ?? r.places[0];
    if (!p) continue;
    const e = m.get(p.gazetteerId) ?? { place: p, reports: 0 };
    e.reports++;
    m.set(p.gazetteerId, e);
  }
  return [...m.values()].sort(
    (a, b) => b.reports - a.reports || Number(b.place.precision === 'landmark') - Number(a.place.precision === 'landmark'),
  );
}

// All landmarks are in Tirana; they group with Tirana city reports.
const TIRANA_ID = 'gn:3183875';
export const cityKey = (p: PlaceRef) => (p.gazetteerId.startsWith('lm:') ? TIRANA_ID : p.gazetteerId);
const eventTime = (r: Report) => Date.parse(r.publishedAt ?? r.collectedAt);
const RANK: Record<Authority, number> = { authoritative: 3, established: 2, other: 1 };

interface Unit {
  key: string;
  authority: Authority;
  reports: Report[];
}

/**
 * Collapses reports into independent "units": one per media family / source,
 * and copies (near-identical titles) across sources are merged into one unit.
 * Imported reports keep their original source, so a shared copy never adds a unit.
 */
export function independentUnits(reports: Report[], sources: Map<string, Source>): Unit[] {
  const units: Unit[] = [];
  const sorted = [...reports].sort((a, b) => eventTime(a) - eventTime(b));
  for (const r of sorted) {
    const src = sources.get(r.sourceId);
    const key = src?.family ?? r.sourceId;
    // Only reports this phone fetched itself carry their source's authority. Shared or pasted
    // reports can't be checked (a bundle could claim to be from the Police), so they rank lowest.
    const authority: Authority = r.provenance.origin === 'collected' ? (src?.authority ?? 'other') : 'other';
    let unit = units.find((u) => u.key === key);
    if (!unit) {
      unit = units.find((u) =>
        u.reports.some((x) => x.contentHash === r.contentHash || titleSimilarity(x.title, r.title) >= COPY_SIMILARITY),
      );
    }
    if (unit) {
      unit.reports.push(r);
      if (RANK[authority] > RANK[unit.authority]) unit.authority = authority;
    } else {
      units.push({ key, authority, reports: [r] });
    }
  }
  return units;
}

function assess(reports: Report[], sources: Map<string, Source>, now: number, category: Category): {
  assessment: Assessment;
  status: Incident['status'];
  place: PlaceRef;
  places: PlaceRef[];
  placeCounts: Incident['placeCounts'];
} {
  const reasons: Reason[] = [];
  const supporting = reports.filter((r) => !r.denial);
  const denials = reports.filter((r) => r.denial);
  const units = independentUnits(supporting, sources);
  const est = units.filter((u) => u.authority === 'established').length;
  const oth = units.filter((u) => u.authority === 'other').length;
  const auth = units.filter((u) => u.authority === 'authoritative').length;
  const copies = supporting.length - units.length;

  let occurred: ConfidenceState;
  if (auth > 0) {
    occurred = 'confirmed';
    reasons.push({ key: 'reason.authoritative', params: { n: auth } });
  } else if (est >= 3) occurred = 'high';
  else if (est === 2) occurred = 'moderate';
  else if (est === 1 || oth >= 2) occurred = 'low';
  else occurred = 'unverified';
  if (auth === 0) reasons.push({ key: 'reason.independent', params: { est, oth } });
  if (copies > 0) reasons.push({ key: 'reason.copies', params: { n: copies } });

  const maxSupport = Math.max(0, ...units.map((u) => RANK[u.authority]));
  const denialUnits = independentUnits(denials, sources);
  let conflict = false;
  if (denialUnits.some((u) => RANK[u.authority] >= maxSupport)) {
    occurred = 'disputed';
    conflict = true;
    reasons.push({ key: 'reason.denied', params: { n: denialUnits.length } });
  } else if (denialUnits.length) {
    conflict = true;
    reasons.push({ key: 'reason.deniedWeak', params: { n: denialUnits.length } });
  }

  // Location: the most specific place, rated by how many independent units name it.
  const placeVotes = new Map<string, { p: PlaceRef; units: Set<string>; auth: boolean }>();
  for (const u of units)
    for (const r of u.reports)
      for (const p of r.places) {
        const v = placeVotes.get(p.gazetteerId) ?? { p, units: new Set(), auth: false };
        v.units.add(u.key);
        if (u.authority === 'authoritative') v.auth = true;
        placeVotes.set(p.gazetteerId, v);
      }
  // Most independent mentions wins; a landmark only wins a tie, so one outlet naming a
  // square doesn't override what most sources say.
  const votes = [...placeVotes.values()].sort(
    (a, b) =>
      b.units.size - a.units.size || Number(b.p.precision === 'landmark') - Number(a.p.precision === 'landmark'),
  );
  const best = votes[0] ?? { p: reports[0].places[0], units: new Set<string>(), auth: false };
  let location: ConfidenceState = best.auth ? 'confirmed' : best.units.size >= 2 ? 'moderate' : 'low';
  if (occurred === 'unverified') location = 'unverified';

  // Time: only reports with a real publication time count.
  const dated = supporting.filter((r) => r.publishedAt);
  let time: ConfidenceState = 'low';
  if (!dated.length) {
    time = 'unverified';
    reasons.push({ key: 'reason.noDate' });
  } else if (dated.every((r) => r.timeApprox)) {
    reasons.push({ key: 'reason.timeApprox' });
  } else if (auth > 0) time = 'confirmed';
  else if (units.length >= 2) {
    const ts = dated.map(eventTime).sort((a, b) => a - b);
    if (ts[ts.length - 1] - ts[0] <= 3 * 3600e3) time = 'moderate';
  }

  // Freshness: active only while a dated report is inside the category lifetime.
  const newestDated = dated.length ? Math.max(...dated.map(eventTime)) : -Infinity;
  const ageH = (now - newestDated) / 3600e3;
  let status: Incident['status'] = 'active';
  if (ageH > HISTORICAL_AFTER_H) status = 'historical';
  else if (ageH > LIFETIME_H[category]) status = 'stale';
  if (status !== 'active' && occurred !== 'disputed') {
    reasons.push({ key: 'reason.stale', params: { h: Math.round(ageH), was: occurred } });
    occurred = 'stale';
  }

  return {
    assessment: {
      occurred,
      conflict,
      location,
      time,
      reasons,
      independentSources: units.length,
      assessedAt: new Date(now).toISOString(),
      method: 'rules-v1',
    },
    status,
    place: best.p,
    places: votes.slice(0, 6).map((v) => v.p),
    placeCounts: countPlaces(supporting.length ? supporting : reports),
  };
}

/**
 * People reports ("I saw police here"). Each phone counts once, using its latest answer.
 * 1 person = unverified, 2 = low, 3+ = moderate. People alone never reach "high" or "confirmed",
 * because one person with several phones could fake confirmations.
 */
function assessPeople(reports: Report[], now: number, category: Category): {
  assessment: Assessment;
  status: Incident['status'];
  place: PlaceRef;
  places: PlaceRef[];
  placeCounts: Incident['placeCounts'];
} {
  const latest = new Map<string, Report>();
  for (const r of [...reports].sort((a, b) => eventTime(a) - eventTime(b))) latest.set(r.reporter?.key ?? r.id, r);
  const answers = [...latest.values()];
  const seenR = answers.filter((r) => r.stance !== 'gone');
  const goneR = answers.filter((r) => r.stance === 'gone');
  const seen = seenR.length;
  const gone = goneR.length;
  const lastSeen = seenR.length ? Math.max(...seenR.map(eventTime)) : -Infinity;
  const lastGone = goneR.length ? Math.max(...goneR.map(eventTime)) : -Infinity;
  const reasons: Reason[] = [{ key: 'reason.people', params: { seen } }];

  let occurred: ConfidenceState = seen >= 3 ? 'moderate' : seen === 2 ? 'low' : 'unverified';
  let conflict = false;
  let status: Incident['status'] = 'active';
  if (gone && lastGone > lastSeen) {
    if (gone >= seen) {
      status = 'stale';
      occurred = 'stale';
      reasons.push({ key: 'reason.goneEnded', params: { gone } });
    } else {
      occurred = 'disputed';
      conflict = true;
      reasons.push({ key: 'reason.peopleConflict', params: { seen, gone } });
    }
  } else if (gone) {
    reasons.push({ key: 'reason.goneOlder', params: { gone } });
  }
  reasons.push({ key: 'reason.peopleLimit' });

  const ageH = (now - Math.max(lastSeen, lastGone)) / 3600e3;
  if (status === 'active' && ageH > PEOPLE_LIFETIME_H(category)) {
    status = ageH > HISTORICAL_AFTER_H ? 'historical' : 'stale';
    reasons.push({ key: 'reason.stale', params: { h: Math.round(ageH), was: occurred } });
    occurred = 'stale';
  }
  const first = reports[0];
  const times = seenR.map(eventTime).sort((a, b) => a - b);
  return {
    assessment: {
      occurred,
      conflict,
      people: { seen, gone },
      location: seen >= 2 ? 'moderate' : seen === 1 ? 'low' : 'unverified',
      time: seen >= 2 && times[times.length - 1] - times[0] <= 3600e3 ? 'moderate' : 'low',
      reasons,
      independentSources: seen,
      assessedAt: new Date(now).toISOString(),
      method: 'rules-v1',
    },
    status,
    place: first.places[0],
    places: first.places,
    placeCounts: [{ place: first.places[0], reports: seenR.length || reports.length }],
  };
}

const isPeople = (r: Report) => r.sourceId === 'crowd';

/**
 * Links people reports with news about the same kind of event in the same town at about the same time:
 * news support can raise a people report; a denial in the news marks it as conflicting.
 */
function crossReference(incidents: Incident[]): void {
  const news = incidents.filter((i) => !i.sourceIds.includes('crowd'));
  for (const p of incidents.filter((i) => i.sourceIds.includes('crowd'))) {
    const town = p.places[1] ?? p.places[0];
    const match = news.find(
      (n) =>
        n.category === p.category &&
        cityKey(n.place) === cityKey(town) &&
        Math.abs(Date.parse(n.lastSeen) - Date.parse(p.lastSeen)) < 6 * 3600e3,
    );
    if (!match) continue;
    const a = p.assessment;
    if (match.assessment.occurred === 'disputed' || match.assessment.conflict) {
      a.conflict = true;
      a.reasons.push({ key: 'reason.newsDisputes', params: { place: match.place.name } });
    } else if (['low', 'moderate', 'high', 'confirmed'].includes(match.assessment.occurred)) {
      a.reasons.push({ key: 'reason.newsAlso', params: { n: match.assessment.independentSources, place: match.place.name } });
      if (a.occurred !== 'stale' && a.occurred !== 'disputed')
        a.occurred = stronger(a.occurred, match.assessment.occurred === 'confirmed' ? 'high' : match.assessment.occurred);
    }
    match.assessment.reasons.push({ key: 'reason.peopleAlso', params: { seen: a.people?.seen ?? 0 } });
  }
}

/** Groups located, categorised reports into incidents and rates each one. */
export function buildIncidents(reports: Report[], sourceList: Source[], now = Date.now()): Incident[] {
  const sources = new Map(sourceList.map((s) => [s.id, s]));
  const groups = new Map<string, Report[]>();
  for (const r of reports) {
    if (r.category === 'other' || !r.places.length) continue;
    // People reports group by ~1 km cell; news by town (all Tirana landmarks count as Tirana).
    const key = isPeople(r) ? `${r.category}|people:${peopleCell(r.places[0])}` : `${r.category}|${cityKey(r.places[0])}`;
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  const out: Incident[] = [];
  for (const [key, list] of groups) {
    const category = key.split('|')[0] as Category;
    const people = key.includes('|people:');
    const gapMs = (people ? PEOPLE_LIFETIME_H(category) : LIFETIME_H[category]) * 3600e3;
    list.sort((a, b) => eventTime(a) - eventTime(b));
    let cluster: Report[] = [];
    const flush = () => {
      if (!cluster.length) return;
      const parts = !people && STORY_CATS.has(category) ? splitByStory(cluster) : [cluster];
      for (const part of parts) emit(part);
      cluster = [];
    };
    const emit = (cluster: Report[]) => {
      const { assessment, status, place, places, placeCounts } = people
        ? assessPeople(cluster, now, category)
        : assess(cluster, sources, now, category);
      const lead =
        [...cluster].sort(
          (a, b) =>
            RANK[sources.get(b.sourceId)?.authority ?? 'other'] - RANK[sources.get(a.sourceId)?.authority ?? 'other'] ||
            eventTime(a) - eventTime(b),
        )[0];
      out.push({
        id: `${category}:${cluster[0].id}`,
        category,
        place,
        places,
        placeCounts,
        title: lead.title,
        firstSeen: new Date(eventTime(cluster[0])).toISOString(),
        lastSeen: new Date(eventTime(cluster[cluster.length - 1])).toISOString(),
        reportIds: cluster.map((r) => r.id),
        sourceIds: [...new Set(cluster.map((r) => r.sourceId))],
        assessment,
        status,
      });
    };
    for (const r of list) {
      if (cluster.length && eventTime(r) - eventTime(cluster[cluster.length - 1]) > gapMs) flush();
      cluster.push(r);
    }
    flush();
  }
  crossReference(out);
  return out.sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
}
