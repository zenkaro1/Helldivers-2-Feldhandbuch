// Lädt eine kleine, hochauflösende Bildbibliothek für Missionsschritte.

import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2Feldhandbuch/1.0 (fan handbook; contact: local)';
const OUT = path.join(process.cwd(), 'assets', 'img', 'missions', 'steps');
const FILES = {
  hatchery: 'Hatchery Nest Small.png',
  eggs: 'Terminid Eggs.png',
  nest: 'Terminid City Nest.png',
  airbase: 'Automaton Airbase Tower.png',
  broadcast: 'Terminate Illegal Broadcast Objective Tower Medium.png',
  broadcast_console: 'Terminate Illegal Broadcast Objective Console 1.png',
  flag: 'Spread Democracy Mission Target.png',
  artillery: 'SEAF Artillery Topography.png',
  artillery_shells: 'SEAF Artillery loaded shells.png',
  sam: 'SEAF SAM Site Topography Rocky Canyons.png',
  radar: 'Detector Tower.png',
  jammer: 'Stratagem Jammer OO Structure.png',
  gunship: 'Gunship Facility.png',
  spore: 'Terminid City Spore Spewer.png',
  shrieker: 'Shrieker Nest.png',
  fabricator: 'Automaton Fabricator.png',
  colony: 'Colony Street.jpg',
  darkfluid: 'Dark Fluid Vessel Helldiver Stage 1.png',
  overship: 'Overship main.png',
  research: 'Automaton Confidential Data.png',
  transmission: 'Automaton Transmission Tower.png',
  tcs: 'Terminid Control System+ ACT Extraction site.png',
  bile: 'Bile Titain.png',
  battle: 'Terminid City Hatchery.png'
};

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('format', 'json');
  u.searchParams.set('formatversion', '2');
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json();
}

await fs.mkdir(OUT, { recursive: true });
const missing = [];
for (const [key, file] of Object.entries(FILES)) {
  try {
    const d = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '1200', titles: `File:${file}` });
    const info = d.query?.pages?.[0]?.imageinfo?.[0];
    const url = info?.thumburl || info?.url;
    if (!url) throw new Error('keine Bild-URL');
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await fs.writeFile(path.join(OUT, `${key}.png`), Buffer.from(await r.arrayBuffer()));
    console.log('OK', key, file, info.width, info.height);
  } catch (e) {
    missing.push({ key, file, err: e.message });
    console.log('MISS', key, file, e.message);
  }
}
console.log('missing', JSON.stringify(missing, null, 2));
