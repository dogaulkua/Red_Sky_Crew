// core: language, profile/save, audio (music + sfx + voice)

// ---------------------------------------------------------------- i18n
let LOC = 'en';
let DICT = {};
const listeners = new Set();
export async function loadText(...urls) {
  for (const u of urls) Object.assign(DICT, await fetch(u).then((r) => r.json()));
}
export const lang = () => LOC;
let PREV = 'en';
export function setLang() { PREV = LOC; LOC = 'en'; /* English only */ document.documentElement.lang = LOC; try { localStorage.setItem('mars_lang', LOC); } catch {} listeners.forEach((f) => f(LOC, PREV)); }
export const onLang = (f) => listeners.add(f);
export const offLang = (f) => listeners.delete(f);
export function tt(o, vars) {
  let s = o == null ? '' : typeof o === 'string' ? o : (o[LOC] ?? o.en ?? '');
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}
export const t = (k, vars) => (DICT[k] ? tt(DICT[k], vars) : k);
export const has = (k) => !!DICT[k];
// turn a string already shown in one language into the other (used when the language is switched mid-game)
const RX = {};
function index(l) {
  if (RX[l]) return RX[l];
  const exact = new Map(), tpl = [];
  for (const [k, v] of Object.entries(DICT)) {
    const x = v && v[l]; if (!x) continue;
    if (x.includes('{')) { const names = []; const re = new RegExp('^' + x.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, n) => { names.push(n); return '(.+?)'; }) + '$'); tpl.push([re, names, k]); }
    else if (!exact.has(x)) exact.set(x, k);
  }
  return (RX[l] = { exact, tpl });
}
export function retranslate(str, from, to = LOC) {
  if (!str || from === to) return str;
  const I = index(from), plain = (x) => x.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1');
  const one = (x) => {
    const k = I.exact.get(x); if (k) return plain(DICT[k][to] || x);
    for (const [re, names, key] of I.tpl) { const m = x.match(re); if (m) { const vars = {}; names.forEach((n, i) => (vars[n] = m[i + 1])); return plain(tt(DICT[key], vars)); } }
    return null;
  };
  const r = one(str); if (r != null) return r;
  if (str.includes(' · ')) return str.split(' · ').map((p) => one(p) ?? p).join(' · ');
  return str;
}

// ---------------------------------------------------------------- profile / save
const KEY = 'mars_outpost_v2';
const DEFAULT = { name: '', avatar: 'c09', suit: 0, lang: null, cards: [], stars: {}, done: [], base: null,
  settings: { music: 0.6, sfx: 0.8, voice: true, blips: false, rate: 1, fontScale: 1, shake: true, v4: true } };
// Several pilots can share one device (siblings, classmates). Each has its own name, look and progress.
// Everything stays in this browser only: no account, no server.
const KEY2 = 'mars_pilots_v1';
let STORE = null, P = null;
const norm = (p) => { const q = { ...structuredClone(DEFAULT), ...p }; q.settings = { ...DEFAULT.settings, ...(p.settings || {}) }; if (!(p.settings || {}).v5) { q.settings.voice = true; q.settings.blips = false; q.settings.v5 = true; } return q; };
function store() {
  if (STORE) return STORE;
  try { STORE = JSON.parse(localStorage.getItem(KEY2)); } catch { STORE = null; }
  if (!STORE || !STORE.pilots) {
    STORE = { active: null, pilots: {} };
    try { const old = JSON.parse(localStorage.getItem(KEY)); if (old && old.name) { const id = 'p' + Date.now().toString(36); STORE.pilots[id] = { ...old, id }; STORE.active = id; } } catch {}
  }
  for (const id in STORE.pilots) STORE.pilots[id] = norm({ ...STORE.pilots[id], id });
  return STORE;
}
const persist = () => { try { localStorage.setItem(KEY2, JSON.stringify(STORE)); } catch {} };
export function profile() {
  const s = store();
  if (P && s.pilots[P.id] === P) return P;
  P = s.pilots[s.active] || (P && !P.id ? P : norm({}));
  return P;
}
export function save(patch = {}) {
  const s = store(), p = profile();
  Object.assign(p, patch);
  if (p.name) { if (!p.id) p.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); s.pilots[p.id] = p; s.active = p.id; p.seen = Date.now(); }
  persist();
  return p;
}
export const pilots = () => Object.values(store().pilots).sort((a, b) => (b.seen || 0) - (a.seen || 0));
export function switchPilot(id) { const s = store(); if (s.pilots[id]) { s.active = id; P = s.pilots[id]; P.seen = Date.now(); persist(); } return P; }
export function newPilot() { const s = store(), keep = profile(); s.active = null; P = norm({ lang: keep.lang, settings: keep.settings }); return P; }
export function deletePilot(id) { const s = store(); delete s.pilots[id]; if (s.active === id) { s.active = null; P = null; } persist(); }
export function resetProfile() { const p = profile(); if (p.id) deletePilot(p.id); P = norm({}); }
export const hasProfile = () => !!profile().name;

