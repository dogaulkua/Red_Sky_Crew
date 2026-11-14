// DOM user interface: top meters, dialogue, choices, NASA cards, overlays
import { retranslate, t, tt, lang, setLang, onLang, profile, save, sfx, voice, hasVoice, stopSpeak, suitImage, applyVolumes, wait, blip } from './core.js?v=2026-11-15d';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ROOT;
export const PEOPLE = {
  aylin: { name: 'Aylin', role: { en: 'Biologist' }, color: '#5ED68A' },
  deniz: { name: 'Deniz', role: { en: 'Engineer' }, color: '#FFA45C' },
  kerem: { name: 'Kerem', role: { en: 'Doctor' }, color: '#7FB2FF' },
  nova: { name: 'NOVA', role: { en: 'Base AI' }, color: '#5FE0E0' },
  cmd: { name: null, role: { en: 'Commander' }, color: '#FFD27A' },
  earth: { name: { en: 'Mission Control' }, role: { en: 'Earth' }, color: '#B8C7E6' },
};
export async function portrait(who, mood = 'happy') {
  if (who === 'nova') return 'assets/crew/nova.png';
  if (who === 'earth') return 'assets/scene/earth.png';
  if (who === 'cmd') { const p = profile(); return suitImage(`assets/portraits/${p.avatar}_${mood}.png`, p.suit); }
  return `assets/crew/${who}_${mood}.png`;
}

// ---------------------------------------------------------------- mount
export function mount() {
  ROOT = $('#ui');
  ROOT.innerHTML = `
  <div id="top" class="hide">
    <div id="chapterTag" class="glass"></div>
    <div class="meters">
      ${['air', 'food', 'power', 'shield', 'science'].map((k) => `<div class="meter glass" id="m_${k}" title=""><i>${{ air: '💨', food: '🥬', power: '⚡', shield: '🛡️', science: '🔬' }[k]}</i><div><small data-k="m_${k}"></small><span class="v">0</span><div class="bar"><b style="background:var(--${k === 'science' ? 'sci' : k})"></b></div></div></div>`).join('')}
    </div>
    <div class="spacer"></div>
    <button class="iconbtn glass" id="bSet" aria-label="Settings">⚙️</button>
  </div>
  <div id="objective" class="glass hide"><span class="dot"></span><span id="objText"></span></div>
  <div id="say" class="hide"><div class="box glass"><div class="por"><img id="sayImg" alt=""></div><div class="name" id="sayName"></div><div class="txt" id="sayTxt"></div>
    <div class="tools"><button id="sayVoice" aria-label="Read aloud">🔊</button></div><div class="nx"><span data-k="tap_continue"></span><b>▶</b></div></div></div>
  <div id="toasts"></div>
  <div id="layer"></div>
  <div id="rotate"><div>📱↻<p data-k="rotate"></p></div></div>`;
  $('#bSet').onclick = () => { sfx.click(); settings(); };
  onLang(refreshStatic); refreshStatic();
  onLang(relabel);
  for (const k of ['air', 'food', 'power', 'shield', 'science']) $('#m_' + k).onclick = () => glossary('m_' + k + '_g');
  const rot = () => $('#rotate').classList.toggle('need', innerHeight > innerWidth && innerWidth < 600 && !document.getElementById('title'));
  addEventListener('resize', rot); rot();
}
// language switched mid-game: redraw the current line and translate every visible text in the HUD/overlays
let CUR = null;
function relabel(to, from) {
  if (CUR && !$('#say').classList.contains('hide')) {
    const l = CUR, text = l.key ? t(l.key, l.vars) : tt(l.text, l.vars), P = PEOPLE[l.who || 'nova'];
    if (typing && skipType) skipType();
    $('#sayTxt').innerHTML = markup(text); bindWords($('#sayTxt'));
    const nm = (l.who === 'cmd') ? `${t('commander')} ${profile().name}` : tt(P.name);
    $('#sayName').innerHTML = `${esc(nm)} <small>${esc(tt(P.role))}</small>`;
    if (l.key && hasVoice(l.key)) voice(l.key, l.vars || {});
  }
  const walk = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('#say,[data-k],script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      const m = n.nodeValue.match(/^([^\p{L}\p{N}]*)([\s\S]*?)([\s:]*)$/u); if (!m || !m[2]) continue;
      const r = retranslate(m[2], from, to); if (r !== m[2]) n.nodeValue = m[1] + r + m[3];
    }
    root.querySelectorAll('[placeholder]').forEach((e) => (e.placeholder = retranslate(e.placeholder, from, to)));
  };
  walk($('#ui'));
}
function refreshStatic() { document.querySelectorAll('[data-k]').forEach((n) => (n.textContent = t(n.dataset.k))); }
export function applyFontScale() { document.documentElement.style.setProperty('--fs', profile().settings.fontScale); }

