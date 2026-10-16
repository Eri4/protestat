<script lang="ts">
  import { onMount } from 'svelte';
  import qrcode from 'qrcode-generator';
  import { load, toast } from '../app.svelte';
  import { ago, t } from '../i18n/i18n.svelte';
  import { addSharedSource, shareText, telegramShareUrl } from '../share/io';
  import { joinLink, newGroupKey, normaliseServer, parseJoin, type GroupInfo } from '../sync/group';
  import { dismissSuggestion, getGroup, joinGroup, leaveGroup, syncNow, testServer, type SyncState } from '../sync/sync';
  import { canHostHere, hostStatus, startHosting, stopHosting } from '../sync/host';
  import Sheet from './Sheet.svelte';

  let { onguide, pendingJoin = '' }: { onguide: (id: string) => void; pendingJoin?: string } = $props();

  let group = $state<SyncState | null>(null);
  let host = $state({ running: false, port: 0, addresses: [] as string[], items: 0 });
  let busy = $state(false);
  let sheet = $state<'' | 'join' | 'create' | 'invite'>('');

  // join
  let code = $state('');
  let joinErr = $state('');
  const parsed = $derived(parseJoin(code));

  // create
  let where = $state<'phone' | 'server'>(canHostHere() ? 'phone' : 'server');
  let serverUrl = $state('');
  let groupName = $state('');
  let createErr = $state('');

  async function refreshState() {
    group = await getGroup();
    host = await hostStatus();
  }

  onMount(() => {
    void refreshState();
    if (pendingJoin) {
      code = pendingJoin;
      sheet = 'join';
    }
    const id = setInterval(refreshState, 15000);
    return () => clearInterval(id);
  });

  async function doJoin() {
    if (!parsed) return (joinErr = t('group.badCode'));
    busy = true;
    joinErr = '';
    try {
      if (!(await testServer(parsed.server))) return (joinErr = t('group.serverDown'));
      await joinGroup(parsed);
      await syncNow();
      await load();
      await refreshState();
      sheet = '';
      code = '';
      toast(t('group.joined'));
    } finally {
      busy = false;
    }
  }

  async function doCreate() {
    busy = true;
    createErr = '';
    try {
      const key = newGroupKey();
      if (where === 'phone') {
        const h = await startHosting();
        const lan = h.addresses[0] ?? '127.0.0.1';
        const g: GroupInfo = { server: `http://${lan}:${h.port}`, key, name: groupName.trim() };
        await joinGroup(g, { role: 'host', connectUrl: `http://127.0.0.1:${h.port}` });
      } else {
        let url: string;
        try {
          url = normaliseServer(serverUrl);
        } catch {
          return (createErr = t('group.serverDown'));
        }
        if (!(await testServer(url))) return (createErr = t('group.serverDown'));
        await joinGroup({ server: url, key, name: groupName.trim() });
      }
      await syncNow();
      await refreshState();
      sheet = 'invite';
    } catch {
      createErr = t('common.error');
    } finally {
      busy = false;
    }
  }

  async function toggleHost() {
    busy = true;
    try {
      if (host.running) await stopHosting();
      else {
        const h = await startHosting();
        // The phone's address may have changed (other Wi-Fi / hotspot): update the invite code.
        if (group && group.role === 'host') {
          group.server = `http://${h.addresses[0] ?? '127.0.0.1'}:${h.port}`;
          group.connectUrl = `http://127.0.0.1:${h.port}`;
          await joinGroupKeepState(group);
        }
      }
      await refreshState();
    } finally {
      busy = false;
    }
  }

  async function joinGroupKeepState(g: SyncState) {
    const { setSetting } = await import('../store/db');
    await setSetting('syncGroup', $state.snapshot(g));
  }

  async function doSync() {
    busy = true;
    try {
      await syncNow();
      await load();
      await refreshState();
    } finally {
      busy = false;
    }
  }

  async function doLeave() {
    if (!confirm(t('group.leaveConfirm'))) return;
    if (group?.role === 'host' && host.running) await stopHosting();
    await leaveGroup();
    await refreshState();
    toast(t('group.left'));
  }

  const link = $derived(group ? joinLink(group) : '');
  const qrSvg = $derived.by(() => {
    if (!link) return '';
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  });
  const inviteText = $derived(group ? `${t('group.inviteMsg', { name: group.name || t('group.unnamed') })}\n${link}` : '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast(t('group.copied'));
    } catch {
      /* clipboard blocked: the code is selectable on screen */
    }
  }
</script>