// ---------------------------------------------------------------- suit colours (recolour the green trim of the sprites)
export const SUITS = [
  { id: 'green', hue: null, css: '#2E8B57' }, { id: 'orange', hue: 25, css: '#F08A3C' }, { id: 'blue', hue: 210, css: '#3C7FE0' },
  { id: 'purple', hue: 275, css: '#8A5AE0' }, { id: 'red', hue: 355, css: '#E04848' }, { id: 'gold', hue: 45, css: '#E0B030' },
];
const recolorCache = new Map();
export function suitImage(src, suitIdx) {
  const s = SUITS[suitIdx] || SUITS[0];
  if (s.hue == null) return Promise.resolve(src);
  const key = src + '|' + s.hue;
  if (recolorCache.has(key)) return recolorCache.get(key);
  const p = new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] < 10) continue;
        const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
        if (dd < 0.12) continue;
        let h; if (mx === r) h = ((g - b) / dd) % 6; else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4; h *= 60; if (h < 0) h += 360;
        if (h < 95 || h > 175) continue; // only the green trim
        const sat = dd / (1 - Math.abs(2 * l - 1));
        const nh = s.hue / 60, C = (1 - Math.abs(2 * l - 1)) * Math.min(1, sat * 1.1), X = C * (1 - Math.abs((nh % 2) - 1)), m = l - C / 2;
        let [rr, gg, bb] = nh < 1 ? [C, X, 0] : nh < 2 ? [X, C, 0] : nh < 3 ? [0, C, X] : nh < 4 ? [0, X, C] : nh < 5 ? [X, 0, C] : [C, 0, X];
        a[i] = (rr + m) * 255; a[i + 1] = (gg + m) * 255; a[i + 2] = (bb + m) * 255;
      }
      x.putImageData(d, 0, 0); res(c.toDataURL());
    };
    img.onerror = () => res(src);
    img.src = src;
  });
  recolorCache.set(key, p);
  return p;
}

