import type { Category, Incident, Report, ReportDetail } from '../model/types';
import { db } from '../store/db';
import { rebuildIncidents } from '../engine/collector';
import { getKeys } from '../share/keys';
import { makePeopleReport } from './people';

/** Saves a new people report from this phone (signed with this phone's key). */
export async function reportWhatISee(input: {
  category: Category;
  lat: number;
  lon: number;
  note: string;
  detail?: ReportDetail;
}): Promise<Report> {
  const r = await makePeopleReport({ ...input, stance: 'seen' }, await getKeys());
  await db.reports.put(r);
  await rebuildIncidents();
  return r;
}

/** "I see it too" / "It's gone" on an existing event: same place, so it joins the same event. */
export async function answer(incident: Incident, stance: 'seen' | 'gone'): Promise<Report> {
  const r = await makePeopleReport(
    {
      category: incident.category,
      lat: incident.place.lat,
      lon: incident.place.lon,
      note: '',
      stance,
      place: incident.sourceIds.includes('crowd') ? incident.place : undefined,
      town: incident.places[1],
    },
    await getKeys(),
  );
  await db.reports.put(r);
  await rebuildIncidents();
  return r;
}
