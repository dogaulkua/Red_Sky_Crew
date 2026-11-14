// MISSION MODE · a replayable 10-sol outpost simulation.
// Three core resources: oxygen (life support), power (battery) and radiation dose (shielding).
// The Sun comes from NASA DONKI: live in the player's browser when api.nasa.gov answers,
// otherwise a real archived week (NASA SVS / JPL). Every number is either a sourced fact (SRC)
// or marked as a game estimate in the "Why?" lines. Nothing archived is ever called live.
import { plantCare } from './minis.js?v=2026-11-15d';
import { profile, save, sfx, music, wait } from './core.js?v=2026-11-15d';
import { say, choose, showTop, toast, el, esc, $, costChips, overlay, objective } from './ui.js?v=2026-11-15d';
// scenes.js needs Phaser: load it only when the 2D mission runs (the 3D page shares this file)
const dir = async () => (await import('./scenes.js?v=2026-11-15d')).director;
import { lightDelayMinutes, tauToEfficiency } from './sim.js?v=2026-11-15d';

// ---------------------------------------------------------------- sources shown inside the game
export const SRC = {
  donki: { t: 'NASA DONKI space weather database', u: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' },
  api: { t: 'NASA Open APIs (api.nasa.gov) · DONKI', u: 'https://api.nasa.gov/' },
  svs24: { t: 'NASA SVS · flares of May 10–14, 2024', u: 'https://svs.gsfc.nasa.gov/14589' },
  svs17: { t: 'NASA SVS · flares of September 2017', u: 'https://svs.gsfc.nasa.gov/12706' },
  rad: { t: 'Curiosity RAD · 0.64 mSv per day on Mars (Hassler et al. 2014)', u: 'https://data.nasa.gov/dataset/msl-mars-radiation-assessment-detector-rdr-d9ab6' },
  may24: { t: 'NASA/JPL · Curiosity measured 8,100 micrograys on May 20, 2024', u: 'https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm' },
  sep17: { t: 'NASA/JPL · Sept 2017 storm doubled Mars surface radiation', u: 'https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/' },
  ochmo: { t: 'NASA OCHMO radiation brief · shielding cuts solar-storm dose ~50%, cosmic rays only ~7% · career limit 600 mSv', u: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf' },
  iss: { t: 'ISS crews: about 80 mSv (solar max) to 160 mSv (solar min) per 6 months (NASA/MSFC via SIDC)', u: 'https://www.sidc.be/article/radiation-space' },
  radlab: { t: 'NASA OSDR RadLab · ISS dosimeters', u: 'https://visualization.osdr.nasa.gov/radlab/gui/data-api/' },
  moxie: { t: 'MOXIE on Perseverance: up to 12 g of oxygen per hour, 122 g in total, 98% pure', u: 'https://www.space.com/perseverance-mars-rover-ends-moxie-oxygen-experiment' },
  tau: { t: 'NASA/JPL · Opportunity: dust (tau) normally ~0.5, reached 10.8 in 2018', u: 'https://www.jpl.nasa.gov/news/six-things-about-opportunitys-recovery-efforts/' },
  spirit: { t: 'NASA/JPL · wind cleaned Spirit’s panels (2009)', u: 'https://pds-rings.seti.org/press_releases/pages/PIA11xxx/PIA11799.html' },
  bone: { t: 'NASA · bones lose 1–1.5% of density per month in space', u: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/' },
  osdr: { t: 'NASA OSDR · space biology & astronaut health studies', u: 'https://osdr.nasa.gov/bio/repo/' },
  radish: { t: 'NASA · radishes grew to harvest in 27 days on the ISS', u: 'https://www.nasa.gov/feature/astronauts-harvest-radish-crop-on-international-space-station' },
  lettuce: { t: 'NASA OSDR OSD-268 · ISS lettuce grew in 33–56 days', u: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-268' },
  csa: { t: 'Canadian Space Agency · Food production in space toolkit (Veg-04A, Tomatosphere)', u: 'https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/' },
  trek: { t: 'NASA Mars Trek · explore the landing sites', u: 'https://trek.nasa.gov/mars/' },
  jpl: { t: 'NASA JPL planet positions → today’s Earth–Mars signal delay', u: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html' },
  ice: { t: 'NASA/JPL 2019 · water-ice map: ice just under the surface in places like Arcadia Planitia', u: 'https://www.jpl.nasa.gov/news/nasas-treasure-map-for-water-ice-on-mars/' },
};
export const chip = (k) => `<a class="src" href="${SRC[k].u}" target="_blank" rel="noopener noreferrer">📚 ${esc(SRC[k].t)}</a>`;
export const EST = '<span class="est">game estimate</span>';

// ---------------------------------------------------------------- game rules (game design, labelled in the UI)
export const R = {
  sols: 10, crewO2: 1.0, o2Start: 3.0, lsPerUnit: 0.35, ghO2: 0.05, exerciseO2: 0.2, coldNightO2: 0.4,
  battMax: 6, battStart: 3, heater: 2, solarMax: 8,
  gcr: 0.64, // Curiosity RAD, measured
  habSep: 0.8, shelterSep: 0.5, shelterGcr: 0.93, // OCHMO ~50% / ~7%; habitat walls 0.8 is a game estimate
  doseGoal: 14, sciGoal: 25, dustPerSol: 0.04, windClean: 0.08, faultP: 0.1, faultPFixed: 0.02,
  tau: [{ tau: 0.5, eff: 1.0 }, { tau: 1.0, eff: 0.75 }, { tau: 2.0, eff: 0.55 }, { tau: 3.0, eff: 0.45 }, { tau: 6.0, eff: 0.25 }, { tau: 10.8, eff: 0.05 }],
};

// three real landing sites (Mars Trek) — the bonuses are game rules built on real facts
export const SITES = [
  { id: 'gale', name: 'Gale Crater', img: 'assets/bg/landing_empty.jpg', lat: '5°S, near the equator', fact: 'Curiosity has measured radiation here since 2012. Tall cliffs of Mount Sharp are close by.', perk: 'Storm shelter works better (cliffs add shielding)', src: 'may24', shelterSep: 0.4 },
  { id: 'jezero', name: 'Jezero Crater', img: 'assets/bg/landing.jpg', lat: '18°N', fact: 'An ancient lake with a river delta, where Perseverance looks for signs of past life.', perk: 'Every EVA finds more science (+2)', src: 'trek', evaBonus: 2 },
  { id: 'arcadia', name: 'Arcadia Planitia', img: 'assets/bg/storm.jpg', lat: 'far north', fact: 'NASA’s ice map shows water ice just under the ground here. Farther from the equator means weaker sunlight.', perk: 'Oxygen maker +25% (ice), solar power −15%', src: 'ice', o2Mult: 1.25, sunMult: 0.85 },
];

// ---------------------------------------------------------------- seeded randomness (every mission differs)
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- the Sun: live DONKI → snapshot → archived real weeks
const ARCHIVE = [
  { name: 'May 2024 solar storms', src: 'svs24', days: [
    { d: '2024-05-11', flares: [{ c: 'X5.8', t: '01:23 UTC' }, { c: 'X1.5', t: '11:44 UTC' }] },
    { d: '2024-05-12', flares: [] }, { d: '2024-05-13', flares: [] },
    { d: '2024-05-14', flares: [{ c: 'X1.7', t: '02:09 UTC' }, { c: 'X1.2', t: '12:55 UTC' }] },
    { d: '2024-05-15', flares: [] }, { d: '2024-05-16', flares: [] }, { d: '2024-05-17', flares: [] }, { d: '2024-05-18', flares: [] }, { d: '2024-05-19', flares: [] },
    { d: '2024-05-20', flares: [], marsSep: { dose: 8.1, src: 'may24', note: 'A flare on the far side of the Sun hit Mars. Curiosity measured 8,100 micrograys (about 8 mSv), its biggest surge since landing.' } },
  ] },
  { name: 'September 2017 solar storm', src: 'svs17', days: [
    { d: '2017-09-04', flares: [{ c: 'M5.5', t: '20:33 UTC' }] }, { d: '2017-09-05', flares: [] },
    { d: '2017-09-06', flares: [{ c: 'X2.2', t: '09:10 UTC' }, { c: 'X9.3', t: '12:02 UTC' }] },
    { d: '2017-09-07', flares: [{ c: 'M7.3', t: '10:15 UTC' }, { c: 'X1.3', t: '14:36 UTC' }] },
    { d: '2017-09-08', flares: [{ c: 'M8.1', t: '07:49 UTC' }] }, { d: '2017-09-09', flares: [] },
    { d: '2017-09-10', flares: [{ c: 'X8.2', t: '16:47 UTC' }], marsSep: { dose: 0.64, src: 'sep17', note: 'Particles reached Mars and doubled the surface radiation for more than two days (Curiosity RAD).' } },
    { d: '2017-09-11', flares: [], marsSep: { dose: 0.64, src: 'sep17', note: 'Second day of doubled radiation on Mars.' } },
    { d: '2017-09-12', flares: [] }, { d: '2017-09-13', flares: [] },
  ] },
];
export const ymd = (d) => d.toISOString().slice(0, 10);
export async function getJSON(url, ms = 8000) {
  const c = new AbortController(); const tm = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error(r.status); const tx = await r.text(); return tx ? JSON.parse(tx) : []; } finally { clearTimeout(tm); }
}
function pickWindow(days, rnd) {
  // 10 consecutive real days; most missions get the most active stretch, some get a random one
  const score = (i) => days.slice(i, i + 10).reduce((s, d) => s + d.flares.reduce((a, f) => a + (f.c[0] === 'X' ? 3 : f.c[0] === 'M' ? 1 : 0), 0) + (d.sep ? 4 : 0), 0);
  const starts = days.map((_, i) => i).filter((i) => i + 10 <= days.length);
  if (rnd() < 0.6) return starts.reduce((b, i) => (score(i) > score(b) ? i : b), starts[0]);
  return starts[Math.floor(rnd() * starts.length)];
}
function fromDonki(flr, sep, end, label) {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = ymd(new Date(end.getTime() - i * 864e5));
    days.push({
      d, flares: (flr || []).filter((f) => (f.beginTime || '').startsWith(d) && /^[MX]/.test(f.classType || '')).map((f) => ({ c: f.classType, t: (f.peakTime || f.beginTime || '').slice(11, 16) + ' UTC', id: f.flrID, link: f.link })),
      sep: (sep || []).find((s) => (s.eventTime || '').startsWith(d)) || null,
    });
  }
  return { mode: label, days };
}
export async function loadSun(rnd) {
  const end = new Date(), start = new Date(end.getTime() - 30 * 864e5);
  const q = `?startDate=${ymd(start)}&endDate=${ymd(end)}&api_key=DEMO_KEY`;
  try {
    // NASA Open APIs first, then NASA CCMC's own DONKI web service (same database)
    let flr, sep, err;
    for (const base of ['https://api.nasa.gov/DONKI/', 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/']) {
      try { const qq = base.includes('api.nasa.gov') ? q : q.replace(/&api_key=DEMO_KEY/, ''); [flr, sep] = await Promise.all([getJSON(base + 'FLR' + qq), getJSON(base + 'SEP' + qq)]); err = null; break; } catch (e) { err = e; }
    }
    if (err) throw err;
    const s = fromDonki(flr, sep, end, 'live'); s.at = new Date(); s.src = 'api';
    const w = pickWindow(s.days, rnd); s.days = s.days.slice(w, w + 10); return s;
  } catch (e) { /* fall through */ }
  try {
    const snap = await getJSON('data/donki_latest.json?v=2026-11-15c', 4000);
    if (snap && snap.sourceHost && snap.events) {
      const e = new Date(snap.snapshotDate);
      const s = fromDonki(snap.events.FLR, snap.events.SEP, e, 'snapshot'); s.at = e; s.src = 'donki';
      const w = pickWindow(s.days, rnd); s.days = s.days.slice(w, w + 10); return s;
    }
  } catch (e) { /* fall through */ }
  const a = ARCHIVE[Math.floor(rnd() * ARCHIVE.length)];
  return { mode: 'archived', name: a.name, src: a.src, days: a.days.map((d) => ({ ...d })) };
}
// turn one real day into today's particle-storm risk (the chance is a game estimate, the flare is real)
export function solarRisk(day) {
  if (day.marsSep) return { p: 1, dose: day.marsSep.dose, why: day.marsSep.note, src: day.marsSep.src, real: true };
  if (day.sep) return { p: 0.9, dose: 4, why: `DONKI logged a solar particle storm near Earth on ${day.d}.`, src: 'donki', link: day.sep.link, id: day.sep.sepID };
  const top = day.flares.reduce((b, f) => (rank(f.c) > rank(b) ? f.c : b), 'A0');
  if (top[0] === 'X') return { p: 0.35, dose: 4, why: `${top} flare: the strongest kind. Big flares often throw out fast particles.`, top };
  if (top[0] === 'M' && parseFloat(top.slice(1)) >= 5) return { p: 0.15, dose: 1.5, why: `${top} flare: a strong one. Particles are possible.`, top };
  if (top[0] === 'M') return { p: 0.06, dose: 1, why: `${top} flare: medium. Small chance of particles.`, top };
  return { p: 0.02, dose: 1, why: 'No big flare that day. The Sun can still surprise us.', top: null };
}
function rank(c) { const k = { A: 0, B: 1, C: 2, M: 3, X: 4 }[c[0]] ?? 0; return k * 100 + parseFloat(c.slice(1) || 0); }
export const riskWord = (p) => (p >= 0.9 ? 'CERTAIN' : p >= 0.3 ? 'HIGH' : p >= 0.1 ? 'MEDIUM' : 'LOW');

// ---------------------------------------------------------------- optional: one real ISS reading from RadLab
export async function radlab() {
  return null; // RadLab's API does not allow requests from web pages (CORS), so the game shows sourced ISS numbers instead
}
export async function radlabDirect() {
  const u = 'https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel&timestamp%3E=2022-04-01T00%3A00&timestamp%3C2022-04-02T00%3A00&absorbed_dose_rate&format=json';
  try {
    const j = await getJSON(u, 7000);
    const vals = []; const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (/absorbed_dose_rate/i.test(k) && isFinite(+v)) vals.push(+v); else walk(v); } };
    walk(j);
    if (vals.length < 5) return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length; // μGy per hour
    return { mGyDay: (mean * 24) / 1000, n: vals.length, day: '2022-04-01' };
  } catch (e) { return null; }
}

// ---------------------------------------------------------------- HUD
const HUD_ID = 'mmHud';
function hud(st) {
  let h = $('#' + HUD_ID);
  if (!h) { h = el('div', 'glass'); h.id = HUD_ID; $('#ui').appendChild(h); }
  const o2c = st.o2 < 1 ? 'bad' : st.o2 < 2 ? 'warn' : 'ok', dc = st.dose > R.doseGoal ? 'bad' : st.dose > R.doseGoal * 0.75 ? 'warn' : 'ok';
  h.innerHTML = `<div class="mmSol"><b>SOL ${Math.min(st.sol, R.sols)}/${R.sols}</b><small>${esc(st.sun.days[Math.min(st.sol, R.sols) - 1]?.d || '')} Sun</small></div>
    <div class="mmM ${o2c}" data-g="o2"><i>💨</i><div><small>Oxygen</small><b>${st.o2.toFixed(1)} days</b><span class="bar"><b style="width:${Math.min(100, (st.o2 / 5) * 100)}%"></b></span></div></div>
    <div class="mmM" data-g="batt"><i>🔋</i><div><small>Battery</small><b>${st.batt}/${R.battMax}</b><span class="bar"><b style="width:${(st.batt / R.battMax) * 100}%;background:var(--power)"></b></span></div></div>
    <div class="mmM ${dc}" data-g="dose"><i>☢️</i><div><small>Radiation</small><b>${st.dose.toFixed(1)} / ${R.doseGoal} mSv</b><span class="bar"><b style="width:${Math.min(100, (st.dose / R.doseGoal) * 100)}%;background:#C78BFF"></b></span></div></div>
    <div class="mmS"><span title="Science sent to Earth">🔬 ${st.sciSent}/${R.sciGoal}${st.sciStored ? ` <em>+${st.sciStored} waiting</em>` : ''}</span><span title="Solar panels clean">☀️ ${Math.round(st.clean * 100)}%</span><span title="Dust in the sky (tau)">🌫️ τ ${st.tau.toFixed(1)}</span></div>`;
  h.querySelectorAll('[data-g]').forEach((m) => (m.onclick = () => { sfx.click(); explain(m.dataset.g); }));
}
const GLOSS = {
  o2: ['💨 Oxygen (life support)', 'Days of air left in the tanks for the crew of 4. Every sol the crew breathes 1 day. The oxygen maker turns Mars air (CO₂) into oxygen, like NASA’s MOXIE did on Perseverance, but it needs power.', ['moxie']],
  batt: ['🔋 Battery (power)', 'Solar panels charge it in the day. Power you do not use is saved here. Mars nights are about −80 °C, so the heaters always need 2 at night. If it is empty, the oxygen maker freezes overnight.', ['tau', 'spirit']],
  dose: ['☢️ Radiation dose', 'Mars has thin air and no magnetic shield, so space radiation reaches the ground: about 0.64 mSv every sol (measured by Curiosity). Solar particle storms add more. A storm shelter cuts solar-storm dose about in half, but barely stops cosmic rays. Mission goal: stay under 14 mSv.', ['rad', 'ochmo']],
};
function explain(k) {
  const [h, p, s] = GLOSS[k];
  const o = overlay(`<div class="card glass"><h2>${h}</h2><p style="font-size:18px;line-height:1.5">${esc(p)}</p><div class="srcs">${s.map(chip).join('')}</div><div class="row"><button class="btn primary">OK</button></div></div>`);
  o.querySelector('.btn').onclick = () => { sfx.click(); o.remove(); };
}
function panel(html) { let p = $('#mg'); if (!p) { p = el('div', 'glass'); p.id = 'mg'; $('#layer').appendChild(p); } p.className = 'glass mmPlan'; p.innerHTML = html; return p; }
const closePanel = () => $('#mg')?.remove();
const N = (k) => ({ ls: 'Oxygen maker', gh: 'Greenhouse', lab: 'Lab', shield: 'Storm shelter', comms: 'Radio to Earth' }[k]);
const ICON = { ls: '💨', gh: '🌱', lab: '🔬', shield: '🛡️', comms: '📡' };
const MAXU = { ls: 4, gh: 3, lab: 4, shield: 1, comms: 1 };

// ---------------------------------------------------------------- one sol: plan the power
async function planPower(st) {
  const pool = st.solar + st.batt;
  const wake = await (await dir()).show('wake', { power: pool });
  showTop(false); hud(st);
  const prev = st.lastAlloc || { ls: 3, gh: 0, lab: 2, shield: 0, comms: 1 };
  // start from yesterday's plan when it still fits
  let a = { ls: 0, gh: 0, lab: 0, shield: 0, comms: 0 };
  let left = pool; for (const k of ['ls', 'comms', 'shield', 'lab', 'gh']) { const n = Math.min(prev[k] || 0, left, MAXU[k]); a[k] = n; left -= n; }
  let asked = false;
  return new Promise((resolve) => {
    const free = () => pool - Object.values(a).reduce((s, v) => s + v, 0);
    const prod = () => a.ls * R.lsPerUnit * st.o2Mult * (st.fault ? 0.5 : 1) + a.gh * R.ghO2;
    const draw = () => {
      const net = prod() - R.crewO2, battNight = Math.min(R.battMax, free()) - R.heater;
      const sunTxt = asked ? sunReport(st) : a.comms ? `<button class="btn" id="pAsk">📡 Ask Earth for today’s space weather</button>` : `<span class="unk">❓ No radio = no news from Earth today. You will not know if a solar storm is coming.</span>`;
      const p = panel(`<div class="ptop"><b>⚡ Power today: ${pool}</b> <small>= ☀️ ${st.solar} from the panels + 🔋 ${st.batt} from the battery</small> <span class="free ${free() ? '' : 'zero'}">Unused → battery: ${free()}</span></div>
        <div class="rooms">${['ls', 'comms', 'shield', 'lab', 'gh'].map((k) => `<div class="room"><span class="ri">${ICON[k]}</span><span class="rn">${N(k)}</span><button class="b" data-k="${k}" data-d="-1" aria-label="less">−</button><b class="rv">${a[k]}</b><button class="b" data-k="${k}" data-d="1" aria-label="more">＋</button></div>`).join('')}</div>
        <div class="prev">${costChips({ air: `${net >= 0 ? '+' : ''}${net.toFixed(2)} days` })}<span class="cost ${battNight >= 0 ? 'p' : 'n'}">🌙 battery tonight ${Math.max(0, battNight)}${battNight < 0 ? ' · COLD NIGHT!' : ''}</span><span class="cost ${a.shield ? 'p' : 'n'}">🛡️ shelter ${a.shield ? 'ON' : 'off'}</span><span class="cost p">🔬 +${a.lab + a.gh * 0.5}</span><span class="cost ${a.comms ? 'p' : 'n'}">📡 ${a.comms ? 'link ON' : 'no link'}</span></div>
        <div class="sun">${sunTxt}</div>
        <div class="row"><button class="btn primary" id="pGo">Confirm plan ▶</button></div>`);
      p.querySelectorAll('.b').forEach((b) => (b.onclick = () => {
        const k = b.dataset.k, d = +b.dataset.d;
        if (d > 0 && (free() <= 0 || a[k] >= MAXU[k])) { sfx.error(); toast(free() <= 0 ? '🤖 No power left. Take some from another room.' : `🤖 ${N(k)} is full.`, '#FFC94D'); return; }
        if (d < 0 && a[k] <= 0) return;
        a[k] += d; d > 0 ? sfx.plug() : sfx.unplug(); const snap = { ...a }; wake.setAlloc(snap); a = snap; draw();
      }));
      const ask = p.querySelector('#pAsk');
      if (ask) ask.onclick = async () => { sfx.click(); ask.disabled = true; await earthDelay(st); asked = true; draw(); };
      p.querySelector('#pGo').onclick = () => { sfx.success(); closePanel(); resolve({ alloc: { ...a }, banked: free(), asked }); };
    };
    // dragging power in the picture works too: keep both in sync
    wake.events.on('change', (al) => {
      const c = { ls: 0, gh: 0, lab: 0, shield: 0, comms: 0 }; for (const k in c) c[k] = Math.min(MAXU[k], al[k] || 0);
      const clamped = Object.keys(c).some((k) => c[k] !== (al[k] || 0));
      if (JSON.stringify(c) !== JSON.stringify(a)) { a = c; if (clamped) { toast('🤖 1 power is enough for the shelter and the radio.', '#FFC94D'); wake.setAlloc(c); } draw(); }
    });
    wake.setAlloc({ ...a });
    draw();
  });
}
export function sunReport(st) {
  const day = st.sun.days[st.sol - 1], r = st.risk;
  const fl = day.flares.length ? day.flares.map((f) => `<b>${esc(f.c)}</b> at ${esc(f.t)}${f.link ? ` <a href="${esc(f.link)}" target="_blank" rel="noopener noreferrer">DONKI ↗</a>` : ''}`).join(', ') : 'no M- or X-class flares';
  const tag = st.sun.mode === 'live' ? `🟢 LIVE from NASA DONKI (api.nasa.gov), fetched ${st.sun.at.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : st.sun.mode === 'snapshot' ? `🟡 NASA DONKI snapshot, ${ymd(st.sun.at)} (updated once a day, not live)` : `🟠 ARCHIVED real data: ${esc(st.sun.name)}`;
  return `<div class="sunrep"><div class="tag">${tag}</div>☀️ <b>Real Sun on ${esc(day.d)}:</b> ${fl}.<br>⚠️ Particle storm risk today: <b class="risk r${riskWord(r.p)}">${riskWord(r.p)} (${Math.round(r.p * 100)}%)</b> <small>${esc(r.why)} The % is a ${EST}.</small><br>🌫️ Dust forecast for tomorrow (from orbiters): <b>τ ${st.fc[0].toFixed(1)}–${st.fc[1].toFixed(1)}</b></div>`;
}
// the real light-travel time, sped up so kids do not wait 15 minutes
export function earthDelay(st) {
  const min = st.delay, secs = Math.max(3, Math.min(7, Math.round(min / 3)));
  return new Promise((res) => {
    const o = overlay(`<div class="card glass" style="text-align:center"><div class="h" style="letter-spacing:3px;color:var(--cyan);font-weight:900">📡 CALLING EARTH…</div>
      <div class="h" style="font-size:54px;font-weight:900;margin:6px 0" id="dN">${min.toFixed(1)} min</div><div class="timer"><div class="t"><b id="dB" style="background:linear-gradient(90deg,#5FE0FF,#9FD0FF)"></b></div></div>
      <p class="small">Radio travels at the speed of light, but Earth and Mars are so far apart that today an answer takes <b>${min.toFixed(1)} minutes</b> each way. (Sped up for the game.)</p>${chip('jpl')}</div>`);
    o.style.background = 'rgba(3,5,12,.55)';
    const t0 = performance.now();
    const iv = setInterval(() => {
      const f = Math.min(1, (performance.now() - t0) / 1000 / secs);
      o.querySelector('#dN').textContent = (min * (1 - f)).toFixed(1) + ' min';
      o.querySelector('#dB').style.width = f * 100 + '%';
      if (f >= 1) { clearInterval(iv); sfx.alarm(); o.remove(); res(); }
    }, 80);
  });
}

// ---------------------------------------------------------------- one sol: the crew's job
const JOBS = [
  { id: 'eva', icon: '🧑‍🚀', label: 'EVA: collect rocks', hint: 'Big science. But outside there are no walls if a solar storm hits.', costs: { science: '+3', dose: '+0.1' } },
  { id: 'clean', icon: '🧹', label: 'Clean the solar panels', hint: 'Dust steals power every sol. Wipe it off (outside!).', costs: { power: 'more tomorrow', dose: '+0.1' } },
  { id: 'gym', icon: '🏋️', label: 'Exercise', hint: 'Low gravity weakens bones. Training protects them, but you breathe more.', costs: { air: '−0.2' } },
  { id: 'plants', icon: '🌱', label: 'Plant experiment', hint: 'Look after the plants: science, and practice growing food.', costs: { science: '+1' } },
  { id: 'fix', icon: '🔧', label: 'Check the machines', hint: 'Lowers the chance the oxygen maker breaks for 3 sols.', costs: { science: '0' } },
];

// ---------------------------------------------------------------- the whole mission
export async function missionMode() {
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0, rnd = rng(seed);
  showTop(false); objective(''); music('calm');
  const site = await pickSite();
  if (!site) return 'map';
  const loading = overlay(`<div class="card glass" style="text-align:center"><h2>🛰️ Asking NASA about the real Sun…</h2><p class="small">Trying NASA DONKI live. If it does not answer, we use a real archived week and say so.</p></div>`);
  const [sun, iss] = await Promise.all([loadSun(rnd), radlab()]);
  loading.remove();
  const st = {
    sol: 1, site, sun, iss, seed, o2: R.o2Start, batt: R.battStart, dose: 0, doseSep: 0, doseGcr: 0, sciSent: 0, sciStored: 0,
    clean: 1, tau: 0.5, storm: 0, o2Mult: site.o2Mult || 1, fault: false, fixedUntil: 0, gymDays: 0, plantDays: 0, log: [], delay: lightDelayMinutes(),
  };
  st.fc = [0.4, 0.8];
  await intro(st);
  for (; st.sol <= R.sols; st.sol++) {
    // ---- morning: weather, power, solar risk (decided now, revealed only by the radio or by the storm itself)
    weather(st, rnd);
    st.solar = Math.max(1, Math.round(R.solarMax * tauToEfficiency(st.tau, R.tau) * st.clean * (site.sunMult || 1)));
    st.risk = solarRisk(st.sun.days[st.sol - 1]);
    st.sepToday = rnd() < st.risk.p;
    st.fault = st.sol > 1 && rnd() < (st.sol <= st.fixedUntil ? R.faultPFixed : R.faultP);
    music(st.tau >= 2 ? 'tense' : 'calm');
    await morning(st);
    const plan = await planPower(st);
    st.lastAlloc = plan.alloc;
    const ji = await choose({ title: `Sol ${st.sol}: what does the crew do today?`, question: 'Pick one job. Every job costs something.', options: JOBS });
    const job = JOBS[ji === 'timeout' ? 4 : ji];
    const res = await doJob(st, job);
    await wait(900);
    const rep = resolveSol(st, plan, job, res, rnd);
    hud(st);
    const end = await solReport(st, rep);
    if (st.o2 <= 0) return failMission(st, rep);
    if (end === 'quit') return 'map';
  }
  return endReport(st);
}

async function pickSite() {
  const land = await (await dir()).show('land', { time: 'day' });
  const i = await choose({ title: 'Mission Mode · Choose your landing site', question: 'Three real places on Mars. Each one changes the game. Explore them yourself in NASA Mars Trek.', options: SITES.map((s) => ({ icon: '📍', label: s.name, hint: `${s.lat}. ${s.fact} ➜ ${s.perk}.`, costs: {} })) });
  if (i === 'timeout') return SITES[0];
  toast(`📚 <a href="${SRC.trek.u}" target="_blank" rel="noopener noreferrer" style="color:#9FD0FF">NASA Mars Trek: see ${esc(SITES[i].name)} in real orbital images ↗</a>`, '#5FE0FF');
  return SITES[i];
}
async function intro(st) {
  const tag = st.sun.mode === 'live' ? 'the REAL Sun of the last 30 days, live from NASA DONKI' : st.sun.mode === 'snapshot' ? 'a NASA DONKI snapshot of the real Sun (updated daily)' : `a real archived week: ${st.sun.name}`;
  toast(`📍 ${esc(st.site.name)} · ☀️ Sun: ${esc(tag)}`, '#FFC94D');
  await say([{ who: 'nova', key: 'mm_i1' }, { who: 'nova', key: 'mm_i2' }  ]);
}
function weather(st, rnd) {
  // dust: calm days ~0.5 (Opportunity's normal), random regional storms; panels get dustier every sol
  if (st.storm > 0) { st.storm--; st.tau = Math.max(1.6, st.tau + (rnd() - 0.5) * 0.8); }
  else if (st.sol > 2 && rnd() < 0.13) { st.storm = 1 + Math.floor(rnd() * 2); st.tau = 2 + rnd() * 2; }
  else st.tau = 0.4 + rnd() * 0.5;
  st.clean = Math.max(0.4, st.clean - R.dustPerSol);
  st.windCleaned = rnd() < R.windClean; if (st.windCleaned) st.clean = Math.min(1, st.clean + 0.2);
  // tomorrow's forecast (honest range: it can be wrong)
  const stormSoon = st.storm > 0 || rnd() < 0.15;
  st.fc = stormSoon ? [Math.max(0.5, st.tau - 0.6), st.tau + 1.2] : [0.4, 1.0];
}
async function morning(st) {
  const land = await (await dir()).show('land', { time: st.tau >= 2 ? 'storm' : 'day' });
  if (st.tau >= 2) land.shake?.(1200, 0.003);
  hud(st);
  const lines = [{ who: 'nova', text: { en: `Sol ${st.sol} morning. Dust in the sky: tau ${st.tau.toFixed(1)}${st.tau >= 2 ? ' — a dust storm! The panels get much less sunlight' : ''}. Panels are ${Math.round(st.clean * 100)}% clean. Solar power today: ${st.solar}.` } }];
  if (st.windCleaned) lines.push({ who: 'nova', text: { en: 'Lucky! The wind blew some dust off our panels last night. That really happened to NASA’s Spirit rover in 2009.' } });
  if (st.fault) lines.push({ who: 'kerem', mood: 'worried', text: { en: 'Bad news: the oxygen maker is acting up. It only makes half today. Machines break more often when nobody checks them.' } });
  await say(lines);
}
async function doJob(st, job) {
  if (job.id === 'clean') {
    const land = await (await dir()).show('land', { time: st.tau >= 2 ? 'storm' : 'day' }); hud(st);
    toast('🧹 The crew brushes the dust off the solar panels…', '#FFC94D'); await wait(1600);
    return { cleaned: 0.8 };
  }
  if (job.id === 'plants') {
    await (await dir()).show('green'); hud(st);
    const r = await plantCare(8000);
    return { care: r };
  }
  if (job.id === 'eva') {
    const land = await (await dir()).show('land', { time: st.tau >= 2 ? 'storm' : 'day' }); hud(st);
    toast('🧑‍🚀 The crew walks out to the rocks…', '#FFC94D'); await wait(1800);
    if (st.sepToday) { land.shake?.(800, 0.004); toast('☢️ RADIATION ALARM outside! The crew runs back in!', '#FF5A5A'); sfx.alarm(); await wait(1600); }
    return {};
  }
  toast(job.id === 'gym' ? '🏋️ Two hours on the treadmill and bike, like astronauts on the ISS.' : '🔧 Filters cleaned, valves checked, a cracked seal replaced.', '#5FE0FF');
  await wait(1400);
  return {};
}
function resolveSol(st, plan, job, res, rnd) {
  const a = plan.alloc, why = [];
  // oxygen
  const made = a.ls * R.lsPerUnit * st.o2Mult * (st.fault ? 0.5 : 1) + a.gh * R.ghO2;
  const used = R.crewO2 + (job.id === 'gym' ? R.exerciseO2 : 0);
  let o2 = made - used;
  why.push({ ic: '💨', txt: `Oxygen maker on ${a.ls} power made ${made.toFixed(2)} days of air${st.fault ? ' (half: it was broken)' : ''}; the crew breathed ${used.toFixed(1)}${job.id === 'gym' ? ' (exercise makes you breathe harder)' : ''}.`, d: o2, src: ['moxie'], est: true });
  // battery & night
  let batt = Math.min(R.battMax, plan.banked);
  const lost = Math.max(0, plan.banked - R.battMax);
  batt -= R.heater;
  if (batt < 0) { batt = 0; o2 -= R.coldNightO2; why.push({ ic: '🥶', txt: 'Cold night! The battery was empty, the heaters stopped and the oxygen maker froze for hours. Saving power in the day protects you at night.', d: -R.coldNightO2, src: ['tau'], est: true, bad: true }); }
  else why.push({ ic: '🔋', txt: `${plan.banked} unused power went to the battery${lost ? ` (${lost} wasted: battery full)` : ''}; heaters used 2 overnight (Mars nights are freezing).`, src: [], est: true });
  st.o2 = Math.max(0, st.o2 + o2); st.batt = batt;
  // radiation: cosmic rays every sol (measured), solar particles only on storm days
  const outside = job.id === 'eva' || job.id === 'clean';
  const shelter = a.shield > 0;
  const gcr = R.gcr * (shelter ? R.shelterGcr : 1) + (outside ? 0.1 : 0);
  let sep = 0;
  if (st.sepToday) {
    const f = outside ? 1 : shelter ? (st.site.shelterSep || R.shelterSep) : R.habSep;
    sep = st.risk.dose * f;
    why.push({ ic: '☀️', txt: `SOLAR PARTICLE STORM hit today! ${st.risk.real ? st.risk.why + ' ' : ''}Base dose ${st.risk.dose.toFixed(1)} mSv × ${f} (${outside ? 'crew was outside: no walls' : shelter ? 'crew was in the storm shelter' : 'habitat walls only'}) = ${sep.toFixed(1)} mSv.`, d: -sep, src: st.risk.src ? [st.risk.src, 'ochmo'] : ['donki', 'ochmo'], est: !st.risk.real, bad: true, unit: 'mSv' });
  } else if (shelter) why.push({ ic: '🛡️', txt: 'No solar storm came today, so the shelter only blocked a little cosmic radiation (~7%). Shelters work great against solar storms but barely stop cosmic rays.', src: ['ochmo'] });
  why.push({ ic: '☢️', txt: `Cosmic rays: ${gcr.toFixed(2)} mSv. This never stops on Mars (Curiosity measures ~0.64 every sol)${outside ? ', +0.1 for working outside' : ''}.`, src: ['rad'] });
  st.dose += gcr + sep; st.doseSep += sep; st.doseGcr += gcr;
  // science
  let sci = a.lab + Math.floor(a.gh * 0.5) + (job.id === 'eva' ? (st.sepToday ? 1 : 3) + (st.site.evaBonus || 0) : 0) + (job.id === 'plants' ? 1 : 0);
  st.sciStored += sci;
  if (a.comms) { why.push({ ic: '📡', txt: `Sent ${st.sciStored} science points to Earth (radio was on).`, src: ['jpl'] }); st.sciSent += st.sciStored; st.sciStored = 0; }
  else if (st.sciStored) why.push({ ic: '📦', txt: `${st.sciStored} science points are waiting: no radio today, so nothing reached Earth.`, src: [], bad: true });
  // jobs with later effects
  if (job.id === 'clean') { const g = (1 - st.clean) * res.cleaned; st.clean = Math.min(1, st.clean + g); why.push({ ic: '🧹', txt: `Panels are now ${Math.round(st.clean * 100)}% clean, so tomorrow’s solar power is higher. Dust really ended NASA’s InSight and Opportunity missions.`, src: ['spirit'] }); }
  if (job.id === 'fix') { st.fixedUntil = st.sol + 3; why.push({ ic: '🔧', txt: 'Machines checked: breakdowns are much less likely for 3 sols.', src: [], est: true }); }
  if (job.id === 'gym') { st.gymDays++; why.push({ ic: '🦴', txt: 'Bones and muscles stayed strong today. In space, bones can lose 1–1.5% of their density every month without enough exercise.', src: ['bone', 'osdr'] }); }
  if (a.gh) st.plantDays++;
  if (job.id === 'plants') { st.plantDays += res.care > 0.6 ? 1 : 0; why.push({ ic: '🌱', txt: `Plant experiment done (${Math.round(res.care * 100)}% of problems fixed). NASA grew radishes on the ISS in 27 days; Canada’s Veg-04A tested lettuce lights.`, src: ['radish', 'csa'] }); }
  return { why, o2, sep, gcr, sci, sepHit: st.sepToday, outside, shelter };
}
function solReport(st, rep) {
  return new Promise((res) => {
    const o = overlay(`<div class="card glass mmRep"><div class="h kick">END OF SOL ${st.sol}</div><h2>${rep.sepHit ? '☀️ A solar storm hit!' : st.o2 <= 0 ? '💨 Out of oxygen…' : 'What happened today, and why?'}</h2>
      <div class="why">${rep.why.map((w) => `<div class="w ${w.bad ? 'bad' : ''}"><span class="i">${w.ic}</span><div><p>${esc(w.txt)}${w.est ? ` ${EST}` : ''}</p>${w.src.map(chip).join('')}</div></div>`).join('')}</div>
      <div class="row"><button class="btn" id="rQuit">Quit</button><button class="btn primary" id="rGo">${st.sol >= R.sols || st.o2 <= 0 ? 'See the result ▶' : `Sol ${st.sol + 1} ▶`}</button></div></div>`);
    if (rep.sepHit) sfx.alarm(); else sfx.success();
    o.querySelector('#rGo').onclick = () => { sfx.click(); o.remove(); res('go'); };
    o.querySelector('#rQuit').onclick = () => { sfx.click(); o.remove(); res('quit'); };
  });
}
async function failMission(st, rep) {
  $('#' + HUD_ID)?.remove();
  return new Promise((res) => {
    const o = overlay(`<div class="card glass" style="text-align:center"><div class="h" style="letter-spacing:5px;color:var(--warn);font-weight:900">MISSION OVER</div>
      <p style="font-size:20px">The oxygen ran out on sol ${st.sol}. Real crews keep a reserve and never let the oxygen maker run short of power, because air can’t be shipped from Earth in time.</p>
      <p class="small">Tip: the oxygen maker needs 3 power just to keep up with 4 people, and the heaters need 2 every night. Dust storms and empty batteries are what usually break that.</p>
      <div class="row" style="justify-content:center"><button class="btn" id="fMap">Back</button><button class="btn primary" id="fRe">New mission (new weather, new Sun days)</button></div></div>`);
    o.querySelector('#fRe').onclick = () => { o.remove(); res('replay'); };
    o.querySelector('#fMap').onclick = () => { o.remove(); res('map'); };
  });
}
async function endReport(st) {
  $('#' + HUD_ID)?.remove(); music('win');
  await (await dir()).show('land', { time: 'dusk' });
  const s1 = true, s2 = st.sciSent >= R.sciGoal, s3 = st.dose <= R.doseGoal, stars = [s1, s2, s3].filter(Boolean).length;
  const p = profile(); const best = Math.max(stars, (p.mission && p.mission.best) || 0);
  save({ mission: { best, runs: ((p.mission && p.mission.runs) || 0) + 1 } });
  const months6 = ((R.sols - st.gymDays) / R.sols) * 6; // months without enough exercise, if this pace went on for 6 months
  const issLine = st.iss ? `ISS dosimeter DosTel (RadLab, ${st.iss.day}): about <b>${st.iss.mGyDay.toFixed(2)} mGy per day</b>, read live from NASA RadLab just now.` : 'ISS crews get about <b>80–160 mSv in 6 months</b>.';
  return new Promise((res) => {
    const o = overlay(`<div class="card glass mmRep" style="width:min(820px,95vw)"><div class="h kick">MISSION COMPLETE · ${esc(st.site.name)}</div>
      <div id="eStars" style="font-size:58px;text-align:center;letter-spacing:8px;color:#FFC94D">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <div class="goals"><div class="ok">★ Survived 10 sols (oxygen left: ${st.o2.toFixed(1)} days)</div><div class="${s2 ? 'ok' : ''}">${s2 ? '★' : '☆'} Science sent to Earth: ${st.sciSent}/${R.sciGoal}${st.sciStored ? ` (${st.sciStored} never sent)` : ''}</div><div class="${s3 ? 'ok' : ''}">${s3 ? '★' : '☆'} Radiation: ${st.dose.toFixed(1)} mSv (goal ≤ ${R.doseGoal})</div></div>
      <h3>☢️ Your dose compared with real numbers</h3>
      <div class="cmp"><p>Your crew: <b>${st.dose.toFixed(1)} mSv in 10 sols</b> (${st.doseGcr.toFixed(1)} from cosmic rays, ${st.doseSep.toFixed(1)} from solar storms).</p>
      <p>Curiosity on Mars measures about <b>6.4 mSv every 10 sols</b> from cosmic rays alone. ${issLine}</p><p>NASA’s limit for a whole astronaut career: <b>600 mSv</b>.</p>${chip('rad')}${chip(st.iss ? 'radlab' : 'iss')}${chip('ochmo')}</div>
      <h3>🦴 Health</h3><p class="small">You exercised on ${st.gymDays} of 10 sols. If that pace went on for 6 months in zero-g, bones could lose about ${(months6 * 1).toFixed(1)}–${(months6 * 1.5).toFixed(1)}% (NASA rate: 1–1.5% per month without enough exercise). Mars has 38% of Earth’s gravity; scientists don’t yet know how much that helps. ${chip('bone')}</p>
      <h3>🛰️ Data used in this mission</h3><div class="srcs">${chip(st.sun.mode === 'archived' ? st.sun.src : st.sun.mode === 'live' ? 'api' : 'donki')}${chip('donki')}${chip('rad')}${chip('ochmo')}${chip('moxie')}${chip('tau')}${chip('jpl')}${chip('trek')}${chip(st.site.src)}${chip('radish')}${chip('csa')}${chip('osdr')}</div>
      <p class="small">Sun days used: ${esc(st.sun.days[0].d)} → ${esc(st.sun.days[R.sols - 1].d)} (${st.sun.mode === 'live' ? 'live from NASA DONKI' : st.sun.mode === 'snapshot' ? 'DONKI daily snapshot' : 'archived, not live'}). DONKI watches the Sun from near Earth; Mars may face a different side of the Sun, so we use these days as practice. Oxygen, power and particle-storm chances are simplified game rules.</p>
      <div class="row" style="justify-content:center"><button class="btn" id="eMap">Back</button><button class="btn primary" id="eRe">New mission ↻</button></div></div>`);
    for (let i = 0; i < stars; i++) setTimeout(() => sfx.star(i), 500 + i * 450);
    o.querySelector('#eRe').onclick = () => { o.remove(); res('replay'); };
    o.querySelector('#eMap').onclick = () => { o.remove(); res('map'); };
  });
}
