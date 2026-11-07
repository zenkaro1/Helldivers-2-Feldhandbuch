/* Ansichten im Blue-Terminal-Design. */

import {
  DB, $, $$, esc, md, trunc, fmtCooldown, codeArrows, threatDots,
  factionName, factionColor, CLASS_LABELS, categoryLabel, route, toast,
  copyText, safeSource
} from './core.js';

const M = 'assets/img/missions/';
const W = 'assets/img/weapons/';
const O = 'assets/img/objectives/';
const E = 'assets/img/enemies/';

const MISSION_VISUALS = {
  launch_icbm: { icon: 'launch_icbm_holo.png', img: 'icbm_rocket_card.png' },
  purge_hatcheries: { icon: 'purge_hatcheries_holo.png', img: 'hatchery_card.png' },
  sabotage_air_base: { icon: 'sabotage_air_base_holo.png', img: 'airbase_tower_card.png' },
  spread_democracy: { icon: 'spread_democracy_holo.png', img: 'spread_target_card.png' },
  deactivate_terminid_control_system: { icon: 'activate_tcs_holo.png', img: 'tcs_card.png' },
  activate_tcs_station: { icon: 'activate_tcs_holo.png', img: 'tcs_card.png' },
  evacuate_colonists: { icon: 'evacuate_hva_holo.png', img: null },
  evacuate_high_value_assets: { icon: 'evacuate_hva_holo.png', img: null },
  repel_invasion_fleet: { icon: 'repel_fleet_holo.png', img: null },
  destroy_transmission_network: { icon: 'destroy_transmission_holo.png', img: null },
  seaf_artillery: { symbol: 'artillery' },
  seaf_sam_site: { symbol: 'artillery' },
  stratagem_jammer: { symbol: 'jammer' },
  detector_tower: { symbol: 'radar' },
  lidar_station: { symbol: 'radar' },
  cognitive_disruptor: { symbol: 'radar' },
  destroy_high_value_target: { symbol: 'terminal' },
  gunship_facility: { symbol: 'terminal' },
  deploy_dark_fluid: { symbol: 'fuel' }
};

const WEAPON_IMAGES = {
  ar_23_liberator: 'wpn_ar23_alpha.png',
  br_14_adjudicator: 'wpn_br14_alpha.png',
  r_63_diligence: 'wpn_r63_alpha.png',
  sg_225_breaker: 'wpn_sg225_alpha.png',
  mp_98_knight: 'wpn_mp98_alpha.png',
  las_5_scythe: 'wpn_las5_alpha.png'
};

function weaponImage(w) {
  if (w.image) return w.image.replace(/^\/+/, '');
  if (WEAPON_IMAGES[w.id]) return W + WEAPON_IMAGES[w.id];
  return null;
}

