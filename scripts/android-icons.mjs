// Regenerates Android launcher icons and splash screens from the app's icon design.
//   node scripts/android-icons.mjs   (after `npx cap add android`)
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const RES = 'android/app/src/main/res';
const NAVY = '#14213D';
// The glyph: two arcs and the red dot, drawn in a 512 box.
const glyph = `<path d="M104 300a152 152 0 0 1 304 0" stroke="#fff" stroke-opacity=".55" stroke-width="30" fill="none" stroke-linecap="round"/><path d="M164 300a92 92 0 0 1 184 0" stroke="#fff" stroke-width="30" fill="none" stroke-linecap="round"/><circle cx="256" cy="300" r="42" fill="#C8102E"/>`;

const svg = {
  square: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${NAVY}"/>${glyph}</svg>`,
  round: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="${NAVY}"/>${glyph}</svg>`,
  // Adaptive icon foreground: glyph kept inside the central 66/108 safe zone.
  foreground: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(256 256) scale(0.58) translate(-256 -256)">${glyph}</g></svg>`,
};

const pngSize = (file) => {
  const b = fs.readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const render = (markup, w) => new Resvg(markup, { fitTo: { mode: 'width', value: w } }).render().asPng();

for (const dir of fs.readdirSync(RES)) {
  for (const [file, kind] of [['ic_launcher.png', 'square'], ['ic_launcher_round.png', 'round'], ['ic_launcher_foreground.png', 'foreground']]) {
    const p = path.join(RES, dir, file);
    if (fs.existsSync(p)) fs.writeFileSync(p, render(svg[kind], pngSize(p)[0]));
  }
  const splash = path.join(RES, dir, 'splash.png');
  if (fs.existsSync(splash)) {
    const [w, h] = pngSize(splash);
    const s = Math.min(w, h) * 0.28;
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${NAVY}"/><g transform="translate(${(w - s) / 2} ${(h - s) / 2}) scale(${s / 512})">${glyph}</g></svg>`;
    fs.writeFileSync(splash, new Resvg(markup).render().asPng());
  }
}
fs.writeFileSync(
  path.join(RES, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${NAVY}</color>\n</resources>\n`,
);
console.log('android icons and splash screens updated');
