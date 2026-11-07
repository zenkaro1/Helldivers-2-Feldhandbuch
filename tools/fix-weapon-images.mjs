// Repariert fehlende Waffenrender: liest das Infobox-Bild erneut und lädt
// jede Datei einzeln als 1200-px-PNG.

import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2Feldhandbuch/1.0 (fan handbook; contact: local)';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'assets', 'img', 'weapons', 'hi');
const DATA = path.join(ROOT, 'data', 'weapons.json');
const wp = JSON.parse(await fs.readFile(DATA, 'utf8'));

function pageTitle(w) {
  try {
    const u = new URL(w.source);
    return decodeURIComponent(u.pathname.split('/wiki/')[1].replace(/_/g, ' '));
  } catch { return w.name; }
}
function chunks(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
function field(content, name) {
  return (content.match(new RegExp(`^\\s*\\|\\s*${name}\\s*=\\s*(.*)$`, 'im'))?.[1] || '').trim();
}
function cleanImage(v, title) {
  let s = String(v || '').replace(/^\[\[File:/i, '').replace(/\]\]$/, '').replace(/^File:/i, '');
  s = s.split('|')[0].trim().replace(/\{\{PAGENAME\}\}/gi, title);
  return s;
}
async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json();
}

const titles = wp.weapons.map(pageTitle);
const contents = new Map();
for (const batch of chunks(titles, 40)) {
  const d = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: batch.join('|'), redirects: '1' });
  for (const p of d.query?.pages || []) {
    if (!p.missing) contents.set(p.title, p.revisions?.[0]?.slots?.main?.content || '');
    for (const r of d.query?.redirects || []) if (r.to === p.title) contents.set(r.from, p.revisions?.[0]?.slots?.main?.content || '');
  }
}

const jobs = [];
const noImage = [];
for (const w of wp.weapons) {
  const text = contents.get(pageTitle(w)) || contents.get(w.name) || '';
  const box = text.match(/\{\{Infobox[^\n]*\n([\s\S]*?)\n\}\}/i)?.[1] || text;
  const title = pageTitle(w);
  const file = cleanImage(field(box, 'weapon_image') || field(box, 'image') || field(box, 'stratagem_image'), title);
  if (!file) { noImage.push(w.name); continue; }
  w.imageFile = file;
  jobs.push({ w, file });
}

let done = 0, fail = 0;
const queue = [...jobs];
async function worker() {
  while (queue.length) {
    const { w, file } = queue.shift();
    const dest = path.join(OUT, `${w.id}.png`);
    try {
      const st = await fs.stat(dest).catch(() => null);
      if (st && st.size > 8000) {
        w.image = `assets/img/weapons/hi/${w.id}.png`;
        done++;
        continue;
      }
      const d = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '1200', titles: `File:${file}` });
      const p = d.query?.pages?.[0];
      const info = p?.imageinfo?.[0];
      const url = info?.thumburl || info?.url;
      if (!url) throw new Error('keine imageinfo');
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
      w.image = `assets/img/weapons/hi/${w.id}.png`;
      done++;
    } catch (e) {
      fail++;
      console.log('FAIL', w.id, file, e.message);
    }
  }
}
await Promise.all(Array.from({ length: 5 }, worker));

// Relative Pfade korrigieren
for (const w of wp.weapons) {
  if (w.image?.startsWith('/')) w.image = w.image.slice(1);
}
await fs.writeFile(DATA, JSON.stringify(wp, null, 2));
const missing = [];
for (const w of wp.weapons) {
  const st = await fs.stat(path.join(OUT, `${w.id}.png`)).catch(() => null);
  if (!st || st.size < 8000) missing.push(`${w.id} (${w.name}) ${w.imageFile || ''}`);
}
console.log(JSON.stringify({ done, fail, noImage, missingCount: missing.length, missing }, null, 2));
