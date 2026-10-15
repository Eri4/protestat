<script lang="ts">
  import { onMount } from 'svelte';
  import { app, checkUpdate, load, toast } from '../app.svelte';
  import { i18n, setLang, t } from '../i18n/i18n.svelte';
  import { getSetting, setSetting, wipeAll, RETENTION_DAYS_DEFAULT } from '../store/db';
  import { regenerateKeys } from '../share/io';
  import { APP_VERSION, PROJECT_URL } from '../config';
  import Sheet from './Sheet.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let retention = $state(RETENTION_DAYS_DEFAULT);
  let confirming = $state(false);

  onMount(async () => (retention = await getSetting('retentionDays', RETENTION_DAYS_DEFAULT)));

  async function setRetention(d: number) {
    retention = d;
    await setSetting('retentionDays', d);
  }

  async function wipe() {
    await wipeAll();
    confirming = false;
    await load();
    toast(t('set.wiped'));
  }

  async function update() {
    const r = await checkUpdate(true);
    if (r === 'latest') toast(t('set.upToDate'));
    else if (r === 'error') toast(t('common.error'));
  }
</script>

<Sheet title={t('nav.settings')} {onclose}>
  <div class="stack">
    <div class="small"><strong>{t('set.language')}</strong></div>
    <div class="row">
      <button class="chip" aria-pressed={i18n.lang === 'sq'} onclick={() => setLang('sq')}>🇦🇱 Shqip</button>
      <button class="chip" aria-pressed={i18n.lang === 'en'} onclick={() => setLang('en')}>🇬🇧 English</button>
    </div>

    <div class="small"><strong>{t('set.retention')}</strong></div>
    <div class="row">
      {#each [7, 30, 90] as d}
        <button class="chip" aria-pressed={retention === d} onclick={() => setRetention(d)}>{t('set.days', { n: d })}</button>
      {/each}
    </div>

    <div class="note"><strong>{t('set.safety')}.</strong> {t('set.safetyText')}</div>

    {#if confirming}
      <div class="card confirm stack">
        <p>{t('set.wipeConfirm')}</p>
        <div class="row">
          <button class="btn danger" onclick={wipe}>{t('common.yes')}, {t('set.wipe').toLowerCase()}</button>
          <button class="btn" onclick={() => (confirming = false)}>{t('common.cancel')}</button>
        </div>
      </div>
    {:else}
      <button class="btn danger block" onclick={() => (confirming = true)}>🗑 {t('set.wipe')}</button>
    {/if}
    <button class="btn block" onclick={async () => { await regenerateKeys(); toast('✓'); }}>{t('set.newId')}</button>

    <div class="section-title" style="margin-left:0">{t('set.about')}</div>
    <p class="muted small">{t('set.aboutText')}</p>
    <p class="small">{t('set.version', { v: APP_VERSION })} · <a href={PROJECT_URL} target="_blank" rel="noopener noreferrer">{t('set.code')}</a></p>
    {#if app.update}
      <a class="btn primary block" href={app.update.url} target="_blank" rel="noopener noreferrer">{t('set.updateAvailable', { v: app.update.version })}</a>
    {:else}
      <button class="btn block" onclick={update}>{t('set.update')}</button>
    {/if}
  </div>
</Sheet>

<style>
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .confirm {
    padding: 14px;
  }
  .confirm p {
    margin: 0;
  }
</style>
