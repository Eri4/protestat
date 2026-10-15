<script lang="ts">
  import type { Category, Incident, Report } from '../model/types';
  import { app } from '../app.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { fold } from '../geo/gazetteer';
  import { CAT_ICON } from './meta';
  import IncidentCard from './IncidentCard.svelte';
  import ReportRow from './ReportRow.svelte';

  let {
    onopen,
    onsharereport,
    onreport,
    onguide,
    ongoto,
  }: {
    onopen: (i: Incident) => void;
    onsharereport: (r: Report) => void;
    onreport: () => void;
    onguide: (id: string) => void;
    ongoto: (tab: 'sources' | 'share') => void;
  } = $props();

  let mode = $state<'events' | 'all'>('events');
  let hours = $state(24);
  let cat = $state<Category | 'all'>('all');
  let q = $state('');
  let showOld = $state(false);
  let onlyAB = $state(false);
  const tierOf = $derived(new Map(app.sources.map((s) => [s.id, s.tier])));
  const trusted = (sourceId: string) => ['A', 'B'].includes(tierOf.get(sourceId) ?? 'D');

  const CATS: (Category | 'all')[] = ['all', 'demonstration', 'police-presence', 'road-closure', 'emergency', 'traffic', 'hazard', 'police-notice', 'official-notice'];
  const TIMES = [
    [2, 'time.2h'],
    [12, 'time.12h'],
    [24, 'time.24h'],
    [168, 'time.7d'],
  ] as const;

  const matches = (text: string) => !q.trim() || fold(text).includes(fold(q.trim()));
  const since = $derived(Date.now() - hours * 3600e3);

  const incidents = $derived(
    app.incidents.filter(
      (i) =>
        (showOld || i.status === 'active') &&
        Date.parse(i.lastSeen) >= since &&
        (cat === 'all' || i.category === cat) &&
        (!onlyAB || i.sourceIds.some(trusted)) &&
        matches(`${i.title} ${i.place.name}`),
    ),
  );
  const reports = $derived(
    app.reports
      .filter(
        (r) =>
          Date.parse(r.publishedAt ?? r.collectedAt) >= since &&
          (cat === 'all' || r.category === cat) &&
          (!onlyAB || trusted(r.sourceId)) &&
          matches(`${r.title} ${r.summary} ${r.sourceName} ${r.places.map((p) => p.name).join(' ')}`),
      )
      .slice(0, 300),
  );
</script>

<div class="page">
  <p class="intro pad">{t('intro.news')} <button class="hl" onclick={() => onguide('read')}>{t('help.how')}</button></p>
  <div class="seg pad" role="tablist">
    <button role="tab" aria-selected={mode === 'events'} onclick={() => (mode = 'events')}>{t('news.events')}</button>
    <button role="tab" aria-selected={mode === 'all'} onclick={() => (mode = 'all')}>{t('news.all')}</button>
  </div>

  <div class="pad search">
    <input class="input" type="search" placeholder={t('news.search')} bind:value={q} aria-label={t('news.search')} />
  </div>

  <div class="chips" aria-label="time">
    {#each TIMES as [h, key]}
      <button class="chip" aria-pressed={hours === h} onclick={() => (hours = h)}>{t(key)}</button>
    {/each}
  </div>
  <div class="chips" aria-label="category">
    {#each CATS as c}
      <button class="chip" aria-pressed={cat === c} onclick={() => (cat = c)}>
        {c === 'all' ? t('cat.all') : `${CAT_ICON[c]} ${t(`cat.${c}`)}`}
      </button>
    {/each}
  </div>

  {#if mode === 'events'}
    <div class="pad list">
      {#each incidents as i (i.id)}
        <IncidentCard incident={i} {onopen} />
      {:else}
        <p class="empty muted">{t('news.emptyEvents')}</p>
      {/each}
      <label class="old small muted">
        <input type="checkbox" bind:checked={showOld} />
        {t('news.showStale')}
      </label>
      <label class="old small muted">
        <input type="checkbox" bind:checked={onlyAB} />
        {t('news.minTier')}
      </label>
    </div>
  {:else}
    <div class="rows">
      {#each reports as r (r.id)}
        <ReportRow report={r} onshare={onsharereport} />
      {:else}
        <p class="empty muted pad">{t('news.emptyAll')}</p>
      {/each}
    </div>
  {/if}
  <section class="tip card">
    <strong>🎯 {t('more.title')}</strong>
    <p>{t('more.text')}</p>
    <div class="tip-actions">
      <button class="btn small" onclick={() => ongoto('share')}>📥 {t('share.receive')}</button>
      <button class="btn small" onclick={() => ongoto('sources')}>📡 {t('nav.sources')}</button>
      <button class="btn small" onclick={onreport}>📣 {t('report.button')}</button>
      <button class="btn small" onclick={() => onguide('accuracy')}>{t('help.more')}</button>
    </div>
  </section>
</div>

<button class="fab" onclick={onreport}>＋ {t('report.button')}</button>

<style>
  .seg {
    display: flex;
    gap: 6px;
    margin: 12px 0 10px;
  }
  .seg button {
    flex: 1;
    min-height: 44px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-weight: 650;
    cursor: pointer;
  }
  .seg button[aria-selected='true'] {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .search {
    margin-bottom: 10px;
  }
  .chips {
    margin-bottom: 8px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 6px;
  }
  .rows {
    margin-top: 6px;
    border-top: 1px solid var(--line);
  }
  .empty {
    text-align: center;
    padding: 32px 16px;
  }
  .old {
    display: flex;
    gap: 8px;
    align-items: center;
    min-height: 44px;
  }
  .old input {
    width: 20px;
    height: 20px;
  }
  .intro {
    margin: 12px 0 0;
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }
  .hl {
    border: none;
    background: none;
    padding: 0;
    color: var(--focus);
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
  }
  .tip {
    margin: 20px 16px 90px;
    padding: 14px 16px;
  }
  .tip p {
    margin: 6px 0 10px;
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }
  .tip-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .fab {
    position: fixed;
    right: max(16px, calc(50vw - 364px));
    bottom: calc(76px + var(--safe-bottom));
    z-index: 20;
    min-height: 52px;
    padding: 0 20px;
    border-radius: 999px;
    border: none;
    background: var(--accent);
    color: #fff;
    font-weight: 800;
    font-size: var(--fs-md);
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.3);
    cursor: pointer;
  }
</style>
