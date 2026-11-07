/* Kern: Daten laden, Suche, Hilfsfunktionen, Routing-Hash parsen. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const DB = {
  guide: { chapters: [] },
  enemies: { factions: [], enemies: [] },
  missions: { missions: [] },
  weapons: { weapons: [] },
  stratagems: { stratagems: [] },
  armor: { classes: [], passives: [], sets: [] },
  boosters: { boosters: [] },
  economy: { currencies: [], vendors: [], warbonds: [], ship_modules: [], progression: [] },
  planets: { hazards: [], modifiers: [], forces: [], biomes: [] }
};

export const FACTION_FALLBACK = {
  terminids: { name: 'Terminiden', color: '#8a9a3b' },
  automatons: { name: 'Automatons', color: '#a8432f' },
  illuminate: { name: 'Illuminate', color: '#35617c' },
  superearth: { name: 'Super-Erde', color: '#a98a2a' },
  any: { name: 'Alle Fraktionen', color: '#6d6b58' }
};

const FILES = {
  guide: 'data/guide.json',
  enemies: 'data/enemies.json',
  missions: 'data/missions.json',
  weapons: 'data/weapons.json',
  stratagems: 'data/stratagems.json',
  armor: 'data/armor.json',
  boosters: 'data/boosters.json',
  economy: 'data/economy.json',
  planets: 'data/planets.json'
};

export async function loadAll() {
  const entries = Object.entries(FILES);
  const results = await Promise.allSettled(entries.map(async ([key, url]) => {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const json = await res.json();
    return [key, json];
  }));
  const missing = [];
  results.forEach((r, i) => {
    const key = entries[i][0];
    if (r.status === 'fulfilled' && r.value[1]) {
      mergeInto(key, r.value[1]);
    } else {
      missing.push(FILES[key]);
      console.warn('Daten nicht geladen:', FILES[key], r.reason);
    }
  });
  return { missing };
}

function mergeInto(key, json) {
  const target = DB[key];
  if (Array.isArray(json) && Array.isArray(target)) target.push(...json);
  else if (typeof json === 'object' && json !== null) Object.assign(target, json);
}

/* --------------------------------------------------------------------------
   Text & Markdown
   -------------------------------------------------------------------------- */

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function md(value) {
  let s = esc(value ?? '');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|#[^)\s]+)\)/g,
    (_m, label, url) => `<a href="${esc(url)}"${url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`);
  if (!s.trim()) return '';
  return s.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

export function plain(value) {
  return String(value ?? '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
}

export function norm(value) {
  return String(value ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function trunc(value, n = 160) {
  const s = plain(value);
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const space = cut.lastIndexOf(' ');
  return `${(space > n * 0.55 ? cut.slice(0, space) : cut).replace(/[.,;:!?–-]+$/, '')}…`;
}

export function fmtCooldown(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds === 0) return 'Mission';
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')} min`;
  }
  return `${seconds} s`;
}

export function codeArrows(code, big = false) {
  const glyphs = { U: '↑', D: '↓', L: '←', R: '→' };
  const chars = String(code || '').split('').filter((c) => glyphs[c]);
  if (!chars.length) return '<span class="muted small">Kein Code</span>';
  return `<span class="code${big ? ' code--lg' : ''}">${chars.map((c) => `<i aria-label="${c}">${glyphs[c]}</i>`).join('')}</span>`;
}

export function threatDots(n) {
  const v = Math.max(1, Math.min(5, Number(n) || 1));
  return `<span class="threat" title="Gefahr ${v}/5" aria-label="Gefahr ${v} von 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</span>`;
}

export function ratingBadge(r) {
  const cls = r === 'S' ? 'badge--yellow' : r === 'A' ? 'badge--solid' : 'badge--muted';
  return `<span class="badge ${cls}" title="Bewertung">${esc(r || '–')}</span>`;
}

export function faction(id) {
  const f = DB.enemies.factions.find((x) => x.id === id);
  return f || { ...(FACTION_FALLBACK[id] || FACTION_FALLBACK.any), id };
}

export function factionColor(id) {
  return faction(id).color || FACTION_FALLBACK.any.color;
}

export function factionName(id) {
  return faction(id).name || FACTION_FALLBACK.any.name;
}

export const CLASS_LABELS = {
  chaff: 'Kleinvieh',
  light: 'Leicht',
  medium: 'Mittel',
  heavy: 'Schwer',
  elite: 'Elite',
  air: 'Luftziel',
  structure: 'Struktur'
};

export const CATEGORY_LABELS = {
  orbital: 'Orbital',
  eagle: 'Eagle',
  support: 'Support',
  backpack: 'Rucksack',
  sentry: 'Geschütz',
  mine: 'Minen',
  emplacement: 'Stellung',
  vehicle: 'Fahrzeug',
  mission: 'Mission'
};

export function categoryLabel(id) {
  return CATEGORY_LABELS[id] || id;
}

export function route(...parts) {
  return `#/${parts.filter(Boolean).join('/')}`;
}

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  return {
    section: segments[0] || '',
    id: segments[1] || '',
    sub: segments[2] || '',
    query: new URLSearchParams(queryPart)
  };
}

