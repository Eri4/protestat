<script lang="ts">
  import type { Incident, Report } from '../model/types';
  import { app, load, toast } from '../app.svelte';
  import { t, when } from '../i18n/i18n.svelte';
  import { shareText, telegramShareUrl } from '../share/io';
  import { answer } from '../crowd/actions';
  import { cityKey } from '../engine/incidents';
  import AgeChip from './AgeChip.svelte';
  import Badge from './Badge.svelte';
  import Sheet from './Sheet.svelte';
  import { explain, isPeopleIncident } from './explain';
  import { CAT_COLOR, CAT_ICON, placeLabel } from './meta';

  let {
    incident: initial,
    onclose,
    onsharereport,
    onguide,
  }: { incident: Incident; onclose: () => void; onsharereport: (r: Report) => void; onguide: (id: string) => void } = $props();

  // Follow the live version: the rating changes when someone confirms or new reports arrive.
  const incident = $derived(
    app.incidents.find((x) => x.id === initial.id) ??
      app.incidents.find((x) => x.reportIds.some((id) => initial.reportIds.includes(id)) && x.category === initial.category) ??
      initial,
  );
  let busy = $state(false);
  async function say(stance: 'seen' | 'gone') {
    busy = true;
    try {
      await answer(incident, stance);
      await load();
      toast(t('detail.thanks'));
    } finally {
      busy = false;
    }
  }

  const time = (r: Report) => Date.parse(r.publishedAt ?? r.collectedAt);
  // Newest first: what is the latest anyone has said about it?
  const reports = $derived(app.reports.filter((r) => incident.reportIds.includes(r.id)).sort((a, b) => time(b) - time(a)));
  // Events people can see with their own eyes can be confirmed or marked as gone.
  const answerable = $derived(['demonstration', 'police-presence', 'road-closure', 'emergency', 'traffic'].includes(incident.category));
  // People answers that belong to this event: its own reports, or (for news events) people reports
  // of the same kind in the same town within 6 hours.
  const peopleAnswers = $derived(
    app.reports.filter(
      (r) =>
        r.sourceId === 'crowd' &&
        r.category === incident.category &&
        (incident.reportIds.includes(r.id) ||
          (!incident.sourceIds.includes('crowd') &&
            cityKey(r.places[1] ?? r.places[0]) === cityKey(incident.place) &&
            Math.abs(time(r) - Date.parse(incident.lastSeen)) < 6 * 3600e3)),
    ),
  );
  const mine = $derived(peopleAnswers.filter((r) => r.reporter?.key === app.myKey).sort((a, b) => time(b) - time(a))[0]);
  const peopleCounts = $derived.by(() => {
    const latest = new Map<string, Report>();
    for (const r of [...peopleAnswers].sort((a, b) => time(a) - time(b))) latest.set(r.reporter?.key ?? r.id, r);
    const v = [...latest.values()];
    return { seen: v.filter((r) => r.stance !== 'gone').length, gone: v.filter((r) => r.stance === 'gone').length };
  });
  const lead = $derived(reports.find((r) => r.title === incident.title) ?? reports[0]);
  const text = $derived(
    t('share.reportText', {
      title: incident.title,
      conf: t(`conf.${incident.assessment.occurred}`),
      place: placeLabel(incident.place),
      source: lead?.sourceName ?? '',
    }),
  );
</script>

