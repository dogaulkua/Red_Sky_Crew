// Parts of this code were written with help from an AI coding assistant (see README "Use of AI").
import { loadText, setLang, profile, suitImage, save } from './core.js?v=2026-11-15d';
import { mount, applyFontScale } from './ui.js?v=2026-11-15d';
import { director, preloadAll, Land, Descent, Wake, Green, Shelter } from './scenes.js?v=2026-11-15d';
import { runTitle } from './title.js?v=2026-11-15d';
import { Rover } from './minis.js?v=2026-11-15d';
import { missionMode } from './mission.js?v=2026-11-15d';
import { chapter1, chapter2, chapter3, chapter4, chapter5 } from './story.js?v=2026-11-15d';

await loadText('data/text.json?v=2026-11-15d');
const RAW = await fetch('data/text.json?v=2026-11-15d').then((r) => r.json());
const p = profile();
setLang('en');
mount(); applyFontScale();

const CHAPTERS = [
  { id: 'ch1', num: 1, title: RAW.c1_title, tagline: RAW.c1_tagline, run: chapter1 },
  { id: 'ch2', num: 2, title: RAW.c2_title, tagline: RAW.c2_tagline, run: chapter2 },
  { id: 'ch3', num: 3, title: RAW.c3_title, tagline: RAW.c3_tagline, run: chapter3 },
  { id: 'ch4', num: 4, title: RAW.c4_title, tagline: RAW.c4_tagline, run: chapter4 },
  { id: 'ch5', num: 5, title: RAW.c5_title, tagline: RAW.c5_tagline, run: chapter5 },
];

class Boot extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() { preloadAll(this); }
  create() { this.game.events.emit('booted'); }
}
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', backgroundColor: '#05070F',
  scale: { mode: Phaser.Scale.RESIZE, width: innerWidth, height: innerHeight },
  scene: [Boot, Land, Descent, Wake, Green, Shelter, Rover],
});
director.game = game;
await new Promise((r) => game.events.once('booted', r));

async function commanderTexture() {
  const pr = profile();
  const url = await suitImage(`assets/chars/${pr.avatar}.png`, pr.suit);
  if (game.textures.exists('ch_cmd')) game.textures.remove('ch_cmd');
  await new Promise((res) => { const img = new Image(); img.onload = () => { game.textures.addImage('ch_cmd', img); res(); }; img.src = url; });
}
window.__game = game;
let first = true;
while (true) {
  const id = await runTitle(CHAPTERS, { skipSplash: !first }); first = false;
  const ch = id === 'mission' ? { run: missionMode } : CHAPTERS.find((c) => c.id === id);
  if (id !== 'mission') save({ last: id });
  await commanderTexture();
  let r = 'replay';
  while (r === 'replay') r = await ch.run();
  document.getElementById('mmHud')?.remove(); document.getElementById('mg')?.remove();
  game.scene.getScenes(true).forEach((s) => s.scene.stop());
}
