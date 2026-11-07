// Holt für alle Waffen das Wiki-Render (1200 px) und die Infobox-Werte.
// Aufruf: node tools/enrich-weapons.mjs

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
    const p = u.pathname.split('/wiki/')[1];
    return p ? decodeURIComponent(p.replace(/_/g, ' ')) : w.name;
  } catch {
    return w.name;
  }
}

async function api(params) {
  const url = new URL(API);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`API ${res.status} ${url}`);
  return res.json();
}

function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function field(content, name) {
  const re = new RegExp(`^\\s*\\|\\s*${name}\\s*=\\s*(.*)$`, 'im');
  return (content.match(re)?.[1] || '').trim();
}

function strip(v) {
  return String(v || '')
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{\{\*\}\}/g, ' · ')
    .replace(/\{\{Tooltip\|([^|}]+)[^}]*\}\}/gi, '$1')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{Currency\|([^|}]+)\|([^}]+)\}\}/gi, '$2 $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\/\s*|\s*\/$/g, '');
}

function damage(v) {
  const text = String(v || '');
  const parts = [];
  const re = /\{\{Damage\|([^|}]+)\|([^}|]+)[^}]*\}\}/gi;
  let m;
  while ((m = re.exec(text))) {
    const type = strip(m[1]);
    const val = strip(m[2]);
    if (val) parts.push(`${val} ${type}`.trim());
  }
  if (!parts.length) {
    const n = text.match(/\d[\d,.]*/);
    if (n) parts.push(n[0]);
  }
  return [...new Set(parts)].join(' / ');
}

function armor(v) {
  const text = String(v || '');
  const parts = [];
  const re = /\{\{Armor\|([^|}]+)\|([^}|]+)[^}]*\}\}/gi;
  let m;
  while ((m = re.exec(text))) {
    const n = strip(m[1]);
    const suffix = strip(m[2]);
    if (n) parts.push(`${n} ${suffix}`.trim());
  }
  if (!parts.length) {
    const n = text.match(/\d+/);
    if (n) parts.push(n[0]);
  }
  return [...new Set(parts)].join(' / ');
}

function cleanImage(v) {
  const s = String(v || '').replace(/^\[\[File:/i, '').replace(/\]\]$/, '').replace(/^File:/i, '');
  return s.split('|')[0].trim();
}

const titles = wp.weapons.map(pageTitle);
const contents = new Map();
for (const batch of chunks(titles, 40)) {
  const data = await api({
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
    titles: batch.join('|'), redirects: '1'
  });
  for (const p of data.query?.pages || []) {
    if (p.missing) continue;
    const text = p.revisions?.[0]?.slots?.main?.content || '';
    contents.set(p.title, text);
    for (const r of data.query.redirects || []) {
      if (r.to === p.title) contents.set(r.from, text);
    }
  }
}

const stats = [];
const imageFiles = new Map();
const missingPages = [];

for (const w of wp.weapons) {
  const title = pageTitle(w);
  const text = contents.get(title) || contents.get(w.name) || '';
  if (!text) { missingPages.push(w.name); continue; }
  const box = text.match(/\{\{Infobox[^\n]*\n([\s\S]*?)\n\}\}/i)?.[1] || text;
  const image = cleanImage(field(box, 'weapon_image') || field(box, 'image') || field(box, 'stratagem_image'));
  if (image) imageFiles.set(w.id, image);
  const dmg = damage(field(box, 'damage'));
  const ap = armor(field(box, 'penetration'));
  const fireRate = strip(field(box, 'fire_rate'));
  const dps = strip(field(box, 'dps'));
  const capacity = strip(field(box, 'capacity'));
  const recoil = strip(field(box, 'recoil'));
  const reload = strip(field(box, 'reload_time') || field(box, 'reload'));
  const spare = strip(field(box, 'spare_mags') || field(box, 'spare_shells'));
  const modes = strip(field(box, 'firing_modes'));
  const wtype = strip(field(box, 'weapon_type'));
  const radius = strip(field(box, 'radius'));
  const fuse = strip(field(box, 'fuse'));
  const source = strip(field(box, 'source'));
  const cost = strip(field(box, 'cost'));
  stats.push({ id: w.id, damage: dmg, ap, fireRate, dps, capacity, recoil, reload, spare, modes, wtype, radius, fuse, source, cost, image });
}

// 1200-px-Thumbnails für alle Dateien
const files = [...new Set([...imageFiles.values()].filter(Boolean))];
const urls = new Map();
for (const batch of chunks(files, 40)) {
  const data = await api({
    action: 'query', prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '1200',
    titles: batch.map((f) => `File:${f}`).join('|')
  });
  for (const p of data.query?.pages || []) {
    if (p.missing || !p.imageinfo?.[0]) continue;
    const info = p.imageinfo[0];
    urls.set(p.title.replace(/^File:/, ''), info.thumburl || info.url);
  }
}

await fs.mkdir(OUT, { recursive: true });
const downloads = [];
for (const [id, file] of imageFiles) {
  const url = urls.get(file);
  if (!url) continue;
  downloads.push({ id, url, ext: url.split('?')[0].split('.').pop().toLowerCase() });
}

let ok = 0, failed = 0;
const queue = [...downloads];
async function worker() {
  while (queue.length) {
    const d = queue.shift();
    const dest = path.join(OUT, `${d.id}.png`);
    try {
      const existing = await fs.stat(dest).catch(() => null);
      if (existing && existing.size > 8000) { ok++; continue; }
      const res = await fetch(d.url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(res.status);
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      ok++;
    } catch (e) {
      failed++;
      console.log('DOWNLOAD FAIL', d.id, d.url, e.message);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

const byId = new Map(stats.map((s) => [s.id, s]));
for (const w of wp.weapons) {
  const s = byId.get(w.id);
  if (!s) continue;
  w.damage = s.damage || '';
  w.damageType = (s.damage.match(/[A-Za-zÄÖÜäöüß]+$/) || [''])[0];
  w.ap = s.ap || '';
  w.fireRate = s.fireRate || '';
  w.dps = s.dps || '';
  w.capacity = s.capacity || '';
  w.recoil = s.recoil || '';
  w.reload = s.reload || '';
  w.spareMags = s.spare || '';
  w.firingModes = s.modes || '';
  w.weaponType = s.wtype || '';
  w.radius = s.radius || '';
  w.fuse = s.fuse || '';
  w.sourceLabel = s.source || '';
  w.cost = s.cost || '';
  w.image = `/assets/img/weapons/hi/${w.id}.png`;
}

await fs.writeFile(DATA, JSON.stringify(wp, null, 2));
console.log(JSON.stringify({
  weapons: wp.weapons.length,
  pages: contents.size,
  missingPages,
  imageFiles: imageFiles.size,
  imageUrls: urls.size,
  downloads: downloads.length,
  ok, failed,
  statCoverage: {
    damage: stats.filter((s) => s.damage).length,
    fireRate: stats.filter((s) => s.fireRate).length,
    dps: stats.filter((s) => s.dps).length,
    capacity: stats.filter((s) => s.capacity).length,
    recoil: stats.filter((s) => s.recoil).length,
    reload: stats.filter((s) => s.reload).length
  }
}, null, 2));