<Sheet title={t('detail.title')} {onclose}>
  <div class="stack">
    <div class="head">
      <div class="cat" style:color={CAT_COLOR[incident.category]}>{CAT_ICON[incident.category]} {t(`cat.${incident.category}`)}</div>
      <h3>{incident.title}</h3>
      <div class="muted small">📍 {placeLabel(incident.place)} · 🕒 {when(incident.firstSeen)}–{when(incident.lastSeen)}</div>
      <div class="muted small">📰 {t('detail.summary', { n: reports.length, s: incident.assessment.independentSources })}</div>
      {#if (incident.places ?? []).length > 1}
        <div class="muted small">{t('detail.places')}: {incident.places.map((p) => p.name).join(', ')}</div>
      {/if}
      <div class="chips-row"><AgeChip {incident} /></div>
    </div>

    <section class="explain card" class:warn={incident.assessment.conflict || incident.status !== 'active'}>
      <div class="ex-title">💬 {t('explain.title')}</div>
      {#each explain(incident, reports) as line}<p>{line}</p>{/each}
      <button class="link" onclick={() => onguide('read')}>{t('help.how')} →</button>
    </section>

    {#if answerable}
      <section class="answer card">
        <p class="small">{t('detail.peopleHelp')}</p>
        {#if peopleCounts.seen || peopleCounts.gone}
          <p class="counts">👍 {peopleCounts.seen} · 👋 {peopleCounts.gone}</p>
        {/if}
        {#if mine}<p class="xs muted">{mine.stance === 'gone' ? t('detail.youGone') : t('detail.youSeen')}</p>{/if}
        <div class="actions stacked">
          <button class="btn" disabled={busy || mine?.stance === 'seen'} onclick={() => say('seen')}>{t('detail.seeToo')}</button>
          <button class="btn" disabled={busy || mine?.stance === 'gone'} onclick={() => say('gone')}>{t('detail.gone')}</button>
        </div>
      </section>
    {/if}

    {#if (incident.placeCounts ?? []).length}
      <section class="where card">
        <div class="ex-title">📍 {t('detail.where')}</div>
        <ul>
          {#each incident.placeCounts as pc}
            <li>
              <span>{pc.place.precision === 'landmark' ? pc.place.name : t('detail.whereTown', { place: pc.place.name })}</span>
              <strong>{pc.reports === 1 ? t('detail.reports1') : t('detail.reportsN', { n: pc.reports })}</strong>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <div class="facets card">
      <div><span>{t('detail.occurred')}</span><Badge state={incident.assessment.occurred} /></div>
      <div><span>{t('detail.location')}</span><Badge state={incident.assessment.location} /></div>
      <div><span>{t('detail.time')}</span><Badge state={incident.assessment.time} /></div>
    </div>

    <div>
      <div class="section-title" style="margin-left:0">{t('detail.why')}</div>
      <ul class="reasons">
        {#each incident.assessment.reasons as r}
          <li>{t(r.key, { ...r.params, was: r.params?.was ? t(`conf.${r.params.was}`) : '' })}</li>
        {/each}
      </ul>
      <p class="note">{t('detail.automated')}</p>
    </div>

    {#if lead}
      <div class="actions">
        <a class="btn primary" href={telegramShareUrl(lead.url, text)} target="_blank" rel="noopener noreferrer">
          ✈️ {t('share.telegram')}
        </a>
        <button class="btn" onclick={() => shareText(text, lead.url)}>↗ {t('nav.share')}</button>
      </div>
    {/if}

    <div class="section-title" style="margin-left:0">{t('detail.timeline')}</div>
    <ol class="tl">
      {#each reports as r (r.id)}
        <li style:--c={CAT_COLOR[incident.category]}>
          <div class="tl-time">{when(r.publishedAt ?? r.collectedAt)}</div>
          <div class="tl-body">
            <div class="tl-src">
              <strong>{r.sourceName}</strong>
              {#if r.provenance.origin === 'imported'}<span class="tag">{t('detail.imported')}</span>{/if}
              {#if r.provenance.origin === 'user' && !r.reporter}<span class="tag">{t('detail.userLink')}</span>{/if}
              {#if r.stance === 'gone'}<span class="tag deny">{t('detail.gone')}</span>{:else if r.stance === 'seen'}<span class="tag ok">{t('detail.seeToo')}</span>{:else if r.denial}<span class="tag deny">{t('conf.disputed')}</span>{/if}
              {#if r.timeApprox}<span class="tag">≈</span>{/if}
            </div>
            <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
            <button class="tl-share" onclick={() => onsharereport(r)} aria-label={t('nav.share')}>↗</button>
          </div>
        </li>
      {/each}
    </ol>
  </div>
</Sheet>

<style>
  h3 {
    margin: 4px 0;
    font-size: var(--fs-xl);
    line-height: 1.25;
  }
  .cat {
    font-weight: 600;
    color: var(--ink-2);
    font-size: var(--fs-sm);
  }
  .facets {
    padding: 4px 14px;
  }
  .facets > div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .facets > div:last-child {
    border: none;
  }
  .reasons {
    margin: 0 0 8px;
    padding-left: 20px;
  }
  .reasons li {
    margin: 4px 0;
  }
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .actions > * {
    flex: 1;
  }
  .tl {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tl li {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 10px;
    position: relative;
    padding-bottom: 14px;
  }
  .tl li::before {
    content: '';
    position: absolute;
    left: 70px;
    top: 6px;
    bottom: -6px;
    width: 2px;
    background: var(--line);
  }
  .tl li:last-child::before {
    display: none;
  }
  .tl-time {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--ink-2);
    text-align: right;
    padding-top: 1px;
  }
  .tl-body {
    position: relative;
    padding-left: 18px;
    padding-right: 40px;
  }
  .tl-body::before {
    content: '';
    position: absolute;
    left: -6px;
    top: 5px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--c);
    border: 2px solid var(--bg);
  }
  .tl-src {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-size: var(--fs-sm);
  }
  .tl-body a {
    color: var(--ink);
    text-decoration: none;
    font-weight: 550;
    line-height: 1.35;
  }
  .tag {
    font-size: var(--fs-xs);
    background: var(--surface-2);
    padding: 1px 8px;
    border-radius: 999px;
  }
  .tag.deny {
    color: var(--c-disputed);
  }
  .tag.ok {
    color: var(--c-high);
  }
  .chips-row {
    margin-top: 8px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .explain {
    padding: 14px 16px;
    border-left: 5px solid var(--c-moderate);
  }
  .explain.warn {
    border-left-color: var(--c-low);
  }
  .explain p {
    margin: 6px 0 0;
    line-height: 1.45;
  }
  .ex-title {
    font-weight: 800;
  }
  .link {
    margin-top: 8px;
    padding: 0;
    border: none;
    background: none;
    color: var(--focus);
    font-weight: 600;
    cursor: pointer;
    min-height: 32px;
  }
  .answer {
    padding: 14px 16px;
  }
  .where {
    padding: 14px 16px;
  }
  .where ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }
  .where li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
  }
  .where li:last-child {
    border: none;
  }
  .answer p {
    margin: 0 0 10px;
  }
  .counts {
    font-weight: 800;
    font-size: var(--fs-lg);
  }
  .actions.stacked {
    flex-direction: column;
  }
  .tl-share {
    position: absolute;
    right: 0;
    top: -6px;
    width: 40px;
    height: 40px;
    border: none;
    background: none;
    color: var(--ink-2);
    font-size: 1.1rem;
    cursor: pointer;
  }
</style>
