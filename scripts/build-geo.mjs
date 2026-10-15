// Builds the offline place list and country outline used by the app.
//
//   node scripts/build-geo.mjs <dir-with-AL.txt-and-XK.txt> <ne_50m_admin_0_countries.geojson>
//
// Inputs:
//   GeoNames dumps AL.txt, XK.txt  https://download.geonames.org/export/dump/  (CC BY 4.0)
//   Natural Earth 50m countries    https://github.com/nvkelso/natural-earth-vector  (public domain)
import fs from 'node:fs';
import path from 'node:path';

const [, , geoDir, nePath] = process.argv;
if (!geoDir || !nePath) {
  console.error('usage: node scripts/build-geo.mjs <geonames-dir> <ne-countries.geojson>');
  process.exit(1);
}

// Generic Albanian words that are also village names; matching them would create false places.
const STOP = new Set(['qender', 'ura', 'fusha', 'kodra', 'mali', 'lumi', 'rruga', 'fshat', 'shkolla', 'kala', 'kalaja', 'mamurras', 'zall', 'gur', 'vend', 'stan', 'lagje', 'pus', 'arra', 'dardha', 'molla', 'bardhe', 'lura', 'qafe', 'kuq', 'para', 'bote', 'shtat', 'rrota', 'arras',
  // first names, surnames and common words that are also village names
  'kosovo', 'clirim', 'blerim', 'perparim', 'hasan', 'kastriot', 'armen', 'levan', 'kombesi', 'katundi', 'baza', 'lisa', 'golem', 'pirg', 'kote', 'kuci', 'kute', 'tapi', 'remas', 'farka', 'gege', 'hoti', 'kurjan', 'kuman', 'kajan', 'karine', 'suke', 'sult', 'tomin', 'pojan', 'miras', 'melan', 'vrap', 'kalis', 'lunik', 'sinje', 'brataj', 'fratar', 'arren', 'buze', 'lekas', 'kolc', 'qerret', 'ostren', 'bujan', 'kryevidh', 'krahes', 'kashar-fshat', 'armeni', 'bushat', 'bushati']);
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ë/g, 'e').replace(/ç/g, 'c');
const LATIN = /^[A-Za-zÇçËë' -]{3,40}$/;

const places = [];
for (const cc of ['AL', 'XK']) {
  const rows = fs.readFileSync(path.join(geoDir, `${cc}.txt`), 'utf8').split('\n');
  for (const line of rows) {
    const c = line.split('\t');
    if (c[6] !== 'P') continue;
    const code = c[7];
    const pop = Number(c[14] || 0);
    const admin = /PPLA|PPLC/.test(code);
    if (!admin && pop < 1000) continue;
    const names = new Set([c[1], c[2], ...(c[3] ? c[3].split(',') : [])].filter((n) => LATIN.test(n)));
    // Keep only spellings that share the official name's first 4 letters (Tiranë, Tirana, Tirane),
    // dropping historic and foreign exonyms that would cause false matches.
    const stem = fold(c[2]).slice(0, 4);
    const keys = [...new Set([...names].map(fold))].filter(
      (k) => k.length >= 4 && !STOP.has(k) && !k.includes(' ') && k.startsWith(stem) &&
        // -aj names are usually family/clan names too
        !(k.endsWith('aj') && pop < 10000),
    );
    if (!keys.length) continue;
    places.push({
      id: `gn:${c[0]}`,
      name: c[1],
      keys,
      lat: Math.round(Number(c[4]) * 1e4) / 1e4,
      lon: Math.round(Number(c[5]) * 1e4) / 1e4,
      pop,
      cc,
    });
  }
}
places.sort((a, b) => b.pop - a.pop);

const out = path.resolve('src/lib/geo/places.json');
fs.writeFileSync(out, JSON.stringify(places));
console.log(`places: ${places.length} -> ${out} (${fs.statSync(out).size} bytes)`);

const ne = JSON.parse(fs.readFileSync(nePath, 'utf8'));
const feats = ne.features
  .filter((f) => ['ALB', 'KOS', 'XKX'].includes(f.properties.ADM0_A3) || ['Albania', 'Kosovo'].includes(f.properties.NAME))
  .map((f) => ({ type: 'Feature', properties: { name: f.properties.NAME }, geometry: f.geometry }));
const outline = path.resolve('public/outline.geojson');
fs.writeFileSync(outline, JSON.stringify({ type: 'FeatureCollection', features: feats }));
console.log(`outline: ${feats.length} countries -> ${outline} (${fs.statSync(outline).size} bytes)`);
