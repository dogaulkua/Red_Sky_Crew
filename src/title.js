// Title: key art splash (language chips always visible) → astronaut creator → mission select with art cards
const BUILD = '2026-11-15d'; // bump with tools/bump.py so browsers load fresh files
import { t, tt, lang, setLang, profile, save, sfx, music, unlockAudio, SUITS, suitImage, hasProfile, pilots, switchPilot, newPilot, deletePilot } from './core.js?v=2026-11-15d';
import { el, esc, $, settings } from './ui.js?v=2026-11-15d';

export const AVATARS = ['c02', 'c03', 'c04', 'c05', 'c06', 'c08', 'c09', 'c10', 'c12'];
const THUMB = { ch1: 'landing', ch2: 'storm', ch3: 'shelter', ch4: 'descent', ch5: 'cutaway' };

function root() {
  let r = document.getElementById('title');
  if (!r) {
    r = el('div', '', `<div class="art"></div><div class="shade"></div><div class="stage"></div><div class="credit">NASA Space Apps 2026 · Data: NASA DONKI · Curiosity RAD · OSDR · JPL · build ${BUILD}</div>`);
    r.id = 'title'; document.body.appendChild(r);
  }
  return r;
}
export function closeTitle() { const r = document.getElementById('title'); if (r) { r.style.transition = 'opacity .6s'; r.style.opacity = 0; setTimeout(() => r.remove(), 600); } }

