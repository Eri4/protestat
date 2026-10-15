<script lang="ts">
  import type { ConfidenceState } from '../model/types';
  import { t } from '../i18n/i18n.svelte';
  import { CONF_ICON, confColor } from './meta';

  let { state, compact = false }: { state: ConfidenceState; compact?: boolean } = $props();
</script>

<span class="badge" style:--c={confColor(state)} title={t('conf.help')}>
  <span class="dot" aria-hidden="true">{CONF_ICON[state]}</span>
  {#if !compact}<span>{t(`conf.${state}`)}</span>{/if}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
    white-space: nowrap;
  }
  .dot {
    letter-spacing: -1px;
  }
</style>