/* --------------------------------------------------------------------------
   Index & Suche
   -------------------------------------------------------------------------- */

export const INDEX = [];

export function buildIndex() {
  INDEX.length = 0;
  const add = (entry) => {
    const text = [entry.title, entry.sub, entry.text, ...(entry.keys || [])].join(' ');
    INDEX.push({
      ...entry,
      titleNorm: norm(entry.title),
      hay: norm(text),
      keysNorm: (entry.keys || []).map(norm).join(' ')
    });
  };

  DB.guide.chapters.forEach((c) => add({
    type: 'Kapitel', section: 'grundlagen', route: route('grundlagen', c.id),
    title: c.title, sub: c.subtitle || `Kapitel ${c.number}`, text: plain(c.intro), keys: [c.number, 'grundlagen', 'anleitung']
  }));

  DB.enemies.enemies.forEach((e) => add({
    type: e.class === 'structure' ? 'Struktur' : 'Feind', section: 'feinde', route: route('feinde', e.id),
    title: e.name, sub: [factionName(e.faction), CLASS_LABELS[e.class] || e.class].filter(Boolean).join(' · '),
    text: [e.summary, e.armorNote, ...(e.weakspots || []).map((w) => `${w.zone} ${w.note}`), ...(e.tactics || []), ...(e.gear || [])].join(' '),
    keys: [e.de, e.subfaction, ...(e.gear || [])]
  }));

  DB.missions.missions.forEach((m) => add({
    type: 'Mission', section: 'missionen', route: route('missionen', m.id),
    title: m.name, sub: [m.de, factionName(m.faction)].filter(Boolean).join(' · '),
    text: [m.summary, ...(m.steps || []), ...(m.tips || []), ...(m.required || [])].join(' '),
    keys: [m.de, m.category, 'ziel', 'objective']
  }));

  DB.weapons.weapons.forEach((w) => add({
    type: 'Waffe', section: 'waffen', route: route('waffen', w.id),
    title: w.name, sub: [w.type, w.category].filter(Boolean).join(' · '),
    text: [w.role, w.verdict, ...(w.traits || [])].join(' '),
    keys: [w.type, w.unlock, ...(w.traits || [])]
  }));

  DB.stratagems.stratagems.forEach((s) => add({
    type: 'Stratagem', section: 'stratagems', route: route('stratagems', s.id),
    title: s.name, sub: [categoryLabel(s.category), s.rolle, s.code].filter(Boolean).join(' · '),
    text: [s.beschreibung, ...(s.staerken || []), ...(s.schwaechen || []), ...(s.traits || [])].join(' '),
    keys: [s.code, s.rolle, s.unlock_source, ...(s.aliases || [])]
  }));

  DB.armor.passives.forEach((p) => add({
    type: 'Rüstungs-Passiv', section: 'waffen', route: route('ruestung', p.id),
    title: p.name, sub: `Passiv · Bewertung ${p.rating || '–'}`, text: [p.effect, p.note].join(' '),
    keys: ['passive', 'rüstung', p.rating]
  }));

  DB.boosters.boosters.forEach((b) => add({
    type: 'Booster', section: 'waffen', route: route('booster', b.id),
    title: b.name, sub: `Booster · ${b.rating || '–'}`, text: [b.effect, b.note].join(' '),
    keys: ['booster', b.rating]
  }));

  DB.planets.hazards.forEach((h) => add({
    type: 'Umweltbedingung', section: 'planeten', route: route('planeten', h.id),
    title: h.name, sub: h.de, text: [h.effect, h.counter].join(' '), keys: [h.de, 'hazard', 'wetter']
  }));

  DB.planets.modifiers.forEach((m) => add({
    type: 'Modifikator', section: 'planeten', route: route('planeten', m.id),
    title: m.name, sub: m.de, text: [m.effect, m.counter].join(' '), keys: [m.de, m.kind, 'modifier']
  }));

  DB.economy.currencies.forEach((c) => add({
    type: 'Währung', section: 'fortschritt', route: route('fortschritt'),
    title: c.name, sub: c.de, text: [c.note, ...(c.earn || []), ...(c.spend || [])].join(' '),
    keys: [c.de, c.icon, 'währung', 'geld']
  }));

  DB.economy.warbonds.forEach((w) => add({
    type: 'Warbond', section: 'fortschritt', route: route('fortschritt'),
    title: w.name, sub: [w.type, w.cost ? `${w.cost} SC` : 'kostenlos'].filter(Boolean).join(' · '),
    text: [w.theme, ...(w.highlights || [])].join(' '), keys: ['warbond', w.type, ...(w.highlights || [])]
  }));

  DB.economy.ship_modules.forEach((m) => add({
    type: 'Schiffsmodul', section: 'fortschritt', route: route('fortschritt'),
    title: m.name, sub: [m.category, m.cost ? `${m.cost} RS` : null].filter(Boolean).join(' · '),
    text: [m.effect].join(' '), keys: ['ship module', 'schiff', m.category]
  }));

  DB.armor.sets.forEach((s) => add({
    type: 'Rüstungsset', section: 'waffen', route: route('waffen', 'ruestung'),
    title: s.name, sub: [s.class, s.passive].filter(Boolean).join(' · '), text: s.unlock || '',
    keys: [s.passive, s.class, s.unlock]
  }));
}

