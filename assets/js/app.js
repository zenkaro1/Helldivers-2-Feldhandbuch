/* Blue Terminal — App, Router, Suche. */

import { DB, $, $$, loadAll, buildIndex, search, esc, parseHash, toast } from './core.js';
import {
  home, missions, missionDetail, enemies, enemyDetail, weapons, stratagems,
  stratagemDetail, planets, progress, basics, assistantPage, sources, notFound
} from './views-blue.js';
import { initAssistant, open as openAI } from './assistant.js';

const NAV = {
  '': 'home', home: 'home', missionen: 'missionen', feinde: 'feinde',
  waffen: 'waffen', stratagems: 'stratagems', planeten: 'planeten',
  fortschritt: 'fortschritt', assistent: 'assistent', quellen: null,
  grundlagen: 'grundlagen',
  warbond: 'fortschritt', ruestung: 'waffen', booster: 'waffen'
};

const TITLES = {
  '': 'KOMMANDOZENTRALE', missionen: 'EINSATZTAFEL', feinde: 'FEINDDATENBANK',
  waffen: 'AUSRÜSTUNG', stratagems: 'STRATAGEMS', planeten: 'PLANETEN & EFFEKTE',
  fortschritt: 'FORTSCHRITT', assistent: 'FELDASSISTENT', quellen: 'QUELLEN',
  grundlagen: 'GRUNDLAGEN',
  warbond: 'FORTSCHRITT', ruestung: 'RÜSTUNG', booster: 'BOOSTER'
};

let missing = [];

function titleFor(r) {
  if (!r.section) return TITLES[''];
  if (r.section === 'missionen' && r.id) return DB.missions.missions.find((m) => m.id === r.id)?.name || TITLES.missionen;
  if (r.section === 'feinde' && r.id) return DB.enemies.enemies.find((e) => e.id === r.id)?.name || TITLES.feinde;
  if (r.section === 'stratagems' && r.id) return DB.stratagems.stratagems.find((s) => s.id === r.id)?.name || TITLES.stratagems;
  return TITLES[r.section] || 'FELDHANDBUCH';
}

function resolveView(r) {
  switch (r.section) {
    case '': return home();
    case 'missionen': return r.id ? missionDetail(r.id) : missions();
    case 'feinde': return r.id ? enemyDetail(r.id) : enemies();
    case 'waffen': {
      if (r.id === 'ruestung') return weapons('ruestung');
      if (r.id === 'booster') return weapons('booster');
      if (r.id) return weapons('primary', r.id);
      return weapons('primary');
    }
    case 'ruestung': return weapons('ruestung');
    case 'booster': return weapons('booster');
    case 'stratagems': return r.id ? stratagemDetail(r.id) : stratagems();
    case 'planeten': return planets();
    case 'fortschritt':
    case 'warbond': return progress();
    case 'assistent': return assistantPage();
    case 'grundlagen': return basics();
    case 'quellen': return sources();
    default: return notFound('Seite', '#/');
  }
}

function render() {
  const r = parseHash();
  const view = resolveView(r);
  const main = $('#view');
  let html = view.html;
  if (missing.length) {
    html = `<div class="banner" style="margin-bottom:14px">Achtung: ${missing.length} Datendatei(en) fehlen — bitte über <code>start.cmd</code> starten.</div>` + html;
  }
  main.innerHTML = html;
  view.mount?.();
  document.dispatchEvent(new CustomEvent('hd2:route', { detail: { route: location.hash || '#/' } }));

  const nav = NAV[r.section];
  $$('.rail__nav a').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === nav));
  $('#crumb-title').textContent = titleFor(r);
  document.title = `${titleFor(r)} · SEAF Feldhandbuch (Fanprojekt)`;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ---------------------------------------------------------------- search */
let selection = 0;
let results = [];

function openSearch(initial = '') {
  const o = $('#search-overlay');
  o.hidden = false;
  document.body.style.overflow = 'hidden';
  const input = $('#search-input');
  input.value = initial;
  renderSearch(initial);
  setTimeout(() => { input.focus(); input.select(); }, 20);
}
function closeSearch() {
  $('#search-overlay').hidden = true;
  document.body.style.overflow = '';
}
function renderSearch(q) {
  const box = $('#search-results');
  const count = $('#search-count');
  results = q.trim() ? search(q, 14) : [];
  selection = 0;
  if (!q.trim()) {
    box.innerHTML = '<div class="search-empty">Feind, Waffe, Mission, Stratagem oder Währung eingeben.</div>';
    count.textContent = '';
    return;
  }
  if (!results.length) {
    box.innerHTML = '<div class="search-empty">Kein Treffer. Frag den Assistenten.</div>';
    count.textContent = '0 Treffer';
    return;
  }
  box.innerHTML = results.map((r, i) => `<a class="search-result${i === 0 ? ' is-selected' : ''}" href="${esc(r.route)}" data-index="${i}">
    <span class="search-result__type">${esc(r.type)}</span>
    <span><span class="search-result__title">${esc(r.title)}</span><span class="search-result__sub">${esc(r.sub || '')}</span></span>
    <span class="search-result__arrow">→</span>
  </a>`).join('');
  count.textContent = `${results.length} Treffer`;
  $$('.search-result', box).forEach((el) => el.addEventListener('click', closeSearch));
}
function move(delta) {
  if (!results.length) return;
  selection = (selection + delta + results.length) % results.length;
  $$('.search-result').forEach((el, i) => el.classList.toggle('is-selected', i === selection));
  $$('.search-result')[selection]?.scrollIntoView({ block: 'nearest' });
}

/* ---------------------------------------------------------------- boot */
function wire() {
  $('#search-open')?.addEventListener('click', () => openSearch());
  $('#search-input')?.addEventListener('input', (e) => renderSearch(e.target.value));
  $('#search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[selection];
      if (hit) { closeSearch(); location.hash = hit.route; }
    }
  });
  $$('[data-close-search]').forEach((b) => b.addEventListener('click', closeSearch));
  $('#search-overlay')?.addEventListener('click', (e) => { if (e.target.id === 'search-overlay') closeSearch(); });
  $$('#search-hints [data-q]').forEach((b) => b.addEventListener('click', () => {
    const input = $('#search-input');
    input.value = b.dataset.q;
    renderSearch(b.dataset.q);
    input.focus();
  }));
  $('#print-btn')?.addEventListener('click', () => window.print());
  $('#ai-open')?.addEventListener('click', openAI);

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); return; }
    if (e.key === 'Escape') {
      if (!$('#search-overlay')?.hidden) { closeSearch(); return; }
      if (!$('#ai-settings')?.hidden) { $('#ai-settings').hidden = true; document.body.style.overflow = ''; return; }
      if ($('#ai')?.classList.contains('is-open')) $('#ai-close')?.click();
    }
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      openSearch();
    }
  });
}

async function boot() {
  const res = await loadAll();
  missing = res.missing || [];
  buildIndex();
  wire();
  render();
  window.addEventListener('hashchange', render);
  await initAssistant();
  if (missing.length) toast(`${missing.length} Datendatei(en) fehlen`);
}

boot().catch((err) => {
  console.error(err);
  $('#view').innerHTML = `<div class="page"><div class="panel"><div class="panel__body"><h1>Startfehler</h1><p class="muted">${esc(err.message)}</p><p class="small">Bitte über <code>start.cmd</code> starten.</p></div></div></div>`;
});
