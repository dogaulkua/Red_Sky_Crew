// Hands-on mini-games inside the chapters. Each one is about a real Mars constraint and returns a score
// that changes the story's numbers, so how well kids play really matters.
// 1 Oxygen valve (life support) · 2 Plant care (food) · 3 Fold the panels (power vs. dust storm)
// 4 Aim the dish at Earth (communication) · 5 Crew to the shelter (radiation) · 6 Rover dash (radiation vs. time)
import { sfx, wait, voice } from './core.js?v=2026-11-15d';
import { el, $ } from './ui.js?v=2026-11-15d';

// ---------------------------------------------------------------- shared pieces
function hud(title, desc, vkey) {
  $('#mgHud')?.remove(); if (vkey) voice(vkey);
  const h = el('div', 'glass', `<b class="h">${title}</b><span>${desc}</span><div class="mgbar"><i></i></div><em></em>`);
  h.id = 'mgHud'; $('#layer').appendChild(h);
  return {
    time(f) { h.querySelector('.mgbar i').style.width = Math.max(0, f * 100) + '%'; h.classList.toggle('late', f < 0.3); },
    score(txt) { h.querySelector('em').textContent = txt; },
    close() { h.classList.add('out'); setTimeout(() => h.remove(), 400); },
  };
}
async function go(text = 'GO!') { await wait(1600); const g = el('div', 'mgGo h', text); $('#layer').appendChild(g); sfx.success(); await wait(900); g.remove(); }
async function result(text) { const r = el('div', 'mgGo h small', text); $('#layer').appendChild(r); sfx.card(); await wait(1600); r.remove(); }
function countdown(ms, onTick) {
  return new Promise((res) => { const t0 = performance.now(); const iv = setInterval(() => { const f = 1 - (performance.now() - t0) / ms; onTick(Math.max(0, f)); if (f <= 0) { clearInterval(iv); res(); } }, 50); });
}
function panel(html, cls = '') { const p = el('div', 'mini glass ' + cls, html); $('#layer').appendChild(p); return p; }

// ---------------------------------------------------------------- 1. Oxygen valve: keep the pressure needle in the green
// The oxygen maker's output wobbles; hold OPEN or CLOSE to keep the cabin pressure safe. Returns 0..1 (time in the green).
export async function o2Valve(ms = 12000) {
  const H = hud('💨 Start the oxygen maker!', 'Keep the needle in the GREEN zone. Hold ◀ less or more ▶ (or the arrow keys).', 'mg_valve_v');
  const p = panel(`<div class="gauge"><div class="zone"></div><div class="needle"></div><div class="lbl"><span>LOW</span><span>SAFE</span><span>HIGH</span></div></div>
    <div class="row"><button class="btn big" id="vL">◀ Less</button><button class="btn big primary" id="vR">More ▶</button></div>`, 'valve');
  await go();
  let v = 0.5, vel = 0, push = 0, inside = 0, total = 0;
  const hold = (b, d) => { const on = (e) => { e.preventDefault(); push = d; }, off = () => { if (push === d) push = 0; }; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); };
  hold(p.querySelector('#vL'), -1); hold(p.querySelector('#vR'), 1);
  const kd = (e) => { if (e.key === 'ArrowLeft') push = -1; if (e.key === 'ArrowRight') push = 1; }, ku = (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') push = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  let drift = 0.6, last = performance.now();
  await countdown(ms, (f) => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (Math.random() < dt * 0.8) drift = (Math.random() - 0.5) * 1.6;
    vel += (drift + push * 1.9) * dt; vel *= 0.92; v = Math.max(0, Math.min(1, v + vel * dt));
    const ok = v > 0.38 && v < 0.62; total += dt; if (ok) inside += dt;
    p.querySelector('.needle').style.left = v * 100 + '%'; p.classList.toggle('bad', !ok);
    H.time(f); H.score(`Safe: ${Math.round((inside / Math.max(0.01, total)) * 100)}%`);
    if (!ok && Math.random() < 0.05) sfx.tick();
  });
  removeEventListener('keydown', kd); removeEventListener('keyup', ku);
  p.remove(); H.close();
  const score = inside / Math.max(0.01, total);
  await result(score > 0.75 ? 'Perfect pressure!' : `${Math.round(score * 100)}% safe`);
  return score;
}