export function runTitle(chapters, opts = {}) {
  return new Promise((resolve) => {
    const r = root(), stage = r.querySelector('.stage');
    let current = null;
    const audio = () => { unlockAudio(); music('title'); };
    // where this pilot left off: the chapter they last started (if not finished), else the first unfinished one
    const resumeOf = (p) => { const done = p.done || []; const last = chapters.find((c) => c.id === p.last && !done.includes(c.id)); return last || chapters.find((c) => !done.includes(c.id)) || null; };

    function splash() {
      current = splash; r.classList.remove('dim');
      stage.innerHTML = `<div class="splash"><div class="subtitle h">${t('subtitle')}</div><button class="tapstart h" id="tStart">${t('tap_start')}</button></div>`;
      const go = () => { audio(); sfx.whoosh(); pilots().length ? who() : create(); };
      $('#tStart').onclick = (e) => { e.stopPropagation(); go(); };
      r.onclick = (e) => { if (e.target.closest('.langchips')) return; r.onclick = null; go(); };
    }
    async function who() {
      current = who; r.onclick = null; r.classList.add('dim');
      const list = pilots();
      const cards = await Promise.all(list.map(async (p) => {
        const img = await suitImage(`assets/portraits/${p.avatar}_happy.png`, p.suit);
        const stars = Object.values(p.stars || {}).reduce((a, b) => a + b, 0);
        const nx = resumeOf(p);
        return `<div class="pcard glass" data-id="${p.id}"><button class="pdel" data-del="${p.id}" aria-label="${esc(t('pilot_delete'))}">✕</button>
          <img src="${img}" alt=""><b class="h">${esc(p.name)}</b>
          <small>${nx ? `▶ ${esc(t('resume_ch', { n: nx.num }))}` : '🏆 ' + esc(t('all_done'))}</small>
          <small>⭐ ${stars}/15 · 🃏 ${(p.cards || []).length}</small></div>`;
      }));
      stage.innerHTML = `<div class="who"><h2 class="h mtitle">${t('who_plays')}</h2><div class="small" style="text-align:center">${t('who_sub')}</div>
        <div class="pgrid">${cards.join('')}<button class="pcard glass pnew" id="pNew"><div class="plus">＋</div><b class="h">${t('pilot_new')}</b><small>${t('pilot_new_sub')}</small></button></div></div>`;
      stage.querySelectorAll('.pcard[data-id]').forEach((c) => (c.onclick = (e) => {
        if (e.target.closest('.pdel')) return;
        sfx.success(); switchPilot(c.dataset.id); missions();
      }));
      stage.querySelectorAll('.pdel').forEach((b) => (b.onclick = (e) => {
        e.stopPropagation(); sfx.click();
        if (b.dataset.sure) { deletePilot(b.dataset.del); who(); return; }
        b.dataset.sure = 1; b.textContent = t('pilot_sure'); b.classList.add('sure');
      }));
      $('#pNew').onclick = () => { sfx.click(); newPilot(); create(); };
    }
    function create() {
      current = create; r.onclick = null; r.classList.add('dim');
      const p = profile(); let pick = AVATARS.includes(p.avatar) ? p.avatar : 'c09', suit = p.suit || 0;
      stage.innerHTML = `<div class="lobby"><div class="hero"><img id="cPrev" alt=""></div>
        <div class="side glass"><h2 class="h">🪪 ${t('create_id')}</h2>
          <div class="lab">${t('call_sign')}</div><input id="cName" maxlength="14" autocomplete="off" placeholder="${esc(t('call_sign_ph'))}" value="${esc(p.name)}">
          <div class="small">${t('privacy')}</div>
          <div class="lab">${t('face')}</div><div class="avgrid">${AVATARS.map((a) => `<button class="av${a === pick ? ' on' : ''}" data-a="${a}" aria-label="${a}"><img src="assets/portraits/${a}_happy.png" alt=""></button>`).join('')}</div>
          <div class="lab">${t('suit_color')}</div><div class="swatches">${SUITS.map((s, i) => `<button class="sw${i === suit ? ' on' : ''}" data-s="${i}" style="background:${s.css}" aria-label="${s.id}"></button>`).join('')}</div>
          <div class="small" id="cErr" style="color:#FF9A9A;font-weight:800;min-height:20px"></div>
          <button class="btn primary big" id="cGo">${t('create_go')}</button>
          ${hasProfile() || pilots().length ? `<button class="btn ghost" id="cBack">${t('back')}</button>` : ''}</div></div>`;
      const prev = async () => { const im = $('#cPrev'); im.src = await suitImage(`assets/chars/${pick}.png`, suit); im.style.animation = 'none'; void im.offsetWidth; im.style.animation = ''; };
      prev();
      stage.querySelectorAll('.av').forEach((b) => (b.onclick = () => { sfx.click(); stage.querySelectorAll('.av').forEach((x) => x.classList.remove('on')); b.classList.add('on'); pick = b.dataset.a; prev(); }));
      stage.querySelectorAll('.sw').forEach((b) => (b.onclick = () => { sfx.click(); stage.querySelectorAll('.sw').forEach((x) => x.classList.remove('on')); b.classList.add('on'); suit = +b.dataset.s; prev(); }));
      const go = () => {
        const n = $('#cName').value.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 14);
        if (n.length < 2) { sfx.error(); $('#cErr').textContent = t('need_name'); return; }
        sfx.success(); save({ name: n, avatar: pick, suit }); missions();
      };
      $('#cGo').onclick = go; $('#cName').onkeydown = (e) => { if (e.key === 'Enter') go(); };
      $('#cBack') && ($('#cBack').onclick = () => { sfx.click(); hasProfile() ? missions() : who(); });
    }
    async function missions() {
      current = missions; r.onclick = null; r.classList.add('dim');
      const p = profile(); const img = await suitImage(`assets/portraits/${p.avatar}_happy.png`, p.suit);
      const starN = Object.values(p.stars).reduce((a, b) => a + b, 0);
      const next = resumeOf(p);
      stage.innerHTML = `<div class="missions">
        <div class="topbar"><div class="idchip glass"><img src="${img}" alt=""><div><b>${esc(p.name)}</b><small>⭐ ${t('commander')} · ${starN}/15 ★ · 🃏 ${p.cards.length}</small></div><button class="btn" id="mEdit" title="${esc(t('edit'))}">✏️</button><button class="btn" id="mWho" title="${esc(t('pilot_switch'))}">👥</button></div>
          <div class="spacer"></div><a class="btn glass" href="nasa.html">🛰️ ${t('nasa_data')}</a><button class="btn glass" id="mSet">⚙️</button></div>
        <h2 class="h mtitle">${t('pick_chapter')}</h2>${next ? `<button class="btn primary big resumebtn" id="mGo">▶ ${esc(t('resume_ch', { n: next.num }))} · ${esc(tt(next.title))}</button>` : ''}<div class="small" style="text-align:center;margin-top:-6px">${t('all_open')}</div>
        <div class="mgrid">${chapters.map((c) => {
          const s = p.stars[c.id] || 0;
          return `<button class="mcard" data-c="${c.id}"><div class="thumb" style="background-image:url(assets/bg/${THUMB[c.id]}.jpg)"></div><div class="num h">${c.num}</div>
            ${next && next.id === c.id ? `<div class="rec">${p.last === c.id && !p.done.includes(c.id) ? t('resume') : t('recommended')}</div>` : ''}${p.done.includes(c.id) ? '<div class="done">✓</div>' : ''}
            <div class="info"><b class="h">${esc(tt(c.title))}</b><small>${esc(tt(c.tagline))}</small><div class="stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</div></div></button>`;
        }).join('')}</div></div>`;
      stage.querySelectorAll('.mcard').forEach((b) => { b.onmouseenter = () => sfx.hover(); b.onclick = () => { sfx.click(); closeTitle(); resolve(b.dataset.c); }; });
      $('#mEdit').onclick = () => { sfx.click(); create(); };
      $('#mGo') && ($('#mGo').onclick = () => { sfx.click(); closeTitle(); resolve(next.id); });
      $('#mWho').onclick = () => { sfx.click(); who(); };
      $('#mSet').onclick = () => { sfx.click(); settings(); };
    }
    if (opts.skipSplash && hasProfile()) { audio(); missions(); } else splash();
  });
}
