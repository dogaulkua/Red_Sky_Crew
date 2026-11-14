// Mars Outpost — simulation engine (pure, no DOM). Runs in the browser and in Node tests.
// All rates are "per sol" in data/game.json; the game advances in small time steps.

// ---------------------------------------------------------------- Earth–Mars light delay
// NASA JPL "Approximate Positions of the Planets", Keplerian elements valid 1800–2050 AD.
const EL = {
  earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0],
  mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
};
const rad = (d) => (d * Math.PI) / 180;
function helio(k, T) {
  const [a0, da, e0, de, i0, di, L0, dL, w0, dw, n0, dn] = EL[k];
  const a = a0 + da * T, e = e0 + de * T, I = rad(i0 + di * T), L = L0 + dL * T, wbar = w0 + dw * T, node = n0 + dn * T;
  const w = rad(wbar - node), O = rad(node);
  let M = ((L - wbar) % 360 + 540) % 360 - 180; M = rad(M);
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * x + (-sw * cO - cw * sO * cI) * y,
    (cw * sO + sw * cO * cI) * x + (-sw * sO + cw * cO * cI) * y,
    sw * sI * x + cw * sI * y,
  ];
}
export function earthMarsDistanceAU(date = new Date()) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const e = helio('earth', T), m = helio('mars', T);
  return Math.hypot(m[0] - e[0], m[1] - e[1], m[2] - e[2]);
}
export function lightDelayMinutes(date = new Date()) {
  const AU_KM = 149597870.7, C_KMS = 299792.458;
  return (earthMarsDistanceAU(date) * AU_KM) / C_KMS / 60;
}

// ---------------------------------------------------------------- helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function tauToEfficiency(tau, table) {
  if (tau <= table[0].tau) return table[0].eff;
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1], b = table[i];
    if (tau <= b.tau) return a.eff + ((tau - a.tau) / (b.tau - a.tau)) * (b.eff - a.eff);
  }
  return table[table.length - 1].eff;
}

// ---------------------------------------------------------------- state
export function createState(mission, rules) {
  return {
    missionId: mission.id,
    t: 0, // time in sols since start
    o2: mission.start.o2, food: mission.start.food, science: 0, dose: 0,
    power: { ls: 0, gh: 0, lab: 0, shield: 0 },
    cleanliness: 1, // dust on panels: 1 = clean
    storm: null, // {eff, until, after}
    shelterUntil: -1,
    fired: {}, // event index -> true
    pending: null, // decision waiting for the player
    messages: [], // {text, at} queued Earth messages
    log: [], // per sol summary
    status: 'playing', failCause: null,
    solAcc: { dose: 0, science: 0, events: [] },
  };
}

export function solNumber(s) { return Math.floor(s.t) + 1; }

export function solarEfficiency(s, mission, rules) {
  let eff = s.cleanliness;
  if (mission.tauBySol) eff *= tauToEfficiency(mission.tauBySol[Math.min(mission.tauBySol.length - 1, Math.floor(s.t))], rules.dustTauToEfficiency);
  if (s.storm && s.t < s.storm.until) eff *= s.storm.eff;
  return clamp(eff, 0, 1);
}
export function powerAvailable(s, mission, rules) {
  return Math.floor(rules.solarMaxUnits * solarEfficiency(s, mission, rules) + 1e-9);
}
export const powerUsed = (s) => s.power.ls + s.power.gh + s.power.lab + s.power.shield;
export const inShelter = (s) => s.t < s.shelterUntil;

// rates per sol given the current state (used for the live arrows in the HUD)
export function rates(s, mission, rules) {
  const R = rules.rooms, sh = inShelter(s);
  const working = !sh;
  const protection = Math.min(R.shield.max * R.shield.perUnit, s.power.shield * R.shield.perUnit);
  const ev = activeRadiation(s, mission);
  let dose = (rules.baselineDoseMsvPerSol + ev) * (1 - protection);
  if (sh) dose *= rules.shelterDoseFactor;
  return {
    o2: s.power.ls * R.ls.perUnit - rules.crew * rules.o2PerCrew,
    food: (working ? s.power.gh * R.gh.perUnit : 0) - rules.crew * rules.foodPerCrew,
    science: working ? s.power.lab * R.lab.perUnit : 0,
    dose, protection, radiationEvent: ev,
  };
}
function activeRadiation(s, mission) {
  let r = 0;
  (mission.events || []).forEach((e, i) => {
    if (e.type === 'SEP' && s.t >= e.at && s.t < e.at + e.duration) r += e.doseMsv / e.duration;
    if (e.type === 'CME' && s.t >= e.at && s.t < e.at + (e.duration || 0.5)) r += (e.doseMsv || 0) / (e.duration || 0.5);
  });
  return r;
}

// change power in a room by +1/-1; returns new state (or same if not allowed)
export function setPower(s, room, delta, mission, rules) {
  const max = rules.rooms[room].max;
  const next = clamp(s.power[room] + delta, 0, max);
  if (next === s.power[room]) return s;
  if (delta > 0 && powerUsed(s) + 1 > powerAvailable(s, mission, rules)) return s;
  return { ...s, power: { ...s.power, [room]: next } };
}

// if solar drops, unplug rooms in this order until it fits
const SHED = ['lab', 'shield', 'gh', 'ls'];
export function shedPower(s, mission, rules) {
  let avail = powerAvailable(s, mission, rules), p = { ...s.power }, shed = [];
  for (const r of SHED) while (p.ls + p.gh + p.lab + p.shield > avail && p[r] > 0) { p[r]--; shed.push(r); }
  return shed.length ? { s: { ...s, power: p }, shed } : { s, shed };
}