function short(v, n = 24) {
  const s = String(v || '—');
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

const ICBM_STEPS = [
  {
    title: 'Startcodes bergen', symbol: 'codes', image: 'codes_disk_cool.png',
    square: true,
    text: 'Begib dich zum Startcodes-Symbol auf der Karte. Dort stehen mehrere Gegner und ein Gebäude. Die blaue Code-Festplatte liegt als Item in der Nähe am Boden — aufnehmen, nicht zerstören.',
    tip: 'Die Festplatte leuchtet blau. Codes stehen danach oben links im HUD.',
    caption: 'ITEM // STARTCODES'
  },
  {
    title: 'Generator starten', symbol: 'generator', image: 'icbm_generator_hi.png',
    text: 'Zum Generator-Symbol. Am Terminal die Anweisungen befolgen: 5 Sicherungen setzen, Spannung auf 100 % drehen. Danach den großen Hebel am Trafo umlegen.',
    tip: 'Hebel erst umlegen, wenn 100 % erreicht sind.',
    caption: 'OBJEKT // TRAFO + HEBEL'
  },
  {
    title: 'Treibstoffpumpen', symbol: 'fuel', image: 'icbm_fuel_hi.png',
    text: 'An den Pumpen die Verbindungen aus dem Boden ziehen und die Tanks befüllen. Drei Pumpen; jede startet eine Verteidigungswelle.',
    tip: 'Zwischen den Pumpenwellen heilen und nachladen.',
    caption: 'OBJEKT // PUMPEN-ROUTING'
  },
  {
    title: 'ICBM-Terminal', symbol: 'terminal', image: 'icbm_site_hi.png',
    hud: { label: 'CODES // HUD', value: '7 3 9 1' },
    text: 'Zur Startstelle gehen. Die zuvor gesammelten Codes stehen oben links im HUD — am Terminal eingeben und die vier Silo-Verriegelungen lösen. Danach das Silo öffnen und die Rakete ausfahren.',
    tip: 'Erst sammeln, dann eingeben: Codes stehen oben links.',
    caption: 'OBJEKT // SILO + TERMINAL'
  },
  {
    title: 'Abschuss', symbol: 'launch', image: 'icbm_rocket_hi.png',
    text: 'Startbereich verlassen (mindestens 30 m). Rakete zünden — der Feuerball tötet auch Helldiver.',
    tip: 'Mindestens 30 m Abstand, sonst tötet der Feuerball.',
    caption: 'OBJEKT // ICBM'
  }
];

/* ------------------------------------------------------------------ utils */
const page = (html) => `<div class="page">${html}</div>`;

function pageHead(kicker, title, lead, stats = []) {
  return `
    <div class="page-head">
      <div class="page-head__main">
        <span class="kicker">${esc(kicker)}</span>
        <h1>${esc(title)}</h1>
        <p class="lead">${lead}</p>
      </div>
      <div class="page-head__stats">
        ${stats.map(([v, l]) => `<div class="kpi"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}
      </div>
    </div>`;
}

function panel(title, code, body, cls = '') {
  return `<div class="panel ${cls}">
    ${title ? `<div class="panel__head"><span>${esc(title)}</span>${code ? `<span>${esc(code)}</span>` : ''}</div>` : ''}
    ${body}
  </div>`;
}

function iconFor(m) {
  const v = MISSION_VISUALS[m.id];
  if (v && v.symbol) return O + v.symbol + '.svg';
  return v && v.icon ? M + v.icon : O + 'terminal.svg';
}

function imageFor(m) {
  const v = MISSION_VISUALS[m.id];
  return v && v.img ? M + v.img : null;
}

function missionCard(m) {
  const img = imageFor(m);
  const icon = iconFor(m);
  const cat = m.category === 'main' ? 'HAUPTZIEL' : m.category === 'tactical' ? 'NEBENZIEL' : 'EVENT';
  return `<a class="mission-card" href="${route('missionen', m.id)}">
    <div class="mission-card__img${img ? '' : ' mission-card__img--blank'}">
      ${img ? `<img class="mission-card__photo" src="${esc(img)}" alt="" loading="lazy">` : ''}
      <div class="mission-card__top"><span class="tag tag--cyan">${cat}</span><span class="tag tag--muted">${esc(factionName(m.faction))}</span></div>
      <img class="mission-card__symbol${img ? '' : ' mission-card__symbol--solo'}" src="${esc(icon)}" alt="" loading="lazy">
    </div>
    <div class="mission-card__body">
      <h3>${esc(m.name)}</h3>
      <div class="de">${esc(m.de || '')}</div>
      <p>${esc(trunc(m.summary, 130))}</p>
      <div class="mission-card__foot">
        <span>${(m.steps || []).length} SCHRITTE</span><span>·</span><span>${esc(m.time || '—')}</span>
        <span class="go">ÖFFNEN →</span>
      </div>
    </div>
  </a>`;
}

function stepCard(step, index) {
  const image = step.image ? (step.image.startsWith('assets/') ? step.image : M + step.image) : null;
  const symbol = O + (step.symbol || 'terminal') + '.svg';
  if (!image) {
    return `<article class="step-card step-card--text">
      <div class="step-card__body">
        <div class="step-card__text-top"><span class="step-card__num">0${index + 1}</span><img src="${esc(symbol)}" alt=""></div>
        <h3>${esc(step.title)}</h3>
        <p>${esc(step.text)}</p>
        <div class="step-card__foot">${esc(step.caption || 'OBJEKT')}</div>
      </div>
    </article>`;
  }
  return `<article class="step-card">
    <div class="step-card__media">
      <img class="photo" src="${esc(image)}" alt="" loading="lazy" ${step.square ? 'style="object-fit:contain;padding:10px"' : ''}>
      <span class="step-card__num">0${index + 1}</span>
      <img class="symbol" src="${esc(symbol)}" alt="" loading="lazy">
      ${step.hud ? `<div class="step-card__hud">${esc(step.hud.label)}<b>${esc(step.hud.value)}</b></div>` : ''}
    </div>
    <div class="step-card__body">
      <h3>${esc(step.title)}</h3>
      <p>${esc(step.text)}</p>
      ${step.tip ? `<div class="step-card__tip"><b>TIPP</b>${esc(step.tip)}</div>` : ''}
      <div class="step-card__foot">${esc(step.caption || 'OBJEKT')}</div>
    </div>
  </article>`;
}

/* ------------------------------------------------------------------ home */
export function home() {
  const strats = DB.stratagems.stratagems.length;
  const enemies = DB.enemies.enemies.filter((e) => e.class !== 'structure').length;
  const missions = DB.missions.missions.length;
  const weapons = DB.weapons.weapons.length;

  return {
    html: page(`
      <section class="hero">
        <div class="hero__copy">
          <span class="kicker">SEAF FELDHANDBUCH // AUSGABE 07-2184</span>
          <h1>FELD<br><span class="outline">HANDBUCH</span></h1>
          <p class="hero__sub">EINSATZBEREIT. ALLES, WAS DU ZWISCHEN HELLPOD UND EXTRACTION WISSEN MUSST — ZIELE, FEINDE, WAFFEN, PLANETEN, LOGISTIK.</p>
          <div class="hero__actions">
            <a class="btn" href="${route('missionen')}">Einsatztafel</a>
            <a class="btn btn--ghost" href="${route('feinde')}">Feinddatenbank</a>
          </div>
          <div class="hero__meta">
            <span>3 FRAKTIONEN</span><span>${enemies} FEINDE</span><span>${weapons} WAFFEN</span><span>${strats} STRATAGEMS</span>
          </div>
        </div>
        <a class="hero__art" href="${route('missionen', 'launch_icbm')}">
          <img src="${M}icbm_rocket_hero_color.png" alt="ICBM-Startgelände">
          <div class="hero__hud"><span>LIVE-FEED // STARTANLAGE 07</span><span>CAM 04 · 14:22:08</span></div>
          <div class="hero__title"><span>EINSATZ DES TAGES</span><b>LAUNCH ICBM</b><span>6–10 MIN · 500 REQ · 5 SCHRITTE</span></div>
        </a>
      </section>

      <div class="quick-grid">
        <a class="quick" href="${route('missionen')}">
          <small>01 // EINSATZTAFEL</small><b>Missionen</b><span>Haupt- und Nebenziele mit Kartenlogo, Ablauf und Belohnung.</span><span class="big">${missions}</span>
        </a>
        <a class="quick" href="${route('feinde')}">
          <small>02 // FEINDDATENBANK</small><b>Feinde</b><span>Weakspots, Panzerung, Angriffe und effektive Waffen.</span><span class="big">${enemies}</span>
        </a>
        <a class="quick" href="${route('waffen')}">
          <small>03 // ARSENAL</small><b>Ausrüstung</b><span>Waffen, Stratagems, Rüstung und Booster im Vergleich.</span><span class="big">${weapons + strats}</span>
        </a>
      </div>

      <div class="panel" style="margin-top:14px">
        <div class="panel__head"><span>FELDAUSBILDUNG // 7 KAPITEL</span><span>GRUNDLAGEN</span></div>
        <div class="panel__body" style="display:flex;flex-wrap:wrap;align-items:center;gap:14px">
          <div style="flex:1 1 520px"><p class="small" style="margin:0">Panzerung &amp; Schaden, die erste Mission, Schwierigkeit und Sterne, Teamplay, Fortschritt und Glossar — das Handbuch erklärt nicht nur Werte, sondern auch, warum sie zählen.</p></div>
          <a class="btn btn--ghost" href="${route('grundlagen')}">Grundlagen öffnen</a>
        </div>
      </div>

      <div class="home-bottom">
        <div class="panel assistant-preview">
          <div class="panel__head"><span>FELDASSISTENT // LOKAL</span><span>OFFLINE</span></div>
          <div class="panel__body">
            <div class="msg"><b>DU:</b> „Wie töte ich einen Bile Titan?“</div>
            <div class="msg"><b>ASSISTENT:</b> Kopf mit Panzerabwehr (AP 4+). Säcke zuerst, wenn kein Schuss frei ist. Der Bauch ist AV 2 — erst die Panzerung brechen, dann trifft alles.</div>
            <button class="btn btn--primary btn--sm" type="button" data-open-ai>Assistent öffnen</button>
          </div>
        </div>
        <div class="panel">
          <div class="panel__head"><span>SYSTEMSTATUS</span><span>SECTOR 07</span></div>
          <div class="panel__body">
            <div class="status-row"><span>DATENBANK</span><b>${enemies} Feinde · ${weapons} Waffen · ${strats} Stratagems</b></div>
            <div class="status-row"><span>WIKI-SYNC</span><b>07.11.2184 · 14:18</b></div>
            <div class="status-row"><span>KI-MODUL</span><b>optional · nicht verbunden</b></div>
            <div class="status-row"><span>LINK</span><b>STABLE · 12 MS</b></div>
          </div>
        </div>
      </div>
    `),
    mount() {
      $$('[data-open-ai]').forEach((b) => b.addEventListener('click', () => $('#ai-open')?.click()));
    }
  };
}

/* ------------------------------------------------------------------ missions */
const missionState = { cat: 'all' };

export function missions() {
  const all = DB.missions.missions;
  return {
    html: page(`
      ${pageHead('EINSATZTAFEL // 40 ZIELE // 3 FRONTEN', 'Missionen',
        'Hauptziele, optionale Ziele und Events — mit Kartenlogo, Objektfoto, Ablauf und Belohnung. Öffne ein Ziel für die konkrete Schritt-für-Schritt-Anleitung.',
        [[all.filter((m) => m.category === 'main').length, 'Hauptziele'], [all.filter((m) => m.category === 'tactical').length, 'Nebenziele'], [all.filter((m) => m.category === 'event').length, 'Events']])}
      <div class="filters">
        <button class="tab is-active" data-mcat="all" type="button">Alle</button>
        <button class="tab" data-mcat="main" type="button">Hauptziele</button>
        <button class="tab" data-mcat="tactical" type="button">Nebenziele</button>
        <button class="tab" data-mcat="event" type="button">Events</button>
        <label class="search-inline"><input id="mission-q" type="search" placeholder="Ziel suchen …" autocomplete="off"></label>
      </div>
      <div class="grid grid--missions" id="mission-grid"></div>
    `),
    mount() {
      const grid = $('#mission-grid');
      let q = '';
      const paint = () => {
        const items = all.filter((m) => (missionState.cat === 'all' || m.category === missionState.cat)
          && (!q || `${m.name} ${m.de} ${m.summary}`.toLowerCase().includes(q)));
        grid.innerHTML = items.map(missionCard).join('') || '<p class="muted">Keine Ziele gefunden.</p>';
      };
      $$('[data-mcat]').forEach((b) => b.addEventListener('click', () => {
        missionState.cat = b.dataset.mcat;
        $$('[data-mcat]').forEach((x) => x.classList.toggle('is-active', x === b));
        paint();
      }));
      $('#mission-q')?.addEventListener('input', (e) => { q = e.target.value.toLowerCase(); paint(); });
      paint();
    }
  };
}

function genericSteps(m) {
  return (m.steps || []).map((text, i) => {
    const image = m.stepImages?.[i] || null;
    let symbol = 'terminal';
    if (image) {
      if (image.includes('codes')) symbol = 'codes';
      else if (image.includes('generator')) symbol = 'generator';
      else if (image.includes('fuel')) symbol = 'fuel';
      else if (image.includes('launch') || image.includes('rocket')) symbol = 'launch';
      else if (image.includes('airbase') || image.includes('artillery') || image.includes('sam')) symbol = 'artillery';
      else if (image.includes('radar') || image.includes('detector')) symbol = 'radar';
      else if (image.includes('jammer') || image.includes('broadcast') || image.includes('transmission')) symbol = 'jammer';
      else if (image.includes('fabricator') || image.includes('research') || image.includes('colony') || image.includes('overship')) symbol = 'terminal';
      else if (image.includes('nest') || image.includes('hatchery') || image.includes('egg') || image.includes('battle') || image.includes('bile')) symbol = 'codes';
    }
    return {
      title: `Schritt ${i + 1}`,
      symbol,
      image,
      text,
      tip: null,
      caption: 'OBJEKT // ' + (m.de || m.name)
    };
  });
}

export function missionDetail(id) {
  const m = DB.missions.missions.find((x) => x.id === id);
  if (!m) return notFound('Mission', route('missionen'));
  const rich = id === 'launch_icbm';
  const steps = rich ? ICBM_STEPS : genericSteps(m);
  const img = rich ? M + 'icbm_hero_hi.png' : imageFor(m);
  const icon = iconFor(m);
  const tags = [
    m.category === 'main' ? 'HAUPTZIEL' : m.category === 'tactical' ? 'NEBENZIEL' : 'EVENT',
    factionName(m.faction).toUpperCase(),
    `${steps.length} SCHRITTE`
  ];
  const rewardShort = (m.rewards || '—').replace('Requisition Slips', 'REQ').replace(' XP', ' XP').split(',')[0];
  return {
    html: page(`
      <div class="detail-head">
        <img class="detail-head__icon" src="${esc(icon)}" alt="">
        <div class="detail-head__main">
          <span class="kicker">${rich ? 'HAUPTOBJEKTIV // ALLE FRONTEN' : 'EINSATZPLAN'}</span>
          <h1>${esc(m.name)}</h1>
          <div class="de">${esc(m.de || '')}</div>
          <div class="detail-head__tags">${tags.map((t) => `<span class="tag tag--cyan">${esc(t)}</span>`).join('')}</div>
        </div>
        <div class="detail-stats">
          <div class="stat"><b>${esc(m.time || '—')}</b><span>DAUER</span></div>
          <div class="stat"><b>${esc(rewardShort)}</b><span>BELOHNUNG</span></div>
          <div class="stat"><b>${esc(factionName(m.faction))}</b><span>FRONT</span></div>
        </div>
      </div>

      <div class="mission-hero">
        <div class="mission-hero__photo">
          ${img ? `<img src="${esc(img)}" alt="">` : `<div style="position:absolute;inset:0;background-image:linear-gradient(rgba(80,210,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(80,210,255,.06) 1px,transparent 1px);background-size:24px 24px"></div>`}
          <div class="scan"></div>
          <div class="mission-hero__label"><span>LIVE-FEED // ${esc((m.de || m.name).toUpperCase())}</span><span>OBJEKT ERFASST</span></div>
          <div class="map-inline"><img src="${esc(icon)}" alt=""><span>MAP // LZ-01</span></div>
          <div class="mission-hero__bottom"><span><b>ZIEL:</b> ${esc(m.name)}</span><span>SEKTOR 07 / TIEN KWAN</span></div>
        </div>
        <div class="mission-info">
          <div class="mission-info__row"><span>OBJEKT</span><b>${esc(rich ? 'Raketensilo + Startterminal' : m.summary)}</b></div>
          <div class="mission-info__row"><span>ABLAUF</span><b>${steps.length} Schritte · ${esc(m.time || '—')}</b></div>
          <div class="mission-info__row"><span>FRONT</span><b>${esc(factionName(m.faction))}</b></div>
          <div class="mission-info__row"><span>GEFAHR</span><b>${esc(rich ? 'Türme, Luftraum, Wellen' : 'Feindkontakt, Verstärkung')}</b></div>
          <div class="mission-info__symbols">
            <img src="${esc(icon)}" alt=""><span>HAUPTZIEL</span>
            <img src="${O}${rich ? 'terminal' : 'artillery'}.svg" alt=""><span>${rich ? 'TO // STATION' : 'TO // OBJEKT'}</span>
          </div>
        </div>
      </div>

      <section class="panel steps-panel">
        <div class="panel__head"><span>ABLAUF // SO MACHST DU DAS OBJEKTIV</span><span>STEP 01-${String(steps.length).padStart(2, '0')}</span></div>
        <div class="panel__body">
          <div class="steps-grid">${steps.map(stepCard).join('')}</div>
        </div>
      </section>
    `)
  };
}

/* ------------------------------------------------------------------ enemies */
const enemyState = { faction: 'all', cls: 'all' };

export function enemies() {
  const all = DB.enemies.enemies;
  const factions = DB.enemies.factions;
  return {
    html: page(`
      ${pageHead('FEINDDATENBANK // 94 EINTRÄGE // 3 FRAKTIONEN', 'Feinde',
        'Panzerung, Weakspots, Angriffe und die Waffen, die tatsächlich durchkommen. Filtere nach Fraktion und öffne das Feindprofil für den Scan.',
        [[all.length, 'Einträge'], [factions.length, 'Fraktionen'], [10, 'AV-Stufen']])}
      <div class="filters">
        <button class="tab is-active" data-efac="all" type="button">Alle</button>
        ${factions.map((f) => `<button class="tab" data-efac="${esc(f.id)}" type="button">${esc(f.name)}</button>`).join('')}
        <label class="search-inline"><input id="enemy-q" type="search" placeholder="Feind suchen …" autocomplete="off"></label>
      </div>
      <div class="grid grid--enemies" id="enemy-grid"></div>
    `),
    mount() {
      const grid = $('#enemy-grid');
      let q = '';
      const paint = () => {
        const items = all.filter((e) => (enemyState.faction === 'all' || e.faction === enemyState.faction)
          && (!q || `${e.name} ${e.de} ${e.summary}`.toLowerCase().includes(q)));
        grid.innerHTML = items.map(enemyCard).join('') || '<p class="muted">Keine Feinde gefunden.</p>';
      };
      $$('[data-efac]').forEach((b) => b.addEventListener('click', () => {
        enemyState.faction = b.dataset.efac;
        $$('[data-efac]').forEach((x) => x.classList.toggle('is-active', x === b));
        paint();
      }));
      $('#enemy-q')?.addEventListener('input', (e) => { q = e.target.value.toLowerCase(); paint(); });
      paint();
    }
  };
}

function enemyCard(e) {
  return `<a class="enemy-card" href="${route('feinde', e.id)}">
    <div class="enemy-card__media">
      <img src="assets/img/enemies/card/${esc(e.id)}.png" alt="${esc(e.name)}" loading="lazy" onerror="this.onerror=null;this.src='${E}${esc(e.id)}.png'">
      <div class="enemy-card__tags"><span class="tag" style="color:${factionColor(e.faction)};border-color:${factionColor(e.faction)}">${esc(factionName(e.faction))}</span><span class="av-badge">AV ${Number(e.armor ?? 0)}</span></div>
    </div>
    <div class="enemy-card__body">
      <h3>${esc(e.name)}</h3>
      <div class="meta">${esc(CLASS_LABELS[e.class] || e.class)} // ${threatDots(e.threat)}</div>
      <div class="enemy-card__weak">${esc((e.weakspots || []).slice(0, 2).map((w) => w.zone).join(' · ') || 'WEAKSPOTS')}</div>
      <div class="enemy-card__foot"><span>GEFAHR ${esc(e.threat || '?')}/5</span><span class="go">PROFIL →</span></div>
    </div>
  </a>`;
}

const ATTACKS = {
  bile_titan: [
    { name: 'CAUSTIC SURGE', type: 'Säurestrahl', range: '40 m', danger: 'HOCH', desc: 'Verlangsamt · DoT · 1,5 s Vorwarnung' },
    { name: 'CATACLYSMIC SLAM', type: 'Stampfen', range: '8 m', danger: 'TÖDLICH', desc: 'Knockback · zerstört Deckung' },
    { name: 'BILE SPEW', type: 'Säureklumpen', range: '60 m', danger: 'MITTEL', desc: 'Streuschaden · hinterlässt Säure' }
  ]
};

export function enemyDetail(id) {
  const e = DB.enemies.enemies.find((x) => x.id === id);
  if (!e) return notFound('Feind', route('feinde'));
  const attacks = e.attacks || ATTACKS[e.id] || [];
  const weak = e.weakspots || [];
  const portrait = e.imageLarge || (e.id === 'bile_titan' ? E + 'bile_titan_large.png' : E + e.id + '.png');
  const pins = [[50, 28], [43, 52], [53, 63]];
  return {
    html: page(`
      <div class="detail-head">
        <img class="detail-head__icon" src="${portrait}" alt="" onerror="this.style.visibility='hidden'">
        <div class="detail-head__main">
          <span class="kicker">${esc(factionName(e.faction))} // ${esc(CLASS_LABELS[e.class] || e.class)} // GEFAHR ${esc(e.threat || '?')}/5</span>
          <h1>${esc(e.name)}</h1>
          <div class="de">${esc(e.de || '')} // PANZERUNG AV ${Number(e.armor ?? 0)}</div>
          <div class="detail-head__tags">
            <span class="tag tag--cyan">LIVE-SCAN</span>
            <span class="tag tag--amber">${esc(e.threat || '?')} / 5</span>
            ${e.subfaction ? `<span class="tag tag--red">${esc(e.subfaction)}</span>` : ''}
          </div>
        </div>
        <div class="detail-stats">
          <div class="stat"><b>AV ${Number(e.armor ?? 0)}</b><span>PANZERUNG</span></div>
          <div class="stat"><b>${esc(weak.length)}</b><span>WEAKSPOTS</span></div>
          <div class="stat"><b>${esc(attacks.length || '—')}</b><span>ANGRIFFE</span></div>
        </div>
      </div>

      <div class="enemy-detail">
        <div class="scan-panel">
          <div class="scan-panel__head"><span>ANATOMIE // LIVE-SCAN</span><span>ROTATION 0°</span></div>
          <div class="scan-panel__stage">
            <div class="scan-ring"></div>
            <img class="enemy" src="${portrait}" alt="${esc(e.name)}" onerror="this.remove()">
            ${weak.slice(0, 3).map((w, i) => `<span class="hotspot" style="left:${pins[i][0]}%;top:${pins[i][1]}%"><span>${esc(w.zone)} // AV ${Number(w.armor ?? e.armor ?? 0)}</span></span>`).join('')}
          </div>
        </div>

        <div class="enemy-side">
          <div class="panel">
            <div class="panel__head"><span>ANGRIFFE</span><span>ATK-0${attacks.length}</span></div>
            <div class="panel__body" style="padding-top:4px;padding-bottom:4px">
              ${attacks.map((a) => `<div class="attack-row">
                <span class="attack-icon">◈</span>
                <div><b>${esc(a.name)}</b><span>${esc(a.type)} · ${esc(a.range)}</span><span>${esc(a.desc)}</span></div>
                <em>${esc(a.danger)}</em>
              </div>`).join('') || '<p class="muted small">Angriffsdaten folgen.</p>'}
            </div>
          </div>

          <div class="panel">
            <div class="panel__head"><span>EFFEKTIVE WAFFEN</span><span>AP 4+</span></div>
            <div class="panel__body" style="padding-top:4px;padding-bottom:4px">
              ${(e.gear || []).slice(0, 5).map((g) => `<div class="weapon-row"><span>▸</span><span>${esc(g)}</span><span class="ap">EMPFOHLEN</span></div>`).join('') || '<p class="muted small">—</p>'}
            </div>
          </div>

          <div class="panel">
            <div class="panel__head"><span>TAKTIK</span><span>FIELD-NOTE</span></div>
            <div class="panel__body">
              ${(e.tactics || []).slice(0, 4).map((t) => `<p class="small">▸ ${esc(t)}</p>`).join('') || '<p class="muted small">—</p>'}
              <div class="rule"></div>
              <p class="fine">Panzerung: ${esc(e.armorNote || '—')}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:14px">
        <div class="panel__head"><span>PANZERUNG // AV 0–10</span><span>SEGMENT-SCAN</span></div>
        <div class="panel__body">
          <div class="armor-table">
            ${weak.map((w) => `<div class="armor-table__row">
              <b>${esc(w.zone)}</b><span class="tag tag--amber">AV ${Number(w.armor ?? e.armor ?? 0)}</span>
              <div class="bar"><i style="width:${Math.min(100, (Number(w.armor ?? e.armor ?? 0) + 1) * 10)}%"></i></div>
              <span class="mono small">${esc(w.note ? trunc(w.note, 40) : '')}</span>
            </div>`).join('')}
          </div>
          <p class="fine" style="margin-top:10px">AP ≥ AV = voller Schaden · AP = AV = 65 % · AP &lt; AV = Abpraller.</p>
        </div>
      </div>
    `)
  };
}

/* ------------------------------------------------------------------ weapons */
const weaponState = { tab: 'primary', group: 'Sturmgewehr', selected: 'ar_23_liberator' };

function weaponGroup(w) {
  const t = (w.type || '').toLowerCase();
  if (t.includes('sturm')) return 'Sturmgewehr';
  if (t.includes('präzision')) return 'Präzisionsgewehr';
  if (t.includes('scharf')) return 'Scharfschütze';
  if (t.includes('schrot')) return 'Schrotflinte';
  if (t.includes('maschinenpistole')) return 'MP';
  if (t.includes('energie') || t.includes('laser')) return 'Energie';
  if (t.includes('explosiv') || t.includes('granat')) return 'Explosiv';
  return 'Sonstige';
}

const WEAPON_TABS = [['primary', 'Primärwaffen'], ['secondary', 'Sekundärwaffen'], ['grenade', 'Wurfwaffen'], ['support', 'Support'], ['ruestung', 'Rüstung'], ['booster', 'Booster']];

function weaponCode(w) {
  const t = (w.type || '').toLowerCase();
  if (t.includes('sturm')) return 'AR';
  if (t.includes('präzision')) return 'MR';
  if (t.includes('scharf')) return 'SR';
  if (t.includes('schrot')) return 'SG';
  if (t.includes('maschinenpistole')) return 'SMG';
  if (t.includes('energie') || t.includes('laser')) return 'EN';
  if (t.includes('explosiv') || t.includes('granat')) return 'EX';
  return 'W';
}

function weaponCard(w) {
  const image = weaponImage(w);
  const active = w.id === weaponState.selected;
  return `<button class="weapon-card${active ? ' is-active' : ''}" data-weapon="${esc(w.id)}" type="button">
    <div class="weapon-card__media">
      ${image ? `<img src="${esc(image)}" alt="${esc(w.name)}" loading="lazy">` : `<div class="weapon-placeholder"><b>${weaponCode(w)}</b><span>KEIN SCAN</span></div>`}
    </div>
    <div class="weapon-card__body">
      <h3>${esc(w.name)}</h3>
      <div class="type">${esc(w.type || w.category)}</div>
      <p>${esc(trunc(w.role, 76))}</p>
      <div class="weapon-card__foot"><span class="tag tag--cyan">AP ${esc(w.pen ?? '—')}</span><span class="tag tag--muted">MAG ${esc(w.mag ?? '—')}</span></div>
    </div>
  </button>`;
}

function weaponDetail(w) {
  const image = weaponImage(w);
  const fullDamage = w.damage || '—';
  const specs = [
    ['SCHADEN', short(fullDamage, 20), fullDamage],
    ['AP', short(w.ap || `${w.pen ?? '—'} AP`, 10), w.ap || `${w.pen ?? '—'} AP`],
    w.fireRate ? ['FEUERRATE', w.fireRate, w.fireRate] : null,
    w.dps ? ['DPS', w.dps, w.dps] : null,
    [w.category === 'grenade' ? 'ANZAHL' : 'MAGAZIN', w.capacity || w.mag || '—', w.capacity || w.mag || '—'],
    w.recoil ? ['RÜCKSTOSS', w.recoil, w.recoil] : null,
    w.reload ? ['NACHLADEN', short(w.reload, 12), w.reload] : null,
    w.spareMags ? ['RESERVE', short(w.spareMags, 12), w.spareMags] : null,
    w.radius ? ['RADIUS', w.radius, w.radius] : null,
    w.fuse ? ['ZÜNDER', w.fuse, w.fuse] : null
  ].filter(Boolean).slice(0, 8);

  return `<div class="weapon-detail">
    <div class="weapon-detail__media">${image ? `<img src="${esc(image)}" alt="${esc(w.name)}">` : `<span class="mono">${esc((w.type || 'WAFFE').toUpperCase())}</span>`}</div>
    <div class="weapon-detail__body">
      <h3>${esc(w.name)}</h3>
      <div class="type">${esc(w.type || '')} // ${esc(w.unlock || '')}</div>

      <div class="weapon-brief">
        <div class="weapon-brief__head"><span>STECKBRIEF</span><span>WIKI // 1.007</span></div>
        <div class="weapon-sheet">
          ${specs.map(([label, value, full]) => `<div title="${esc(full)}"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('')}
        </div>
        <div class="weapon-brief__rows">
          ${fullDamage.length > 22 ? `<div><span>SCHADEN</span><b>${esc(fullDamage)}</b></div>` : ''}
          ${(w.ap || '').length > 14 ? `<div><span>PANZERUNG</span><b>${esc(w.ap)}</b></div>` : ''}
          ${w.damageType ? `<div><span>SCHADENSART</span><b>${esc(w.damageType)}</b></div>` : ''}
          ${w.firingModes ? `<div><span>FEUERMODI</span><b>${esc(w.firingModes)}</b></div>` : ''}
          ${w.weaponType ? `<div><span>WAFFENTYP</span><b>${esc(w.weaponType)}</b></div>` : ''}
          ${(w.sourceLabel || w.unlock) ? `<div><span>QUELLE</span><b>${esc(w.sourceLabel || w.unlock)}</b></div>` : ''}
        </div>
      </div>

      <p>${esc(w.role || '')}</p>
      <p class="fine">${esc(w.verdict || '')}</p>
      <div class="weapon-tags">${(w.traits || []).map((t) => `<span class="tag tag--muted">${esc(t)}</span>`).join('')}</div>
    </div>
  </div>`;
}

export function weapons(initialTab = 'primary', initialId = null) {
  if (initialId) {
    const w = DB.weapons.weapons.find((x) => x.id === initialId);
    if (w) {
      initialTab = w.category;
      weaponState.selected = w.id;
      weaponState.group = 'all';
    }
  }
  if (['primary', 'secondary', 'grenade', 'support', 'ruestung', 'booster'].includes(initialTab)) {
    weaponState.tab = initialTab;
    if (!initialId) weaponState.group = initialTab === 'primary' ? 'Sturmgewehr' : 'all';
  }
  return {
    html: page(`
      ${pageHead('ARSENAL // 142 WAFFEN // 6 KATEGORIEN', 'Ausrüstung',
        'Primärwaffen, Sekundärwaffen, Wurfwaffen, Support, Rüstung und Booster. In jeder Kategorie filterst du nach Waffentyp — die AP-Skala ist der rote Faden.',
        [['142', 'Waffen'], ['117', 'Stratagems'], ['AP 0–10', 'Skala']])}
      <div class="tabs" id="weapon-tabs">${WEAPON_TABS.map(([id, label]) => `<button class="tab${id === weaponState.tab ? ' is-active' : ''}" data-wtab="${id}" type="button">${label}</button>`).join('')}</div>
      <div class="subtabs" id="weapon-subtabs"></div>
      <div id="weapon-content"></div>
    `),
    mount() {
      const subtabs = $('#weapon-subtabs');
      const content = $('#weapon-content');

      const paint = () => {
        if (weaponState.tab === 'ruestung') {
          subtabs.innerHTML = '';
          content.innerHTML = `<div class="grid grid--3">${DB.armor.classes.map((c) => `<div class="panel"><div class="panel__head"><span>${esc(c.name)}</span><span>${esc(c.armor || '')}</span></div><div class="panel__body"><p class="small muted">${esc(c.note || '')}</p></div></div>`).join('')}</div>
            <div class="panel" style="margin-top:14px"><div class="panel__head"><span>ARMOR PASSIVES</span><span>${DB.armor.passives.length}</span></div><div class="panel__body"><table class="data-table"><thead><tr><th>Passiv</th><th>Wirkung</th><th>Bewertung</th></tr></thead><tbody>${DB.armor.passives.map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.effect)}</td><td>${esc(p.rating || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
          return;
        }
        if (weaponState.tab === 'booster') {
          subtabs.innerHTML = '';
          content.innerHTML = `<div class="grid grid--3">${DB.boosters.boosters.map((b) => `<div class="panel"><div class="panel__head"><span>${esc(b.name)}</span><span>${esc(b.rating || '—')}</span></div><div class="panel__body"><p class="small muted">${esc(b.effect)}</p></div></div>`).join('')}</div>`;
          return;
        }
        const cat = weaponState.tab;
        const list = DB.weapons.weapons.filter((w) => w.category === cat);
        const groups = ['all', ...[...new Set(list.map(weaponGroup))]];
        subtabs.innerHTML = groups.map((g) => `<button class="subtab${weaponState.group === g ? ' is-active' : ''}" data-wgroup="${esc(g)}" type="button">${g === 'all' ? 'Alle' : esc(g)}</button>`).join('');
        const filtered = weaponState.group === 'all' ? list : list.filter((w) => weaponGroup(w) === weaponState.group);
        let selected = filtered.find((w) => w.id === weaponState.selected) || filtered[0];
        if (selected) weaponState.selected = selected.id;
        content.innerHTML = `<div class="weapon-layout">
          <div class="weapon-grid">${filtered.map(weaponCard).join('') || '<p class="muted">Keine Waffen in dieser Gruppe.</p>'}</div>
          ${selected ? weaponDetail(selected) : ''}
        </div>`;
        $$('[data-wgroup]').forEach((b) => b.addEventListener('click', () => { weaponState.group = b.dataset.wgroup; paint(); }));
        $$('[data-weapon]').forEach((b) => b.addEventListener('click', () => {
        weaponState.selected = b.dataset.weapon;
        paint();
        if (window.matchMedia('(max-width: 1180px)').matches) {
          setTimeout(() => $('.weapon-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
        }
      }));
      };

      $$('[data-wtab]').forEach((b) => b.addEventListener('click', () => {
        weaponState.tab = b.dataset.wtab;
        weaponState.group = 'all';
        $$('[data-wtab]').forEach((x) => x.classList.toggle('is-active', x === b));
        paint();
      }));
      paint();
    }
  };
}

/* ------------------------------------------------------------------ stratagems */
const stratState = { cat: 'all', q: '' };

export function stratagems() {
  const all = DB.stratagems.stratagems;
  const cats = ['all', 'orbital', 'eagle', 'support', 'backpack', 'sentry', 'mine', 'emplacement', 'vehicle', 'mission'];
  return {
    html: page(`
      ${pageHead('ORBIT // 117 STRATAGEMS', 'Stratagems',
        'Codes, Cooldowns und Rollen. Lerne vier Codes blind: Panzerabwehr, ein Eagle, ein Sentry und Resupply. Alles andere ist Bonus.',
        [[all.length, 'Einträge'], ['4', 'Standard-Slots'], ['0–780', 'Sekunden']])}
      <div class="filters">
        ${cats.map((c) => `<button class="tab${c === 'all' ? ' is-active' : ''}" data-scat="${c}" type="button">${c === 'all' ? 'Alle' : categoryLabel(c)}</button>`).join('')}
        <label class="search-inline"><input id="strat-q" type="search" placeholder="Name, Rolle, Code …" autocomplete="off"></label>
      </div>
      <div class="strat-grid" id="strat-grid"></div>
    `),
    mount() {
      const grid = $('#strat-grid');
      const paint = () => {
        const items = all.filter((s) => (stratState.cat === 'all' || s.category === stratState.cat)
          && (!stratState.q || `${s.name} ${s.code} ${s.rolle} ${s.beschreibung}`.toLowerCase().includes(stratState.q)));
        grid.innerHTML = items.map(stratCard).join('') || '<p class="muted">Keine Stratagems gefunden.</p>';
      };
      $$('[data-scat]').forEach((b) => b.addEventListener('click', () => {
        stratState.cat = b.dataset.scat;
        $$('[data-scat]').forEach((x) => x.classList.toggle('is-active', x === b));
        paint();
      }));
      $('#strat-q')?.addEventListener('input', (e) => { stratState.q = e.target.value.toLowerCase(); paint(); });
      paint();
    }
  };
}

function stratCard(s) {
  const file = String(s.icon || '').split('/').pop();
  return `<a class="strat-card" href="${route('stratagems', s.id)}">
    <div class="strat-card__top">
      <span class="strat-icon"><img src="assets/icons/${esc(file)}" alt="" loading="lazy" onerror="this.remove()"></span>
      <div><h3>${esc(s.name)}</h3><div class="meta">${esc(categoryLabel(s.category))} · ${esc(fmtCooldown(s.cooldown))}</div>${codeArrows(s.code)}</div>
    </div>
    <p>${esc(trunc(s.beschreibung, 120))}</p>
    <div class="strat-card__foot">${esc(s.rolle || '')}<span style="margin-left:auto;color:var(--cyan)">DETAILS →</span></div>
  </a>`;
}

export function stratagemDetail(id) {
  const s = DB.stratagems.stratagems.find((x) => x.id === id);
  if (!s) return notFound('Stratagem', route('stratagems'));
  const file = String(s.icon || '').split('/').pop();
  return {
    html: page(`
      <div class="detail-head">
        <span class="strat-icon" style="width:74px;height:74px"><img src="assets/icons/${esc(file)}" alt="" style="width:60px;height:60px"></span>
        <div class="detail-head__main"><span class="kicker">${esc(categoryLabel(s.category))}</span><h1>${esc(s.name)}</h1><div class="de">${esc(s.rolle || '')}</div><div class="detail-head__tags"><span class="tag tag--cyan">${esc(fmtCooldown(s.cooldown))}</span><span class="tag tag--muted">${esc(s.unlock_source || 'Standard')}</span></div></div>
        <div class="code" style="margin-top:14px">${codeArrows(s.code, true)}</div>
      </div>
      <div class="grid grid--2" style="margin-top:16px">
        <div class="panel"><div class="panel__head"><span>WIRKUNG</span><span>${esc(s.code)}</span></div><div class="panel__body"><p class="lead">${esc(s.beschreibung || '')}</p><div class="chips">${(s.traits || []).map((t) => `<span class="tag tag--muted">${esc(t)}</span>`).join('')}</div></div></div>
        <div class="panel"><div class="panel__head"><span>STÄRKEN / SCHWÄCHEN</span><span>FIELD-NOTE</span></div><div class="panel__body"><p class="small"><b style="color:var(--green)">+</b> ${esc((s.staerken || []).join(' · '))}</p><p class="small"><b style="color:var(--red)">−</b> ${esc((s.schwaechen || []).join(' · '))}</p></div></div>
      </div>
    `)
  };
}

/* ------------------------------------------------------------------ planets */
export function planets() {
  const p = DB.planets;
  return {
    html: page(`
      ${pageHead('GALAKTISCHE KARTE // SEKTOR 07', 'Planeten & Effekte',
        'Umweltbedingungen gelten immer, Operationsmodifikatoren ab Hard, und manche Planeten bringen eigene Subfraktionen mit. Lies sie vor dem Drop.',
        [[p.hazards.length, 'Umwelt'], [p.modifiers.length, 'Modifier'], [p.forces.length, 'Kräfte']])}
      <section class="section"><div class="section__head"><h2>Umweltbedingungen</h2><span class="count">${p.hazards.length} EFFEKTE</span></div>
        <div class="hazard-grid">${p.hazards.map((h) => `<div class="hazard-card"><span class="sev">${esc(h.severity || '')}</span><h3>${esc(h.name)}</h3><div class="mono small muted">${esc(h.de)}</div><p>${esc(h.effect)}</p><p class="fine">Gegenmittel: ${esc(h.counter || '—')}</p></div>`).join('')}</div>
      </section>
      <section class="section"><div class="section__head"><h2>Operationsmodifikatoren</h2><span class="count">AB HARD</span></div>
        <div class="panel"><div class="panel__body" style="padding:0"><table class="data-table"><thead><tr><th>Modifier</th><th>Wirkung</th><th>Gegenmittel</th></tr></thead><tbody>${p.modifiers.map((m) => `<tr><td><b>${esc(m.name)}</b><br><span class="tag tag--muted">${esc(m.de)}</span></td><td>${esc(m.effect)}</td><td>${esc(m.counter || '—')}</td></tr>`).join('')}</tbody></table></div></div>
      </section>
      <section class="section"><div class="section__head"><h2>Subfraktionen &amp; Biome</h2><span class="count">COMBATANT FORCES</span></div>
        <div class="grid grid--3">${p.forces.map((f) => `<div class="panel"><div class="panel__head"><span>${esc(f.name)}</span><span>${esc(factionName(f.faction))}</span></div><div class="panel__body"><p class="small muted">${esc(f.effect)}</p></div></div>`).join('')}</div>
        <div class="grid grid--2" style="margin-top:12px">${p.biomes.map((b) => `<div class="panel"><div class="panel__body"><h3>${esc(b.name)}</h3><p class="small muted">${esc(b.note)}</p></div></div>`).join('')}</div>
      </section>
    `)
  };
}

/* ------------------------------------------------------------------ progress */
const progressState = { tab: 'ship' };

export function progress() {
  return {
    html: page(`
      ${pageHead('FORTSCHRITT // SCHIFF // AUSRÜSTUNG // WARBONDS', 'Fortschritt',
        'Was Schiffmodule sind, wo du sie kaufst und wie du an neue Stratagems und Warbonds kommst — ohne Medaillen oder Samples zu verbrennen.',
        [['6', 'Kategorien'], ['5', 'Tiers'], ['26', 'Warbonds']])}
      <div class="progress-layout">
        <div class="panel">
          <div class="panel__head"><span>SHIP MANAGEMENT // MODUL-TERMINAL</span><span>SUPER-DESTROYER</span></div>
          <div class="terminal-photo">
            <img src="${M}ship_bridge_cool.png" alt="Super-Destroyer-Terminal">
            <div class="terminal-photo__label"><span>KOMMANDODECK // TERMINAL 04</span><span>SAMPLES + REQUISITION</span></div>
          </div>
          <div class="terminal-steps">
            <div class="terminal-step"><b>01</b><span>Schiff → Module öffnen</span></div>
            <div class="terminal-step"><b>02</b><span>Kategorie wählen</span></div>
            <div class="terminal-step"><b>03</b><span>Mit Samples kaufen</span></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel__head"><span>WAS SIND SCHIFFSMODULE?</span><span>ERKLÄRUNG</span></div>
          <div class="panel__body">
            <p class="small" style="color:var(--text)">Dauerhafte Upgrades für deinen Super-Zerstörer. Sie gelten teamweit, kosten Samples + Requisition und werden in 6 Kategorien mit je 5 Tiers gekauft.</p>
            <div class="weapon-stats"><div><b>6</b><span>KATEGORIEN</span></div><div><b>5</b><span>TIERS</span></div><div><b>TEAM</b><span>WIRKUNG</span></div></div>
            <div class="module-row"><span>BEISPIEL // HANGAR</span><b>EXPANDED WEAPONS BAY</b></div>
            <div class="module-row"><span>+1 Eagle-Nutzung</span><b>60 C · 20 R</b></div>
            <div class="module-row"><span>WARBONDS</span><b>Standard gratis · 1.000 SC</b></div>
          </div>
        </div>
      </div>
      <div class="tabs" id="progress-tabs" style="margin-top:14px">
        <button class="tab is-active" data-ptab="ship" type="button">Schiffsmodule</button>
        <button class="tab" data-ptab="strat" type="button">Stratagems</button>
        <button class="tab" data-ptab="warbond" type="button">Warbonds</button>
        <button class="tab" data-ptab="currency" type="button">Währungen</button>
      </div>
      <div id="progress-body"></div>
    `),
    mount() {
      const body = $('#progress-body');
      const paint = () => {
        if (progressState.tab === 'ship') {
          body.innerHTML = `<div class="grid grid--3">
            <div class="panel"><div class="panel__head"><span>TERMINAL</span><span>01</span></div><div class="panel__body"><p class="small muted">Im Schiff auf <b style="color:var(--text)">Schiff → Module</b> gehen. Jede Kategorie hat fünf Tiers; du kaufst dauerhaft für das ganze Team.</p><div class="chips">${['Patriotic Admin','Orbital Cannons','Hangar','Bridge','Engineering','Robotics'].map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div></div></div>
            <div class="panel"><div class="panel__head"><span>BEZAHLEN</span><span>02</span></div><div class="panel__body"><p class="small muted">Kosten bestehen aus <b style="color:var(--text)">Common, Rare und Super Samples</b> plus Requisition. Seltene Samples gibt es auf höheren Schwierigkeiten.</p><p class="small" style="color:var(--amber)">Erst Cooldowns und Resupply, dann Spezialisierung.</p></div></div>
            <div class="panel"><div class="panel__head"><span>BEISPIEL</span><span>03</span></div><div class="panel__body"><p class="small" style="color:var(--text)"><b>EXPANDED WEAPONS BAY</b></p><p class="small muted">Hangar-Modul: +1 Eagle-Nutzung. Kosten: 60 Common + 20 Rare.</p><p class="fine">Die vollständige Liste steht im Spielterminal — hier geht es nur um das System.</p></div></div>
          </div>`;
        } else if (progressState.tab === 'strat') {
          const rows = [
            ['SCHIFFSMODUL', 'Patriotic Administration Center', 'Resupply · Reinforce'],
            ['SCHIFFSMODUL', 'Hangar / Bridge', 'Eagle · Sentries · Orbitals'],
            ['WARBOND', 'Helldivers Mobilize!', 'Eagle 500 kg · Railgun'],
            ['LEVEL', 'Level 1–25', 'Standard-Stratagems'],
            ['MAJOR ORDER', 'Event-Belohnung', 'Sonder-Stratagems']
          ];
          body.innerHTML = `<div class="panel"><div class="panel__head"><span>STRATAGEMS FREISCHALTEN</span><span>QUELLEN</span></div><div class="panel__body" style="padding:0"><table class="data-table"><thead><tr><th>Quelle</th><th>Beispiel</th><th>Wo im Spiel</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div></div>`;
        } else if (progressState.tab === 'warbond') {
          body.innerHTML = `<div class="warbond-grid">${DB.economy.warbonds.map((w) => `<div class="warbond-card"><h3>${esc(w.name)}</h3><div class="cost">${w.cost ? w.cost + ' SC' : 'KOSTENLOS'} · ${w.pages || '?'} SEITEN</div><p>${esc(trunc(w.theme, 110))}</p></div>`).join('')}</div>`;
        } else {
          body.innerHTML = `<div class="currency-grid">${DB.economy.currencies.map((c) => `<div class="currency"><div class="currency__icon" style="background:${esc(c.color || '#8FF2FF')}">${esc(c.icon || '')}</div><h3>${esc(c.name)}</h3><p>${esc(c.note || '')}</p><p class="fine">${esc((c.spend || []).join(' · '))}</p></div>`).join('')}</div>`;
        }
      };
      $$('[data-ptab]').forEach((b) => b.addEventListener('click', () => {
        progressState.tab = b.dataset.ptab;
        $$('[data-ptab]').forEach((x) => x.classList.toggle('is-active', x === b));
        paint();
      }));
      paint();
    }
  };
}

/* ------------------------------------------------------------------ basics */
function guideBlock(b) {
  if (b.type === 'p') return `<p class="guide-p">${md(b.text)}</p>`;
  if (b.type === 'callout') return `<div class="guide-callout"><b>${esc(b.title || 'HINWEIS')}</b><div>${md(b.text || '')}</div></div>`;
  if (b.type === 'list') return `<ul class="guide-list">${(b.items || []).map((i) => `<li>${md(i)}</li>`).join('')}</ul>`;
  if (b.type === 'table') return `<div class="panel__body" style="padding:0;overflow-x:auto"><table class="data-table" style="min-width:480px"><thead><tr>${(b.head || []).map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(b.rows || []).map((row) => `<tr>${row.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return '';
}

export function basics() {
  const chapters = DB.guide.chapters;
  return {
    html: page(`
      ${pageHead('FELDAUSBILDUNG // 7 KAPITEL', 'Grundlagen',
        'Was du tust, warum du es tust und wann du stirbst. Die kurze Ausbildung vor dem ersten Drop — ohne Lexikon-Ton.',
        [[chapters.length, 'Kapitel'], ['3', 'Fraktionen'], ['1–10', 'Schwierigkeit']])}
      <div class="grid grid--2">
        ${chapters.map((c) => `<article class="panel guide-chapter">
          <div class="panel__head"><span>${esc(c.number)} // ${esc(c.title.toUpperCase())}</span><span>${esc(c.id)}</span></div>
          <div class="panel__body">
            <h2 style="font-size:22px;margin-bottom:4px">${esc(c.title)}</h2>
            <p class="small dim" style="margin-bottom:10px">${esc(c.subtitle || '')}</p>
            <p class="guide-p">${md(c.intro || '')}</p>
            ${(c.blocks || []).map(guideBlock).join('')}
          </div>
        </article>`).join('')}
      </div>
    `)
  };
}

/* ------------------------------------------------------------------ assistant/sources */
export function assistantPage() {
  return {
    html: page(`
      ${pageHead('FELDASSISTENT // LOKAL + OPTIONAL KI', 'Assistent',
        'Der lokale Modus durchsucht das komplette Handbuch offline. Optional bindest du ein OpenAI-kompatibles Modell an — der Key bleibt lokal.', [['LOKAL', 'Suche'], ['KI', 'optional']])}
      <div class="grid grid--2">
        <div class="panel"><div class="panel__head"><span>LOKALER MODUS</span><span>IMMER AN</span></div><div class="panel__body"><p class="small muted">Durchsucht Feinde, Waffen, Stratagems, Missionen und Währungen. Antwortet mit Quellenlinks. Kein Konto, kein Key, kein Internet.</p><button class="btn" type="button" data-open-ai>Assistent öffnen</button></div></div>
        <div class="panel"><div class="panel__head"><span>KI-MODUS</span><span>OPTIONAL</span></div><div class="panel__body"><p class="small muted">OpenAI, DeepSeek, Groq, OpenRouter oder lokal mit Ollama/LM Studio. Das Modell bekommt die passenden Handbuchstellen als Kontext.</p><button class="btn btn--ghost" type="button" id="assist-settings">Einrichten</button></div></div>
      </div>
      <div class="panel" style="margin-top:14px"><div class="panel__head"><span>BEISPIELFRAGEN</span><span>KLICKEN</span></div><div class="panel__body"><div class="chips">${['Wie töte ich einen Bile Titan?', 'Wie mache ich das ICBM-Objektiv?', 'Welche Waffe gegen Hulk Scorcher?', 'Was sind Schiffmodule?', 'Wofür gebe ich Super Credits aus?'].map((q) => `<button class="tag tag--cyan" type="button" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div></div></div>
    `),
    mount() {
      $$('[data-open-ai]').forEach((b) => b.addEventListener('click', () => $('#ai-open')?.click()));
      $('#assist-settings')?.addEventListener('click', () => $('#ai-settings-open')?.click());
      $$('[data-ask]').forEach((b) => b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('hd2:ask', { detail: b.dataset.ask }))));
    }
  };
}

export function sources() {
  return {
    html: page(`
      ${pageHead('ANHANG // QUELLEN // HINWEISE', 'Quellen & Hinweise',
        'Inoffizielles Fan-Projekt. Keine Verbindung zu Arrowhead oder Sony.', [])}
      <div class="panel" style="border-color:var(--amber)"><div class="panel__head" style="color:var(--amber)"><span>BILDRECHTE // WICHTIG</span><span>KEINE RECHTSBERATUNG</span></div><div class="panel__body">
        <p class="small"><b>Wiki-Texte:</b> <a href="https://helldivers.wiki.gg" target="_blank" rel="noopener">Helldivers Wiki (wiki.gg)</a>, soweit nicht anders angegeben <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>.</p>
        <p class="small"><b>Spielbilder:</b> Renders, Screenshots, Logos und Icons sind Werke von <b>Arrowhead Game Studios / Sony Interactive Entertainment</b>. Sie bleiben urheberrechtlich geschützt; die Wiki-Lizenz für Texte gilt nicht automatisch für diese Spielassets.</p>
        <p class="small">Dieses Projekt nutzt die Bilder <b>nicht kommerziell</b> zur Dokumentation, mit Quellenangabe und ohne offiziellen Anspruch. Das ist keine offizielle Lizenz. Bei kommerzieller Nutzung müssen die Rechte separat geklärt werden.</p>
        <p class="small">Bearbeitungen: blau eingefärbt, freigestellt, zugeschnitten. Rechte an den Originalen bleiben bei den Rechteinhabern.</p>
        <p class="fine"><a href="COPYRIGHT.md" target="_blank" rel="noopener">Vollständige Bildrechte- und Quellenhinweise (COPYRIGHT.md)</a> · Keine Rechtsberatung.</p>
      </div></div>
      <div class="panel" style="margin-top:14px"><div class="panel__body">
        <p class="small">Datenstand: November 2026. Werte können sich mit Patches ändern. Bei wenigen Feinden ist der AV-Wert geschätzt — das steht im Feindprofil.</p>
        <p class="small">Keine Cheats, keine Overlays, keine Automatisierung. Nur ein Handbuch.</p>
      </div></div>
    `)
  };
}

export function notFound(what = 'Seite', back = '#/') {
  return { html: page(`<div class="panel"><div class="panel__body center"><h1 style="font-size:64px;color:var(--cyan)">404</h1><p class="lead">${esc(what)} nicht gefunden.</p><a class="btn" href="${back}">Zurück</a></div></div>`) };
}
