<script lang="ts">
  import { onMount } from 'svelte';
  import { load, toast } from '../app.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { BundleError, type SharedSource } from '../share/bundle';
  import { addSharedSource, exportReports, importBundle, myFingerprint, readFileInput, shareFile } from '../share/io';

  let { onguide }: { onguide: (id: string) => void } = $props();
  let days = $state(1);
  let busy = $state(false);
  let fp = $state('');
  let result = $state('');
  let suggested = $state<SharedSource[]>([]);
  let fileEl: HTMLInputElement;

  onMount(async () => (fp = await myFingerprint()));

  async function send() {
    busy = true;
    try {
      const { bytes, name, count } = await exportReports(days);
      await shareFile(bytes, name, `Protestat · ${count}`);
    } catch (e) {
      if (!/cancel/i.test(String(e))) toast(t('common.error'));
    } finally {
      busy = false;
    }
  }

  async function receive(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    busy = true;
    result = '';
    try {
      const s = await importBundle(await readFileInput(f));
      result = t('share.done', { added: s.added, dup: s.duplicates, rej: s.rejected, fp: s.fingerprint });
      suggested = s.suggestedSources;
      await load();
    } catch (err) {
      result = err instanceof BundleError ? t(`share.err.${err.code}`) : t('common.error');
    } finally {
      busy = false;
      fileEl.value = '';
    }
  }

  async function addSuggested(s: SharedSource) {
    await addSharedSource(s);
    suggested = suggested.filter((x) => x !== s);
    await load();
  }
</script>

<div class="page pad stack">
  <p class="intro">{t('intro.share')} <button class="hl" onclick={() => onguide('share')}>{t('help.how')}</button></p>
  <section class="card box stack">
    <h2>📤 {t('share.title')}</h2>
    <p class="muted">{t('share.help')}</p>
    <div class="small">{t('share.period')}</div>
    <div class="periods">
      {#each [[1, 'time.24h'], [3, '3'], [7, 'time.7d']] as [d, key]}
        <button class="chip" aria-pressed={days === d} onclick={() => (days = d as number)}>
          {key === '3' ? t('set.days', { n: 3 }) : t(key as string)}
        </button>
      {/each}
    </div>
    <button class="btn primary block" disabled={busy} onclick={send}>✈️ {t('share.send')}</button>
    <p class="xs muted">{t('share.privacy')}</p>
  </section>

  <section class="card box stack">
    <h2>📥 {t('share.receive')}</h2>
    <p class="muted">{t('share.receiveHelp')}</p>
    <input bind:this={fileEl} type="file" accept=".protestat,application/octet-stream,application/gzip" class="visually-hidden" onchange={receive} />
    <button class="btn block" disabled={busy} onclick={() => fileEl.click()}>{t('share.choose')}</button>
    {#if result}<p class="note">{result}</p>{/if}
    {#if suggested.length}
      <div class="small"><strong>{t('share.suggested')}</strong></div>
      {#each suggested as s}
        <div class="sug">
          <span>{s.adapter === 'telegram' ? '✈️' : '🌐'} {s.name}</span>
          <button class="btn small" onclick={() => addSuggested(s)}>{t('share.addSource')}</button>
        </div>
      {/each}
    {/if}
    <p class="xs muted">{t('share.copiesNote')}</p>
  </section>

  {#if fp}<p class="xs muted center">{t('share.myId', { fp })}</p>{/if}
</div>

<style>
  .page {
    padding-top: 14px;
  }
  .box {
    padding: 16px;
  }
  h2 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  p {
    margin: 0;
  }
  .periods {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .sug {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .intro {
    margin: 0;
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
  .center {
    text-align: center;
  }
</style>
