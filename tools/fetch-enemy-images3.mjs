// Hochauflösende Feindbilder über explizite Wiki-Dateinamen:
// <Name>.png, <Name>_Main_Health.png, <Name>_Main_Front.png, ...,
// als letzter Fallback das 2048er Enemy-Icon.

import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2Feldhandbuch/1.0 (fan handbook; contact: local)';
const DATA = path.join(process.cwd(), 'data', 'enemies.json');
const OUT = path.join(process.cwd(), 'assets', 'img', 'enemies', 'hi');
const db = JSON.parse(await fs.readFile(DATA, 'utf8'));

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('format', 'json'); u.searchParams.set('formatversion', '2');
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json();
}
function chunks(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

function base(name) {
  return name.replace(/\([^)]*\)/g, '').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '');
}
function variants(name) {
  const b = base(name);
  return [
    `${b}.png`, `${b}.jpg`,
    `${b}_Main_Health.png`, `${b}_Main_Front.png`, `${b}_Main_Side.png`,
    `${b}_Main_Rear.png`, `${b}_Render.png`, `${b}_Full.png`,
    `${b}_Enemy_Icon.png`
  ];
}
function priority(file, name) {
  const b = base(name).toLowerCase();
  const f = file.toLowerCase();
  if (f === `${b}.png` || f === `${b}.jpg`) return 100;
  if (f.includes('_enemy_icon')) return 95;
  if (f.includes('_render')) return 90;
  if (f.includes('_full')) return 85;
  if (f.includes('_main_front')) return 60;
  if (f.includes('_main_side')) return 58;
  if (f.includes('_main_health')) return 40;
  if (f.includes('_main_rear')) return 38;
  return 50;
}

const all = [];
for (const e of db.enemies) {
  if (e.id === 'bile_titan') { e.imageLarge = 'assets/img/enemies/bile_titan_large.png'; continue; }
  for (const file of variants(e.name)) all.push({ e, file });
}

const info = new Map();
for (const batch of chunks(all, 40)) {
  const d = await api({
    action: 'query', prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '1400',
    titles: batch.map((x) => `File:${x.file}`).join('|')
  });
  const pages = Array.isArray(d.query?.pages) ? d.query.pages : Object.values(d.query?.pages || {});
  for (const p of pages) {
    const i = p.imageinfo?.[0];
    if (i) info.set(p.title.replace(/^File:/, ''), i);
  }
}

const byEnemy = new Map();
for (const { e, file } of all) {
  const i = info.get(file) || info.get(file.replace(/_/g, ' '));
  if (!i) continue;
  const list = byEnemy.get(e.id) || [];
  list.push({ file, i, p: priority(file, e.name) });
  byEnemy.set(e.id, list);
}

const chosen = [], missing = [];
for (const e of db.enemies) {
  if (e.id === 'bile_titan') continue;
  const list = (byEnemy.get(e.id) || []).filter((x) => x.i.width >= 500 && x.i.height >= 300);
  if (!list.length) { missing.push({ id: e.id, name: e.name }); continue; }
  list.sort((a, b) => (b.p - a.p) || (b.i.width * b.i.height - a.i.width * a.i.height));
  const best = list[0];
  chosen.push({ id: e.id, name: e.name, file: best.file, w: best.i.width, h: best.i.height, url: best.i.thumburl || best.i.url });
}

await fs.mkdir(OUT, { recursive: true });
let ok = 0, fail = 0;
for (const c of chosen) {
  try {
    const r = await fetch(c.url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await fs.writeFile(path.join(OUT, `${c.id}.png`), Buffer.from(await r.arrayBuffer()));
    ok++;
  } catch (err) { fail++; console.log('FAIL', c.id, c.file, err.message); }
}
for (const c of chosen) {
  const e = db.enemies.find((x) => x.id === c.id);
  if (e) e.imageLarge = `assets/img/enemies/hi/${c.id}.png`;
}
await fs.writeFile(DATA, JSON.stringify(db, null, 2));
console.log(JSON.stringify({ ok, fail, chosen: chosen.length, missing, samples: chosen.slice(0, 25) }, null, 2));