// ---------------------------------------------------------------- 2. Plant care: tap 💧 dry trays and 💡 dim lights before they fade
export function plantCare(ms = 9000) {
  const H = hud('🌱 Look after the plants!', 'Tap 💧 to water a dry tray and 💡 to fix a dim light, before they fade.', 'mg_plants_v');
  let shown = 0, fixed = 0; const pops = [];
  H.score('0');
  const spawn = () => {
    shown++;
    const b = el('button', 'mgPop', `<span>${Math.random() < 0.55 ? '💧' : '💡'}</span>`);
    b.style.left = 18 + Math.random() * 64 + '%'; b.style.top = 40 + Math.random() * 30 + '%';
    b.onpointerdown = (e) => { e.stopPropagation(); if (b.done) return; b.done = true; fixed++; sfx.plug(); b.classList.add('ok'); H.score(String(fixed)); setTimeout(() => b.remove(), 350); };
    $('#layer').appendChild(b); pops.push(b);
    setTimeout(() => { if (!b.done) { b.classList.add('miss'); setTimeout(() => b.remove(), 300); } }, 2300);
  };
  const t0 = performance.now();
  const iv = setInterval(() => H.time(1 - (performance.now() - t0) / ms), 60);
  const sp = setInterval(spawn, 850); spawn();
  return new Promise((res) => setTimeout(() => { clearInterval(iv); clearInterval(sp); pops.forEach((p) => p.remove()); H.close(); res(shown ? fixed / shown : 1); }, ms));
}

// ---------------------------------------------------------------- 3. Fold the panels before the dust wall arrives
// Six panel sections; tap each one to fold it. The dust wall moves in from the left. Returns { n, of }.
export async function foldPanels(ms = 9000) {
  const H = hud('🌪️ Fold the solar panels!', 'Tap every panel to fold it before the dust wall reaches it.', 'mg_fold_v');
  const p = panel(`<div class="wall"></div><div class="pgrid">${Array.from({ length: 6 }, (_, i) => `<button class="pn" data-i="${i}"><i></i></button>`).join('')}</div>`, 'fold');
  await go();
  let n = 0; const done = new Set();
  p.querySelectorAll('.pn').forEach((b) => (b.onpointerdown = (e) => { e.preventDefault(); if (done.has(b) || b.classList.contains('hit')) return; done.add(b); n++; b.classList.add('folded'); sfx.plug(); H.score(`${n} / 6`); }));
  H.score('0 / 6');
  await countdown(ms, (f) => {
    const wx = (1 - f) * 112; p.querySelector('.wall').style.width = wx + '%'; H.time(f);
    p.querySelectorAll('.pn').forEach((b, i) => { const x = ((i % 3) + 0.5) / 3 * 100; if (wx > x + 4 && !done.has(b) && !b.classList.contains('hit')) { b.classList.add('hit'); sfx.error(); } });
  });
  p.remove(); H.close();
  await result(n === 6 ? 'All panels safe!' : `${n} of 6 folded`);
  return { n, of: 6 };
}

// ---------------------------------------------------------------- 4. Aim the dish at Earth
// Earth is somewhere in the sky; turn the dish until the signal bar is full and hold it for a moment. Returns seconds used (or null).
export async function aimDish(ms = 14000) {
  const H = hud('📡 Find Earth!', 'Turn the dish (drag the slider or use ← →) until the signal is strong, and hold it there.', 'mg_dish_v');
  const target = 25 + Math.random() * 130;
  const p = panel(`<div class="sky"><div class="earth" style="left:${(target / 180) * 100}%">🌍</div><div class="beam"></div></div>
    <input type="range" min="0" max="180" value="90" id="dA"><div class="sig"><b>Signal</b><span><i></i></span><em>0%</em></div><div class="lock"><i></i></div>`, 'dish');
  await go();
  const inp = p.querySelector('#dA'); let a = 90, held = 0, locked = null; const t0 = performance.now(), last = { t: t0 };
  const kd = (e) => { if (e.key === 'ArrowLeft') { a = Math.max(0, a - 3); inp.value = a; } if (e.key === 'ArrowRight') { a = Math.min(180, a + 3); inp.value = a; } };
  addEventListener('keydown', kd); inp.oninput = () => (a = +inp.value);
  await new Promise((res) => {
    const iv = setInterval(() => {
      const now = performance.now(), dt = (now - last.t) / 1000; last.t = now;
      const f = 1 - (now - t0) / ms; H.time(f);
      const sig = Math.max(0, 1 - Math.abs(a - target) / 40) ** 2;
      p.querySelector('.beam').style.left = (a / 180) * 100 + '%';
      p.querySelector('.sig i').style.width = sig * 100 + '%'; p.querySelector('.sig em').textContent = Math.round(sig * 100) + '%';
      held = sig > 0.82 ? held + dt : Math.max(0, held - dt * 2); p.querySelector('.lock i').style.width = Math.min(1, held / 1.2) * 100 + '%';
      if (sig > 0.82 && Math.random() < 0.15) sfx.tick();
      if (held >= 1.2) { locked = (now - t0) / 1000; clearInterval(iv); res(); }
      else if (f <= 0) { clearInterval(iv); res(); }
    }, 50);
  });
  removeEventListener('keydown', kd); p.remove(); H.close();
  await result(locked != null ? `Locked on Earth in ${locked.toFixed(1)} s!` : 'Signal lost…');
  return locked;
}

