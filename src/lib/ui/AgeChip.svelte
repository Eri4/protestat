<script lang="ts">
  import type { Incident } from '../model/types';
  import { t } from '../i18n/i18n.svelte';
  import { ageInfo } from './explain';

  let { incident }: { incident: Incident } = $props();
  const info = $derived(ageInfo(incident));
  const conflict = $derived(incident.assessment.conflict || incident.assessment.occurred === 'disputed');
</script>

<span class="age {info.level}">{info.level === 'fresh' ? '🟢' : info.level === 'recent' ? '🟡' : '⏳'} {info.label}</span>
{#if conflict}<span class="conf">⚠️ {t('conflict.badge')}</span>{/if}

<style>
  .age,
  .conf {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: var(--fs-xs);
    font-weight: 700;
    white-space: nowrap;
  }
  .age.fresh {
    background: color-mix(in srgb, var(--c-high) 14%, transparent);
    color: var(--c-high);
  }
  .age.recent {
    background: color-mix(in srgb, var(--c-low) 14%, transparent);
    color: var(--c-low);
  }
  .age.old {
    background: var(--surface-2);
    color: var(--ink-2);
  }
  .conf {
    background: color-mix(in srgb, var(--c-disputed) 14%, transparent);
    color: var(--c-disputed);
  }
</style>
