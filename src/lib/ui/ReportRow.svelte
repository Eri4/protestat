<script lang="ts">
  import type { Report } from '../model/types';
  import { t, ago, when } from '../i18n/i18n.svelte';
  import { CAT_ICON } from './meta';
  import { app } from '../app.svelte';
  import TierBadge from './TierBadge.svelte';

  let { report, onshare }: { report: Report; onshare: (r: Report) => void } = $props();
</script>

<article class="row">
  <a class="main" href={report.url} target="_blank" rel="noopener noreferrer">
    <div class="src">
      <span aria-hidden="true">{CAT_ICON[report.category]}</span>
      <strong>{report.sourceName}</strong>
      <TierBadge tier={app.sources.find((s) => s.id === report.sourceId)?.tier ?? 'D'} />
      <span>· {ago(report.publishedAt ?? report.collectedAt)}</span>
      {#if report.provenance.origin === 'imported'}<span class="tag">{t('detail.imported')}</span>{/if}
      {#if report.provenance.origin === 'user'}<span class="tag">{t('detail.userLink')}</span>{/if}
    </div>
    <div class="title">{report.title}</div>
    {#if report.summary}<div class="sum">{report.summary}</div>{/if}
    <div class="times xs muted">
      {t('time.happened')}: {when(report.publishedAt)} · {t('time.collected')}: {when(report.collectedAt)}
      {#if report.places.length}· 📍 {report.places.map((p) => p.name).join(', ')}{/if}
    </div>
  </a>
  <button class="share" aria-label={t('nav.share')} onclick={() => onshare(report)}>↗</button>
</article>

<style>
  .row {
    display: flex;
    gap: 4px;
    padding: 12px 8px 12px 16px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }
  .main {
    flex: 1;
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }
  .src {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }
  .src strong {
    color: var(--ink);
  }
  .tag {
    font-size: var(--fs-xs);
    background: var(--surface-2);
    padding: 1px 8px;
    border-radius: 999px;
  }
  .title {
    font-weight: 650;
    margin-top: 4px;
    line-height: 1.3;
  }
  .sum {
    margin-top: 4px;
    font-size: var(--fs-sm);
    color: var(--ink-2);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .times {
    margin-top: 6px;
  }
  .share {
    flex: none;
    width: 44px;
    height: 44px;
    border: none;
    background: none;
    font-size: 1.2rem;
    color: var(--ink-2);
    cursor: pointer;
  }
</style>
