<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { GUIDES } from '../guides';
  import { i18n, t } from '../i18n/i18n.svelte';

  let { section = 'start', onclose }: { section?: string; onclose: () => void } = $props();
  let open = $state<string>('');
  let root = $state<HTMLElement>();

  onMount(async () => {
    open = section;
    await tick();
    root?.querySelector(`#g-${section}`)?.scrollIntoView({ block: 'start' });
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="page-full" role="dialog" aria-modal="true" aria-label={t('help.guides')}>
  <header>
    <button class="back" onclick={onclose} aria-label={t('detail.close')}>←</button>
    <h2>📘 {t('help.guides')}</h2>
  </header>
  <div class="body" bind:this={root}>
    {#each GUIDES as g}
      <section id="g-{g.id}" class="card guide" class:open={open === g.id}>
        <button class="gh" aria-expanded={open === g.id} onclick={() => (open = open === g.id ? '' : g.id)}>
          <span class="gi" aria-hidden="true">{g.icon}</span>
          <span class="gt">{g.title[i18n.lang]}</span>
          <span class="chev" aria-hidden="true">{open === g.id ? '−' : '+'}</span>
        </button>
        {#if open === g.id}
          <div class="gb">
            {#each g.body[i18n.lang] as line}
              {@const step = line.match(/^(\d+)\.\s+(.*)$/)}
              {#if step}
                <p class="step"><span class="num">{step[1]}</span><span>{step[2]}</span></p>
              {:else}
                <p>{line}</p>
              {/if}
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .page-full {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    max-width: 760px;
    margin: 0 auto;
  }
  header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: calc(8px + var(--safe-top)) 12px 8px 6px;
    background: var(--brand);
    color: var(--brand-ink);
    border-bottom: 3px solid var(--accent);
  }
  h2 {
    margin: 0;
    font-size: var(--fs-xl);
  }
  .back {
    width: 48px;
    height: 48px;
    border: none;
    background: none;
    color: inherit;
    font-size: 1.5rem;
    cursor: pointer;
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px calc(24px + var(--safe-bottom));
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .guide {
    flex-shrink: 0;
    scroll-margin-top: 8px;
    overflow: hidden;
  }
  .gh {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 56px;
    padding: 10px 14px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .gi {
    font-size: 1.4rem;
  }
  .gt {
    flex: 1;
    font-weight: 750;
    font-size: var(--fs-lg);
  }
  .chev {
    font-size: 1.4rem;
    color: var(--ink-3);
  }
  .gb {
    padding: 0 16px 14px;
  }
  .gb p {
    margin: 8px 0;
    line-height: 1.5;
  }
  .step {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .num {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--bg);
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: var(--fs-sm);
  }
</style>