// ---------------------------------------------------------------- meters
let M = { air: 0, food: 0, power: 0, shield: 0, science: 0 }, MAX = { air: 100, food: 100, power: 10, shield: 3, science: 100 };
export function showTop(on, chapterLabel) { $('#top').classList.toggle('hide', !on); if (chapterLabel != null) $('#chapterTag').textContent = chapterLabel; }
export function meters(next, max) {
  if (max) Object.assign(MAX, max);
  for (const [k, v] of Object.entries(next)) {
    const m = $('#m_' + k); if (!m) continue;
    const old = M[k]; M[k] = v;
    m.querySelector('.v').textContent = k === 'power' ? `${v}/${MAX.power}` : k === 'shield' ? `${v}/${MAX.shield}` : k === 'science' ? `${Math.round(v)}/${MAX.science}` : Math.round(v);
    m.querySelector('.bar b').style.width = `${Math.max(0, Math.min(100, (100 * v) / MAX[k]))}%`;
    m.classList.toggle('low', (k === 'air' || k === 'food') && v < 30);
    const d = Math.round(v - old);
    if (d && old !== undefined) { const f = el('span', 'float', (d > 0 ? '+' : '') + d); f.style.color = d > 0 ? '#8DF5B4' : '#FF9A9A'; m.appendChild(f); setTimeout(() => f.remove(), 1500); }
  }
}
export const meterValues = () => ({ ...M });

// ---------------------------------------------------------------- objective & toast
export function objective(text) { $('#objective').classList.toggle('hide', !text); $('#objText').textContent = text || ''; }
export function toast(html, color) { const n = el('div', 'toast glass', html); if (color) n.style.borderColor = color; $('#toasts').appendChild(n); setTimeout(() => n.remove(), 3800); }

// ---------------------------------------------------------------- dialogue
// lines: [{who, key|text, mood, vars}]
let typing = null, skipType = null;
export async function say(lines) {
  const box = $('#say'); box.classList.remove('hide');
  for (const l of lines) await sayLine(l);
  box.classList.add('hide'); stopSpeak();
}
function markup(s) {
  return esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, word, key) => `<span class="w" data-g="${esc(key || word.toLowerCase())}">${word}</span>`);
}
async function sayLine(l) {
  CUR = l;
  const who = l.who || 'nova', P = PEOPLE[who];
  window.dispatchEvent(new CustomEvent('speak', { detail: { who, mood: l.mood || 'happy', act: l.act } }));
  const text = l.key ? t(l.key, l.vars) : tt(l.text, l.vars);
  const img = $('#sayImg'); img.src = await portrait(who, l.mood || 'happy');
  img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
  const nm = who === 'cmd' ? `${t('commander')} ${profile().name}` : tt(P.name);
  $('#sayName').innerHTML = `${esc(nm)} <small>${esc(tt(P.role))}</small>`; $('#sayName').style.background = P.color;
  const tx = $('#sayTxt'); const html = markup(text); const plain = text.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1');
  const voiced = l.key && hasVoice(l.key) && profile().settings.voice;
  const spoken = voiced ? voice(l.key, l.vars || {}) : Promise.resolve(false);
  $('#sayVoice').classList.toggle('hide', !(l.key && hasVoice(l.key)));
  $('#sayVoice').onclick = (e) => { e.stopPropagation(); voice(l.key, l.vars || {}); };
  // typewriter over plain text, then swap in the marked-up html
  await new Promise((res) => {
    let i = 0; tx.textContent = '';
    const done = () => { clearInterval(typing); typing = null; tx.innerHTML = html; bindWords(tx); res(); };
    skipType = done;
    const t0 = performance.now();
    typing = setInterval(() => { const n = Math.min(plain.length, Math.floor((performance.now() - t0) / 24)); if (n > i) { i = n; tx.textContent = plain.slice(0, i); if (!voiced && i % 2 === 0 && plain[i - 1] !== ' ') blip(who, l.mood || 'happy', plain[i - 1]); } if (i >= plain.length) done(); }, 30);
  });
  await new Promise((res) => {
    const box = $('#say');
    const go = (e) => { if (e && e.target.closest('.w,.tools')) return; cleanup(); sfx.next(); res(); };
    const key = (e) => { if (e.key === ' ' || e.key === 'Enter') go(); };
    const cleanup = () => { box.removeEventListener('click', go); removeEventListener('keydown', key); };
    setTimeout(() => { box.addEventListener('click', go); addEventListener('keydown', key); }, 150);
    if (l.auto) Promise.all([wait(voiced ? 400 : l.auto), spoken]).then(() => { cleanup(); res(); });
  });
}
// tapping during typing finishes the line
document.addEventListener('click', (e) => { if (typing && e.target.closest('#say') && !e.target.closest('.tools')) skipType && skipType(); }, true);
function bindWords(root) { root.querySelectorAll('.w').forEach((w) => (w.onclick = (e) => { e.stopPropagation(); sfx.click(); glossary('g_' + w.dataset.g); })); }

