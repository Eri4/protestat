import type { Category, ConfidenceState, PlaceRef } from '../model/types';
import { t } from '../i18n/i18n.svelte';

export const CAT_ICON: Record<Category, string> = {
  demonstration: '✊',
  'road-closure': '🚧',
  traffic: '🚗',
  emergency: '🚨',
  hazard: '⚠️',
  'police-notice': '👮',
  'police-presence': '🚓',
  'official-notice': '🏛️',
  other: '📰',
};

/** One colour per type of event, used on the map and the news cards (readable in light and dark). */
export const CAT_COLOR: Record<Category, string> = {
  demonstration: '#c8102e',
  'police-notice': '#1d4ed8',
  'police-presence': '#4338ca',
  'road-closure': '#d97706',
  traffic: '#64748b',
  emergency: '#ea580c',
  hazard: '#7c3aed',
  'official-notice': '#0f766e',
  other: '#64748b',
};

export const CONF_ICON: Record<ConfidenceState, string> = {
  unverified: '?',
  low: '●',
  moderate: '●●',
  high: '●●●',
  confirmed: '✓',
  disputed: '!',
  stale: '◷',
};

export const confColor = (c: ConfidenceState) => `var(--c-${c})`;

/** Map circle radius in metres: the area is never smaller than ~500 m. */
export const RADIUS_M = { landmark: 500, city: 3000, region: 20000, country: 60000 } as const;

export const placeLabel = (p?: PlaceRef) =>
  p ? `${p.name} · ${t(`place.${p.precision}`)}` : t('place.unknown');
