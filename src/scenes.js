// Phaser scenes built on the team's painted backgrounds (assets/bg/*.jpg, 1920 wide)
// Land (exterior, day/dusk/night/storm) · Descent (cinematic) · Wake (cutaway power puzzle) · Green (greenhouse) · Shelter (lava tube)
import { sfx, profile, t, wait, lang, onLang, offLang } from './core.js?v=2026-11-15d';

export const director = {
  game: null,
  show(key, data = {}) { return new Promise((res) => this._start(key, { ...data, ready: res })); },
  play(key, data = {}) { return new Promise((res) => this._start(key, { ...data, done: res })); },
  _start(key, data) { const g = this.game; g.scene.getScenes(true).forEach((s) => s.scene.key !== key && s.scene.stop()); g.scene.start(key, data); },
  get(key) { return this.game.scene.getScene(key); },
};
export const quality = { low: false };
const shakeOK = () => profile().settings.shake;
const FONT = '"Exo 2", "Trebuchet MS", sans-serif';

function fitCover(scene, w, h) {
  const cam = scene.cameras.main;
  const fit = () => { const z = Math.max(scene.scale.width / w, scene.scale.height / h); cam.setZoom(z); cam.centerOn(w / 2, h / 2); };
  fit(); scene.scale.on('resize', fit); scene.events.once('shutdown', () => scene.scale.off('resize', fit));
}
// fit inside the area between the top HUD and the bottom panel
function fitContain(scene, w, h, padTop = 84, padBottom = 190) {
  const cam = scene.cameras.main;
  const fit = () => {
    const H = scene.scale.height, availH = Math.max(200, H - padTop - padBottom);
    const z = Math.min(scene.scale.width / w, availH / h); cam.setZoom(z);
    const d = (padTop - padBottom) / 2; cam.centerOn(w / 2, h / 2 - d / z);
  };
  fit(); scene.scale.on('resize', fit); scene.events.once('shutdown', () => scene.scale.off('resize', fit));
}
function fx(scene) {
  if (scene.renderer.type !== Phaser.WEBGL || quality.low) return null;
  const pf = scene.cameras.main.postFX; pf.clear();
  pf.addBloom(0xffffff, 1, 1, 1, 1.05, 2);
  pf.addVignette(0.5, 0.5, 0.9, 0.3);
  scene.time.delayedCall(2500, () => { if (scene.game.loop.actualFps < 28) { quality.low = true; pf.clear(); } });
  return pf;
}
function baseTextures(scene) {
  if (scene.textures.exists('dot')) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff, 1).fillCircle(16, 16, 16); g.generateTexture('dot', 32, 32); g.clear();
  for (let r = 32; r > 0; r -= 2) { g.fillStyle(0xffffff, (1 - r / 32) * 0.12); g.fillCircle(32, 32, r); } g.generateTexture('soft', 64, 64); g.clear();
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 4, 22); g.generateTexture('streak', 4, 22); g.clear();
  // light beam (for god rays)
  for (let i = 0; i < 60; i++) { g.fillStyle(0xffffff, 0.012 * (1 - Math.abs(i - 30) / 30)); g.fillRect(i * 2, 0, 2, 512); } g.generateTexture('beam', 120, 512); g.destroy();
}
export function preloadAll(scene) {
  const L = scene.load;
  for (const k of ['exterior', 'cutaway', 'greenhouse', 'shelter', 'descent', 'storm', 'landing']) if (!scene.textures.exists('bg_' + k)) L.image('bg_' + k, `assets/bg/${k}.jpg`);
  if (!scene.textures.exists('ext_sky')) L.image('ext_sky', 'assets/bg/exterior_sky.png');
  if (!scene.textures.exists('ext_fg')) L.image('ext_fg', 'assets/bg/exterior_fg.png');
  for (const k of ['rocket_p', 'earth']) if (!scene.textures.exists(k)) L.image(k, `assets/scene/${k}.png`);
  if (!scene.textures.exists('bg_landing_empty')) L.image('bg_landing_empty', 'assets/bg/landing_empty.jpg');
  for (const c of ['aylin', 'deniz', 'kerem']) if (!scene.textures.exists('ch_' + c)) L.image('ch_' + c, `assets/chars/${c}.png`);
  if (!scene.textures.exists('ch_nova')) L.image('ch_nova', 'assets/crew/nova_full.png');
}
const tw = (scene, cfg) => new Promise((r) => scene.tweens.add({ ...cfg, onComplete: r }));
function tintTween(scene, img, from, to, ms) {
  const c0 = Phaser.Display.Color.ValueToColor(from), c1 = Phaser.Display.Color.ValueToColor(to), o = { v: 0 };
  scene.tweens.add({ targets: o, v: 100, duration: ms, onUpdate: () => { const c = Phaser.Display.Color.Interpolate.ColorWithColor(c0, c1, 100, o.v); img.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); } });
}

