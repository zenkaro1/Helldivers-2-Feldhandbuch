import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const data = JSON.parse(await fs.readFile(path.join(root, 'data/enemies.json'), 'utf8'));
const outDir = path.join(root, 'assets/img/enemies');
await fs.mkdir(outDir, { recursive: true });

const slug = (s) => s.replace(/ /g, '_');
const candidates = (name) => [
  `${slug(name)}_Enemy_Icon.png`,
  `${slug(name)}_Icon.png`,
  `${slug(name)}.png`
];

let found = 0, missing = [];
const queue = [...data.enemies];
async function worker() {
  while (queue.length) {
    const e = queue.shift();
    let done = false;
    for (const file of candidates(e.name)) {
      const url = `https://helldivers.wiki.gg/images/thumb/${file}/120px-${file}`;
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'hd2-field-manual/1.0 (fan project)' } });
        if (!res.ok) continue;
        const type = res.headers.get('content-type') || '';
        if (!type.startsWith('image/')) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 500) continue;
        await fs.writeFile(path.join(outDir, `${e.id}.png`), buf);
        found++; done = true; break;
      } catch { /* try next */ }
    }
    if (!done) missing.push(e.name);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`icons: ${found}/${data.enemies.length}`);
console.log('missing:', missing.join(', '));
