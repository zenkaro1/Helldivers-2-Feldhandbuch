// Ordnet jedem Missionsschritt ein Bild aus der Bildbibliothek zu.
import fs from 'node:fs/promises';

const DATA = 'data/missions.json';
const dir = 'assets/img/missions/steps/';
const special = 'assets/img/missions/';
const db = JSON.parse(await fs.readFile(DATA, 'utf8'));

const pools = {
  launch_icbm: null,
  terminate_illegal_broadcast: ['broadcast', 'broadcast_console', 'transmission', 'broadcast'],
  conduct_geological_survey: ['nest', 'battle', 'bile', 'nest'],
  spread_democracy: ['flag', 'colony', 'flag', 'colony'],
  retrieve_valuable_data: ['research', 'broadcast_console', 'fabricator', 'research'],
  emergency_evacuation: ['colony', 'flag', 'colony'],
  evacuate_high_value_assets: ['colony', 'sam', 'colony', 'flag'],
  upload_escape_pod_data: ['research', 'broadcast_console', 'colony'],
  purge_hatcheries: ['hatchery', 'eggs', 'nest', 'battle', 'hatchery'],
  eradicate_terminid_swarm: ['battle', 'nest', 'bile', 'battle'],
  nuke_nursery: ['hatchery', 'eggs', 'fabricator', 'hatchery'],
  sabotage_air_base: ['airbase', 'airbase', 'fabricator', 'gunship'],
  destroy_transmission_network: ['transmission', 'broadcast', 'broadcast_console'],
  seize_industrial_complex: ['colony', 'fabricator', 'colony', 'fabricator'],
  blitz_search_and_destroy: ['battle', 'nest', 'fabricator', 'battle'],
  evacuate_colonists: ['colony', 'flag', 'colony'],
  free_colony: ['flag', 'colony', 'flag', 'colony'],
  repel_invasion_fleet: ['overship', 'gunship', 'battle'],
  infiltrate_illuminate_lair: ['overship', 'tcs', 'darkfluid', 'overship'],
  activate_tcs_plus_station: ['tcs', 'overship', 'tcs'],
  conduct_mobile_e711_extraction: ['darkfluid', 'overship', 'tcs'],
  seaf_artillery: ['artillery', 'artillery_shells', 'artillery'],
  lidar_station: ['radar', 'radar', 'colony'],
  seaf_sam_site: ['sam', 'sam', 'airbase'],
  destroy_high_value_target: ['fabricator', 'fabricator', 'research'],
  erase_terrorist_memorials: ['colony', 'flag', 'broadcast'],
  stratagem_jammer: ['jammer', 'jammer', 'radar'],
  detector_tower: ['radar', 'radar', 'radar'],
  gunship_facility: ['gunship', 'airbase', 'gunship'],
  spore_spewer: ['spore', 'nest', 'spore'],
  shrieker_nest: ['shrieker', 'nest', 'shrieker'],
  stalker_lair: ['nest', 'battle', 'nest'],
  cognitive_disruptor: ['radar', 'overship', 'tcs'],
  retrieve_mutant_larva: ['eggs', 'hatchery', 'nest'],
  destroy_rogue_research_station: ['research', 'fabricator', 'research'],
  deploy_dark_fluid: ['darkfluid', 'overship', 'tcs'],
  deactivate_terminid_control_system: ['tcs', 'tcs', 'nest'],
  take_down_overship: ['overship', 'gunship', 'overship'],
  destroy_exospire: ['overship', 'radar', 'gunship'],
  halt_cyborg_production: ['fabricator', 'fabricator', 'colony']
};

const keyword = (m, text, index) => {
  const t = String(text).toLowerCase();
  if (m.id === 'launch_icbm') {
    if (/code|festplatte/.test(t)) return special + 'codes_disk_cool.png';
    if (/generator|trafo|sicherung/.test(t)) return special + 'generator_cool.png';
    if (/pump|treibstoff/.test(t)) return special + 'fuel_pump_cool.png';
    if (/terminal|silo|verriegel/.test(t)) return special + 'lc_site_cool.png';
    if (/start|rakete|abschuss/.test(t)) return special + 'icbm_launch.png';
  }
  if (/broadcast|funk|signal|transmission/.test(t)) return dir + 'broadcast.png';
  if (/airbase|flugfeld|luftwaffe|tower/.test(t) && m.faction === 'automatons') return dir + 'airbase.png';
  if (/flagge|flag|demokratie/.test(t)) return dir + 'flag.png';
  if (/tcs|control system/.test(t)) return dir + 'tcs.png';
  if (/artillerie|artillery|geschütz/.test(t)) return dir + 'artillery.png';
  if (/sam|flugabwehr/.test(t)) return dir + 'sam.png';
  if (/jammer/.test(t)) return dir + 'jammer.png';
  if (/radar|lidar|detector|scan/.test(t)) return dir + 'radar.png';
  if (/gunship/.test(t)) return dir + 'gunship.png';
  if (/spore|sporen/.test(t)) return dir + 'spore.png';
  if (/shrieker/.test(t)) return dir + 'shrieker.png';
  if (/fabricator|fabrik|produktion/.test(t)) return dir + 'fabricator.png';
  if (/dark fluid|dunkle/.test(t)) return dir + 'darkfluid.png';
  if (/overship|mutterschiff/.test(t)) return dir + 'overship.png';
  if (/research|forschung|daten|data/.test(t)) return dir + 'research.png';
  if (/\beier\b|\beiern\b|\begg/.test(t)) return dir + 'eggs.png';
  if (/gelege|nest/.test(t)) return dir + 'nest.png';
  if (/brut|hatch/.test(t)) return dir + 'hatchery.png';
  if (/evaku|zivil|kolon|siedlung|stadt/.test(t)) return dir + 'colony.png';
  const pool = pools[m.id];
  if (pool?.length) return dir + pool[index % pool.length] + '.png';
  return dir + (m.category === 'tactical' ? 'nest.png' : 'battle.png');
};

let total = 0;
for (const m of db.missions) {
  const steps = m.steps || [];
  m.stepImages = steps.map((s, i) => keyword(m, s, i));
  total += m.stepImages.length;
  if (!pools[m.id] && m.id !== 'launch_icbm') console.log('DEFAULT POOL', m.id);
}

await fs.writeFile(DATA, JSON.stringify(db, null, 2));
console.log(JSON.stringify({ missions: db.missions.length, steps: total, withImages: db.missions.filter((m) => m.stepImages?.length === m.steps.length).length }, null, 2));