// ---------------------------------------------------------------- overlay helpers
function overlay(html, cls = '') { const o = el('div', 'ov ' + cls, html); $('#layer').appendChild(o); return o; }
export function glossary(key) {
  const o = overlay(`<div class="card glass"><h2>📖 ${esc(t(key + '_t') !== key + '_t' ? t(key + '_t') : t('glossary'))}</h2><p>${esc(t(key))}</p><div class="row"><button class="btn" id="gSpeak">🔊</button><button class="btn primary" id="gClose">${t('close')}</button></div></div>`);
  o.querySelector('#gClose').onclick = () => { sfx.click(); o.remove(); };
  o.querySelector('#gSpeak').onclick = () => voice(key);
  if (hasVoice(key)) voice(key);
  const close0 = o.querySelector('#gClose').onclick; o.querySelector('#gClose').onclick = () => { stopSpeak(); close0(); };
  o.onclick = (e) => { if (e.target === o) o.remove(); };
}
const COST_ICON = { air: '💨', food: '🥬', power: '⚡', shield: '🛡️', science: '🔬', dose: '☢️', time: '⏱️' };
export function costChips(costs = {}) {
  return Object.entries(costs).map(([k, v]) => {
    const good = k === 'dose' ? v < 0 : v > 0;
    const txt = typeof v === 'string' ? v : (v > 0 ? '+' : '') + v;
    return `<span class="cost ${good ? 'p' : 'n'}">${COST_ICON[k] || ''} ${esc(txt)}</span>`;
  }).join('');
}
// choice cards; returns index or 'timeout'
export function choose({ title, question, options, seconds, danger }) {
  return new Promise((res) => {
    const o = el('div', '', `<div class="wrap">${seconds ? `<div class="timer"><div class="n" id="cN">${seconds}</div><div class="t"><b id="cB"></b></div></div>` : ''}
      <h2 class="h">${esc(title)}</h2>${question ? `<p class="q">${esc(question)}</p>` : ''}
      <div class="cards">${options.map((op, i) => `<button class="ccard" data-i="${i}"><div class="ic">${op.icon || '•'}</div><b>${esc(op.label)}</b><span>${esc(op.hint || '')}</span><div class="costs">${costChips(op.costs)}</div></button>`).join('')}</div></div>`);
    o.id = 'choice'; $('#layer').appendChild(o);
    if (danger) o.style.background = 'radial-gradient(ellipse at center,rgba(60,5,10,.35),rgba(30,3,8,.85))';
    let timer = null, left = seconds;
    const finish = (v) => { clearInterval(timer); o.remove(); res(v); };
    o.querySelectorAll('.ccard').forEach((b) => { b.onmouseenter = () => sfx.hover(); b.onclick = () => { sfx.click(); finish(+b.dataset.i); }; });
    if (seconds) {
      const start = performance.now();
      timer = setInterval(() => {
        left = seconds - (performance.now() - start) / 1000;
        const n = o.querySelector('#cN'); if (n) n.textContent = Math.max(0, Math.ceil(left));
        o.querySelector('#cB').style.width = `${Math.max(0, (100 * left) / seconds)}%`;
        if (Math.ceil(left) !== Math.ceil(left + 0.1)) sfx.tick();
        if (left <= 0) finish('timeout');
      }, 100);
    }
  });
}
// NASA card unlock
export function nasaCard(card, number, total) {
  const p = profile(); if (!p.cards.includes(card.id)) save({ cards: [...p.cards, card.id] });
  sfx.card();
  return new Promise((res) => {
    const o = overlay(`<div style="text-align:center"><div class="h" style="letter-spacing:4px;color:var(--accent2);font-weight:900;margin-bottom:12px">✨ ${t('new_card')}</div>
      <div class="ncard"><div class="in"><div class="face"><div class="num">${number}/${total}</div><div class="lbl">${t('nasa_card')}</div>
      <div class="art">${card.icon}</div><h3>${esc(tt(card.title))}</h3><div class="fact">${esc(tt(card.fact))}</div>
      <div class="src">${t('source')}: <a href="${esc(card.url)}" target="_blank" rel="noopener noreferrer">${esc(card.source)}</a></div></div></div></div>
      <div class="row" style="justify-content:center"><button class="btn primary" id="ncOk">${t('collect')}</button></div></div>`);
    setTimeout(() => voice('card_' + card.id), 900);
    o.querySelector('#ncOk').onclick = () => { stopSpeak(); sfx.success(); o.remove(); res(); };
  });
}
export function titleCard(kicker, title, sub, ms = 4200) {
  return new Promise((res) => {
    const o = el('div', '', `<div class="k">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(sub || '')}</p>`); o.id = 'titlecard';
    $('#layer').appendChild(o); sfx.whoosh();
    const end = () => { o.style.transition = 'opacity .8s'; o.style.opacity = 0; setTimeout(() => { o.remove(); res(); }, 800); };
    const tm = setTimeout(end, ms); o.onclick = () => { clearTimeout(tm); end(); };
  });
}
export function letterbox(on) { $('#ui').classList.toggle('bars', on); }
export function info({ title, body, button }) {
  return new Promise((res) => {
    const o = overlay(`<div class="card glass"><h2>${esc(title)}</h2><div style="font-size:18px;line-height:1.5">${body}</div><div class="row"><button class="btn primary" id="iOk">${esc(button || t('continue'))}</button></div></div>`);
    o.querySelector('#iOk').onclick = () => { sfx.click(); o.remove(); res(); };
  });
}
export function settings() {
  const s = profile().settings;
  const o = overlay(`<div class="card glass settings"><h2>⚙️ ${t('settings')}</h2>
    <label>🎵 ${t('set_music')}<input type="range" min="0" max="1" step="0.05" value="${s.music}" id="sMusic"></label>
    <label>🔔 ${t('set_sfx')}<input type="range" min="0" max="1" step="0.05" value="${s.sfx}" id="sSfx"></label>
    <label>💬 ${t('set_blips')}<input type="checkbox" ${s.blips ? 'checked' : ''} id="sBlips"></label>
    <label>🗣️ ${t('set_voice')}<input type="checkbox" ${s.voice ? 'checked' : ''} id="sVoice"></label>
    <label>⏩ ${t('set_rate')}<input type="range" min="0.7" max="1.4" step="0.05" value="${s.rate}" id="sRate"></label>
    <label>🔠 ${t('set_font')}<input type="range" min="0.9" max="1.35" step="0.05" value="${s.fontScale}" id="sFont"></label>
    <label>📳 ${t('set_shake')}<input type="checkbox" ${s.shake ? 'checked' : ''} id="sShake"></label>
    <div class="row"><button class="btn primary" id="sOk">${t('close')}</button></div></div>`);
  const upd = () => { save({ settings: { ...s, music: +o.querySelector('#sMusic').value, sfx: +o.querySelector('#sSfx').value, voice: o.querySelector('#sVoice').checked, blips: o.querySelector('#sBlips').checked, rate: +o.querySelector('#sRate').value, fontScale: +o.querySelector('#sFont').value, shake: o.querySelector('#sShake').checked } }); Object.assign(s, profile().settings); applyVolumes(); applyFontScale(); };
  o.querySelectorAll('input').forEach((i) => (i.oninput = upd));
  o.querySelector('#sOk').onclick = () => { sfx.click(); o.remove(); };
}
export function hint(x, y, text) { const h = el('div', 'hint glass', esc(text)); h.style.left = x + 'px'; h.style.top = y + 'px'; $('#layer').appendChild(h); return h; }
export { overlay, el, esc, $ };
