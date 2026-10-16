<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
  import type { FeatureCollection } from 'geojson';
  import { CENTER, OFFLINE_STYLE, ONLINE_STYLE, maplibre } from './maplib';
  import type { Category, Incident } from '../model/types';
  import { app, toast } from '../app.svelte';
  import { t, ago } from '../i18n/i18n.svelte';
  import Badge from './Badge.svelte';
  import AgeChip from './AgeChip.svelte';
  import { incidentIcon } from './explain';
  import { CAT_COLOR, CAT_ICON, RADIUS_M } from './meta';

  let { onopen, onreport, onguide }: { onopen: (i: Incident) => void; onreport: () => void; onguide: (id: string) => void } = $props();

  // Map filters: protests and police activity are on by default. The choice is remembered.
  const MAP_CATS: Category[] = ['demonstration', 'police-presence', 'police-notice', 'road-closure', 'emergency', 'traffic', 'hazard', 'official-notice'];
  const DEFAULT_CATS: Category[] = ['demonstration', 'police-presence', 'police-notice'];
  const PERIODS = [2, 12, 24, 168] as const;

  function loadPrefs(): { cats: Category[]; hours: number } {
    try {
      const p = JSON.parse(localStorage.getItem('mapPrefs2') ?? 'null');
      if (p && Array.isArray(p.cats) && PERIODS.includes(p.hours)) return p;
    } catch {
      /* ignore */
    }
    return { cats: DEFAULT_CATS, hours: 24 };
  }
  const prefs = loadPrefs();
  let cats = $state<Category[]>(prefs.cats);
  let hours = $state<number>(prefs.hours);
  $effect(() => {
    try {
      localStorage.setItem('mapPrefs2', JSON.stringify({ cats, hours }));
    } catch {
      /* ignore */
    }
  });

  let el: HTMLDivElement;
  let strip = $state<HTMLDivElement>();
  let map: MapLibreMap | undefined;
  let loaded = $state(false);
  let offline = $state(false);
  let selected = $state<string | null>(null);
  let showLegend = $state(false);
  const markers = new Map<string, { marker: Marker; el: HTMLElement }>();
  const clusterMarkers: Marker[] = [];
  const subPins: Marker[] = [];
  let userPin: Marker | undefined;
  /** Above this many events on one spot, zoomed out, show one bubble with the number instead. */
  const CLUSTER_MIN = 5;
  const CLUSTER_ZOOM = 11;

  const inWindow = (i: Incident) => i.status !== 'historical' && Date.parse(i.lastSeen) >= Date.now() - hours * 3600e3;
  const counts = $derived(
    Object.fromEntries(MAP_CATS.map((c) => [c, app.incidents.filter((i) => i.category === c && inWindow(i)).length])) as Record<Category, number>,
  );
  const visible = $derived(
    app.incidents
      .filter((i) => cats.includes(i.category) && inWindow(i))
      // Current events first, then most recent.
      .sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || Date.parse(b.lastSeen) - Date.parse(a.lastSeen)),
  );

  function toggleCat(c: Category) {
    cats = cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c];
  }

  // ---------- drawing ----------

  function circle(lon: number, lat: number, radiusM: number, steps = 48): [number, number][] {
    const pts: [number, number][] = [];
    const dLat = radiusM / 111320;
    const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      pts.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
    }
    return pts;
  }

  function areas(): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: visible.map((i) => ({
        type: 'Feature',
        properties: {
          color: CAT_COLOR[i.category],
          old: i.status !== 'active',
          // When exact places are shown as pins, the town-wide circle stays faint.
          sel: i.id === selected && !(i.placeCounts ?? []).some((pc) => pc.place.precision === 'landmark'),
          wide: i.place.precision !== 'landmark',
        },
        geometry: { type: 'Polygon', coordinates: [circle(i.place.lon, i.place.lat, RADIUS_M[i.place.precision])] },
      })),
    };
  }

  function addAreaLayers() {
    if (!map || map.getSource('areas')) return;
    map.addSource('areas', { type: 'geojson', data: areas() });
    const color = ['get', 'color'] as unknown as ExpressionSpecification;
    // The approximate area appears once you zoom in; zoomed out, the markers carry the map.
    map.addLayer({
      id: 'area-fill',
      type: 'fill',
      source: 'areas',
      minzoom: 9,
      // Town-wide circles fade out at street zoom, where they would tint the whole screen.
      paint: {
        'fill-color': color,
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          ['case', ['get', 'sel'], 0.28, ['get', 'old'], 0.08, 0.16],
          13,
          ['case', ['get', 'wide'], 0.03, ['get', 'sel'], 0.28, ['get', 'old'], 0.08, 0.16],
        ] as unknown as ExpressionSpecification,
      },
    });
    map.addLayer({
      id: 'area-line',
      type: 'line',
      source: 'areas',
      minzoom: 9,
      paint: { 'line-color': color, 'line-width': ['case', ['get', 'sel'], 2.5, 1.2], 'line-opacity': ['case', ['get', 'old'], 0.4, 0.8] },
    });
    loaded = true;
  }

  /** Events at the same spot (e.g. several in Tirana) are fanned out so each can be tapped. */
  function offsets(list: Incident[]): Map<string, [number, number]> {
    const groups = new Map<string, Incident[]>();
    for (const i of list) {
      const k = `${i.place.lat.toFixed(3)},${i.place.lon.toFixed(3)}`;
      groups.set(k, [...(groups.get(k) ?? []), i]);
    }
    const out = new Map<string, [number, number]>();
    for (const g of groups.values()) {
      g.forEach((i, k) => {
        if (g.length === 1) return out.set(i.id, [0, 0]);
        const a = (2 * Math.PI * k) / g.length - Math.PI / 2;
        const r = Math.min(150, 18 + 5 * g.length);
        out.set(i.id, [Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))]);
      });
    }
    return out;
  }

  function markerEl(i: Incident): HTMLElement {
    // MapLibre positions the outer element with its own transform, so all styling
    // (including the selected-state zoom) lives on the inner button.
    const root = document.createElement('div');
    root.className = 'pmk';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmk-b';
    btn.style.setProperty('--c', CAT_COLOR[i.category]);
    btn.setAttribute('aria-label', `${t(`cat.${i.category}`)}: ${i.title}`);
    const icon = document.createElement('span');
    icon.className = 'pmk-i';
    icon.textContent = incidentIcon(i, app.reports.filter((r) => i.reportIds.includes(r.id)), CAT_ICON[i.category]);
    btn.append(icon);
    if (i.assessment.conflict || i.assessment.occurred === 'disputed') {
      const w = document.createElement('span');
      w.className = 'pmk-w';
      w.textContent = '!';
      btn.append(w);
    }
    const n = i.assessment.independentSources;
    if (n > 1) {
      const b = document.createElement('span');
      b.className = 'pmk-n';
      b.textContent = String(n);
      btn.append(b);
    }
    root.append(btn);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      void select(i, false);
    });
    return root;
  }

  const spotKey = (i: Incident) => `${i.place.lat.toFixed(3)},${i.place.lon.toFixed(3)}`;

  function syncMarkers() {
    if (!map || !loaded) return;
    for (const m of markers.values()) m.marker.remove();
    markers.clear();
    for (const c of clusterMarkers.splice(0)) c.remove();

    // Zoomed out, many events on one spot (e.g. 30 police stories "in Tirana") become one bubble.
    const bySpot = new Map<string, Incident[]>();
    for (const i of visible) bySpot.set(spotKey(i), [...(bySpot.get(spotKey(i)) ?? []), i]);
    const clustered = new Set<string>();
    if (map.getZoom() < CLUSTER_ZOOM) {
      for (const group of bySpot.values()) {
        if (group.length < CLUSTER_MIN || group.some((i) => i.id === selected)) continue;
        for (const i of group) clustered.add(i.id);
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'pcl';
        el.setAttribute('aria-label', t('map.cluster', { n: group.length, place: group[0].place.name }));
        const icons = [...new Set(group.map((i) => CAT_ICON[i.category]))].slice(0, 3).join('');
        el.innerHTML = '';
        const ic = document.createElement('span');
        ic.textContent = icons;
        const n = document.createElement('strong');
        n.textContent = String(group.length);
        el.append(ic, n);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          map?.flyTo({ center: [group[0].place.lon, group[0].place.lat], zoom: CLUSTER_ZOOM + 1, duration: 700 });
        });
        clusterMarkers.push(new maplibre.Marker({ element: el }).setLngLat([group[0].place.lon, group[0].place.lat]).addTo(map));
      }
    }

    const shown = visible.filter((i) => !clustered.has(i.id));
    const off = offsets(shown);
    // Add in reverse so the newest/current events sit on top.
    for (const i of [...shown].reverse()) {
      markers.get(i.id)?.marker.remove();
      const elm = markerEl(i);
      const marker = new maplibre.Marker({ element: elm, offset: off.get(i.id) ?? [0, 0] }).setLngLat([i.place.lon, i.place.lat]).addTo(map);
      markers.set(i.id, { marker, el: elm });
    }
    styleMarkers();
    (map.getSource('areas') as GeoJSONSource | undefined)?.setData(areas());
  }

  function styleMarkers() {
    for (const i of visible) {
      const m = markers.get(i.id);
      if (!m) continue;
      m.el.classList.toggle('old', i.status !== 'active');
      m.el.classList.toggle('sel', i.id === selected);
      m.el.style.zIndex = i.id === selected ? '10' : i.status === 'active' ? '2' : '1';
    }
  }

  function fitToVisible() {
    if (!map || !visible.length) return;
    if (visible.length === 1) {
      map.flyTo({ center: [visible[0].place.lon, visible[0].place.lat], zoom: 11 });
      return;
    }
    const b = new maplibre.LngLatBounds();
    for (const i of visible) b.extend([i.place.lon, i.place.lat]);
    map.fitBounds(b, { padding: { top: 120, bottom: 200, left: 50, right: 50 }, maxZoom: 11, duration: 600 });
  }

  /** For the selected event: one pin per exact place the reports name, with how many reports name it. */
  function showSubPins(i: Incident | undefined) {
    for (const s of subPins.splice(0)) s.remove();
    if (!map || !i) return [];
    const spots = (i.placeCounts ?? []).filter((pc) => pc.place.precision === 'landmark' && pc.place.gazetteerId !== i.place.gazetteerId);
    spots.forEach((pc, rank) => {
      const el = document.createElement('div');
      el.className = 'psub';
      el.style.setProperty('--c', CAT_COLOR[i.category]);
      const dot = document.createElement('span');
      dot.className = 'psub-dot';
      dot.textContent = String(pc.reports);
      el.append(dot);
      // Names only for the most-named places, so labels don't pile up; the full list is in the details.
      if (rank < 4) {
        const label = document.createElement('span');
        label.className = 'psub-l';
        label.textContent = pc.place.name;
        el.append(label);
      }
      subPins.push(new maplibre.Marker({ element: el, anchor: 'left', offset: [-11, 0] }).setLngLat([pc.place.lon, pc.place.lat]).addTo(map!));
    });
    return spots;
  }

  async function select(i: Incident, fly: boolean) {
    selected = i.id;
    syncMarkers();
    const spots = showSubPins(i);
    (map?.getSource('areas') as GeoJSONSource | undefined)?.setData(areas());
    if (fly && map) {
      if (spots.length) {
        const b = new maplibre.LngLatBounds();
        b.extend([i.place.lon, i.place.lat]);
        for (const s of spots) b.extend([s.place.lon, s.place.lat]);
        map.fitBounds(b, { padding: { top: 140, bottom: 220, left: 60, right: 120 }, maxZoom: 15, duration: 700 });
      } else {
        map.flyTo({ center: [i.place.lon, i.place.lat], zoom: Math.max(map.getZoom(), 10), duration: 700 });
      }
    }
    await tick();
    strip?.querySelector(`[data-id="${CSS.escape(i.id)}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  // ---------- lifecycle ----------

  function useOffline() {
    if (!map || offline) return;
    offline = true;
    loaded = false;
    map.setStyle(OFFLINE_STYLE);
    map.once('styledata', () => {
      addAreaLayers();
      syncMarkers();
    });
  }

  onMount(() => {
    offline = !navigator.onLine;
    map = new maplibre.Map({
      container: el,
      style: offline ? OFFLINE_STYLE : ONLINE_STYLE,
      center: CENTER,
      zoom: 6.6,
      attributionControl: false,
    });
    map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibre.AttributionControl({ compact: true }), 'top-right');
    map.on('load', () => {
      // Start with the map credits folded into their ⓘ button instead of covering the map.
      el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      addAreaLayers();
      syncMarkers();
      fitToVisible();
      void showMeIfAllowed();
    });
    let lastZoomBand = map.getZoom() < CLUSTER_ZOOM;
    map.on('zoomend', () => {
      const band = map!.getZoom() < CLUSTER_ZOOM;
      if (band !== lastZoomBand) {
        lastZoomBand = band;
        syncMarkers();
      }
    });
    map.on('click', () => {
      selected = null;
      showSubPins(undefined);
    });
    map.on('error', (e) => {
      // Basemap unavailable (no internet): fall back to the bundled outline map.
      if (!offline && /style|tile|fetch|Failed/i.test(String(e.error?.message ?? ''))) useOffline();
    });
  });

  // Redraw when data or filters change; re-fit only when the filters change.
  $effect(() => {
    void visible;
    syncMarkers();
  });
  let lastFilter = '';
  $effect(() => {
    const f = `${cats.join(',')}|${hours}`;
    if (loaded && lastFilter && f !== lastFilter) fitToVisible();
    if (loaded) lastFilter = f;
  });
  $effect(() => {
    void selected;
    styleMarkers();
  });

  onDestroy(() => {
    for (const m of markers.values()) m.marker.remove();
    for (const c of [...clusterMarkers, ...subPins]) c.remove();
    userPin?.remove();
    map?.remove();
  });

  /** Your own position as a blue pin. Shown only on this phone, never stored, never shared. */
  function placeMe(lat: number, lon: number) {
    if (!map) return;
    if (!userPin) {
      const el = document.createElement('div');
      el.className = 'pme';
      el.setAttribute('aria-label', t('map.you'));
      const dot = document.createElement('span');
      dot.className = 'pme-dot';
      const label = document.createElement('span');
      label.className = 'pme-l';
      label.textContent = t('map.you');
      el.append(dot, label);
      userPin = new maplibre.Marker({ element: el, anchor: 'center' });
    }
    userPin.setLngLat([lon, lat]).addTo(map);
  }

  function locate(fly: boolean) {
    if (!navigator.geolocation) return toast(t('map.noLocation'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placeMe(pos.coords.latitude, pos.coords.longitude);
        if (fly) {
          map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 });
          toast(t('map.nearMeNote'));
        }
      },
      () => fly && toast(t('map.noLocation')),
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 15000 },
    );
  }
  const nearMe = () => locate(true);

  /** If the user already allowed location before, show the pin straight away (no prompt). */
  async function showMeIfAllowed() {
    try {
      const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      if (st?.state === 'granted') locate(false);
    } catch {
      /* permissions API not available: wait for the button */
    }
  }
</script>

<div class="wrap">
  <div class="map" bind:this={el}></div>

  <div class="filters">
    <div class="chips">
      <select class="chip period" bind:value={hours} aria-label="time">
        {#each PERIODS as h}<option value={h}>🕒 {t(`map.period.${h}`)}</option>{/each}
      </select>
      {#each MAP_CATS as c}
        <button class="chip cat" style:--c={CAT_COLOR[c]} aria-pressed={cats.includes(c)} onclick={() => toggleCat(c)}>
          <span aria-hidden="true">{CAT_ICON[c]}</span>
          {t(`catShort.${c}`)}
          <span class="count">{counts[c]}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if offline}<div class="offline xs">{t('map.offline')}</div>{/if}

  <button class="fab" onclick={onreport}>＋ {t('map.report')}</button>

  <div class="side">
    <button class="round" onclick={() => onguide('map')} aria-label={t('help.how')}>?</button>
    <button class="round" onclick={() => (showLegend = !showLegend)} aria-label={t('map.legendTitle')} aria-expanded={showLegend}>ⓘ</button>
    <button class="round" onclick={nearMe} aria-label={t('map.nearMe')}>📍</button>
  </div>

  {#if showLegend}
    <div class="legend card small" role="dialog" aria-label={t('map.legendTitle')}>
      <strong>{t('map.legendTitle')}</strong>
      <ul>
        <li>{t('map.legendColor')}</li>
        <li><span class="demo-n">3</span> {t('map.legendNumber')}</li>
        <li>{t('map.legendFaded')}</li>
        <li>{t('map.legend')}</li>
        <li><span class="demo-w">!</span> {t('conflict.badge')}</li>
      </ul>
      <button class="btn small" onclick={() => onguide('map')}>{t('help.more')} →</button>
    </div>
  {/if}

  {#if loaded && !visible.length}
    <div class="empty card">
      <p>{t('map.empty', { period: t(`map.period.${hours}`) })}</p>
      {#if hours < 168}<button class="btn small" onclick={() => (hours = 168)}>{t('map.show7d')}</button>{/if}
    </div>
  {/if}

  {#if visible.length}
    <div class="strip" bind:this={strip}>
      {#each visible as i (i.id)}
        <article class="mc card" class:sel={selected === i.id} class:old={i.status !== 'active'} data-id={i.id} style:--c={CAT_COLOR[i.category]}>
          <button class="mc-main" onclick={() => select(i, true)}>
            <div class="mc-top">
              <span class="mc-cat">{CAT_ICON[i.category]} {t(`catShort.${i.category}`)}</span>
              <Badge state={i.assessment.occurred} />
            </div>
            <div class="mc-title">{i.title}</div>
            <div class="mc-meta"><AgeChip incident={i} /> <span>📍 {i.place.name}</span></div>
          </button>
          <button class="mc-more" onclick={() => onopen(i)}>{t('map.details')} →</button>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    height: 100%;
    min-height: 300px;
    overflow: hidden;
  }
  .map {
    position: absolute;
    inset: 0;
    /* Own stacking layer: markers never draw over the filter bar, legend or cards. */
    z-index: 0;
  }
  .filters {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding-top: 10px;
    z-index: 3;
    background: linear-gradient(to bottom, color-mix(in srgb, var(--bg) 85%, transparent), transparent);
  }
  .filters .chips {
    padding-bottom: 10px;
  }
  .chip {
    box-shadow: var(--shadow);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .chip.cat[aria-pressed='true'] {
    background: var(--c);
    border-color: var(--c);
    color: #fff;
  }
  .chip.cat[aria-pressed='false'] {
    color: var(--ink-2);
  }
  .count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: var(--fs-xs);
    font-weight: 700;
    background: rgb(0 0 0 / 0.08);
    text-align: center;
  }
  .chip.cat[aria-pressed='true'] .count {
    background: rgb(255 255 255 / 0.25);
  }
  .period {
    appearance: none;
    padding-right: 14px;
    font-weight: 600;
  }
  .offline {
    position: absolute;
    top: 64px;
    left: 12px;
    z-index: 3;
    background: var(--ink);
    color: var(--bg);
    padding: 4px 10px;
    border-radius: 999px;
  }
  .fab {
    position: absolute;
    left: 12px;
    bottom: 170px;
    z-index: 3;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    border: none;
    background: var(--accent);
    color: #fff;
    font-weight: 800;
    box-shadow: 0 3px 10px rgb(0 0 0 / 0.3);
    cursor: pointer;
  }
  .demo-w {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #7c3aed;
    color: #fff;
    font-size: var(--fs-xs);
    font-weight: 800;
  }
  .side {
    position: absolute;
    right: 10px;
    bottom: 170px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .round {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid var(--line);
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 1.25rem;
    cursor: pointer;
  }
  .legend {
    position: absolute;
    right: 68px;
    bottom: 170px;
    z-index: 4;
    max-width: 280px;
    padding: 12px 14px;
  }
  .legend ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
  .legend li {
    margin: 4px 0;
  }
  .demo-n {
    display: inline-block;
    min-width: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--bg);
    font-size: var(--fs-xs);
    font-weight: 700;
    text-align: center;
  }
  .empty {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 24px;
    z-index: 3;
    padding: 14px 16px;
    text-align: center;
  }
  .empty p {
    margin: 0 0 10px;
    color: var(--ink-2);
  }
  .strip {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 12px;
    z-index: 3;
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 4px 16px;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }
  .strip::-webkit-scrollbar {
    display: none;
  }
  .mc {
    flex: none;
    width: min(82%, 340px);
    scroll-snap-align: center;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-left: 5px solid var(--c);
  }
  .mc.sel {
    outline: 2px solid var(--c);
  }
  .mc.old {
    opacity: 0.75;
  }
  .mc-main {
    text-align: left;
    border: none;
    background: none;
    padding: 10px 12px 6px;
    cursor: pointer;
  }
  .mc-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }
  .mc-cat {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--c);
  }
  .mc-title {
    margin-top: 4px;
    font-weight: 650;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .mc-meta {
    margin-top: 6px;
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: var(--fs-xs);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
  }
  .mc-more {
    border: none;
    border-top: 1px solid var(--line);
    background: none;
    min-height: 40px;
    font-weight: 700;
    font-size: var(--fs-sm);
    color: var(--ink);
    cursor: pointer;
  }

  /* Map markers are created outside Svelte, so their styles are global. */
  :global(.pmk) {
    width: 40px;
    height: 40px;
  }
  :global(.pmk-b) {
    position: relative;
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 50%;
    border: 3px solid #fff;
    background: var(--c);
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
    cursor: pointer;
    transition: transform 0.15s;
    display: grid;
    place-items: center;
  }
  :global(.pmk-i) {
    font-size: 19px;
    line-height: 1;
  }
  :global(.pmk-n) {
    position: absolute;
    top: -7px;
    right: -9px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 999px;
    background: #14213d;
    color: #fff;
    border: 2px solid #fff;
    font: 700 11px/16px system-ui, sans-serif;
    text-align: center;
  }
  :global(.pmk-w) {
    position: absolute;
    bottom: -6px;
    right: -8px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #7c3aed;
    color: #fff;
    border: 2px solid #fff;
    font: 800 11px/14px system-ui, sans-serif;
    text-align: center;
  }
  :global(.pmk.old .pmk-b) {
    opacity: 0.5;
    filter: grayscale(0.4);
  }
  :global(.pmk.sel .pmk-b) {
    transform: scale(1.3);
    opacity: 1;
    filter: none;
    box-shadow: 0 0 0 4px rgb(255 255 255 / 0.7), 0 4px 12px rgb(0 0 0 / 0.4);
  }
  :global(.pcl) {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px 6px 8px;
    border-radius: 999px;
    border: 3px solid #fff;
    background: #14213d;
    color: #fff;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
    font: 800 15px/1 system-ui, sans-serif;
    cursor: pointer;
  }
  :global(.pcl span) {
    font-size: 16px;
  }
  :global(.psub) {
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: none;
  }
  :global(.psub-dot) {
    min-width: 22px;
    height: 22px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--c);
    border: 2px solid #fff;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
    color: #fff;
    font: 800 11px/18px system-ui, sans-serif;
    text-align: center;
  }
  :global(.psub-l) {
    padding: 3px 8px;
    border-radius: 8px;
    background: #fff;
    color: #14213d;
    font: 700 12px/1.2 system-ui, sans-serif;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
    white-space: nowrap;
  }
  :global(.pme) {
    position: relative;
    width: 22px;
    height: 22px;
  }
  :global(.pme-dot) {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: #2563eb;
    border: 4px solid #fff;
    box-shadow: 0 0 0 6px rgb(37 99 235 / 0.25), 0 2px 6px rgb(0 0 0 / 0.4);
  }
  :global(.pme-l) {
    position: absolute;
    top: 26px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 8px;
    border-radius: 999px;
    background: #2563eb;
    color: #fff;
    font: 800 11px/1.4 system-ui, sans-serif;
    white-space: nowrap;
  }
  /* Keep MapLibre's zoom buttons and credits clear of the filter bar. */
  .wrap :global(.maplibregl-ctrl-top-right) {
    top: 60px;
  }
</style>