// ---------------------------------------------------------------- 5. Get the crew into the shelter
// Tap (or drag) each crew member into the storm shelter before the particles arrive. Returns how many made it.
export async function shelterRun(ms = 9000, crew = ['aylin', 'deniz', 'kerem', 'nova']) {
  const H = hud('☢️ Into the shelter!', 'Tap each crew member to send them into the shelter before the particles arrive.', 'mg_shelter_v');
  const p = panel(`<div class="out">${crew.map((c) => `<button class="cm" data-c="${c}"><img src="assets/crew/${c === 'nova' ? 'nova' : c + '_worried'}.png" alt=""></button>`).join('')}</div>
    <div class="shel"><b>🛡️ Shelter</b><small>thick water walls</small><div class="in"></div></div>`, 'shelter');
  await go();
  let n = 0;
  p.querySelectorAll('.cm').forEach((b) => (b.onpointerdown = (e) => { e.preventDefault(); if (b.done) return; b.done = true; n++; sfx.whoosh(); p.querySelector('.in').appendChild(b); H.score(`${n} / ${crew.length} safe`); }));
  H.score(`0 / ${crew.length} safe`);
  // crew members wander, so kids have to aim
  const wander = setInterval(() => p.querySelectorAll('.out .cm').forEach((b) => { b.style.transform = `translate(${(Math.random() - 0.5) * 70}px, ${(Math.random() - 0.5) * 40}px)`; }), 600);
  await countdown(ms, (f) => { H.time(f); if (n === crew.length) H.time(1); });
  clearInterval(wander); p.remove(); H.close();
  await result(n === crew.length ? 'Everyone is safe!' : `${crew.length - n} still outside!`);
  return { n, of: crew.length };
}

