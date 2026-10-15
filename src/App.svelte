<script lang="ts">
  import { onMount } from 'svelte';
  import type { Incident, Report } from './lib/model/types';
  import { app, init, refresh } from './lib/app.svelte';
  import { t, ago, i18n, setLang } from './lib/i18n/i18n.svelte';
  import { isNative } from './lib/engine/fetcher';
  import { shareText, telegramShareUrl } from './lib/share/io';
  import NewsView from './lib/ui/NewsView.svelte';
  import SourcesView from './lib/ui/SourcesView.svelte';
  import ShareView from './lib/ui/ShareView.svelte';
  import SettingsView from './lib/ui/SettingsView.svelte';
  import IncidentDetail from './lib/ui/IncidentDetail.svelte';
  import Sheet from './lib/ui/Sheet.svelte';
  import GuidesView from './lib/ui/GuidesView.svelte';
  import ReportSheet from './lib/ui/ReportSheet.svelte';

  type Tab = 'news' | 'map' | 'sources' | 'share';
  let tab = $state<Tab>('news');
  let detail = $state<Incident | null>(null);
  let sharing = $state<Report | null>(null);
  let settings = $state(false);
  let hideBrowserNote = $state(false);
  let guide = $state<string | null>(null);
  let reporting = $state(false);
  const openGuide = (id: string) => (guide = id);

  const TABS: [Tab, string, string][] = [
    ['news', '📰', 'nav.news'],
    ['map', '🗺️', 'nav.map'],
    ['sources', '📡', 'nav.sources'],
    ['share', '✈️', 'nav.share'],
  ];

  onMount(() => {
    document.documentElement.lang = i18n.lang;
    void init();
  });

  const statusText = $derived(
    app.refreshing
      ? t('status.refreshing', { done: app.progress.done, total: app.progress.total || '…' })
      : !app.online
        ? t('status.offline', { ago: ago(app.lastRefresh) })
        : app.lastRefresh
          ? t('status.updated', { ago: ago(app.lastRefresh) })
          : t('status.never'),
  );

  const reportText = (r: Report) => `${r.title}\n${r.sourceName}`;
</script>

