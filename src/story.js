// Chapter scripts (5 chapters). Every NASA fact used here is on a card in data/cards.json with its source.
import { t, tt, profile, save, sfx, music, wait } from './core.js?v=2026-11-15d';
import { say, choose, nasaCard, titleCard, letterbox, objective, meters, showTop, toast, el, esc, $, costChips, overlay } from './ui.js?v=2026-11-15d';
import { director } from './scenes.js?v=2026-11-15d';
import { o2Valve, plantCare, foldPanels, aimDish, shelterRun } from './minis.js?v=2026-11-15d';
import { lightDelayMinutes } from './sim.js?v=2026-11-15d';
import { SRC, getJSON } from './mission.js?v=2026-11-15d';

// "Why?" moment: NOVA says a voiced, sourced fact while a card shows the source link (and any live number)
async function why(items) {
  for (const [key, src, extra] of items) {
    const s = src && SRC[src];
    const c = donkiCard(`<b>${src === 'you' ? '📊 Your crew' : `📚 Why? · ${s ? 'real source' : 'game estimate'}`}</b>${extra ? `<div class="dkr">${extra}</div>` : ''}${s ? `<small><a href="${s.u}" target="_blank" rel="noopener noreferrer">${esc(s.t)} ↗</a></small>` : ''}`);
    await say([L('nova', key)]); c.remove();
  }
}
// Chapter 5's Sun: ask NASA DONKI directly first (api.nasa.gov, then NASA CCMC), else the daily snapshot.
async function loadDonki30() {
  const ymd = (d) => d.toISOString().slice(0, 10);
  const end = new Date(), start = new Date(end.getTime() - 30 * 864e5);
  const norm = (type, a) => (Array.isArray(a) ? a : []).map((e) => ({ id: e.flrID || e.activityID || e.sepID || e.gstID || '', type, startTime: e.beginTime || e.startTime || e.eventTime || '', peakTime: e.peakTime || '', link: e.link || '', classType: e.classType || '' }));
  for (const base of ['https://api.nasa.gov/DONKI/', 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/']) {
    try {
      const q = `?startDate=${ymd(start)}&endDate=${ymd(end)}${base.includes('api.nasa.gov') ? '&api_key=DEMO_KEY' : ''}`;
      const [f, c, s, g] = await Promise.all(['FLR', 'CME', 'SEP', 'GST'].map((k) => getJSON(base + k + q, 7000)));
      return { mode: 'live', date: ymd(end), ev: { FLR: norm('FLR', f), CME: norm('CME', c), SEP: norm('SEP', s), GST: norm('GST', g) } };
    } catch (e) { /* try the next source */ }
  }
  const snap = await fetch('data/donki_latest.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return { mode: 'snapshot', date: snap ? (snap.snapshotDate || '').slice(0, 10) : '—', ev: (snap && snap.events) || { FLR: [], CME: [], SEP: [], GST: [] } };
}

let CARDS = null;
async function cards() { if (!CARDS) CARDS = await fetch('data/cards.json?v=2026-11-15d').then((r) => r.json()); return CARDS; }
async function card(id) { const C = await cards(); const c = C.cards.find((x) => x.id === id); await nasaCard(c, c.n, C.total); }
const L = (who, key, extra = {}) => ({ who, key, ...extra });
const DELAY = () => lightDelayMinutes();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mgPanel(html) { let p = $('#mg'); if (!p) { p = el('div', 'glass'); p.id = 'mg'; $('#layer').appendChild(p); } p.innerHTML = html; p.classList.remove('hide'); return p; }
const closeMg = () => $('#mg')?.remove();
function startState() { const b = profile().base; return { air: 70, food: 70, power: 10, shield: 0, science: 0, dose: 0, ...(b ? { air: clamp(b.air, 50, 100), food: clamp(b.food, 50, 100) } : {}) }; }
function finish(id, stars, extraBase) {
  const p = profile();
  save({ stars: { ...p.stars, [id]: Math.max(stars, p.stars[id] || 0) }, done: [...new Set([...p.done, id])], base: { ...(p.base || {}), ...extraBase } });
}
function donkiCard(html) { const c = el('div', 'donkiCard glass', html); $('#layer').appendChild(c); return c; }
function lost(st) { return st.air <= 0 ? 'fail_air' : st.food <= 0 ? 'fail_food' : null; }

// ---------------------------------------------------------------- reusable: power puzzle
async function runWake({ power, objectiveKey, objVars, intro, rules = { ls: 2, gh: 2, comms: 1 }, st }) {
  meters({ power }, { power });
  const wake = await director.show('wake', { power });
  objective(t(objectiveKey, objVars));
  if (intro) await say(intro);
  const alloc = await new Promise((resolve) => {
    const tipped = new Set();
    const render = (a, free) => {
      const air = a.ls * 7 - 14, food = a.gh * 6 - 10, sci = a.lab * 4, sh = a.shield * 20;
      const p = mgPanel(`<span class="stat">⚡ ${t('w_free')}: <b style="color:var(--power)">${free}</b></span><span class="stat">${t('w_preview')}:</span>
        <span class="cost ${air >= 0 ? 'p' : 'n'}">💨 ${t('w_air')} ${air >= 0 ? '+' : ''}${air}</span>
        <span class="cost ${food >= 0 ? 'p' : 'n'}">🥬 ${t('w_food')} ${food >= 0 ? '+' : ''}${food}</span>
        <span class="cost p">🔬 ${t('w_sci')} +${sci}</span><span class="cost ${sh ? 'p' : 'n'}">🛡️ ${t('w_shield')} ${sh}%</span>
        <span class="cost ${a.comms ? 'p' : 'n'}">📡 ${a.comms ? '✓' : '✗'}</span><button class="btn primary" id="wGo">${t('w_confirm')}</button>`);
      meters({ power: free });
      p.querySelector('#wGo').onclick = () => {
        const why = free > 0 ? 'w_need_all' : a.ls < (rules.ls || 0) ? 'w_need_air' : a.gh < (rules.gh || 0) ? 'w_need_food' : a.comms < (rules.comms || 0) ? 'w_need_comms' : null;
        if (why) { sfx.error(); toast('🤖 ' + esc(t(why)), '#FF5A5A'); return; }
        sfx.success(); resolve(a);
      };
    };
    wake.events.on('change', (a, free) => { render(a, free); const k = Object.keys(a).find((r) => a[r] > 0 && !tipped.has(r)); if (k && st.tips !== false) { tipped.add(k); toast('🤖 ' + esc(t('tip_' + k)), '#5FE0FF'); } });
    wake.events.on('msg', (k) => toast('🤖 ' + esc(t(k)), '#FFC94D'));
    render(wake.alloc, wake.free());
  });
  closeMg(); objective('');
  st.alloc = alloc; st.shield = alloc.shield;
  st.air = clamp(st.air + (alloc.ls * 7 - 14), 0, 100); st.food = clamp(st.food + (alloc.gh * 6 - 10), 0, 100); st.science += alloc.lab * 4;
  meters(st); wake.cameras.main.flash(400, 255, 255, 255); sfx.powerOn();
  return alloc;
}
// ---------------------------------------------------------------- reusable: delayed message from Earth
function delayCountdown(prepare) {
  const min = DELAY(), secs = Math.max(4, Math.round(min));
  return new Promise((res) => {
    const o = overlay(`<div class="card glass" style="text-align:center"><div class="h" style="letter-spacing:4px;color:var(--cyan);font-weight:900">📨 ${t('delay_title')}</div>
      <div class="h" id="dN" style="font-size:64px;font-weight:900;margin:8px 0">${secs}</div><div class="timer"><div class="t"><b id="dB" style="background:linear-gradient(90deg,#5FE0FF,#9FD0FF)"></b></div></div>
      <p class="small">${esc(t('delay_sub', { min: min.toFixed(1) }))}</p><div id="dPrep"></div></div>`);
    o.style.background = 'rgba(3,5,12,.55)';
    let picked = null;
    if (prepare) {
      o.querySelector('#dPrep').innerHTML = `<p style="font-weight:800">${esc(prepare.q)}</p><div class="cards" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${prepare.options.map((op, i) => `<button class="ccard" style="min-width:180px" data-i="${i}"><div class="ic">${op.icon}</div><b>${esc(op.label)}</b><span>${esc(op.hint)}</span><div class="costs">${costChips(op.costs)}</div></button>`).join('')}</div>`;
      o.querySelectorAll('.ccard').forEach((b) => (b.onclick = () => { sfx.click(); picked = +b.dataset.i; o.querySelectorAll('.ccard').forEach((x) => (x.style.opacity = x === b ? 1 : 0.35)); b.style.borderColor = 'var(--accent)'; }));
    }
    const t0 = performance.now();
    const iv = setInterval(() => {
      const left = secs - (performance.now() - t0) / 1000;
      o.querySelector('#dN').textContent = Math.max(0, Math.ceil(left));
      o.querySelector('#dB').style.width = `${Math.max(0, 100 * (1 - left / secs))}%`;
      if (left <= 0) { clearInterval(iv); sfx.alarm(); o.remove(); toast(esc(t('delay_arrived')), '#5FE0FF'); res({ picked, min }); }
    }, 100);
  });
}
// ---------------------------------------------------------------- reusable: fail screen
function failScreen(key) {
  showTop(false); objective('');
  return new Promise((res) => {
    const o = overlay(`<div class="card glass" style="text-align:center"><div class="h" style="letter-spacing:6px;color:var(--warn);font-weight:900">${t('fail_title')}</div>
      <p style="font-size:20px">${esc(t(key))}</p><div class="row" style="justify-content:center"><button class="btn" id="fMap">${t('to_map')}</button><button class="btn primary" id="fRe">${t('try_again')}</button></div></div>`);
    o.querySelector('#fRe').onclick = () => { o.remove(); res('replay'); };
    o.querySelector('#fMap').onclick = () => { o.remove(); res('map'); };
  });
}

// ================================================================ CHAPTER 1 · Landing at Jezero
export async function chapter1() {
  const name = profile().name, delay = DELAY().toFixed(1);
  const st = { air: 60, food: 60, power: 10, shield: 0, science: 0, dose: 0, quality: 0, eva: false };
  showTop(false); objective('');
  music('tense'); letterbox(true);
  await titleCard(t('c1_kicker'), t('c1_title'), t('c1_sub'));
  const descent = director.play('descent');
  await wait(600);
  await Promise.all([descent, say([L('nova', 'c1_d1', { auto: 5600 }), L('nova', 'c1_d2', { vars: { min: delay }, auto: 6800 }), L('nova', 'c1_d3', { auto: 3600 })])]);
  letterbox(false);
  await card('edl');
  const land = await director.show('land', { time: 'day' });
  music('calm');
  land.act('deniz', 'hop');
  await say([L('deniz', 'c1_l1', { vars: { name }, act: 'hop' }), L('aylin', 'c1_l2')]);
  await card('jezero');
  await why([['c1_trek', 'trek', 'Jezero Crater · 18°N']]);
  await say([L('kerem', 'c1_l3', { mood: 'worried', act: 'worry' }), L('nova', 'c1_l4')]);
  showTop(true, `${t('c1_kicker')} · ${t('c1_title')}`);
  meters(st, { air: 100, food: 100, power: 10, shield: 3, science: 40 });
  await runWake({ power: 10, objectiveKey: 'c1_obj_wake', intro: [L('nova', 'c1_w1')], st });
  await say([L('nova', 'c1_w_done')]);
  // hands-on: start the oxygen maker (life support)
  const valve = await o2Valve(12000);
  st.air = clamp(st.air + Math.round(-6 + 16 * valve), 0, 100); meters(st);
  toast(valve > 0.75 ? '💨 Oxygen maker running smoothly: +air' : valve > 0.45 ? '💨 Oxygen maker is running, but wobbly' : '💨 Pressure kept slipping: we lost some air', valve > 0.45 ? '#8DF5B4' : '#FF5A5A');
  await why([['why_moxie', 'moxie'], ['why_rad', 'rad']]);
  // greenhouse
  objective(t('c1_obj_green'));
  const gh = await director.show('green');
  await say([L('aylin', 'c1_g1'), L('aylin', 'c1_g2')]);
  const res = await new Promise((resolve) => {
    let light = 2, water = 2;
    const draw = () => {
      const p = mgPanel(`<div class="slider">💡 ${t('g_light')} <input type="range" min="1" max="3" step="1" value="${light}" id="gL"> <b>${light}</b></div>
        <div class="slider">💧 ${t('g_water')} <input type="range" min="1" max="3" step="1" value="${water}" id="gW"> <b>${water}</b></div>
        <div class="costs">${costChips({ power: -light, air: -(water * 3) })}</div><button class="btn primary" id="gGo">${t('g_grow')}</button>`);
      p.querySelector('#gL').oninput = (e) => { light = +e.target.value; gh.setLight(light); sfx.tick(); draw(); };
      p.querySelector('#gW').oninput = (e) => { water = +e.target.value; sfx.tick(); draw(); };
      p.querySelector('#gGo').onclick = () => { sfx.click(); resolve({ light, water }); };
    };
    draw();
  });
  closeMg();
  let quality = Math.max(0, 1 - Math.abs(res.light - 2) * 0.22 - Math.max(0, res.water - 2) * 0.45 - Math.max(0, 2 - res.water) * 0.3 + (res.light === 3 ? 0.12 : 0));
  // big day counter (fast-forward 33 days; real ISS lettuce took 33–56 days, NASA OSDR OSD-268)
  const hud = el('div', '', `<div class="plant">🌱</div><div class="d"></div><div class="bar"><b></b></div><div class="stg"></div><div class="src">${esc(t('grow_src'))}</div>`); hud.id = 'growHud'; $('#layer').appendChild(hud);
  const PL = ['🌱', '🌿', '🥬', '🥬', '🥗'];
  let lastStage = -1;
  const care = plantCare(9000);
  await gh.grow(33, quality, (d, f) => {
    hud.querySelector('.d').textContent = t('grow_day', { d, n: 33 });
    hud.querySelector('.bar b').style.width = (f * 100).toFixed(1) + '%';
    const stg = Math.min(4, Math.floor(f * 4.0001));
    if (stg !== lastStage) { lastStage = stg; hud.querySelector('.stg').textContent = t('grow_s' + stg); const p = hud.querySelector('.plant'); p.textContent = PL[stg]; p.style.transform = 'scale(1.4)'; setTimeout(() => (p.style.transform = ''), 250); }
  });
  const cared = await care; await wait(900); hud.remove();
  quality = Math.min(1, quality * 0.7 + cared * 0.35);
  st.food = clamp(st.food + Math.round(10 + 30 * quality), 0, 100); st.air = clamp(st.air - res.water * 3, 0, 100); st.science = Math.max(0, st.science - (res.light - 1) * 2);
  meters(st);
  await say([L('aylin', quality >= 0.8 ? 'c1_g_great' : quality >= 0.5 ? 'c1_g_ok' : 'c1_g_bad', { mood: quality >= 0.5 ? 'happy' : 'worried' })]);
  await card('lettuce');
  // night
  objective(t('c1_obj_night'));
  const night = await director.show('land', { time: 'night' });
  music('night'); night.dustyPanels(true);
  st.power = 8; meters(st);
  await say([L('deniz', 'c1_n1', { mood: 'worried', act: 'worry' }), L('deniz', 'c1_n2', { mood: 'worried' })]);
  const pick = await choose({ title: t('c1_obj_night'), question: t('c1_q'), options: [
    { icon: '🧑‍🚀', label: t('c1_c_eva'), hint: t('c1_c_eva_h'), costs: { power: '+2', dose: '+0.3 mSv', air: -5 } },
    { icon: '🌬️', label: t('c1_c_wait'), hint: t('c1_c_wait_h'), costs: { science: -8, power: '?' } },
  ] });
  if (pick === 0) {
    st.eva = true; st.dose += 0.3; st.air -= 5; st.power = 10;
    await night.walk('deniz', 300, 1600); night.cleanPanels(); meters(st); await wait(600); night.walk('deniz', 560, 1600);
    await say([L('deniz', 'c1_eva_done')]);
  } else { st.science = Math.max(0, st.science - 8); meters(st); await say([L('deniz', 'c1_wait_done')]); }
  await say([L('aylin', 'c1_devil1', { mood: 'worried', act: 'gasp' })]);
  await night.dustDevil(); night.act('deniz', 'hop'); night.act('aylin', 'hop');
  st.power = 10; meters(st);
  await say([L('deniz', 'c1_devil2', { act: 'hop' })]);
  await card('spirit');
  night.setTime('day', 3000); music('win'); objective('');
  await say([L('nova', 'c1_end1'), L('kerem', 'c1_end2', { mood: 'worried', act: 'think' })]);
  const stars = 1 + (quality >= 0.8 ? 1 : 0) + (st.eva ? 0 : 1);
  finish('ch1', stars, { air: st.air, food: st.food, science: st.science, dose: st.dose });
  return endScreen('ch1', stars, [['c1_s1', true], ['c1_s2', quality >= 0.8], ['c1_s3', !st.eva]], ['edl', 'jezero', 'lettuce', 'spirit'], 'c1_real', 'next_ch');
}

// ================================================================ CHAPTER 2 · The Dust Wall (June 2018)
export async function chapter2() {
  const st = { ...startState(), eva: false };
  showTop(false); objective(''); music('tense'); letterbox(true);
  await titleCard(t('c2_kicker'), t('c2_title'), t('c2_sub'));
  letterbox(false);
  let land = await director.show('land', { time: 'dusk' });
  await say([L('aylin', 'c2_l1', { mood: 'worried', act: 'think' }), L('aylin', 'c2_l2', { mood: 'worried' })]);
  await card('tau');
  await say([L('nova', 'c2_l3', { mood: 'worried' })]);
  showTop(true, `${t('c2_kicker')} · ${t('c2_title')}`);
  meters(st, { air: 100, food: 100, power: 10, shield: 3, science: 40 });
  land.shake(1500, 0.004); sfx.wind(3);
  const fold = await choose({ title: t('c2_q1'), seconds: 10, danger: true, options: [
    { icon: '🛡️', label: t('c2_fold'), hint: t('c2_fold_h'), costs: { power: 4 } },
    { icon: '☀️', label: t('c2_leave'), hint: t('c2_leave_h'), costs: { power: 6, '': '−30% later' } },
  ] });
  let stormPower = fold === 0 ? 4 : fold === 1 ? 6 : 5;
  st.afterPower = fold === 0 ? 10 : 7;
  if (fold === 0) { // hands-on: fold every panel before the wall hits; unfolded ones get dust and scratches
    const r = await foldPanels(9000);
    st.afterPower = 6 + Math.round((r.n / r.of) * 4);
    toast(r.n === r.of ? '🛡️ All panels folded: they will be clean after the storm' : `🌪️ ${r.of - r.n} panels were caught by the dust`, r.n === r.of ? '#8DF5B4' : '#FFC94D');
  }
  land = await director.show('land', { time: 'storm' }); music('tense'); land.shake(2000, 0.005);
  if (fold === 'timeout') await say([L('deniz', 'c2_timeout', { mood: 'scared', act: 'shake' })]);
  await runWake({ power: stormPower, objectiveKey: 'c2_obj_wake', objVars: { n: stormPower }, intro: [L('nova', 'c2_w1')], rules: { ls: 2 }, st: { ...st, tips: false } }).then((a) => { st.air = clamp(st.air + (a.ls * 7 - 14), 0, 100); st.food = clamp(st.food + (a.gh * 6 - 10), 0, 100); st.science += a.lab * 4; meters(st); });
  // hands-on: on storm power the oxygen maker struggles
  { const v = await o2Valve(9000); st.air = clamp(st.air + Math.round(-8 + 14 * v), 0, 100); meters(st); }
  // dark sols
  land = await director.show('land', { time: 'storm' });
  objective(t('c2_obj_dark'));
  const rounds = [
    { tau: '6.0', line: 'c2_r1', opts: [['🔬', 'c2_o_lab', { science: -8, air: +6 }], ['💡', 'c2_o_lights', { food: -6, air: +6 }], ['⚡', 'c2_o_keep', { air: -12, food: -6 }]] },
    { tau: '10.8', line: 'c2_r2', opts: [['🛏️', 'c2_o_huddle', { science: -4, air: +8 }], ['🧑‍🚀', 'c2_o_eva', { dose: '+0.5 mSv', air: -4, power: '+1' }], ['🍫', 'c2_o_snacks', { food: -12 }]] },
    { tau: '6.0', line: 'c2_r3', opts: [['🔋', 'c2_o_battery', { air: +10, '': '🔋 0' }], ['💨', 'c2_o_minimal', { science: -6, food: -8, air: +4 }], ['📡', 'c2_o_msg', { air: -3, science: +2 }]] },
  ];
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    st.air = clamp(st.air - 10, 0, 100); st.food = clamp(st.food - 8, 0, 100); meters(st);
    objective(t('c2_night', { n: 3 + i, tau: r.tau }));
    await say([L(i === 1 ? 'deniz' : 'aylin', r.line, { mood: 'worried', act: 'worry' })]);
    const k = await choose({ title: t('c2_night', { n: 3 + i, tau: r.tau }), question: t('c2_obj_dark'), seconds: i === 1 ? 12 : 0, danger: i === 1,
      options: r.opts.map(([icon, key, costs]) => ({ icon, label: t(key), hint: t(key + '_h', { min: DELAY().toFixed(1) }), costs })) });
    const [, key, costs] = r.opts[k === 'timeout' ? 2 : k];
    for (const [m, v] of Object.entries(costs)) if (typeof v === 'number' && m in st) st[m] = clamp(st[m] + v, 0, m === 'science' ? 999 : 100);
    if (key === 'c2_o_eva') { st.eva = true; st.dose += 0.5; land.act('deniz', 'shake'); await say([L('deniz', 'c2_eva_line', { mood: 'scared' })]); }
    meters(st);
    const f = lost(st); if (f) return failScreen(f);
  }
  // clearing
  land = await director.show('land', { time: 'day' }); music('win'); objective('');
  st.power = st.afterPower; meters(st);
  land.act('aylin', 'hop'); land.act('deniz', 'hop');
  await say([L('aylin', 'c2_clear1', { act: 'hop' }), L('kerem', 'c2_clear2', { mood: 'worried' }), L('kerem', 'c2_clear3')]);
  await why([['why_tau', 'tau', 'Dust in the sky (tau): 0.5 → 10.8']]);
  await card('oppy');
  const stars = 1 + (st.air >= 40 && st.food >= 40 ? 1 : 0) + (st.eva ? 0 : 1);
  finish('ch2', stars, { air: st.air, food: st.food });
  return endScreen('ch2', stars, [['c2_s1', true], ['c2_s2', st.air >= 40 && st.food >= 40], ['c2_s3', !st.eva]], ['tau', 'oppy'], 'c2_real', 'c2_next');
}

// ================================================================ CHAPTER 3 · The Late Warning (Sept 2017)
export async function chapter3() {
  const st = { ...startState(), shield: 1 };
  showTop(false); objective(''); music('night'); letterbox(true);
  await titleCard(t('c3_kicker'), t('c3_title'), t('c3_sub'));
  letterbox(false);
  let land = await director.show('land', { time: 'night' });
  showTop(true, `${t('c3_kicker')} · ${t('c3_title')}`);
  meters(st, { air: 100, food: 100, power: 10, shield: 3, science: 40 });
  await say([L('kerem', 'c3_l1'), L('kerem', 'c3_l2')]);
  await card('rad');
  await say([L('nova', 'c3_l3', { mood: 'worried', act: 'gasp' })]);
  const lockT = await aimDish(14000);
  if (lockT == null) { st.science = Math.max(0, st.science - 4); meters(st); toast('📡 We missed Earth at first; the message comes in late.', '#FF5A5A'); }
  const prep = await delayCountdown({ q: t('c3_prep'), options: [
    { icon: '🛡️', label: t('c3_p_shield'), hint: t('c3_p_shield_h'), costs: { shield: +2, science: -6 } },
    { icon: '📦', label: t('c3_p_shelter'), hint: t('c3_p_shelter_h'), costs: { air: -3 } },
    { icon: '🔬', label: t('c3_p_work'), hint: t('c3_p_work_h'), costs: { science: +6 } },
  ] });
  if (prep.picked === 0) { st.shield = 3; st.science = Math.max(0, st.science - 6); }
  if (prep.picked === 1) { st.air -= 3; st.stocked = true; }
  if (prep.picked === 2) st.science += 6;
  meters(st);
  await say([L('earth', 'c3_msg', { mood: 'happy' }), L('nova', 'c3_late', { vars: { min: prep.min.toFixed(1) } })]);
  await card('delay');
  sfx.alarm(); land.shake(800, 0.008);
  const sh = await choose({ title: t('c3_alarm'), seconds: 10, danger: true, options: [
    { icon: '🏃', label: t('c3_shelter'), hint: t('c3_shelter_h'), costs: { dose: '×0.25', science: -8 } },
    { icon: '🔬', label: t('c3_stay'), hint: t('c3_stay_h'), costs: { dose: '+4 mSv', science: +8 } },
  ] });
  const protect = 1 - st.shield * 0.2;
  if (sh === 0) {
    const run = await shelterRun(9000);
    const outside = run.of - run.n;
    st.dose += 4 * 0.25 * protect + outside * 0.6; st.science = Math.max(0, st.science - 8);
    const s = await director.show('shelter'); s.redAlert(true); meters(st);
    await say([L('kerem', 'c3_in1'), L('aylin', 'c3_in2')]);
    s.redAlert(false);
  } else {
    st.dose += 4 * protect; st.science += 8; meters(st);
    await say([L('kerem', 'c3_out1', { mood: 'scared', act: 'shake' })]);
  }
  land = await director.show('land', { time: 'night' }); land.aurora(true); music('calm');
  await say([L('aylin', 'c3_aurora1', { act: 'hop' }), L('aylin', 'c3_aurora2')]);
  await why([['why_ochmo', 'ochmo', `Your crew tonight: ${st.dose.toFixed(1)} mSv`]]);
  await card('sep2017');
  const stars = 1 + (sh === 0 ? 1 : 0) + (prep.picked === 0 || prep.picked === 1 ? 1 : 0);
  finish('ch3', stars, { dose: (profile().base?.dose || 0) + st.dose });
  return endScreen('ch3', stars, [['c3_s1', true], ['c3_s2', sh === 0], ['c3_s3', prep.picked === 0 || prep.picked === 1]], ['rad', 'delay', 'sep2017'], 'c3_real', 'c3_next');
}

// ================================================================ CHAPTER 4 · The Biggest Storm (May 2024)
export async function chapter4() {
  const st = { ...startState(), shield: 1 };
  showTop(false); objective(''); music('calm'); letterbox(true);
  await titleCard(t('c4_kicker'), t('c4_title'), t('c4_sub'));
  letterbox(false);
  let land = await director.show('land', { time: 'day' });
  showTop(true, `${t('c4_kicker')} · ${t('c4_title')}`);
  meters(st, { air: 100, food: 100, power: 10, shield: 3, science: 40 });
  await say([L('kerem', 'c4_l1', { act: 'hop' })]);
  land.walk('kerem', 2200, 2600);
  await say([L('aylin', 'c4_l2', { mood: 'worried', act: 'worry' })]);
  land.hide('kerem');
  await say([L('kerem', 'c4_l3')]);
  const msg = await delayCountdown();
  music('tense'); sfx.alarm();
  await say([L('earth', 'c4_msg')]);
  const k = await choose({ title: t('c4_q'), seconds: 10, danger: true, options: [
    { icon: '🏃', label: t('c4_back'), hint: t('c4_back_h'), costs: { science: -10 } },
    { icon: '🪨', label: t('c4_finish'), hint: t('c4_finish_h'), costs: { dose: '+3 mSv', science: +20 } },
    { icon: '🚙', label: t('c4_rover'), hint: t('c4_rover_h'), costs: { power: -4, air: -6, science: +12 } },
  ] });
  const pick = k === 'timeout' ? 1 : k;
  if (k === 'timeout') await say([L('nova', 'c4_timeout', { mood: 'scared' })]);
  land.hide('kerem', false); land.crew.kerem.homeX = 2200; land.walk('kerem', 1430, 1400);
  if (pick === 0) { st.science = Math.max(0, st.science - 10); await say([L('kerem', 'c4_r_back', { mood: 'worried', act: 'worry' })]); }
  if (pick === 1) { st.dose += 3; st.science += 20; await say([L('kerem', 'c4_r_finish', { mood: 'scared', act: 'shake' })]); }
  if (pick === 2) {
    st.air -= 6; st.science += 12;
    const r = await director.play('rover'); st.dose += r.hits * 0.4; meters(st);
    land = await director.show('land', { time: 'day' });
    await say([L('deniz', 'c4_r_rover', { act: 'hop' })]);
  }
  meters(st);
  const run = await shelterRun(8000); st.dose += (run.of - run.n) * 0.8; meters(st);
  const s = await director.show('shelter', { crew: { deniz: [820, 1060], aylin: [1040, 1060], kerem: [1250, 1064], cmd: [1460, 1066], nova: [1660, 1056] } });
  s.redAlert(true);
  await say([L('nova', 'c4_in1', { mood: 'worried' }), L('kerem', 'c4_in2', { mood: 'worried' }), L('aylin', 'c4_in3')]);
  s.redAlert(false);
  await card('may2024');
  land = await director.show('land', { time: 'night' }); land.aurora(true); music('win');
  // compare the crew's dose with real numbers (Curiosity, ISS / RadLab, NASA career limit)
  await why([['c4_cmp_v', 'you', `Your crew in this storm: ${st.dose.toFixed(1)} mSv`], ['c4_cmp1', 'rad', '6.4 mSv / 10 sols'], ['c4_cmp2', 'iss', '80–160 mSv / 6 months'], ['c4_cmp3', 'ochmo', 'Career limit: 600 mSv']]);
  { const c = donkiCard(`<b>🛰️ NASA RadLab</b><small><a href="${SRC.radlab.u}" target="_blank" rel="noopener noreferrer">See real Space Station dosimeter readings ↗</a></small>`); await wait(2600); c.remove(); }
  await say([L('kerem', 'c4_end1')]);
  const stars = 1 + (pick !== 1 ? 1 : 0) + (pick !== 0 ? 1 : 0);
  finish('ch4', stars, { dose: (profile().base?.dose || 0) + st.dose });
  return endScreen('ch4', stars, [['c4_s1', true], ['c4_s2', pick !== 1], ['c4_s3', pick !== 0]], ['may2024'], 'c4_real', 'c4_next');
}

// ================================================================ CHAPTER 5 · Today's Real Sun (live DONKI)
export async function chapter5() {
  const sun = await loadDonki30();
  const ev = sun.ev, date = sun.date;
  const st = { ...startState(), shield: 0, safe: true };
  showTop(false); objective(''); music('calm'); letterbox(true);
  await titleCard(t('c5_kicker'), t('c5_title'), t('c5_sub', { date }));
  letterbox(false);
  let land = await director.show('land', { time: 'day' });
  showTop(true, `${t('c5_kicker')} · ${t('c5_title')}`);
  meters(st, { air: 100, food: 100, power: 10, shield: 3, science: 40 });
  await say([L('nova', 'c5_l1')]);
  // hands-on: point the dish at Earth to download the space-weather data
  const lockT = await aimDish(14000);
  if (lockT == null) toast('📡 It took a few tries, but the DONKI data came through.', '#FFC94D');
  const counts = donkiCard(`<b>🛰️ NASA DONKI · last 30 days</b><div class="dk"><span>☀️ ${ev.FLR.length}<small>flares</small></span><span>💨 ${ev.CME.length}<small>CMEs</small></span><span>☢️ ${ev.SEP.length}<small>particle storms</small></span><span>🧲 ${ev.GST.length}<small>geomagnetic storms</small></span></div><small>${sun.mode === 'live' ? `Fetched from NASA DONKI just now (${esc(date)})` : `Daily snapshot from ${esc(date)} · updated once a day (not live)`}</small><small>DONKI watches the Sun from near Earth. Mars can face a different side, so this is practice, not a Mars forecast.</small>`);
  await say([L('nova', 'c5_l2v'), ...(sun.mode === 'live' ? [L('nova', 'c5_src_live')] : [])]); counts.remove();
  await card('donki');
  // pick up to 3 real events: particle storms first, then big flares, then CMEs, then GSTs
  const big = (f) => /^[XM]/.test(f.classType || '');
  const list = [...ev.SEP.map((e) => ({ ...e, type: 'SEP' })), ...ev.FLR.filter(big).map((e) => ({ ...e, type: 'FLR' })), ...ev.CME.map((e) => ({ ...e, type: 'CME' })), ...ev.GST.map((e) => ({ ...e, type: 'GST' }))].slice(0, 3);
  if (!list.length) await say([L('aylin', 'c5_calm')]);
  for (const e of list) {
    const d = (e.startTime || e.peakTime || e.eventTime || '').slice(0, 10);
    const extra = t('c5_x_' + e.type);
    const rec = donkiCard(`<b>🛰️ Real DONKI record</b><div class="dkr">${esc(t('c5_t_' + e.type, { cls: e.classType || '' }))}</div><small>${esc(d)}${e.link ? ` · <a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">open the record ↗</a>` : ''}</small>`);
    await say([L('nova', 'c5_ev_intro'), L('nova', 'c5_x_' + e.type)]); rec.remove();
    if (e.link) toast(`🛰️ <a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer" style="color:#9FD0FF">${t('donki_link')} · ${esc(e.id || '')}</a>`, '#5FE0FF');
    if (e.type === 'SEP') {
      const c = await choose({ title: t('c3_alarm'), seconds: 10, danger: true, options: [
        { icon: '🏃', label: t('c3_shelter'), hint: t('c3_shelter_h'), costs: { dose: '×0.25', science: -8 } },
        { icon: '🔬', label: t('c3_stay'), hint: t('c3_stay_h'), costs: { dose: '+2 mSv', science: +8 } },
      ] });
      if (c === 0) { const run = await shelterRun(8000); st.dose += 0.5 + (run.of - run.n) * 0.4; st.science = Math.max(0, st.science - 8); } else { st.dose += 2; st.science += 8; st.safe = false; }
      meters(st);
    }
    if (e.type === 'CME') { land.aurora(true); await wait(1500); land.aurora(false); }
  }
  // the crew's job for today (from Mission Mode): the real Sun of this month decides how risky an EVA is
  await say([L('nova', 'c5_job_v')]);
  const stormy = ev.SEP.length > 0 || ev.FLR.some((f) => /^X/.test(f.classType || ''));
  const job = await choose({ title: 'Crew job for today', question: stormy ? 'NASA logged a strong solar event this month. Is it safe to go outside?' : 'The Sun has been fairly calm this month. What should the crew do?', options: [
    { icon: '🧑‍🚀', label: 'EVA: collect rocks', hint: 'Big science. But outside there are no walls if a solar storm hits.', costs: { science: +10, dose: stormy ? '+1 mSv' : '+0.3 mSv' } },
    { icon: '🏋️', label: 'Exercise', hint: 'Low gravity weakens bones. Training protects them, but you breathe more.', costs: { air: -4 } },
    { icon: '🌱', label: 'Plant experiment', hint: 'Look after the plants: science, and practice growing food.', costs: { science: +4 } },
    { icon: '🔧', label: 'Check the machines', hint: 'Keeps the oxygen maker safe.', costs: { air: +4 } },
  ] });
  if (job === 0) { st.science += 10; st.dose += stormy ? 1 : 0.3; if (stormy) st.safe = false; meters(st); await why([['job_eva', 'rad', stormy ? 'A stormy month: +1 mSv outside' : 'A calm month: +0.3 mSv outside']]); }
  if (job === 1) { st.air = clamp(st.air - 4, 0, 100); meters(st); await why([['job_gym', 'bone', 'Bones: −1 to −1.5% per month without exercise']]); }
  if (job === 2) {
    const g = await director.show('green');
    const care = await plantCare(9000); st.science += Math.round(4 * care); meters(st);
    await why([['job_plants', 'radish', `Problems fixed: ${Math.round(care * 100)}%`]]);
    toast(`📚 <a href="${SRC.csa.u}" target="_blank" rel="noopener noreferrer" style="color:#9FD0FF">Try it in class: ${esc(SRC.csa.t)} ↗</a>`, '#5FE0FF');
    land = await director.show('land', { time: 'day' });
  }
  if (job === 3) { st.air = clamp(st.air + 4, 0, 100); meters(st); await why([['job_fix', null]]); }
  const a = await runWake({ power: 10, objectiveKey: 'c5_wake', intro: [L('nova', 'c5_wake')], st: { ...st, tips: false } });
  land = await director.show('land', { time: 'dusk' }); music('win');
  await say([L('nova', 'c5_end')]);
  const full = a.lab >= 3 && a.ls >= 2 && a.gh >= 2;
  const stars = 1 + (st.safe ? 1 : 0) + (full ? 1 : 0);
  finish('ch5', stars, {});
  return endScreen('ch5', stars, [['c5_s1', true], ['c5_s2', st.safe], ['c5_s3', full]], ['donki'], 'c5_real', 'c5_next', { date });
}

// ================================================================ END SCREEN
export async function endScreen(id, stars, lines, cardIds, realKey, nextKey, vars = {}) {
  const C = await cards();
  showTop(false); objective('');
  return new Promise((resolve) => {
    const o = overlay(`<div class="card glass" style="text-align:center;width:min(720px,94vw)">
      <div class="h" style="letter-spacing:6px;color:var(--accent);font-weight:900">${t('end_title')}</div>
      <div id="eStars" style="font-size:64px;margin:6px 0;letter-spacing:8px">☆☆☆</div>
      <div style="text-align:left;margin:0 auto;max-width:480px">${lines.map(([k, ok]) => `<div style="font-weight:800;font-size:17px;margin:6px 0;color:${ok ? '#8DF5B4' : '#7C88A6'}">${ok ? '★' : '☆'} ${esc(t(k))}</div>`).join('')}</div>
      <h3 style="margin:16px 0 6px">${t('end_cards')}: ${cardIds.length}</h3>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${cardIds.map((c) => { const cc = C.cards.find((x) => x.id === c); return `<span class="cost p" style="font-size:15px">${cc.icon} ${esc(tt(cc.title))}</span>`; }).join('')}</div>
      <div style="text-align:left;background:#10203E;border:1px solid var(--line);border-radius:16px;padding:14px;margin-top:16px"><b>${t('end_real')}</b><p style="margin:6px 0 0;font-size:16px">${esc(t(realKey, vars))}</p></div>
      <p style="color:var(--accent2);font-weight:800">${esc(t(nextKey))}</p>
      <div class="row" style="justify-content:center"><button class="btn" id="eRe">${t('replay')}</button><button class="btn primary" id="eMap">${t('to_map')}</button></div></div>`);
    const s = o.querySelector('#eStars');
    for (let i = 0; i < 3; i++) setTimeout(() => { if (i < stars) { sfx.star(i); s.textContent = '★'.repeat(i + 1) + '☆'.repeat(2 - i); s.style.color = '#FFC94D'; } }, 600 + i * 500);
    o.querySelector('#eRe').onclick = () => { o.remove(); resolve('replay'); };
    o.querySelector('#eMap').onclick = () => { o.remove(); resolve('map'); };
  });
}