// ---------------------------------------------------------------- 6. Rover dash back to base (Phaser scene)
export class Rover extends (globalThis.Phaser ? Phaser.Scene : class {}) {
  constructor() { super('rover'); }
  init(d) { this.d = d; }
  create() {
    const W = 1920, Hh = 1080, G = 860;
    const cam = this.cameras.main;
    const fit = () => { const z = Math.max(this.scale.width / W, this.scale.height / Hh); cam.setZoom(z); cam.centerOn(W / 2, Hh / 2); };
    fit(); this.scale.on('resize', fit); this.events.once('shutdown', () => this.scale.off('resize', fit));
    const sky = this.add.graphics(); sky.fillGradientStyle(0xf2b48a, 0xf2b48a, 0xd9774a, 0xd9774a, 1); sky.fillRect(0, 0, W, Hh);
    const layer = (color, base, amp, seed) => {
      const g = this.add.graphics(); g.fillStyle(color, 1);
      const pts = [{ x: 0, y: Hh }];
      for (let x = 0; x <= W * 2; x += 40) pts.push({ x, y: base - amp * (0.5 + 0.5 * Math.sin(x / (170 + seed * 40) + seed) * Math.cos(x / (310 + seed * 23))) });
      pts.push({ x: W * 2, y: Hh }); g.fillPoints(pts, true); return g;
    };
    this.far = [layer(0xb8644a, 600, 160, 1), layer(0xb8644a, 600, 160, 1)]; this.far[1].x = W * 2;
    this.mid = [layer(0x9c4e34, 760, 110, 3), layer(0x9c4e34, 760, 110, 3)]; this.mid[1].x = W * 2;
    const ground = this.add.graphics(); ground.fillStyle(0x7a3b26, 1).fillRect(0, G, W, Hh - G); ground.fillStyle(0x8e4a30, 1).fillRect(0, G, W, 14);
    this.base = this.add.container(W + 600, G);
    const dome = this.add.graphics(); dome.fillStyle(0xe8e4dc, 1).fillEllipse(0, 0, 360, 260); dome.fillStyle(0x88d8ff, 1).fillEllipse(-40, -50, 90, 50); dome.fillStyle(0xffc46b, 1).fillRect(60, -40, 60, 40);
    this.base.add(dome);
    this.rv = this.add.container(420, G); this.vy = 0;
    const body = this.add.graphics();
    body.fillStyle(0x2b2f38, 1).fillRoundedRect(-150, -120, 300, 60, 14);
    body.fillStyle(0xf2efe8, 1).fillRoundedRect(-140, -150, 280, 50, 16);
    body.fillStyle(0xff8a3c, 1).fillRect(-140, -112, 280, 10);
    body.fillStyle(0x88d8ff, 0.9).fillEllipse(-30, -160, 120, 70); body.fillStyle(0xffffff, 0.6).fillEllipse(-50, -172, 40, 18);
    body.fillStyle(0xd8d8d8, 1).fillRect(90, -230, 6, 80); body.fillStyle(0xff3030, 1).fillCircle(93, -232, 9);
    this.wheels = [-100, 0, 100].map((x) => { const w = this.add.graphics(); w.fillStyle(0x1b1d22, 1).fillCircle(0, 0, 40); w.lineStyle(6, 0x8a8f99, 1).strokeCircle(0, 0, 26); w.lineBetween(-26, 0, 26, 0); w.lineBetween(0, -26, 0, 26); w.setPosition(x, -40); return w; });
    this.rv.add([...this.wheels, body]);
    this.rocks = []; this.speed = 760; this.hits = 0; this.dist = 0; this.length = 18; this.over = false; this.slow = 0; this.nextRock = 1.0;
    this.H = hud('🚙 Race back to base!', 'Tap, Space or ↑ to jump over rocks. Every crash means more time in the radiation.', 'mg_rover_v'); this.H.score('crashes: 0');
    const jump = () => { if (this.rv.y >= G - 1 && !this.over) { this.vy = -1250; sfx.whoosh(); } };
    this.input.on('pointerdown', jump); this.input.keyboard?.on('keydown-SPACE', jump); this.input.keyboard?.on('keydown-UP', jump);
    this.G = G; this.W = W; this.t = 0;
    go();
  }
  rock() {
    const r = this.add.graphics(); const s = 0.8 + Math.random() * 0.6;
    r.fillStyle(0x4a2418, 1).fillPoints([{ x: -60 * s, y: 0 }, { x: -40 * s, y: -55 * s }, { x: 5 * s, y: -80 * s }, { x: 50 * s, y: -45 * s }, { x: 62 * s, y: 0 }], true);
    r.fillStyle(0x6a3626, 1).fillPoints([{ x: -30 * s, y: -45 * s }, { x: 5 * s, y: -72 * s }, { x: 30 * s, y: -40 * s }], true);
    r.setPosition(this.W + 80, this.G); r.w = 55 * s; r.h = 70 * s; this.rocks.push(r);
  }
  update(_, dtMs) {
    if (this.over) return;
    const dt = Math.min(0.05, dtMs / 1000); this.t += dt;
    if (this.t < 0.9) return;
    const sp = this.speed * (this.slow > 0 ? 0.45 : 1); this.slow -= dt;
    this.dist += dt / this.length; this.H.time(1 - this.dist);
    for (const L of [this.far, this.mid]) { const k = L === this.far ? 0.15 : 0.45; for (const g of L) { g.x -= sp * k * dt; if (g.x <= -this.W * 2) g.x += this.W * 4; } }
    this.wheels.forEach((w) => (w.rotation += sp * dt / 40));
    this.vy += 3200 * dt; this.rv.y = Math.min(this.G, this.rv.y + this.vy * dt); if (this.rv.y >= this.G) this.vy = 0;
    this.rv.rotation = this.rv.y < this.G ? -0.08 : Math.sin(this.t * 22) * 0.012;
    this.nextRock -= dt; if (this.nextRock <= 0 && this.dist < 0.9) { this.rock(); this.nextRock = 0.9 + Math.random() * 0.9; }
    for (const r of this.rocks) {
      r.x -= sp * dt;
      if (!r.hit && Math.abs(r.x - this.rv.x) < r.w + 110 && this.rv.y > this.G - r.h) {
        r.hit = true; this.hits++; this.slow = 0.6; sfx.error(); this.cameras.main.shake(250, 0.01); this.cameras.main.flash(150, 255, 60, 60);
        this.H.score('crashes: ' + this.hits); this.tweens.add({ targets: r, alpha: 0, angle: 40, duration: 400 });
      }
    }
    this.rocks = this.rocks.filter((r) => { if (r.x < -200) { r.destroy(); return false; } return true; });
    if (this.dist > 0.75) this.base.x = Math.max(1450, this.base.x - sp * 0.6 * dt);
    if (this.dist >= 1) { this.over = true; this.H.close(); sfx.success(); result(this.hits === 0 ? 'No crashes!' : `${this.hits} crash${this.hits > 1 ? 'es' : ''}`).then(() => this.d.done && this.d.done({ hits: this.hits })); }
  }
}
