// One place that loads MapLibre, its styles and its bundled worker, shared by the map and the report form.
import * as maplibre from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { StyleSpecification } from 'maplibre-gl';

maplibre.setWorkerUrl(workerUrl);

export { maplibre };

// Free, no key, no tracking: https://openfreemap.org
export const ONLINE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const CENTER: [number, number] = [19.9, 41.2];
export const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: { outline: { type: 'geojson', data: './outline.geojson' } },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#dfe7ee' } },
    { id: 'land', type: 'fill', source: 'outline', paint: { 'fill-color': '#f7f7f3' } },
    { id: 'border', type: 'line', source: 'outline', paint: { 'line-color': '#94a3b8', 'line-width': 1.2 } },
  ],
};
