<script lang="ts">
  import type { Category, PlaceRef, Source, Tier } from '../model/types';
  import { CATEGORIES } from '../model/types';
  import { app, load, refresh, toast } from '../app.svelte';
  import { t, ago, when } from '../i18n/i18n.svelte';
  import { db } from '../store/db';
  import { canFetchHere, rebuildIncidents } from '../engine/collector';
  import { previewSource, linkMetadata, makeLinkReport, USER_SOURCE_ID, CROWD_SOURCE_ID, type SourcePreview } from '../sources/custom';
  import { SOCIAL_ACCOUNTS, accountForUrl, socialUrl, type SocialAccount } from '../sources/defaults';
  import TierBadge from './TierBadge.svelte';

  let { onguide }: { onguide: (id: string) => void } = $props();
  import { searchPlaces } from '../geo/gazetteer';
  import { CAT_ICON } from './meta';
  import Sheet from './Sheet.svelte';

  const visible = $derived(app.sources.filter((s) => s.id !== USER_SOURCE_ID && s.id !== CROWD_SOURCE_ID));
  const TIERS: Tier[] = ['A', 'B', 'C', 'D'];
  // Within a level: switched-on first, then alphabetical.
  const byTier = $derived(
    Object.fromEntries(
      TIERS.map((tier) => [
        tier,
        visible
          .filter((s) => (s.tier ?? 'D') === tier)
          .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)),
      ]),
    ) as Record<Tier, Source[]>,
  );
  // One row per account name, with its platforms.
  const socialGroups = $derived(
    Object.values(
      SOCIAL_ACCOUNTS.reduce<Record<string, SocialAccount[]>>((acc, a) => ((acc[a.name] ??= []).push(a), acc), {}),
    ).sort((a, b) => a[0].tier.localeCompare(b[0].tier) || a[0].name.localeCompare(b[0].name)),
  );
  const PLATFORM_ICON = { instagram: '📸 Instagram', tiktok: '🎵 TikTok', facebook: '📘 Facebook', youtube: '▶️ YouTube', x: '✖️ X' };
  let showSocial = $state(false);

  function status(s: Source): { cls: string; text: string } {
    if (s.pausedUntil && Date.parse(s.pausedUntil) > Date.now()) return { cls: 'warn', text: t('src.paused', { t: when(s.pausedUntil) }) };
    if (s.lastError && (!s.lastSuccessAt || (s.lastAttemptAt ?? '') > s.lastSuccessAt))
      return { cls: 'bad', text: t('src.error', { e: s.lastError }) };
    if (s.lastSuccessAt) return { cls: 'ok', text: t('src.lastOk', { ago: ago(s.lastSuccessAt) }) };
    return { cls: '', text: t('src.neverOk') };
  }

  async function toggle(s: Source) {
    await db.sources.update(s.id, { enabled: !s.enabled });
    await load();
  }

  async function remove(s: Source) {
    await db.sources.delete(s.id);
    await rebuildIncidents();
    await load();
  }

  // ---- add source ----
  let adding = $state(false);
  let input = $state('');
  let busy = $state(false);
  let preview = $state<SourcePreview | null>(null);
  let err = $state('');

  async function check() {
    busy = true;
    err = '';
    preview = null;
    try {
      preview = await previewSource(input);
      if (app.sources.some((s) => s.id === preview!.source.id || s.url === preview!.source.url)) err = t('add.exists');
    } catch (e) {
      err = String(e).includes('robots') ? t('add.robots') : t('add.fail');
    } finally {
      busy = false;
    }
  }

  async function confirmAdd() {
    if (!preview) return;
    await db.sources.put($state.snapshot(preview.source));
    adding = false;
    input = '';
    preview = null;
    await load();
    void refresh(false);
  }

  // ---- add link ----
  let linking = $state(false);
  let link = $state({ url: '', title: '', note: '', category: 'demonstration' as Category, account: '' });
  let placeQ = $state('');
  let place = $state<PlaceRef | undefined>();
  const placeHits = $derived(place ? [] : searchPlaces(placeQ, 5));

  async function fillTitle() {
    try {
      new URL(link.url);
    } catch {
      return;
    }
    const known = accountForUrl(link.url);
    if (known && !link.account) link.account = `${known.name}|${known.platform}`;
    if (link.title) return;
    const m = await linkMetadata(link.url);
    if (m.title && !link.title) link.title = m.author ? `${m.title} — ${m.author}` : m.title;
  }

  async function saveLink() {
    try {
      const u = new URL(link.url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    } catch {
      return toast(t('link.bad'));
    }
    const r = await makeLinkReport({
      url: link.url,
      title: link.title || link.url,
      note: link.note,
      category: link.category,
      place: place ? $state.snapshot(place) : undefined,
      seenAt: new Date().toISOString(),
      accountName: link.account ? link.account.split('|')[0] : undefined,
    });
    await db.reports.put(r);
    await rebuildIncidents();
    await load();
    linking = false;
    link = { url: '', title: '', note: '', category: 'demonstration', account: '' };
    place = undefined;
    placeQ = '';
    toast(t('link.saved'));
  }
</script>

{#snippet row(s: Source)}
  {@const st = status(s)}
  <div class="src">
    <div class="info">
      <div class="name">{s.name}</div>
      <div class="xs muted">{t(`src.kind.${s.kind}`)}{s.itemCount ? ` · ${t('src.items', { n: s.itemCount })}` : ''}</div>
      {#if !canFetchHere(s)}
        <div class="xs st warn">{t('src.browserOnly')}</div>
      {:else if s.enabled}
        <div class="xs st {st.cls}">{st.text}</div>
      {/if}
    </div>
    {#if !s.builtIn}<button class="btn small danger" onclick={() => remove(s)}>{t('src.remove')}</button>{/if}
    <label class="switch">
      <input type="checkbox" checked={s.enabled} onchange={() => toggle(s)} aria-label={s.name} />
      <span></span>
    </label>
  </div>
{/snippet}

<div class="page">
  <p class="intro pad">{t('intro.sources')} <button class="hl" onclick={() => onguide('trust')}>{t('help.how')}</button></p>
  <div class="pad actions">
    <button class="btn primary block" onclick={() => (adding = true)}>＋ {t('src.add')}</button>
    <button class="btn block" onclick={() => (linking = true)}>🔗 {t('src.addLink')}</button>
  </div>

  {#each TIERS as tier}
    {#if byTier[tier].length}
      <div class="tier-head pad">
        <div class="th-top">
          <TierBadge {tier} long />
          <span class="xs muted">{t('src.count', { on: byTier[tier].filter((s) => s.enabled).length, all: byTier[tier].length })}</span>
        </div>
        <p class="xs muted">{t(`tier.${tier}.desc`)}</p>
      </div>
      <div class="card list">{#each byTier[tier] as s (s.id)}{@render row(s)}{/each}</div>
    {/if}
  {/each}

  <div class="tier-head pad">
    <button class="social-toggle" aria-expanded={showSocial} onclick={() => (showSocial = !showSocial)}>
      <strong>📱 {t('social.title')}</strong>
      <span aria-hidden="true">{showSocial ? '−' : '+'}</span>
    </button>
    <p class="xs muted">{t('social.help')} <button class="hl" onclick={() => onguide('social')}>{t('help.how')}</button></p>
  </div>
  {#if showSocial}
    <div class="card list">
      {#each socialGroups as g}
        <div class="src">
          <div class="info">
            <div class="name">{g[0].name} <TierBadge tier={g[0].tier} /></div>
            <div class="plats">
              {#each g as a}
                <a class="btn small" href={socialUrl(a)} target="_blank" rel="noopener noreferrer">{PLATFORM_ICON[a.platform]}</a>
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
  <p class="xs muted pad note-tier">{t('tier.note')}</p>
</div>

{#if adding}
  <Sheet title={t('add.title')} onclose={() => (adding = false)}>
    <div class="stack">
      <p class="muted">{t('add.help')}</p>
      <input class="input" bind:value={input} placeholder={t('add.placeholder')} autocapitalize="off" autocomplete="off" inputmode="url" />
      <button class="btn block" disabled={!input.trim() || busy} onclick={check}>{busy ? t('add.loading') : t('add.preview')}</button>
      {#if err}<p class="note err">{err}</p>{/if}
      {#if preview}
        <div class="card prev">
          <strong>{t('add.found', { name: preview.source.name })}</strong>
          <ul>
            {#each preview.items as it}<li>{it.title}</li>{/each}
          </ul>
        </div>
        <p class="xs muted">{t('add.terms')}</p>
        <button class="btn primary block" disabled={err === t('add.exists')} onclick={confirmAdd}>{t('add.confirm')}</button>
      {/if}
    </div>
  </Sheet>
{/if}

{#if linking}
  <Sheet title={t('link.title')} onclose={() => (linking = false)}>
    <div class="stack">
      <p class="muted">{t('link.help')}</p>
      <label class="small">{t('link.url')}<input class="input" bind:value={link.url} onblur={fillTitle} inputmode="url" autocapitalize="off" placeholder="https://www.tiktok.com/@…" /></label>
      <label class="small">{t('link.account')}
        <select class="input" bind:value={link.account}>
          <option value="">{t('link.accountNone')}</option>
          {#each SOCIAL_ACCOUNTS as a}<option value="{a.name}|{a.platform}">{a.name} · {a.platform} ({a.tier})</option>{/each}
        </select>
      </label>
      <label class="small">{t('link.titleField')}<input class="input" bind:value={link.title} /></label>
      <label class="small">{t('link.note')}<textarea class="input" bind:value={link.note} maxlength="300"></textarea></label>
      <label class="small">{t('link.category')}
        <select class="input" bind:value={link.category}>
          {#each CATEGORIES as c}<option value={c}>{CAT_ICON[c]} {t(`cat.${c}`)}</option>{/each}
        </select>
      </label>
      <label class="small">{t('link.place')}
        {#if place}
          <div class="picked"><span>📍 {place.name}</span><button class="btn small" onclick={() => (place = undefined)}>✕</button></div>
        {:else}
          <input class="input" bind:value={placeQ} placeholder="Tiranë, Durrës…" />
        {/if}
      </label>
      {#each placeHits as p}
        <button class="btn small" onclick={() => (place = p)}>📍 {p.name}</button>
      {/each}
      <button class="btn primary block" disabled={!link.url} onclick={saveLink}>{t('link.save')}</button>
    </div>
  </Sheet>
{/if}

<style>
  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
  }
  .list {
    margin: 0 16px;
    overflow: hidden;
  }
  .src {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
  }
  .src:last-child {
    border: none;
  }
  .info {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .st::before {
    content: '●';
    margin-right: 6px;
    color: var(--ink-3);
  }
  .st.ok::before {
    color: var(--c-high);
  }
  .st.bad::before {
    color: var(--accent);
  }
  .st.warn::before {
    color: var(--c-low);
  }
  .switch {
    position: relative;
    width: 52px;
    height: 32px;
    flex: none;
  }
  .switch input {
    opacity: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    position: absolute;
    cursor: pointer;
    z-index: 1;
  }
  .switch span {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--line);
    transition: background 0.15s;
  }
  .switch span::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
    transition: transform 0.15s;
  }
  .switch input:checked + span {
    background: var(--c-high);
  }
  .switch input:checked + span::after {
    transform: translateX(20px);
  }
  .prev {
    padding: 12px 14px;
  }
  .prev ul {
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: var(--fs-sm);
  }
  .err {
    color: var(--accent);
  }
  label.small {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 600;
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
  .tier-head {
    margin: 22px 0 8px;
  }
  .th-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tier-head p {
    margin: 4px 0 0;
  }
  .social-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 44px;
    border: none;
    background: none;
    padding: 0;
    font-size: var(--fs-md);
    cursor: pointer;
  }
  .plats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .note-tier {
    margin-top: 16px;
  }
  .picked {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>