<section class="card box stack">
  <h2>👥 {t('group.title')}</h2>
  {#if !group}
    <p class="muted">{t('group.help')}</p>
    <div class="row2">
      <button class="btn primary" onclick={() => (sheet = 'join')}>🔑 {t('group.join')}</button>
      <button class="btn" onclick={() => (sheet = 'create')}>＋ {t('group.create')}</button>
    </div>
    <button class="hl" onclick={() => onguide('group')}>{t('help.how')}</button>
  {:else}
    <p><strong>{t('group.inGroup', { name: group.name || t('group.unnamed') })}</strong></p>
    <p class="xs muted">{t('group.server', { s: group.server })}</p>

    {#if group.role === 'host'}
      <div class="host" class:on={host.running}>
        <div><strong>{host.running ? t('group.hostOn') : t('group.hostOff')}</strong></div>
        {#if host.running && host.addresses.length}
          <div class="xs">{t('group.addresses', { a: host.addresses.map((a) => `${a}:${host.port}`).join(' · ') })}</div>
        {/if}
        <p class="xs muted">{t('group.offlineHint')}</p>
        <button class="btn small" disabled={busy} onclick={toggleHost}>{host.running ? t('group.hostStop') : t('group.hostStart')}</button>
      </div>
    {/if}

    <p class="small">
      {#if group.lastError}<span class="err">⚠️ {t('group.error', { e: group.lastError })}</span>
      {:else if group.lastSyncAt}✅ {t('group.lastSync', { ago: ago(group.lastSyncAt), sent: group.sent, received: group.received })}
      {:else}{t('group.never')}{/if}
    </p>
    <div class="row2">
      <button class="btn primary" disabled={busy} onclick={doSync}>⟳ {t('group.syncNow')}</button>
      <button class="btn" onclick={() => (sheet = 'invite')}>📨 {t('group.invite')}</button>
    </div>

    {#if group.suggested.length}
      <div class="small"><strong>{t('group.suggested')}</strong></div>
      {#each group.suggested as s}
        <div class="sug">
          <span>{s.adapter === 'telegram' ? '✈️' : '🌐'} {s.name}</span>
          <span>
            <button class="btn small" onclick={async () => { await addSharedSource(s); await dismissSuggestion(s.url); await load(); await refreshState(); }}>{t('share.addSource')}</button>
            <button class="btn small" aria-label={t('detail.close')} onclick={async () => { await dismissSuggestion(s.url); await refreshState(); }}>✕</button>
          </span>
        </div>
      {/each}
    {/if}

    <p class="xs muted">{t('group.privacyNote')}</p>
    <button class="btn small danger" onclick={doLeave}>{t('group.leave')}</button>
  {/if}
</section>

{#if sheet === 'join'}
  <Sheet title={t('group.join')} onclose={() => (sheet = '')}>
    <div class="stack">
      <p class="muted">{t('group.pasteCode')}</p>
      <textarea class="input" bind:value={code} placeholder="protestat://join?…" autocapitalize="off"></textarea>
      {#if parsed}
        <p class="note">👥 {parsed.name || t('group.unnamed')}<br /><span class="xs">{t('group.server', { s: parsed.server })}</span></p>
      {/if}
      {#if joinErr}<p class="note err">{joinErr}</p>{/if}
      <button class="btn primary block" disabled={!code.trim() || busy} onclick={doJoin}>{busy ? t('group.testing') : t('group.join')}</button>
      <p class="xs muted">{t('group.privacyNote')}</p>
    </div>
  </Sheet>
{/if}

{#if sheet === 'create'}
  <Sheet title={t('group.create')} onclose={() => (sheet = '')}>
    <div class="stack">
      <label class="lbl">{t('group.name')}<input class="input" bind:value={groupName} maxlength="60" /></label>
      <div class="lbl">{t('group.where')}</div>
      <button class="opt" aria-pressed={where === 'phone'} disabled={!canHostHere()} onclick={() => (where = 'phone')}>
        <strong>{t('group.onPhone')}</strong>
        <span class="xs">{canHostHere() ? t('group.onPhoneHelp') : t('group.onlyAndroid')}</span>
      </button>
      <button class="opt" aria-pressed={where === 'server'} onclick={() => (where = 'server')}>
        <strong>{t('group.onServer')}</strong>
        <span class="xs">{t('group.onServerHelp')}</span>
      </button>
      {#if where === 'server'}
        <label class="lbl">{t('group.serverUrl')}<input class="input" bind:value={serverUrl} placeholder="https://relay.example.org" inputmode="url" autocapitalize="off" /></label>
        <button class="hl" onclick={() => onguide('server')}>{t('group.howServer')}</button>
      {/if}
      {#if createErr}<p class="note err">{createErr}</p>{/if}
      <button class="btn primary block" disabled={busy || (where === 'server' && !serverUrl.trim())} onclick={doCreate}>{busy ? t('group.testing') : t('group.createBtn')}</button>
    </div>
  </Sheet>
{/if}

{#if sheet === 'invite' && group}
  <Sheet title={t('group.invite')} onclose={() => (sheet = '')}>
    <div class="stack">
      <p class="note">🔐 {t('group.inviteHelp')}</p>
      <a class="btn primary block" href={telegramShareUrl(link, inviteText)} target="_blank" rel="noopener noreferrer">✈️ Telegram</a>
      <button class="btn block" onclick={() => shareText(inviteText)}>↗ {t('nav.share')}</button>
      <button class="btn block" onclick={copy}>📋 {t('group.copy')}</button>
      <p class="xs muted">{t('group.qrHelp')}</p>
      <!-- QR code generated locally from the join link (no user HTML involved). -->
      <div class="qr">{@html qrSvg}</div>
      <code class="code">{link}</code>
      {#if group.role === 'host'}<p class="xs muted">{t('group.offlineHint')}</p>{/if}
    </div>
  </Sheet>
{/if}

<style>
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
  .row2 {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .row2 > * {
    flex: 1;
  }
  .hl {
    border: none;
    background: none;
    padding: 0;
    color: var(--focus);
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    min-height: 32px;
    text-align: left;
  }
  .host {
    padding: 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .host.on {
    background: color-mix(in srgb, var(--c-high) 12%, var(--surface));
  }
  .err {
    color: var(--accent);
  }
  .sug {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .lbl {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: 700;
  }
  .opt {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--line);
    background: var(--surface);
    cursor: pointer;
  }
  .opt[aria-pressed='true'] {
    border-color: var(--ink);
  }
  .opt:disabled {
    opacity: 0.55;
  }
  .qr {
    width: 220px;
    max-width: 100%;
    margin: 0 auto;
    background: #fff;
    padding: 8px;
    border-radius: var(--radius-sm);
  }
  .qr :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
  .code {
    display: block;
    word-break: break-all;
    font-size: var(--fs-xs);
    background: var(--surface-2);
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    user-select: all;
  }
</style>