// ---------------------------------------------------------------- audio
let AC = null, master = null, musicGain = null, sfxGain = null, musicNodes = [];
function ac() {
  if (!AC) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    AC = new C(); master = AC.createGain(); master.connect(AC.destination);
    musicGain = AC.createGain(); musicGain.connect(master); sfxGain = AC.createGain(); sfxGain.connect(master);
    applyVolumes();
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
export function applyVolumes() { if (!AC) return; const s = profile().settings; musicGain.gain.value = s.music * 0.35; sfxGain.gain.value = s.sfx * 0.6; }
export function unlockAudio() { ac(); }
function env(g, t0, a, d, peak = 1) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
function tone(freq, dur, type = 'sine', peak = 0.5, when = 0, slideTo) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  env(g, t0, 0.01, dur, peak); o.connect(g); g.connect(sfxGain); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, peak = 0.4, when = 0, lp = 1200, lpTo, att = 0.02) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + when;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(lp, t0);
  if (lpTo) f.frequency.exponentialRampToValueAtTime(lpTo, t0 + dur);
  const g = c.createGain(); env(g, t0, att, dur, peak); s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t0);
}
export const sfx = {
  // UI sounds are soft "bubble" pops, never sharp clicks or noise slaps
  click: () => tone(700, 0.09, 'sine', 0.07, 0, 1050),
  hover: () => {},
  next: () => tone(820, 0.07, 'sine', 0.035, 0, 980),
  type: () => {},
  whoosh: () => noise(0.9, 0.06, 0, 700, 220, 0.25),
  rumble: (d = 2) => noise(d, 0.5, 0, 180, 60),
  boom: () => { noise(1.2, 0.8, 0, 400, 50); tone(70, 0.8, 'sine', 0.7, 0, 35); },
  thrust: (d = 1.5) => noise(d, 0.45, 0, 900, 400),
  chute: () => { noise(0.4, 0.5, 0, 2500, 600); tone(180, 0.3, 'sawtooth', 0.12, 0, 90); },
  powerOn: () => { tone(110, 0.5, 'sawtooth', 0.15, 0, 440); tone(880, 0.25, 'sine', 0.2, 0.42); },
  plug: () => { tone(520, 0.08, 'sine', 0.08, 0, 780); tone(1040, 0.14, 'sine', 0.07, 0.06); },
  unplug: () => tone(600, 0.12, 'sine', 0.07, 0, 300),
  error: () => { tone(392, 0.12, 'sine', 0.09, 0, 330); tone(330, 0.16, 'sine', 0.08, 0.1, 262); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone(880, 0.22, 'triangle', 0.1, i * 0.5); tone(660, 0.22, 'triangle', 0.1, i * 0.5 + 0.25); } },
  success: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.22, i * 0.09)),
  card: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, 'sine', 0.18, i * 0.07)); noise(0.5, 0.08, 0, 8000, 2000); },
  grow: () => [392, 494, 587].forEach((f, i) => tone(f, 0.2, 'sine', 0.15, i * 0.12)),
  wind: (d = 3) => noise(d, 0.22, 0, 700, 300),
  tick: () => tone(1100, 0.04, 'sine', 0.045),
  star: (i = 0) => tone(880 + i * 220, 0.3, 'triangle', 0.25),
};
// character "voice": short sung syllables, pitch and rhythm by character and mood (no robot TTS)
const VOICE = { nova: [560, 'sine'], aylin: [400, 'triangle'], deniz: [250, 'triangle'], kerem: [200, 'triangle'], cmd: [320, 'triangle'], earth: [180, 'square'] };
let lastBlip = 0;
export function blip(who, mood = 'happy', ch = 'a') {
  if (!profile().settings.blips) return;
  const now = performance.now(); if (now - lastBlip < 55) return; lastBlip = now;
  const c = ac(); if (!c) return;
  const [base, type] = VOICE[who] || VOICE.cmd;
  const vowel = 'aeiouıöü'.includes(ch.toLowerCase()) ? 1.12 : 1;
  const jitter = mood === 'scared' ? 1 + (Math.random() - 0.5) * 0.5 : mood === 'worried' ? 0.92 + Math.random() * 0.08 : 1 + Math.random() * 0.22;
  const f = base * vowel * jitter, t0 = c.currentTime, dur = mood === 'worried' ? 0.08 : 0.06;
  const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter();
  o.type = type; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * (mood === 'happy' ? 1.18 : 0.9), t0 + dur);
  bp.type = 'bandpass'; bp.frequency.value = f * 2.2; bp.Q.value = 1.2;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(who === 'earth' ? 0.12 : 0.22, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(bp); bp.connect(g); g.connect(sfxGain); o.start(t0); o.stop(t0 + dur + 0.02);
}
// ambient music: slow evolving pad (generated, no files)
const MOODS = {
  title: [[110, 164.8, 220, 329.6], 0.07],
  calm: [[98, 146.8, 196, 293.7], 0.06],
  night: [[82.4, 123.5, 164.8, 246.9], 0.05],
  tense: [[73.4, 110, 146.8, 155.6], 0.09],
  win: [[130.8, 196, 261.6, 392], 0.07],
};
export function music(mood) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime;
  musicNodes.forEach((n) => { try { n.g.gain.cancelScheduledValues(t0); n.g.gain.setTargetAtTime(0.0001, t0, 0.8); n.o.stop(t0 + 4); } catch {} });
  musicNodes = [];
  if (!mood || !MOODS[mood]) return;
  const [freqs, lfoRate] = MOODS[mood];
  const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900; filt.connect(musicGain);
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = lfoRate; lg.gain.value = 400; lfo.connect(lg); lg.connect(filt.frequency); lfo.start();
  freqs.forEach((f, i) => {
    for (const det of [-6, 6]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = i === 0 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t0); g.gain.setTargetAtTime((i === 0 ? 0.22 : 0.07) / 2, t0, 2.5);
      o.connect(g); g.connect(filt); o.start(t0); musicNodes.push({ o, g });
    }
  });
  musicNodes.push({ o: lfo, g: lg });
}
// voice acting: pre-recorded neural voice lines (assets/voice/<lang>/<key>.mp3), made offline with
// Kokoro (English) and Piper (Turkish). Lines with a live number ({min}) are stitched from parts.
let cur = null, curToken = 0;
const VIDX = {}; // per language: which lines have a recording (Turkish ones are made with tools/voice)
const loadIdx = (l) => { if (!(l in VIDX)) { VIDX[l] = {}; fetch(`assets/voice/${l}/index.json?v=2026-11-15d`).then((r) => (r.ok ? r.json() : {})).then((j) => (VIDX[l] = j)).catch(() => {}); } };
loadIdx('en');
export const hasVoice = (key) => !!(VIDX[LOC] && VIDX[LOC][key]);
function clip(src, rate) {
  return new Promise((res) => {
    const a = new Audio(src); a.preload = 'auto'; a.volume = 1;
    a.playbackRate = rate; a.preservesPitch = true;
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    a.onended = () => fin(true); a.onerror = () => fin(false);
    a.onloadedmetadata = () => setTimeout(() => fin(true), (a.duration * 1000) / rate + 1500);
    setTimeout(() => fin(false), 25000);
    cur = a; a.play().catch(() => fin(false));
  });
}
// plays a line; resolves when it has finished (or false if there is no recording)
export async function voice(key, vars = {}) {
  stopSpeak();
  const s = profile().settings;
  if (!s.voice || !hasVoice(key)) return false;
  const token = ++curToken, L = LOC, rate = s.rate || 1, base = `assets/voice/${L}/`;
  duck(true);
  let ok;
  if (vars.min != null && /\{min\}/.test((DICT[key] || {})[L] || '')) {
    const v = Math.min(22.5, Math.max(3, Math.round(parseFloat(String(vars.min).replace(',', '.')) * 10) / 10)).toFixed(1);
    ok = await clip(base + key + '.0.mp3', rate);
    if (token === curToken) ok = await clip(base + `num/${v}.mp3`, rate);
    if (token === curToken) ok = await clip(base + key + '.1.mp3', rate);
  } else ok = await clip(base + key + '.mp3', rate);
  if (token === curToken) duck(false);
  return ok && token === curToken;
}
function duck(on) { try { const c = ac(); if (c && musicGain) musicGain.gain.setTargetAtTime(profile().settings.music * (on ? 0.12 : 0.35), c.currentTime, 0.25); } catch {} }
export function speak() {} // old browser TTS removed: it sounded robotic
export const stopSpeak = () => { curToken++; if (cur) { try { cur.pause(); } catch {} cur = null; } duck(false); };
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