const STOPWORDS = new Set(('wie was wo wann warum ich du man einen eine einer ein der die das den dem gegen fuer fur mit und oder ist sind hilft kann soll muss toete tote toeten toten kill how to the a an do i can what are welche welcher welches gibt es im in auf von zu mir mich mein dein').split(' '));

export function search(query, limit = 12) {
  const q = norm(query);
  if (!q) return [];
  const raw = q.split(' ').filter((t) => t.length > 1);
  let tokens = raw.filter((t) => !STOPWORDS.has(t));
  if (!tokens.length) tokens = raw;
  if (!tokens.length) return [];
  const atWordStart = (text, t) => text.startsWith(t) || text.includes(` ${t}`);
  const scored = [];
  for (const item of INDEX) {
    let score = 0;
    const allInTitle = tokens.every((t) => atWordStart(item.titleNorm, t));
    if (item.titleNorm === q) score += 200;
    else if (allInTitle) score += 80;
    else if (tokens.length > 1 && item.titleNorm.includes(q)) score += 35;
    if (allInTitle) score += 32;
    for (const t of tokens) {
      if (atWordStart(item.titleNorm, t)) score += 14;
      if (atWordStart(item.keysNorm, t)) score += 9;
      if (atWordStart(item.hay, t)) score += 3;
      if (item.titleNorm.split(' ').some((w) => w.startsWith(t))) score += 6;
    }
    score -= item.titleNorm.length * 0.12;
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  const best = scored[0]?.score || 0;
  const floor = Math.max(6, best * 0.18);
  return scored.filter((x) => x.score >= floor).slice(0, limit).map((x) => x.item);
}

/* --------------------------------------------------------------------------
   UI-Helfer
   -------------------------------------------------------------------------- */

let toastTimer = null;
export function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  return Promise.resolve();
}

export function safeSource(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}