<div class="shell">
  <header class="top">
    <div class="brand">
      <img src="./icon.svg" alt="" width="30" height="30" />
      <div>
        <div class="name">{t('app.name')}</div>
        <div class="status" class:off={!app.online} aria-live="polite">{statusText}</div>
      </div>
    </div>
    <div class="tools">
      <button class="lang" onclick={() => setLang(i18n.lang === 'sq' ? 'en' : 'sq')} aria-label={t('set.language')}>
        {i18n.lang === 'sq' ? 'EN' : 'SQ'}
      </button>
      <button class="icon help" onclick={() => (guide = 'start')} aria-label={t('help.guides')}>?</button>
      <button class="icon" onclick={() => (settings = true)} aria-label={t('nav.settings')}>⚙️</button>
      <button class="refresh" class:spin={app.refreshing} disabled={app.refreshing || !app.online} onclick={() => refresh(true)} aria-label={t('action.refresh')}>
        ⟳
      </button>
    </div>
  </header>

  {#if !isNative() && !hideBrowserNote}
    <div class="banner">
      <span>{t('status.browserLimited')}</span>
      <button onclick={() => (hideBrowserNote = true)} aria-label={t('detail.close')}>✕</button>
    </div>
  {/if}
  {#if app.update}
    <a class="banner upd" href={app.update.url} target="_blank" rel="noopener noreferrer">{t('set.updateAvailable', { v: app.update.version })}</a>
  {/if}

  <main class:mapmode={tab === 'map'}>
    {#if !app.ready}
      <p class="loading muted">…</p>
    {:else if tab === 'news'}
      <NewsView onopen={(i) => (detail = i)} onsharereport={(r) => (sharing = r)} onreport={() => (reporting = true)} onguide={openGuide} ongoto={(tb) => (tab = tb)} />
    {:else if tab === 'map'}
      {#await import('./lib/ui/MapView.svelte') then M}
        <M.default onopen={(i: Incident) => (detail = i)} onreport={() => (reporting = true)} onguide={openGuide} />
      {/await}
    {:else if tab === 'sources'}
      <SourcesView onguide={openGuide} />
    {:else}
      <ShareView onguide={openGuide} />
    {/if}
  </main>

  <nav class="tabs">
    {#each TABS as [id, icon, key]}
      <button class:active={tab === id} aria-current={tab === id ? 'page' : undefined} onclick={() => (tab = id)}>
        <span class="ti" aria-hidden="true">{icon}</span>
        <span>{t(key)}</span>
      </button>
    {/each}
  </nav>
</div>

{#if detail}
  <IncidentDetail incident={detail} onclose={() => (detail = null)} onsharereport={(r) => (sharing = r)} onguide={openGuide} />
{/if}

{#if sharing}
  {@const r = sharing}
  <Sheet title={t('nav.share')} onclose={() => (sharing = null)}>
    <div class="stack">
      <p class="muted">{r.title}</p>
      <a class="btn primary block" href={telegramShareUrl(r.url, reportText(r))} target="_blank" rel="noopener noreferrer" onclick={() => (sharing = null)}>
        ✈️ {t('share.telegram')}
      </a>
      <button class="btn block" onclick={() => { void shareText(reportText(r), r.url); sharing = null; }}>↗ {t('nav.share')}</button>
    </div>
  </Sheet>
{/if}

{#if settings}<SettingsView onclose={() => (settings = false)} />{/if}
{#if reporting}<ReportSheet onclose={() => (reporting = false)} onguide={openGuide} />{/if}
{#if guide}<GuidesView section={guide} onclose={() => (guide = null)} />{/if}

{#if app.toast}<div class="toast" role="status">{app.toast}</div>{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 760px;
    margin: 0 auto;
    background: var(--bg);
  }
  .top {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: calc(10px + var(--safe-top)) 12px 10px 16px;
    background: var(--brand);
    color: var(--brand-ink);
    border-bottom: 3px solid var(--accent);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .name {
    font-weight: 800;
    font-size: 1.15rem;
    letter-spacing: 0.01em;
  }
  .status {
    font-size: var(--fs-xs);
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .status.off {
    color: #fcd34d;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .tools button {
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
  }
  .lang {
    min-width: 44px;
    height: 44px;
    font-weight: 700;
    font-size: var(--fs-sm);
    border-radius: 999px;
  }
  .icon {
    width: 44px;
    height: 44px;
    font-size: 1.2rem;
  }
  .icon.help {
    width: 36px;
    height: 36px;
    border-radius: 50% !important;
    border: 2px solid rgb(255 255 255 / 0.7) !important;
    font-weight: 800;
    font-size: 1.05rem;
  }
  .refresh {
    width: 48px;
    height: 48px;
    border-radius: 50% !important;
    background: rgb(255 255 255 / 0.14) !important;
    font-size: 1.5rem;
  }
  .refresh:disabled {
    opacity: 0.5;
  }
  .refresh.spin {
    animation: spin 1s linear infinite;
    opacity: 1;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .banner {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: #fff7ed;
    color: #7c2d12;
    font-size: var(--fs-sm);
    text-decoration: none;
  }
  .banner button {
    border: none;
    background: none;
    width: 36px;
    height: 36px;
    color: inherit;
    cursor: pointer;
  }
  @media (prefers-color-scheme: dark) {
    .banner {
      background: #3b2414;
      color: #fed7aa;
    }
  }
  .banner.upd {
    background: #ecfdf5;
    color: #065f46;
    font-weight: 600;
    justify-content: center;
  }
  main {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  main.mapmode {
    overflow: hidden;
  }
  .loading {
    text-align: center;
    padding: 40px;
  }
  .tabs {
    flex: none;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    background: var(--surface);
    border-top: 1px solid var(--line);
    padding-bottom: var(--safe-bottom);
  }
  .tabs button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 60px;
    border: none;
    background: none;
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--ink-3);
    cursor: pointer;
    position: relative;
  }
  .tabs .ti {
    font-size: 1.35rem;
    filter: grayscale(1);
    opacity: 0.7;
  }
  .tabs button.active {
    color: var(--ink);
  }
  .tabs button.active .ti {
    filter: none;
    opacity: 1;
  }
  .tabs button.active::before {
    content: '';
    position: absolute;
    top: 0;
    left: 30%;
    right: 30%;
    height: 3px;
    border-radius: 0 0 3px 3px;
    background: var(--accent);
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(76px + var(--safe-bottom));
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--bg);
    padding: 12px 18px;
    border-radius: 999px;
    font-size: var(--fs-sm);
    z-index: 60;
    max-width: 90vw;
    text-align: center;
  }
</style>
