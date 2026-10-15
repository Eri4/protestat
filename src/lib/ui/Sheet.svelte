<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/i18n.svelte';

  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop" role="presentation" onclick={onclose}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
  <header>
    <h2>{title}</h2>
    <button class="close" onclick={onclose} aria-label={t('detail.close')}>✕</button>
  </header>
  <div class="body">{@render children()}</div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    z-index: 40;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 88vh;
    max-width: 640px;
    margin: 0 auto;
    background: var(--bg);
    border-radius: 20px 20px 0 0;
    z-index: 41;
    display: flex;
    flex-direction: column;
    padding-bottom: var(--safe-bottom);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 8px 8px 16px;
  }
  h2 {
    margin: 0;
    font-size: var(--fs-xl);
  }
  .close {
    width: 48px;
    height: 48px;
    border: none;
    background: none;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .body {
    overflow-y: auto;
    padding: 0 16px 20px;
  }
</style>