// ================================================================ LAND (exterior)
const EW = 1920, EH = 1048;
const EXT = { // points in exterior.jpg (1920x1048)
  sun: [525, 160], antenna: [731, 272],
  windows: [[769, 585], [834, 583], [913, 581], [986, 583], [1050, 585]],
  greenhouse: [1294, 628], door: [1185, 650], tunnel: [1680, 660],
  panels: [[100, 640, 220, 130], [262, 630, 385, 205], [580, 640, 285, 150]],
};
export class Land extends Phaser.Scene {
  constructor() { super('land'); }
  init(d) { this.d = d; this.mode = d.time || 'day'; }
  create() {
    baseTextures(this); fitCover(this, EW, EH); fx(this);
    const storm = this.mode === 'storm';
    this.bg = this.add.image(EW / 2, EH / 2, storm ? 'bg_storm' : 'bg_exterior').setDisplaySize(EW + 60, EH + 34);
    // sky effects (masked to the sky)
    const skyMask = this.make.image({ x: EW / 2, y: EH / 2, key: 'ext_sky', add: false }).setDisplaySize(EW + 60, EH + 34);
    const mask = new Phaser.Display.Masks.BitmapMask(this, skyMask);
    this.stars = this.add.graphics().setAlpha(0); for (let i = 0; i < 380; i++) this.stars.fillStyle(0xffffff, Math.random() * 0.9 + 0.1).fillCircle(Math.random() * EW, Math.random() * 640, Math.random() * 1.8 + 0.4);
    this.stars.setMask(mask);
    this.clouds = this.add.particles(0, 0, 'soft', { x: { min: -200, max: EW }, y: { min: 40, max: 420 }, speedX: { min: 6, max: 18 }, scale: { min: 5, max: 9 }, alpha: { start: 0.09, end: 0 }, lifespan: 26000, frequency: 900, tint: 0xfff3e0 });
    this.clouds.setMask(mask);
    this.auroraG = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0); this.auroraG.setMask(mask);
    // sun glow + god rays
    this.sunGlow = this.add.image(...EXT.sun, 'soft').setScale(6).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff0d0).setAlpha(storm ? 0.15 : 0.45);
    this.tweens.add({ targets: this.sunGlow, scale: 6.8, alpha: '-=0.15', yoyo: true, repeat: -1, duration: 3200, ease: 'Sine.easeInOut' });
    this.rays = [];
    for (let i = 0; i < 6; i++) {
      const r = this.add.image(...EXT.sun, 'beam').setOrigin(0.5, 0).setScale(2.4, 3.2).setBlendMode(Phaser.BlendModes.ADD).setAngle(-70 + i * 22).setAlpha(storm ? 0 : 0.5).setTint(0xffe3b0);
      this.tweens.add({ targets: r, angle: r.angle + 6, alpha: { from: 0.2, to: 0.55 }, yoyo: true, repeat: -1, duration: 5000 + i * 700, ease: 'Sine.easeInOut' }); this.rays.push(r);
    }
    // lights: windows, greenhouse, tunnel, antenna
    this.lights = this.add.container(0, 0).setAlpha(0);
    for (const [x, y] of EXT.windows) this.lights.add(this.add.image(x, y, 'soft').setScale(1.5).setTint(0xffc46b).setBlendMode(Phaser.BlendModes.ADD));
    this.lights.add(this.add.image(...EXT.greenhouse, 'soft').setScale(4.5).setTint(0x7dff9a).setBlendMode(Phaser.BlendModes.ADD));
    this.lights.add(this.add.image(...EXT.door, 'soft').setScale(1.4).setTint(0xffe0a0).setBlendMode(Phaser.BlendModes.ADD));
    this.tunnelGlow = this.add.image(...EXT.tunnel, 'soft').setScale(4).setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.beacon = this.add.image(...EXT.antenna, 'soft').setScale(1.2).setTint(0xff3030).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.beacon, alpha: 0.1, yoyo: true, repeat: -1, duration: 700, hold: 300 });
    // dust on panels (shown when dusty)
    this.panelDust = this.add.graphics().setAlpha(0);
    for (const [x, y, w, h] of EXT.panels) this.panelDust.fillStyle(0x9a5a32, 0.55).fillRect(x, y, w, h);
    // foreground for parallax depth
    this.fg = this.add.image(EW / 2, 765, 'ext_fg').setOrigin(0.5, 0).setDisplaySize(EW + 120, EH - 765 + 20);
    if (storm) this.fg.setVisible(false);
    // crew
    this.crew = {};
    const spots = this.d.crew || { nova: [230, 1040], deniz: [560, 1040], cmd: [850, 1050], aylin: [1170, 1045], kerem: [1430, 1052] };
    for (const [who, [x, y]] of Object.entries(spots)) {
      const key = 'ch_' + who; if (!this.textures.exists(key)) continue;
      const sh = this.add.ellipse(x, y - 6, 170, 28, 0x000000, 0.28);
      const s = this.add.image(x, y, key).setOrigin(0.5, 0.97); s.setScale((who === 'nova' ? 400 : 440) / s.height); s.base = s.scaleX; s.shadow = sh; s.homeX = x;
      if (x > EW / 2) s.setFlipX(true);
      this.tweens.add({ targets: s, scaleY: s.base * 1.012, yoyo: true, repeat: -1, duration: 1600 + Math.random() * 600, ease: 'Sine.easeInOut' });
      this.crew[who] = s;
    }
    if (this.crew.nova && this.renderer.type === Phaser.WEBGL && !quality.low) this.crew.nova.preFX.addGlow(0x5fe0ff, 2, 0, false, 0.1, 10);
    // the person speaking steps forward and reacts
    this.onSpeak = (e) => { const { who, mood, act } = e.detail; this.spotlight(this.crew[who] ? who : null); if (this.crew[who]) this.act(who, act || (mood === 'scared' ? 'shake' : mood === 'worried' ? 'nod' : 'talk')); };
    window.addEventListener('speak', this.onSpeak); this.events.once('shutdown', () => window.removeEventListener('speak', this.onSpeak));
    // ambient dust
    this.motes = this.add.particles(0, 0, 'dot', { x: { min: 0, max: EW }, y: { min: 300, max: EH }, lifespan: 7000, speedX: { min: 12, max: 50 }, speedY: { min: -8, max: 8 }, scale: { start: 0.08, end: 0.02 }, alpha: { start: 0.55, end: 0 }, tint: 0xffe0b8, frequency: 110, blendMode: 'ADD' });
    if (storm) { this.stormFx(); for (const c of Object.values(this.crew)) c.setTint(0xd2b496); }
    // parallax
    this.par = { dx: 0, dy: 0 };
    this.input.on('pointermove', (p) => { this.par = { dx: p.x / this.scale.width - 0.5, dy: p.y / this.scale.height - 0.5 }; });
    // slow camera push-in for depth
    const cam = this.cameras.main; this.baseZoom = cam.zoom;
    this.tweens.add({ targets: this, push: 1, duration: 16000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); this.push = 0;
    if (this.mode === 'dusk') this.setTime('dusk', 0);
    if (this.mode === 'night') this.setTime('night', 0);
    this.d.ready && this.d.ready(this);
  }
  update(time) {
    const { dx, dy } = this.par, s = Math.sin(time / 9000) * 0.25;
    const cam = this.cameras.main, z = Math.max(this.scale.width / EW, this.scale.height / EH);
    cam.setZoom(z * (1 + this.push * 0.035)); cam.centerOn(EW / 2 + (dx + s) * 10, EH / 2 + dy * 6);
    this.bg.x = EW / 2 - (dx + s) * 14; this.fg.x = EW / 2 - (dx + s) * 46;
    for (const c of Object.values(this.crew)) { const o = c.ofs || { y: 0, r: 0 }; c.x = c.homeX - (dx + s) * 60; c.shadow.x = c.x; c.y = (c.baseY ?? (c.baseY = c.y)) + o.y; c.angle = o.r; }
    if (this.auroraOn) this.drawAurora(time);
  }
  setTime(mode, ms = 2500) {
    const T = { day: 0xffffff, dusk: 0xffb488, night: 0x4a5a9a };
    tintTween(this, this.bg, this.curTint || 0xffffff, T[mode], ms); tintTween(this, this.fg, this.curTint || 0xffffff, T[mode], ms);
    for (const c of Object.values(this.crew)) tintTween(this, c, this.curTint || 0xffffff, mode === 'night' ? 0x9aa8d8 : mode === 'dusk' ? 0xffd2b0 : 0xffffff, ms);
    this.curTint = T[mode];
    this.tweens.add({ targets: this.stars, alpha: mode === 'night' ? 1 : 0, duration: ms });
    this.tweens.add({ targets: this.lights, alpha: mode === 'night' ? 1 : mode === 'dusk' ? 0.5 : 0, duration: ms });
    this.tweens.add({ targets: [this.sunGlow, ...this.rays], alpha: mode === 'night' ? 0 : mode === 'dusk' ? 0.35 : 0.6, duration: ms });
  }
  dustyPanels(on) { this.tweens.add({ targets: this.panelDust, alpha: on ? 1 : 0, duration: 800 }); }
  cleanPanels() {
    this.tweens.add({ targets: this.panelDust, alpha: 0, duration: 1600 });
    for (const [x, y, w, h] of EXT.panels) this.add.particles(x + w / 2, y + h / 2, 'dot', { speed: { min: 80, max: 260 }, angle: { min: 200, max: 340 }, scale: { start: 0.35, end: 0 }, lifespan: 1400, quantity: 3, frequency: 30, tint: [0xffd9b0, 0xffffff], blendMode: 'ADD', duration: 900 });
    sfx.success();
  }
  dustDevil() {
    return new Promise((res) => {
      sfx.wind(4);
      const col = this.add.container(EW + 200, 840);
      const em = this.add.particles(0, 0, 'soft', { x: { min: -50, max: 50 }, y: { min: -520, max: 40 }, speedX: { min: -70, max: 70 }, speedY: { min: -140, max: -40 }, scale: { start: 2.6, end: 0.7 }, alpha: { start: 0.5, end: 0 }, lifespan: 1300, frequency: 10, tint: [0xc9874f, 0xe2b080, 0xa86a3e] });
      col.add(em);
      this.tweens.add({ targets: col, x: -260, duration: 5600, ease: 'Sine.easeInOut', onUpdate: () => { col.y = 840 + Math.sin(col.x / 90) * 14; },
        onComplete: () => { em.stop(); this.time.delayedCall(1200, () => { col.destroy(); res(); }); } });
      this.time.delayedCall(2600, () => this.cleanPanels());
      if (shakeOK()) this.cameras.main.shake(4000, 0.0015);
    });
  }
  stormFx() {
    this.add.particles(0, 0, 'soft', { x: { min: -300, max: 0 }, y: { min: 200, max: EH }, speedX: { min: 500, max: 900 }, speedY: { min: -40, max: 40 }, scale: { min: 2, max: 5 }, alpha: { start: 0.35, end: 0 }, lifespan: 3600, frequency: 25, tint: [0x8a5a32, 0xa8703e, 0x6a4024] });
    this.add.particles(0, 0, 'streak', { x: { min: -100, max: 0 }, y: { min: 0, max: EH }, speedX: { min: 1200, max: 1800 }, angle: 0, scale: { start: 0.6, end: 0.2 }, alpha: { start: 0.5, end: 0 }, lifespan: 1500, frequency: 15, tint: 0xd8a070, rotate: 90 });
  }
  shelterLight(on) { this.tweens.add({ targets: this.tunnelGlow, alpha: on ? 0.9 : 0, duration: 800 }); }
  aurora(on) { this.auroraOn = on; this.tweens.add({ targets: this.auroraG, alpha: on ? 0.9 : 0, duration: 2000 }); }
  drawAurora(time) {
    const g = this.auroraG; g.clear();
    for (let b = 0; b < 3; b++) {
      const col = [0x35ff9c, 0x46e0c8, 0x9b6bff][b];
      for (let x = 0; x <= EW; x += 24) { const y = 120 + b * 60 + Math.sin(x / 180 + time / 1300 + b) * 40, hh = 140 + Math.sin(x / 90 + time / 900 + b * 2) * 60; g.fillStyle(col, 0.06).fillRect(x, y, 26, hh); g.fillStyle(col, 0.12).fillRect(x, y + hh * 0.6, 26, hh * 0.4); }
    }
  }
  act(who, a) {
    const s = this.crew[who]; if (!s) return;
    this.tweens.killTweensOf(s.ofs || (s.ofs = { y: 0, r: 0 }));
    const o = s.ofs;
    if (a === 'hop') this.tweens.add({ targets: o, y: -60, duration: 180, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
    else if (a === 'shake') this.tweens.add({ targets: o, r: 3, duration: 60, yoyo: true, repeat: 7, onComplete: () => (o.r = 0) });
    else if (a === 'nod') this.tweens.add({ targets: o, y: 10, duration: 220, yoyo: true, repeat: 1 });
    else if (a === 'talk') this.tweens.add({ targets: o, y: -16, duration: 160, yoyo: true, ease: 'Sine.easeOut' });
    if (a === 'hop' || a === 'shake' || a === 'gasp') this.emote(who, a === 'hop' ? '♪' : '!');
    if (a === 'worry') this.emote(who, '💦');
    if (a === 'think') this.emote(who, '?');
  }
  emote(who, txt) {
    const s = this.crew[who]; if (!s) return;
    const e = this.add.text(s.x + 40, s.y - s.displayHeight - 10, txt, { fontFamily: FONT, fontSize: '72px', fontStyle: '900', color: '#FFD24A', stroke: '#2A1400', strokeThickness: 10 }).setOrigin(0.5).setScale(0).setDepth(50);
    this.tweens.add({ targets: e, scale: 1, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: e, y: e.y - 40, alpha: 0, delay: 1100, duration: 500, onComplete: () => e.destroy() });
  }
  walk(who, x, ms = 1800) {
    const s = this.crew[who]; if (!s) return Promise.resolve();
    s.setFlipX(x < s.homeX); const o = s.ofs || (s.ofs = { y: 0, r: 0 });
    const step = this.tweens.add({ targets: o, y: -14, duration: 160, yoyo: true, repeat: -1 });
    return new Promise((res) => this.tweens.add({ targets: s, homeX: x, duration: ms, ease: 'Sine.easeInOut', onComplete: () => { step.stop(); o.y = 0; res(); } }));
  }
  hide(who, on = true) { const s = this.crew[who]; if (s) { s.setVisible(!on); s.shadow.setVisible(!on); } }
  spotlight(who) { for (const [k, s] of Object.entries(this.crew)) this.tweens.add({ targets: s, alpha: !who || k === who ? 1 : 0.7, duration: 300 }); }
  shake(ms = 600, i = 0.006) { if (shakeOK()) this.cameras.main.shake(ms, i); }
}

// ================================================================ DESCENT (entry fireball → flip → powered descent → legs → touchdown)
// Everything happens in ONE painted view (the team's landing art with the rocket removed), so perspective stays consistent.
const DW = 1920, DH = 1072, PAD = [1407.5, 836];
const LEGS = [ // [attach, deployed foot] relative to the nozzle base (sprite px)
  [[-30, -26], [-66, 15]], [[37, -26], [69, 15]], [[2, -6], [2, 55]],
];
const NOZ = [[-42, -24], [2, 0], [40, -24]];
export class Descent extends Phaser.Scene {
  constructor() { super('descent'); }
  init(d) { this.d = d; }
  create() {
    baseTextures(this); fx(this);
    const cam = this.cameras.main;
    this.bg = this.add.image(DW / 2, DH / 2, 'bg_landing_empty').setDisplaySize(DW, DH);
    // twinkling stars in the painted sky
    this.twk = this.add.particles(0, 0, 'dot', { x: { min: 0, max: DW }, y: { min: 0, max: 230 }, scale: { start: 0.09, end: 0 }, alpha: { start: 0.9, end: 0 }, lifespan: 1400, frequency: 90, blendMode: 'ADD' });
    this.heat = this.add.rectangle(DW / 2, DH / 2, DW * 3, DH * 3, 0xff5a1a, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(9).setScrollFactor(0);
    // ground glow + dust (under the rocket)
    this.gglow = this.add.image(PAD[0], PAD[1] + 30, 'soft').setScale(0, 0).setTint(0xffb060).setBlendMode('ADD').setDepth(2);
    this.dust = this.add.particles(PAD[0], PAD[1] + 40, 'soft', { speedX: { min: -620, max: 620 }, speedY: { min: -70, max: 30 }, scale: { start: 1.2, end: 3.6 }, alpha: { start: 0.55, end: 0 }, lifespan: { min: 1200, max: 2400 }, frequency: 16, quantity: 3, tint: [0xc98b5e, 0xdcaa7a, 0xa86848, 0xe8c49a], emitting: false }).setDepth(3);
    this.billow = this.add.particles(PAD[0], PAD[1] + 30, 'soft', { speedX: { min: -160, max: 160 }, speedY: { min: -180, max: -60 }, scale: { start: 1.5, end: 4.2 }, alpha: { start: 0.4, end: 0 }, lifespan: 2600, frequency: 40, tint: [0xc98b5e, 0xe0b48a], emitting: false }).setDepth(7);
    // rocket = back legs + painted body + front leg, inside one container whose origin is the nozzle base
    this.legK = 0;
    this.legBack = this.add.graphics(); this.legFront = this.add.graphics();
    this.body = this.add.image(0, 0, 'rocket_p').setOrigin(0.5, 1);
    this.rk = this.add.container(380, 70, [this.legBack, this.body, this.legFront]).setDepth(5).setScale(0.34).setAngle(116);
    this.drawLegs();
    // entry plasma: glow at the leading end + trail
    this.plasma = this.add.particles(0, 0, 'soft', { speed: { min: 10, max: 60 }, scale: { start: 0.75, end: 0.1 }, alpha: { start: 0.85, end: 0 }, lifespan: 420, frequency: 10, tint: [0xffffff, 0xffe08a, 0xff8a3c, 0xff3a1a], blendMode: 'ADD' }).setDepth(4);
    this.trail = this.add.particles(0, 0, 'soft', { speed: { min: 5, max: 30 }, scale: { start: 0.55, end: 0.05 }, alpha: { start: 0.55, end: 0 }, lifespan: 1300, frequency: 12, tint: [0xffc890, 0xff7a3a, 0x8a5a48], blendMode: 'ADD' }).setDepth(4);
    // engine plumes (three nozzles)
    this.plumes = NOZ.map((_, i) => this.add.particles(0, 0, 'soft', { speedY: { min: 380, max: 620 }, speedX: { min: -30, max: 30 }, scale: { start: i === 1 ? 0.9 : 0.6, end: 0.1 }, alpha: { start: 1, end: 0 }, lifespan: 260, frequency: 9, tint: [0xffffff, 0xfff0b0, 0xffb050, 0xff6a2a], blendMode: 'ADD', emitting: false }).setDepth(4));
    this.camK = 1.65; this.focus = [this.rk.x, this.rk.y];
    this.tel = document.createElement('div'); this.tel.className = 'telemetry';
    this.tel.innerHTML = '<div class="tl"></div><div class="ph"></div>'; document.getElementById('layer').appendChild(this.tel);
    this.events.once('shutdown', () => this.tel.remove());
    this.nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    this.nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    this.speed = 19500; this.alt = 125; this.wob = 0;
    this.timeline();
    this.d.ready && this.d.ready(this);
  }
  drawLegs() {
    const k = this.legK;
    const foot = ([a, f]) => [a[0] + (f[0] - a[0]) * k + (1 - k) * Math.sign(a[0]) * 6, a[1] + (f[1] - a[1]) * k - (1 - k) * 46];
    const strut = (g, [a, f]) => {
      const [fx2, fy2] = foot([a, f]);
      g.lineStyle(8, 0x2a1a12, 1).lineBetween(a[0], a[1], fx2, fy2);
      g.lineStyle(4, 0xe9dcc6, 1).lineBetween(a[0], a[1], fx2, fy2);
      if (k > 0.4) { g.fillStyle(0x2a1a12, 1).fillEllipse(fx2, fy2, 26 * k, 11 * k); g.fillStyle(0x8a6a52, 1).fillEllipse(fx2, fy2 - 1, 20 * k, 7 * k); }
    };
    this.legBack.clear(); this.legFront.clear();
    strut(this.legBack, LEGS[0]); strut(this.legBack, LEGS[1]); strut(this.legFront, LEGS[2]);
  }
  world(dx, dy) { // container-local → world (rotation + scale)
    const r = Phaser.Math.DegToRad(this.rk.angle), s = this.rk.scale;
    return [this.rk.x + (dx * Math.cos(r) - dy * Math.sin(r)) * s, this.rk.y + (dx * Math.sin(r) + dy * Math.cos(r)) * s];
  }
  setPhase(txt) { const ph = this.tel.querySelector('.ph'); ph.textContent = txt; ph.style.animation = 'none'; void ph.offsetWidth; ph.style.animation = ''; }
  update(time) {
    this.tel.querySelector('.tl').innerHTML = `<span>${t('tel_speed')}</span><b>${this.nf.format(Math.round(this.speed))}</b><i>km/h</i><span>${t('tel_alt')}</span><b>${this.nf1.format(this.alt)}</b><i>km</i>`;
    // gimbal corrections while the engines fire
    if (this.wob) this.rk.angle = Math.sin(time / 260) * 1.6 * this.wob + Math.sin(time / 97) * 0.5 * this.wob;
    const [nx, ny] = this.world(0, -235); this.plasma.setPosition(nx, ny); this.trail.setPosition(...this.world(0, -40));
    NOZ.forEach(([dx, dy], i) => { const [x, y] = this.world(dx, dy + 8); this.plumes[i].setPosition(x, y); this.plumes[i].speedY = { min: 380 * this.rk.scale, max: 620 * this.rk.scale }; });
    // ground effect: closer to the pad → bigger glow and more dust
    const h = Math.max(0, PAD[1] - this.rk.y), near = Phaser.Math.Clamp(1 - h / 420, 0, 1);
    if (this.plumes[1].emitting) this.gglow.setScale(6 * near + 0.3, 1.6 * near + 0.1).setAlpha(0.25 + 0.5 * near);
    // camera follows the rocket, easing toward the pad
    const cam = this.cameras.main, z0 = Math.max(this.scale.width / DW, this.scale.height / DH), z = z0 * this.camK;
    this.focus[0] += (this.rk.x - this.focus[0]) * 0.08; this.focus[1] += (this.rk.y - 80 - this.focus[1]) * 0.08;
    const vw = this.scale.width / z / 2, vh = this.scale.height / z / 2;
    cam.setZoom(z); cam.centerOn(Phaser.Math.Clamp(this.focus[0], vw, DW - vw), Phaser.Math.Clamp(this.focus[1], vh, DH - vh));
  }
  async timeline() {
    const cam = this.cameras.main, num = (key, to, ms, ease = 'Linear') => tw(this, { targets: this, [key]: to, duration: ms, ease });
    // 1. entry: a fireball crossing the sky, nose first
    this.setPhase(t('ph_entry')); sfx.rumble(5); if (shakeOK()) cam.shake(5000, 0.004);
    this.tweens.add({ targets: this.heat, fillAlpha: 0.16, duration: 900, yoyo: true, hold: 2600 });
    num('speed', 1600, 5000, 'Quad.easeOut'); num('alt', 11, 5000, 'Quad.easeOut');
    await tw(this, { targets: this.rk, x: 1180, y: 250, scale: 0.42, duration: 5000, ease: 'Sine.easeOut' });
    // 2. flip upright and light the engines
    this.plasma.stop(); this.trail.stop();
    this.setPhase(t('ph_engines')); sfx.thrust(5);
    await tw(this, { targets: this.rk, angle: 0, x: 1250, y: 300, duration: 1300, ease: 'Back.easeOut' });
    this.plumes.forEach((p) => p.start()); cam.flash(160, 255, 220, 170); if (shakeOK()) cam.shake(6500, 0.0022);
    this.wob = 1;
    // 3. powered descent: fast, then slower and slower
    num('speed', 0, 6400, 'Cubic.easeOut'); num('alt', 0, 6400, 'Cubic.easeOut'); num('camK', 1.25, 6400, 'Sine.easeInOut');
    const at = (ms, fn) => this.tweens.addCounter({ from: 0, to: 1, duration: 1, delay: ms, onComplete: fn });
    at(2200, () => { this.setPhase(t('ph_legs')); sfx.click(); this.tweens.add({ targets: this, legK: 1, duration: 1200, ease: 'Back.easeOut', onUpdate: () => this.drawLegs() }); });
    at(3600, () => { this.dust.start(); sfx.wind(3); });
    at(4600, () => this.billow.start());
    this.tweens.add({ targets: this, wob: 0.25, duration: 6400 });
    await tw(this, { targets: this.rk, x: PAD[0], y: PAD[1], scale: 1, duration: 6400, ease: 'Cubic.easeOut' });
    // 4. touchdown: engines off, legs take the weight, dust settles
    this.wob = 0; this.rk.angle = 0;
    this.plumes.forEach((p) => p.stop()); at(320, () => this.plumes.forEach((p) => p.killAll())); this.tweens.add({ targets: this.gglow, alpha: 0, duration: 900 });
    sfx.boom(); if (shakeOK()) cam.shake(450, 0.012);
    this.tweens.add({ targets: this.body, scaleY: 0.975, duration: 120, yoyo: true });
    this.dust.explode(60); this.dust.stop(); at(1800, () => this.billow.stop()); this.legK = 1; this.drawLegs();
    this.setPhase(t('ph_touchdown'));
    await wait(2600);
    this.d.done && this.d.done();
  }
}

// ================================================================ WAKE (cutaway power puzzle)
const CW = 1920, CH = 1072;
const ROOMS = {
  ls: { rect: [240, 350, 460, 240], max: 4, icon: '💨' },
  gh: { rect: [770, 340, 430, 250], max: 3, icon: '🥬' },
  lab: { rect: [1250, 380, 540, 230], max: 4, icon: '🔬' },
  shield: { rect: [370, 720, 400, 250], max: 3, icon: '🛡️' },
  comms: { rect: [1240, 660, 550, 330], max: 1, icon: '📡' },
};
export class Wake extends Phaser.Scene {
  constructor() { super('wake'); }
  init(d) { this.d = d; this.alloc = { ls: 0, gh: 0, lab: 0, shield: 0, comms: 0 }; this.total = d.power || 10; }
  create() {
    const relang = () => this.labels && this.redraw(); onLang(relang); this.events.once('shutdown', () => offLang(relang));
    baseTextures(this); fx(this); fitContain(this, CW, CH);
    this.add.rectangle(CW / 2, CH / 2, CW * 3, CH * 3, 0x05070f);
    this.add.image(CW / 2, CH / 2, 'bg_cutaway').setDisplaySize(CW, CH);
    this.dark = {}; this.labels = {}; this.pipsG = this.add.graphics().setDepth(6);
    this.cables = this.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    this.hub = { x: 1500, y: 205 };
    for (const [k, r] of Object.entries(ROOMS)) {
      const [x, y, w, h] = r.rect;
      this.dark[k] = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000010, 0.72).setDepth(3);
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (p) => { if (p.event && p.event.target !== this.game.canvas) return; if (!this.dragging && this.alloc[k] > 0) this.change(k, -1); });
      this.labels[k] = this.add.text(x + w / 2, y + 14, '', { fontFamily: FONT, fontSize: '48px', fontStyle: '800', color: '#FFFFFF', backgroundColor: 'rgba(5,8,20,0.8)', padding: { x: 18, y: 8 } }).setOrigin(0.5, 0).setDepth(7);
    }
    const hubG = this.add.graphics().setDepth(8);
    hubG.fillStyle(0xffd35c, 0.25).fillCircle(this.hub.x, this.hub.y, 80).fillStyle(0xffd35c, 1).fillCircle(this.hub.x, this.hub.y, 46).lineStyle(6, 0xffffff, 0.9).strokeCircle(this.hub.x, this.hub.y, 46);
    this.hubTxt = this.add.text(this.hub.x, this.hub.y, '', { fontFamily: FONT, fontSize: '50px', fontStyle: '900', color: '#2A1C00' }).setOrigin(0.5).setDepth(9);
    this.tweens.add({ targets: hubG, alpha: 0.75, yoyo: true, repeat: -1, duration: 700 });
    const orb = this.add.circle(this.hub.x, this.hub.y, 60, 0xffffff, 0.001).setDepth(10).setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(orb);
    this.drag = this.add.circle(0, 0, 24, 0xffd35c).setDepth(11).setVisible(false);
    this.dragLine = this.add.graphics().setDepth(10);
    this.spark = this.add.particles(0, 0, 'dot', { speed: { min: 40, max: 160 }, scale: { start: 0.35, end: 0 }, lifespan: 400, tint: [0xffd35c, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(12);
    orb.on('dragstart', () => { if (this.free() <= 0) { sfx.error(); this.events.emit('msg', 'no_power'); return; } this.dragging = true; this.drag.setVisible(true); sfx.click(); });
    orb.on('drag', (p) => { if (!this.dragging) return; const w = this.cameras.main.getWorldPoint(p.x, p.y); this.drag.setPosition(w.x, w.y); this.dragLine.clear().lineStyle(8, 0xffd35c, 0.9); this.curve(this.dragLine, this.hub, w); this.spark.emitParticleAt(w.x, w.y, 1); });
    orb.on('dragend', (p) => {
      if (!this.dragging) return; this.dragging = false; this.drag.setVisible(false); this.dragLine.clear();
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      const k = Object.keys(ROOMS).find((r) => { const [x, y, ww, hh] = ROOMS[r].rect; return w.x > x && w.x < x + ww && w.y > y && w.y < y + hh; });
      if (k) this.change(k, +1); else sfx.unplug();
    });
    // pulse along cables
    this.pulse = 0; this.tweens.add({ targets: this, pulse: 1, duration: 1200, repeat: -1 });
    this.d.ready && this.d.ready(this);
    this.redraw();
  }
  update() { this.drawCables(); }
  free() { return this.total - Object.values(this.alloc).reduce((a, b) => a + b, 0); }
  change(k, d) {
    const n = this.alloc[k] + d;
    if (n < 0) return;
    if (n > ROOMS[k].max) { sfx.error(); this.events.emit('msg', 'room_full'); return; }
    if (d > 0 && this.free() <= 0) { sfx.error(); this.events.emit('msg', 'no_power'); return; }
    this.alloc[k] = n;
    const [x, y, w, h] = ROOMS[k].rect;
    if (d > 0) { sfx.plug(); this.spark.explode(30, x + w / 2, y + h / 2); if (n === 1) { sfx.powerOn(); this.cameras.main.flash(120, 255, 240, 200); } } else sfx.unplug();
    this.redraw(); this.events.emit('change', { ...this.alloc }, this.free());
  }
  path(a, b) { return new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2((a.x + b.x) / 2, Math.min(a.y, b.y) + 40), new Phaser.Math.Vector2(b.x, b.y)); }
  curve(g, a, b) { this.path(a, b).draw(g, 32); }
  drawCables() {
    const g = this.cables; g.clear();
    for (const [k, r] of Object.entries(ROOMS)) {
      const n = this.alloc[k]; if (!n) continue;
      const [x, y, w] = r.rect, end = { x: x + w / 2, y: y + 18 }, c = this.path(this.hub, end);
      g.lineStyle(12, 0xffd35c, 0.18); c.draw(g, 32); g.lineStyle(4, 0xffe9a8, 0.9); c.draw(g, 32);
      for (let i = 0; i < n; i++) { const p = c.getPoint((this.pulse + i / n) % 1); g.fillStyle(0xffffff, 0.95).fillCircle(p.x, p.y, 7); }
    }
  }
  redraw() {
    this.hubTxt.setText(this.free());
    this.pipsG.clear();
    for (const [k, r] of Object.entries(ROOMS)) {
      const [x, y, w] = r.rect, n = this.alloc[k];
      this.tweens.add({ targets: this.dark[k], fillAlpha: n === 0 ? 0.72 : Math.max(0, 0.4 - n * 0.12), duration: 350 });
      this.labels[k].setText(`${r.icon} ${t('room_' + k)}`);
      const pw = 54, sx = x + w / 2 - (r.max * pw) / 2 + pw / 2, py = y + 118;
      for (let i = 0; i < r.max; i++) this.pipsG.fillStyle(i < n ? 0xffd35c : 0x1a2038, 1).fillCircle(sx + i * pw, py, 21).lineStyle(4, 0xffffff, 0.7).strokeCircle(sx + i * pw, py, 21);
    }
  }
  setAlloc(a) { this.alloc = { ...a }; this.redraw(); this.events.emit('change', { ...this.alloc }, this.free()); }
}

// ================================================================ GREEN (greenhouse growing)
const GW = 1920, GH = 1072;
export class Green extends Phaser.Scene {
  constructor() { super('green'); }
  init(d) { this.d = d; }
  create() {
    baseTextures(this); fitCover(this, GW, GH);
    this.bg = this.add.image(GW / 2, GH / 2, 'bg_greenhouse').setDisplaySize(GW, GH);
    this.pf = null;
    if (this.renderer.type === Phaser.WEBGL && !quality.low) { this.pf = this.cameras.main.postFX; this.pf.addVignette(0.5, 0.5, 0.9, 0.3); this.cm = this.pf.addColorMatrix(); }
    // grow-light glow over the LED strips
    this.leds = this.add.container(0, 0).setBlendMode(Phaser.BlendModes.ADD);
    for (const [x, y, sx, sy] of [[620, 360, 16, 3], [1740, 330, 6, 4], [400, 700, 12, 3], [1740, 700, 6, 3]]) this.leds.add(this.add.image(x, y, 'soft').setScale(sx, sy).setTint(0xff6ad5));
    this.water = this.add.particles(0, 0, 'dot', { x: { min: 100, max: 1120 }, y: { min: 420, max: 520 }, speedY: { min: 200, max: 360 }, scale: { start: 0.14, end: 0.05 }, alpha: { start: 0.7, end: 0 }, lifespan: 700, tint: 0x9fd0ff, frequency: 40, emitting: false });
    this.sparkle = this.add.particles(0, 0, 'dot', { x: { min: 0, max: GW }, y: { min: 500, max: 1000 }, speedY: { min: -60, max: -20 }, scale: { start: 0.25, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 900, tint: [0xffffff, 0xb6ffcf], blendMode: 'ADD', frequency: 60, emitting: false });
        this.growth = 0.15; this.setLight(2); this.applyGrowth();
    this.d.ready && this.d.ready(this);
  }
  setLight(n) { this.light = n; this.tweens.add({ targets: this.leds, alpha: 0.12 + n * 0.16, duration: 300 }); }
  applyGrowth() { // plants look dull and dry before growing, rich and green after
    if (this.cm) { this.cm.reset(); this.cm.saturate(-0.7 + this.growth * 0.9, true); this.cm.brightness(0.8 + this.growth * 0.25, true); }
    else this.bg.setTint(Phaser.Display.Color.GetColor(200 + 55 * this.growth, 190 + 65 * this.growth, 180 + 75 * this.growth));
  }
  grow(days, quality, onDay) {
    return new Promise((res) => {
      this.water.start(); this.sparkle.start(); sfx.grow();
      const st = { d: 0 }; let last = -1;
      this.tweens.add({ targets: st, d: days, duration: 9000, ease: 'Linear',
        onUpdate: () => {
          const f = st.d / days; onDay && onDay(Math.round(st.d), f);
          this.growth = 0.15 + f * (0.4 + 0.6 * quality); this.applyGrowth();
          const stage = Math.floor(f * 4); if (stage !== last) { last = stage; sfx.tick(); }
        },
        onComplete: () => { this.water.stop(); this.sparkle.stop(); sfx.success(); this.time.delayedCall(600, res); } });
    });
  }
}

// ================================================================ SHELTER (lava tube interior, used in later chapters)
export class Shelter extends Phaser.Scene {
  redAlert(on) { this.tweens.killTweensOf(this.alarm); this.alarm.fillAlpha = 0; if (on) this.tweens.add({ targets: this.alarm, fillAlpha: 0.22, yoyo: true, repeat: -1, duration: 500 }); }
  constructor() { super('shelter'); }
  init(d) { this.d = d; }
  create() {
    baseTextures(this); fitCover(this, 1920, 1072); fx(this);
    this.add.image(960, 536, 'bg_shelter').setDisplaySize(1920, 1072);
    for (const [x, y] of [[262, 420], [1818, 460], [1215, 610]]) { const l = this.add.image(x, y, 'soft').setScale(1.6).setTint(0xff3030).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: l, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 }); }
    for (const [x, y] of [[780, 870], [1100, 760], [1540, 860]]) { const l = this.add.image(x, y, 'soft').setScale(2.2).setTint(0xffb050).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: l, alpha: 0.6, yoyo: true, repeat: -1, duration: 900 + Math.random() * 600 }); }
    this.add.particles(0, 0, 'dot', { x: { min: 0, max: 1920 }, y: { min: 200, max: 1000 }, lifespan: 6000, speedX: { min: -8, max: 8 }, speedY: { min: -10, max: 4 }, scale: { start: 0.07, end: 0.02 }, alpha: { start: 0.5, end: 0 }, tint: 0xffd9b0, frequency: 200, blendMode: 'ADD' });
    this.crew = {};
    const spots = this.d.crew || { deniz: [900, 1060], aylin: [1120, 1060], cmd: [1340, 1066], nova: [1560, 1056] };
    for (const [who, [x, y]] of Object.entries(spots)) {
      const key = 'ch_' + who; if (!this.textures.exists(key)) continue;
      const s = this.add.image(x, y, key).setOrigin(0.5, 0.97); s.setScale((who === 'nova' ? 380 : 420) / s.height); s.setTint(0xffd0a0); s.base = s.scaleX;
      this.tweens.add({ targets: s, scaleY: s.base * 1.012, yoyo: true, repeat: -1, duration: 1500 + Math.random() * 600 });
      this.crew[who] = s;
    }
    this.alarm = this.add.rectangle(960, 536, 4000, 3000, 0xff2020, 0).setBlendMode(Phaser.BlendModes.ADD);
    this.d.ready && this.d.ready(this);
  }
}
