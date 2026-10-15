<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import type { Category, Report } from '../model/types';
  import { load, toast } from '../app.svelte';
  import { t, when } from '../i18n/i18n.svelte';
  import { reportWhatISee } from '../crowd/actions';
  import { shareText, telegramShareUrl } from '../share/io';
  import Sheet from './Sheet.svelte';
  import { CAT_COLOR, CAT_ICON } from './meta';

  let { onclose, onguide }: { onclose: () => void; onguide: (id: string) => void } = $props();

  // Things a person can see with their own eyes.
  const TYPES: Category[] = ['police-presence', 'demonstration', 'road-closure', 'emergency', 'traffic', 'hazard'];
  let category = $state<Category | null>(null);
  let note = $state('');
  let saving = $state(false);
  let saved = $state<Report | null>(null);
  let mapEl = $state<HTMLDivElement>();
  let map: MapLibreMap | undefined;

  onMount(async () => {
    const { maplibre, ONLINE_STYLE, OFFLINE_STYLE, CENTER } = await import('./maplib');
    if (!mapEl) return;
    map = new maplibre.Map({
      container: mapEl,
      style: navigator.onLine ? ONLINE_STYLE : OFFLINE_STYLE,
      center: CENTER,
      zoom: 7,
      attributionControl: { compact: true },
    });
    map.on('load', () => mapEl?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
    map.on('error', (e) => {
      if (/style|tile|fetch|Failed/i.test(String(e.error?.message ?? ''))) map?.setStyle(OFFLINE_STYLE);
    });
  });
  onDestroy(() => map?.remove());

  function useLocation() {
    if (!navigator.geolocation) return toast(t('map.noLocation'));
    navigator.geolocation.getCurrentPosition(
      (pos) => map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 }),
      () => toast(t('map.noLocation')),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 },
    );
  }

  async function save() {
    if (!category || !map) return;
    saving = true;
    try {
      const c = map.getCenter();
      saved = await reportWhatISee({ category, lat: c.lat, lon: c.lng, note });
      await load();
      toast(t('report.saved'));
    } finally {
      saving = false;
    }
  }

  const shareMsg = $derived(
    saved
      ? t('report.shareText', {
          icon: CAT_ICON[saved.category],
          what: t(`cat.${saved.category}`),
          place: saved.places[0].name,
          time: when(saved.publishedAt),
        }) + (saved.summary ? `\n“${saved.summary}”` : '')
      : '',
  );
</script>

<Sheet title={t('report.title')} {onclose}>
  {#if saved}
    <div class="stack done">
      <p class="big">✅ {t('report.saved')}</p>
      <a class="btn primary block" href={telegramShareUrl(saved.url, shareMsg)} target="_blank" rel="noopener noreferrer">✈️ {t('report.shareTelegram')}</a>
      <button class="btn block" onclick={() => shareText(shareMsg, saved!.url)}>↗ {t('nav.share')}</button>
      <button class="btn block" onclick={onclose}>{t('common.ok')}</button>
    </div>
  {:else}
    <div class="stack">
      <div class="step">{t('report.step1')}</div>
      <div class="types">
        {#each TYPES as c}
          <button class="type" style:--c={CAT_COLOR[c]} aria-pressed={category === c} onclick={() => (category = c)}>
            <span class="ti" aria-hidden="true">{CAT_ICON[c]}</span>
            <span>{t(`cat.${c}`)}</span>
          </button>
        {/each}
      </div>

      <div class="step">{t('report.step2')}</div>
      <div class="pick">
        <div class="mini" bind:this={mapEl}></div>
        <div class="pin" aria-hidden="true" style:--c={category ? CAT_COLOR[category] : '#14213d'}>{category ? CAT_ICON[category] : '📍'}</div>
      </div>
      <button class="btn block" onclick={useLocation}>{t('report.useLocation')}</button>

      <label class="step" for="rnote">{t('report.step3')}</label>
      <textarea id="rnote" class="input" bind:value={note} maxlength="200" placeholder={t('report.notePh')}></textarea>
      <p class="note">🔒 {t('report.privacy')}</p>

      <button class="btn primary block" disabled={!category || saving} onclick={save}>
        {category ? t('report.save') : t('report.pick')}
      </button>
      <button class="link" onclick={() => onguide('report')}>{t('help.how')} →</button>
    </div>
  {/if}
</Sheet>

<style>
  .step {
    font-weight: 800;
    display: block;
  }
  .types {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .type {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--line);
    background: var(--surface);
    text-align: left;
    font-weight: 600;
    font-size: var(--fs-sm);
    cursor: pointer;
  }
  .type[aria-pressed='true'] {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, var(--surface));
  }
  .ti {
    font-size: 1.4rem;
  }
  .pick {
    position: relative;
    height: 240px;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--line);
  }
  .mini {
    position: absolute;
    inset: 0;
  }
  .pin {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--c);
    border: 3px solid #fff;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
    display: grid;
    place-items: center;
    font-size: 18px;
    pointer-events: none;
    z-index: 2;
  }
  .done .big {
    font-size: var(--fs-lg);
    font-weight: 700;
    margin: 0;
  }
  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--focus);
    font-weight: 600;
    cursor: pointer;
    min-height: 40px;
  }
</style>
