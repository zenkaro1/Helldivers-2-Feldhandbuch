// Lädt für jeden Feind das offizielle Enemy-Icon in 1400 px. Das ist
// konsistente, hochauflösende Feind-Art statt Anatomie-Diagrammen.
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2Feldhandbuch/1.0 (fan handbook; contact: local)';
const DATA = path.join(process.cwd(), 'data', 'enemies.json');
const OUT = path.join(process.cwd(), 'assets', 'img', 'enemies', 'icons');
const db = JSON.parse(await fs.readFile(DATA, 'utf8'));

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('format', 'json'); u.searchParams.set('formatversion', '2');
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
function chunks(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
function iconName(name) {
  return name.replace(/\([^)]*\)/g, '').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '') + '_Enemy_Icon.png';
}

const items = db.enemies.filter((e) => e.id !== 'bile_titan').map((e) => ({ e, file: iconName(e.name) }));
const info = new Map();
for (const batch of chunks(items, 40)) {
  const d = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '1400', titles: batch.map((x) => `File:${x.file}`).join('|') });
  const pages = Array.isArray(d.query?.pages) ? d.query.pages : Object.values(d.query?.pages || {});
  for (const p of pages) {
    const i = p.imageinfo?.[0];
    if (i) info.set(p.title.replace(/^File:/, ''), i);
  }
}
await fs.mkdir(OUT, { recursive: true });
let ok = 0, missing = [];
for (const { e, file } of items) {
  const i = info.get(file) || info.get(file.replace(/_/g, ' '));
  if (!i) { missing.push({ id: e.id, file }); continue; }
  try {
    const r = await fetch(i.thumburl || i.url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await fs.writeFile(path.join(OUT, `${e.id}.png`), Buffer.from(await r.arrayBuffer()));
    e.imageLarge = `assets/img/enemies/icons/${e.id}.png`;
    ok++;
  } catch (err) { missing.push({ id: e.id, file, err: err.message }); }
}
db.enemies.find((e) => e.id === 'bile_titan').imageLarge = 'assets/img/enemies/bile_titan_large.png';
await fs.writeFile(DATA, JSON.stringify(db, null, 2));
console.log(JSON.stringify({ ok, missing, count: items.length }, null, 2));
