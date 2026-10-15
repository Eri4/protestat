<script lang="ts">
  import type { Incident } from '../model/types';
  import { app } from '../app.svelte';
  import { t } from '../i18n/i18n.svelte';
  import AgeChip from './AgeChip.svelte';
  import Badge from './Badge.svelte';
  import { explain, isPeopleIncident } from './explain';
  import { CAT_COLOR, CAT_ICON, placeLabel } from './meta';

  let { incident, onopen }: { incident: Incident; onopen: (i: Incident) => void } = $props();
  const reports = $derived(app.reports.filter((r) => incident.reportIds.includes(r.id)));
  const summary = $derived(explain(incident, reports)[0]);
</script>

<button class="card inc" class:old={incident.status !== 'active'} style:--c={CAT_COLOR[incident.category]} onclick={() => onopen(incident)}>
  <div class="top">
    <span class="cat"><span aria-hidden="true">{CAT_ICON[incident.category]}</span> {t(`cat.${incident.category}`)}</span>
    <Badge state={incident.assessment.occurred} />
  </div>
  <div class="title">
    {#if isPeopleIncident(incident)}<span class="ppl">{t('detail.people')}</span>{/if}
    {incident.title}
  </div>
  <p class="sum">{summary}</p>
  <div class="meta">
    <AgeChip {incident} />
    <span>📍 {placeLabel(incident.place)}</span>
  </div>
</button>

<style>
  .inc {
    display: block;
    width: 100%;
    text-align: left;
    padding: 14px 16px;
    cursor: pointer;
    border-left: 5px solid var(--c);
  }
  .inc.old {
    opacity: 0.7;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .cat {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--c);
  }
  .title {
    font-size: var(--fs-lg);
    font-weight: 650;
    line-height: 1.3;
  }
  .ppl {
    display: inline-block;
    margin-right: 6px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: var(--fs-xs);
    font-weight: 700;
    vertical-align: 2px;
  }
  .sum {
    margin: 6px 0 0;
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin-top: 10px;
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }
</style>
