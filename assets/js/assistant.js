/* Feldassistent: lokale Antworten aus dem Handbuch + optionale LLM-Anbindung. */

import { DB, INDEX, $, esc, md, trunc, fmtCooldown, codeArrows, search, route, toast, factionName, CLASS_LABELS } from './core.js';

const STORE_KEY = 'hd2fm.ai.v1';

const PRESETS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-chat' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'local-model' }
};

const SYSTEM_PROMPT = `Du bist der Feldassistent im inoffiziellen SEAF-Feldhandbuch für Helldivers 2.
Antworte auf Deutsch, knapp, praktisch und in der Du-Form. Du sprichst Einsteiger an.

Regeln:
- Nutze für konkrete Werte (Panzerung, Weakspots, Codes, Cooldowns, Preise, Schritte) ausschließlich den bereitgestellten Handbuch-Kontext.
- Wenn der Kontext eine Frage nicht beantwortet, sage das offen und verweise auf die Helldivers Wiki. Erfinde niemals Statistiken, Gegner oder Items.
- Antworte in dieser Struktur: 1–2 Sätze direkte Antwort, dann 2–4 kurze Bullets, dann optional ein Hinweis.
- Verlinke Handbuch-Einträge als [Titel](#/route), wenn sie im Kontext stehen.
- Keine langen Einleitungen, keine Entschuldigungen, kein Marketing.`;

const state = {
  config: loadConfig(),
  server: { configured: false, model: null, baseUrl: null },
  busy: false,
  history: [],
  els: null
};

function loadConfig() {
  const fallback = { mode: 'local', baseUrl: '', model: '', key: '', preset: '' };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { ...fallback, ...raw };
  } catch { return fallback; }
}

function saveConfig() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state.config)); }
  catch { toast('Konfiguration konnte nicht gespeichert werden'); }
}

function hasLLM() {
  return state.config.mode === 'llm' && Boolean(state.config.key || state.server.configured);
}

/* --------------------------------------------------------------------------
   Init & UI
   -------------------------------------------------------------------------- */

export async function initAssistant() {
  const els = state.els = {
    root: $('#ai'), log: $('#ai-log'), form: $('#ai-form'), input: $('#ai-input'),
    dot: $('#ai-dot'), status: $('#ai-status'), statusText: $('#ai-status-text')
  };
  if (!els.root) return;

  $('#ai-open')?.addEventListener('click', open);
  $('#ai-close')?.addEventListener('click', close);
  $('#ai-settings-open')?.addEventListener('click', openSettings);
  els.form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = els.input.value.trim();
    if (text) { els.input.value = ''; ask(text); }
  });
  els.input?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      els.form.requestSubmit();
    }
  });
  els.log?.addEventListener('click', (ev) => {
    const a = ev.target.closest('a');
    if (a && a.getAttribute('href')?.startsWith('#/')) close();
  });

  document.querySelectorAll('#ai-starters [data-prompt]').forEach((b) => {
    b.addEventListener('click', () => ask(b.dataset.prompt));
  });
  document.addEventListener('hd2:ask', (ev) => {
    open();
    ask(ev.detail);
  });
  document.addEventListener('hd2:route', updateContext);

  initSettingsUI();
  updateStatus();
  updateContext();
  await checkServer();
  updateStatus();
  greet();
}

function currentEntry() {
  const hash = location.hash || '#/';
  return INDEX.find((e) => e.route === hash) || null;
}

function updateContext() {
  const el = $('#ai-context b');
  if (!el) return;
  const entry = currentEntry();
  el.textContent = entry ? `${entry.title} (${entry.type})` : 'Titelblatt';
}

export function open() {
  const root = $('#ai');
  if (!root) return;
  updateContext();
  root.classList.add('is-open');
  root.setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#ai-input')?.focus(), 260);
}

export function close() {
  const root = $('#ai');
  if (!root) return;
  root.classList.remove('is-open');
  root.setAttribute('aria-hidden', 'true');
}

export function toggle() {
  if ($('#ai')?.classList.contains('is-open')) close(); else open();
}

function greet() {
  if (state.els.log.children.length) return;
  push('bot', `<p><strong>Feldassistent bereit.</strong></p><p>Frag mich nach einem Feind, einer Waffe, einem Stratagem, einer Mission oder einer Währung. Ich suche im Handbuch und verlinke die Stelle.</p>`, []);
}