// events that should trigger now (decisions pause the game)
export function dueEvents(s, mission) {
  const out = [];
  (mission.events || []).forEach((e, i) => {
    if (!s.fired[i] && s.t >= e.at) out.push({ i, e });
    if (e.warnAt !== undefined && !s.fired['w' + i] && s.t >= e.warnAt) out.push({ i, e, warning: true });
  });
  return out;
}
export function markFired(s, key) { return { ...s, fired: { ...s.fired, [key]: true } }; }

// apply an event (non-decision part) at trigger time
export function applyEvent(s, e) {
  s = { ...s };
  if (e.type === 'DUST_DEVIL') s.cleanliness = 1;
  if (e.type === 'DUST_SETTLE') s.cleanliness = clamp(s.cleanliness - (e.amount || 0.1), 0, 1);
  if (e.type === 'EQUIPMENT') s.o2 = clamp(s.o2 + (e.o2 || 0), 0, 100);
  s.solAcc = { ...s.solAcc, events: [...s.solAcc.events, e.id] };
  return s;
}
// apply a decision choice
export function applyChoice(s, e, choice, rules) {
  s = { ...s };
  const c = choice.effect || {};
  if (e.type === 'DUST_STORM') s.storm = { eff: c.stormEff ?? 1, until: e.at + e.duration, after: c.afterEff ?? 1 };
  if (c.shelter) s.shelterUntil = e.at + e.duration;
  if (c.science) s.science = Math.max(0, s.science + c.science);
  return s;
}

// advance by dt sols
export function step(s, dt, mission, rules) {
  if (s.status !== 'playing' || s.pending) return s;
  const r = rates(s, mission, rules);
  const prevSol = Math.floor(s.t);
  s = { ...s, t: s.t + dt };
  s.o2 = clamp(s.o2 + r.o2 * dt, 0, 100);
  s.food = clamp(s.food + r.food * dt, 0, 100);
  s.science += r.science * dt;
  s.dose += r.dose * dt;
  s.solAcc = { ...s.solAcc, dose: s.solAcc.dose + r.dose * dt, science: s.solAcc.science + r.science * dt };
  s.cleanliness = clamp(s.cleanliness - rules.dustPerSol * dt, rules.minCleanliness, 1);
  if (s.storm && s.t >= s.storm.until) { s.cleanliness = Math.min(s.cleanliness, s.storm.after); s.storm = null; }
  if (Math.floor(s.t) > prevSol) {
    s.log = [...s.log, { sol: prevSol + 1, power: { ...s.power }, o2: s.o2, food: s.food, science: s.science, dose: s.dose, solDose: s.solAcc.dose, events: s.solAcc.events }];
    s.solAcc = { dose: 0, science: 0, events: [] };
  }
  if (s.o2 <= 0) return { ...s, status: 'failed', failCause: 'o2' };
  if (s.food <= 0) return { ...s, status: 'failed', failCause: 'food' };
  if (s.dose >= mission.doseLimit) return { ...s, status: 'failed', failCause: 'radiation' };
  if (s.t >= mission.sols) {
    if (s.science >= mission.scienceGoal) return { ...s, status: 'won' };
    return { ...s, status: 'failed', failCause: 'science' };
  }
  return s;
}

export function stars(s, mission) {
  if (s.status !== 'won') return 0;
  let n = 1;
  if (s.o2 >= 40 && s.food >= 40) n++; // crew healthy at the end
  if (n === 2 && s.dose < mission.doseLimit * 0.6) n++; // and low radiation
  return n;
}

// Turn the daily DONKI snapshot into a "Today's Sun" mission (30 real days → mission sols)
export function missionFromDonki(template, snap, rules) {
  const m = JSON.parse(JSON.stringify(template));
  m.events = [];
  if (!snap || !snap.events) return m;
  const end = Date.parse(snap.snapshotDate) || Date.now();
  const start = end - 30 * 86400000;
  const toSol = (iso) => clamp(((Date.parse(iso) - start) / (30 * 86400000)) * m.sols, 0.3, m.sols - 0.6);
  for (const f of snap.events.FLR || []) {
    const cls = (f.classType || '')[0];
    if (cls === 'X') m.events.push({ id: 'live_flr_' + f.id, type: 'NOTICE', at: toSol(f.startTime), real: { donkiId: f.id, link: f.link, classType: f.classType, date: (f.startTime || '').slice(0, 10) }, text: 'live_flare' });
  }
  for (const p of snap.events.SEP || []) {
    const at = toSol(p.startTime);
    m.events.push({ id: 'live_sep_' + p.id, type: 'SEP', decision: 'sep', at, warnAt: Math.max(0.1, at - 0.4), duration: 1, doseMsv: rules.liveSepDoseMsv, doseKind: 'game_estimate', real: { donkiId: p.id, link: p.link, date: (p.startTime || '').slice(0, 10) } });
  }
  for (const c of snap.events.CME || []) m.events.push({ id: 'live_cme_' + c.id, type: 'CME', at: toSol(c.startTime), duration: 0.5, doseMsv: 0.3, real: { donkiId: c.id, link: c.link, date: (c.startTime || '').slice(0, 10) } });
  m.events.sort((a, b) => a.at - b.at);
  // keep it playable: at most 3 SEPs, 4 CMEs, at least 0.8 sol apart for SEPs
  let lastSep = -9, sepN = 0, cmeN = 0;
  m.events = m.events.filter((e) => {
    if (e.type === 'SEP') { if (sepN >= 3 || e.at - lastSep < 0.8) return false; lastSep = e.at; sepN++; }
    if (e.type === 'CME') { if (cmeN >= 4) return false; cmeN++; }
    return true;
  });
  return m;
}
