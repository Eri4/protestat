<script lang="ts">
  import type { Tier } from '../model/types';
  import { t } from '../i18n/i18n.svelte';

  let { tier, long = false }: { tier: Tier; long?: boolean } = $props();
</script>

<span class="tb t{tier}" title={t(`tier.${tier}.desc`)}>{long ? t(`tier.${tier}`) : tier}</span>

<style>
  .tb {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 6px;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: #fff;
    white-space: nowrap;
  }
  .tA {
    background: #065f46;
  }
  .tB {
    background: #1d4ed8;
  }
  .tC {
    background: #b45309;
  }
  .tD {
    background: #6b7280;
  }
</style>