function updateStatus() {
  const { dot, status, statusText } = state.els;
  if (!dot) return;
  const llm = hasLLM();
  dot.classList.toggle('on', llm);
  status.querySelector('.badge')?.remove();
  const badge = document.createElement('span');
  badge.className = `badge ${llm ? 'badge--yellow' : 'badge--local'}`;
  badge.textContent = llm ? 'KI' : 'Lokal';
  status.prepend(badge);
  if (llm) {
    const via = state.config.key ? state.config.model : `Server · ${state.server.model || 'Modell'}`;
    statusText.textContent = `KI-Modus · ${via || 'Modell'}`;
  } else if (state.config.mode === 'llm') {
    statusText.textContent = state.server.configured
      ? `Server bereit · ${state.server.model || 'Modell'} (Key fehlt)`
      : 'Kein API-Key · nutzt lokale Suche';
  } else {
    statusText.textContent = 'Offline-Suche · funktioniert ohne API-Key';
  }
}

async function checkServer() {
  try {
    const res = await fetch('api/ai/status', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('no server');
    const json = await res.json();
    state.server = {
      configured: Boolean(json.configured),
      model: json.model || null,
      baseUrl: json.baseUrl || null
    };
  } catch {
    state.server = { configured: false, model: null, baseUrl: null };
  }
  const note = $('#server-note');
  if (note) {
    note.innerHTML = state.server.configured
      ? `<span class="badge badge--local">Server bereit</span> Lokaler Proxy aktiv · Modell <b>${esc(state.server.model || '—')}</b>. Der API-Key bleibt auf dem Server.`
      : `<span class="badge badge--muted">Kein Server-Proxy</span> Kein Key auf dem Server hinterlegt. Du kannst den Key hier im Browser eintragen — oder <code>ai.config.json</code> anlegen und den Server neu starten.`;
  }
}

function initSettingsUI() {
  const dialog = $('#ai-settings');
  if (!dialog) return;
  const radioLocal = dialog.querySelector('input[name="ai-mode"][value="local"]');
  const radioLLM = dialog.querySelector('input[name="ai-mode"][value="llm"]');
  const preset = $('#ai-preset');
  const base = $('#ai-base');
  const model = $('#ai-model');
  const key = $('#ai-key');

  $('#ai-settings-open')?.addEventListener('click', openSettings);

  function fill() {
    (state.config.mode === 'llm' ? radioLLM : radioLocal).checked = true;
    preset.value = state.config.preset || '';
    base.value = state.config.baseUrl || '';
    model.value = state.config.model || '';
    key.value = state.config.key || '';
  }
  state.fillSettings = fill;

  preset?.addEventListener('change', () => {
    const p = PRESETS[preset.value];
    if (!p) return;
    base.value = p.baseUrl;
    model.value = p.model;
  });

  dialog.querySelectorAll('[data-close-settings]').forEach((b) => b.addEventListener('click', closeSettings));
  dialog.addEventListener('click', (ev) => { if (ev.target === dialog) closeSettings(); });

  $('#ai-save')?.addEventListener('click', () => {
    state.config = {
      mode: radioLLM.checked ? 'llm' : 'local',
      preset: preset.value,
      baseUrl: base.value.trim(),
      model: model.value.trim(),
      key: key.value.trim()
    };
    saveConfig();
    updateStatus();
    closeSettings();
    toast(state.config.mode === 'llm' ? 'KI-Modus gespeichert' : 'Lokaler Modus aktiv');
  });

  $('#ai-test')?.addEventListener('click', async () => {
    const btn = $('#ai-test');
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Teste …';
    try {
      const cfg = {
        mode: 'llm',
        baseUrl: base.value.trim(),
        model: model.value.trim(),
        key: key.value.trim()
      };
      const usingServer = !cfg.key && state.server.configured;
      if (!usingServer && (!cfg.baseUrl || !cfg.model)) throw new Error('Base-URL und Modell fehlen');
      if (!usingServer && !cfg.key) throw new Error('Kein API-Key und kein Server-Proxy');
      const reply = await callLLM([{ role: 'user', content: 'Antworte nur mit: OK' }], '', cfg);
      toast(`Verbindung steht · ${trunc(reply, 40)}`);
    } catch (err) {
      toast(`Test fehlgeschlagen: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });
}

function openSettings() {
  state.fillSettings?.();
  const d = $('#ai-settings');
  if (!d) return;
  d.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  const d = $('#ai-settings');
  if (!d) return;
  d.hidden = true;
  document.body.style.overflow = '';
}

/* --------------------------------------------------------------------------
   Nachrichten
   -------------------------------------------------------------------------- */

function push(role, html, sources = []) {
  const log = state.els.log;
  if (!log) return null;
  const wrap = document.createElement('div');
  wrap.className = `ai__msg ai__msg--${role}`;
  if (role === 'bot') {
    wrap.innerHTML = `<h4>Feldassistent</h4><div class="ai__body">${html}</div>${sources.length ? `<div class="ai__sources">${sources.map((s) => `<a href="${esc(s.route)}">${esc(s.title)}</a>`).join('')}</div>` : ''}`;
  } else {
    wrap.textContent = html;
  }
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
  return wrap;
}

function typing() {
  const el = push('bot', `<span class="ai__typing" aria-label="denkt nach"><i></i><i></i><i></i></span>`);
  return el;
}

/* --------------------------------------------------------------------------
   Fragen
   -------------------------------------------------------------------------- */

export async function ask(question) {
  if (!question || state.busy) return;
  const text = question.trim();
  const entry = currentEntry();
  const referential = /^(und|was|wie|wo|welche[rnms]?|warum|er|sie|es|der|die|das|den|dem|davon|dagegen|mehr|hier|dort|dazu)\b/i.test(text)
    || text.split(/\s+/).length <= 2;
  const q = entry && referential && !text.toLowerCase().includes(entry.title.toLowerCase())
    ? `${entry.title} ${text}`
    : text;
  state.busy = true;
  state.els.input?.blur();
  push('user', text);
  state.history.push({ role: 'user', content: text });

  const think = typing();
  const useLLM = hasLLM();

  if (!useLLM) {
    setTimeout(() => {
      const { html, sources } = localAnswer(q);
      think.remove();
      push('bot', html, sources);
      state.history.push({ role: 'assistant', content: html.replace(/<[^>]+>/g, ' ').slice(0, 800) });
      if (state.config.mode === 'llm') {
        push('bot', '<p><span class="badge badge--muted">Hinweis</span> Kein API-Key und kein Server-Proxy. Ich habe lokal geantwortet. <a href="#" data-open-settings>Einstellungen öffnen</a>.</p>');
        state.els.log.querySelector('[data-open-settings]')?.addEventListener('click', (ev) => { ev.preventDefault(); openSettings(); });
      }
      state.busy = false;
    }, 320);
    return;
  }

  try {
    const ctx = buildContext(q);
    const pageLine = entry ? `Aktuelle Seite: ${entry.title} (${entry.type}, ${entry.route})` : '';
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...state.history.slice(-7).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: `${pageLine}\nHandbuch-Kontext:\n${ctx}\n\nFrage: ${text}` }
    ];
    const bubble = think;
    let raw = '';
    let first = true;
    const render = () => {
      const body = bubble.querySelector('.ai__body');
      if (body) body.innerHTML = md(raw) || '<span class="ai__typing"><i></i><i></i><i></i></span>';
      state.els.log.scrollTop = state.els.log.scrollHeight;
    };
    const onDelta = (delta) => {
      if (first) { first = false; }
      raw += delta;
      render();
    };
    const reply = await callLLM(messages, '', state.config, onDelta);
    if (!raw) raw = reply;
    bubble.querySelector('.ai__body').innerHTML = md(raw);
    const srcs = sourcesFor(q);
    if (srcs.length) {
      const box = document.createElement('div');
      box.className = 'ai__sources';
      box.innerHTML = srcs.map((s) => `<a href="${esc(s.route)}">${esc(s.title)}</a>`).join('');
      bubble.appendChild(box);
    }
    state.history.push({ role: 'assistant', content: raw });
    state.els.log.scrollTop = state.els.log.scrollHeight;
  } catch (err) {
    think.remove();
    const { html, sources } = localAnswer(text);
    push('bot', `<p><strong>KI nicht erreichbar:</strong> ${esc(err.message)}. Ich antworte aus dem Handbuch:</p>${html}`, sources);
    push('bot', `<p class="fine">Tipp: Bei CORS-Fehlern hilft der lokale Server-Proxy (<code>ai.config.json</code> + <code>start.cmd</code>) oder ein Anbieter, der Browser-Anfragen erlaubt.</p>`);
  } finally {
    state.busy = false;
  }
}

/* --------------------------------------------------------------------------
   Lokale Antworten
   -------------------------------------------------------------------------- */

function titlesMatch(q, items, max = 3) {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const hits = items.filter((e) => words.some((w) => e.titleNorm.includes(w)));
  return (hits.length ? hits : items).slice(0, max);
}

function sourcesFor(q) {
  return titlesMatch(q, search(q, 6), 3).map((e) => ({ title: e.title, route: e.route }));
}

function localAnswer(q) {
  const results = search(q, 6);
  if (!results.length) {
    return {
      html: `<p>Dazu finde ich im Handbuch nichts. Versuche einen konkreten Namen — <em>Bile Titan</em>, <em>Railgun</em>, <em>Ionenstürme</em>, <em>Super Credits</em> — oder stelle die Frage kürzer.</p><p class="fine">Tipp: Der KI-Modus beantwortet auch freie Fragen, wenn ein API-Key oder Server-Proxy eingerichtet ist.</p>`,
      sources: []
    };
  }
  const top = results[0];
  const detail = answerFor(top);
  const others = titlesMatch(q, results.slice(1), 3);
  const more = others.length
    ? `<p class="fine" style="margin-top:10px">Passt auch: ${others.map((e) => `<a href="${esc(e.route)}">${esc(e.title)}</a>`).join(' · ')}</p>`
    : '';
  return {
    html: detail || `<p>Ich habe <a href="${esc(top.route)}">${esc(top.title)}</a> gefunden, aber keine Kurzantwort dazu.</p>${more}`,
    sources: titlesMatch(q, results, 3).map((e) => ({ title: e.title, route: e.route }))
  };
}

const inlineMd = (value) => md(value).replace(/<\/p>\s*<p>/g, ' ').replace(/<\/?p>/g, '').trim();

function answerFor(entry) {
  const parts = entry.route.replace(/^#\//, '').split('/');
  const section = parts[0];
  const id = parts[1];
  const link = (label = 'Im Handbuch öffnen') => `<p><a href="${esc(entry.route)}">${esc(label)} →</a></p>`;

  if (section === 'feinde') {
    const e = DB.enemies.enemies.find((x) => x.id === id);
    if (!e) return null;
    const weak = (e.weakspots || []).slice(0, 3).map((w) => `<li><strong>${esc(w.zone)}:</strong> ${inlineMd(w.note)}</li>`).join('');
    return `<p><strong>${esc(e.name)}</strong> · ${esc(factionName(e.faction))} · ${esc(CLASS_LABELS[e.class] || e.class || '')} · Gefahr ${esc(e.threat || '?')}/5${Number.isFinite(Number(e.armor)) ? ` · AV ${Number(e.armor)}` : ''}</p>
      <p>${inlineMd(e.summary || '')}</p>
      ${weak ? `<p><strong>Weakspots:</strong></p><ul>${weak}</ul>` : ''}
      ${e.armorNote ? `<p class="fine">${inlineMd(e.armorNote)}</p>` : ''}
      ${(e.gear || []).length ? `<p><strong>Dagegen hilft:</strong> ${e.gear.map((g) => `<code>${esc(g)}</code>`).join(' ')}</p>` : ''}
      ${link('Feindblatt öffnen')}`;
  }
  if (section === 'stratagems') {
    const s = DB.stratagems.stratagems.find((x) => x.id === id);
    if (!s) return null;
    return `<p><strong>${esc(s.name)}</strong> · ${esc(s.rolle || '')} · ${esc(fmtCooldown(s.cooldown))}</p>
      <p>Code: ${codeArrows(s.code)}</p>
      <p>${inlineMd(s.beschreibung || '')}</p>
      ${(s.staerken || []).length ? `<p><strong>Stärken:</strong> ${s.staerken.map(inlineMd).join(' · ')}</p>` : ''}
      ${(s.schwaechen || []).length ? `<p><strong>Schwächen:</strong> ${s.schwaechen.map(inlineMd).join(' · ')}</p>` : ''}
      ${link('Stratagem öffnen')}`;
  }
  if (section === 'missionen') {
    const m = DB.missions.missions.find((x) => x.id === id);
    if (!m) return null;
    return `<p><strong>${esc(m.name)}</strong>${m.de ? ` · ${esc(m.de)}` : ''}</p>
      <p>${inlineMd(m.summary || '')}</p>
      ${(m.steps || []).length ? `<ol>${m.steps.slice(0, 4).map((s) => `<li>${inlineMd(s)}</li>`).join('')}</ol>` : ''}
      ${link('Mission öffnen')}`;
  }
  if (section === 'waffen') {
    const w = DB.weapons.weapons.find((x) => x.id === id);
    if (!w) return null;
    return `<p><strong>${esc(w.name)}</strong> · ${esc(w.type || '')} · AP ${esc(w.pen ?? '?')}${w.mag ? ` · ${esc(w.mag)} Schuss` : ''}</p>
      <p>${inlineMd(w.role || '')}</p>
      <p><strong>Urteil:</strong> ${inlineMd(w.verdict || '')}</p>
      ${link('Waffe öffnen')}`;
  }
  if (section === 'ruestung') {
    const p = DB.armor.passives.find((x) => x.id === id);
    if (!p) return null;
    return `<p><strong>${esc(p.name)}</strong> · Bewertung ${esc(p.rating || '–')}</p><p>${inlineMd(p.effect)}</p>${p.note ? `<p class="fine">${inlineMd(p.note)}</p>` : ''}${link('Passiv öffnen')}`;
  }
  if (section === 'booster') {
    const b = DB.boosters.boosters.find((x) => x.id === id);
    if (!b) return null;
    return `<p><strong>${esc(b.name)}</strong> · Bewertung ${esc(b.rating || '–')}</p><p>${inlineMd(b.effect)}</p>${b.note ? `<p class="fine">${inlineMd(b.note)}</p>` : ''}${link('Booster öffnen')}`;
  }
  if (section === 'planeten') {
    const h = [...DB.planets.hazards, ...DB.planets.modifiers].find((x) => x.id === id);
    if (!h) return null;
    return `<p><strong>${esc(h.name)}</strong>${h.de ? ` · ${esc(h.de)}` : ''}</p><p>${inlineMd(h.effect)}</p><p><strong>Gegenmittel:</strong> ${inlineMd(h.counter || '—')}</p>${link('Effekt öffnen')}`;
  }
  if (section === 'warbond') {
    const w = DB.economy.warbonds.find((x) => x.id === id);
    if (!w) return null;
    return `<p><strong>${esc(w.name)}</strong> · ${esc(w.type || '')} · ${w.cost ? `${esc(w.cost)} SC` : 'kostenlos'}</p><p>${inlineMd(w.theme || '')}</p>${(w.highlights || []).length ? `<p><strong>Highlights:</strong> ${w.highlights.map((h) => esc(h)).join(' · ')}</p>` : ''}${link('Warbond öffnen')}`;
  }
  if (section === 'grundlagen') {
    const c = DB.guide.chapters.find((x) => x.id === id);
    if (!c) return null;
    return `<p><strong>${esc(c.title)}</strong> · Kapitel ${esc(c.number)}</p><p>${inlineMd(c.intro || '')}</p>${link('Kapitel öffnen')}`;
  }
  return null;
}

/* --------------------------------------------------------------------------
   Kontext & LLM
   -------------------------------------------------------------------------- */

function buildContext(q) {
  const results = search(q, 7);
  if (!results.length) return 'Kein Treffer im Handbuch.';
  return results.map((e, i) => {
    const detail = answerFor(e)?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || e.text;
    return `[${i + 1}] ${e.title} (${e.type}) — ${e.sub}\n${trunc(detail, 600)}\nLink: ${e.route}`;
  }).join('\n\n');
}

async function callLLM(messages, _unused, cfg, onDelta) {
  const useServer = !cfg.key && state.server.configured;
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  if (!useServer && !base) throw new Error('Keine Base-URL konfiguriert');

  const url = useServer ? 'api/chat' : `${base}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (!useServer) headers.Authorization = `Bearer ${cfg.key}`;

  const body = useServer
    ? { messages, model: cfg.model || state.server.model }
    : { model: cfg.model, messages, stream: Boolean(onDelta), temperature: 0.25 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error?.message || j.message || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/event-stream')) {
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('Leere Antwort vom Modell');
    if (onDelta) onDelta(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.text || '';
        if (delta) { full += delta; onDelta?.(delta); }
      } catch { /* partielle Zeile ignorieren */ }
    }
  }
  return full;
}
