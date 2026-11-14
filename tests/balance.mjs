// node tests/balance.mjs  — plays every mission with several strategies.
import fs from 'node:fs';
import * as S from '../src/sim.js';
const G = JSON.parse(fs.readFileSync(new URL('../data/game.json', import.meta.url)));
const R = G.rules;
const dt = 0.02;
function fill(s, m, order) { // greedily fill power in an order up to targets
  s = { ...s, power: { ls: 0, gh: 0, lab: 0, shield: 0 } };
  for (const [room, n] of order) for (let i = 0; i < n; i++) s = S.setPower(s, room, +1, m, R);
  return s;
}
const strategies = {
  allScience: () => [['lab', 4], ['ls', 1], ['gh', 1]],
  fixed: () => [['ls', 2], ['gh', 2], ['lab', 4], ['shield', 2]],
  noShield: () => [['ls', 2], ['gh', 2], ['lab', 4], ['ls', 4], ['gh', 3]],
  maxShield: () => [['ls', 2], ['gh', 2], ['shield', 3], ['lab', 4]],
  smart: (s, m) => {
    const o = [];
    const r0 = S.rates(s, m, R);
    const lowO2 = s.o2 < 45, lowFood = s.food < 45;
    o.push(['ls', lowO2 ? 3 : 2], ['gh', lowFood ? 3 : 2]);
    const danger = (m.events || []).some((e) => e.type === 'SEP' && s.t > e.at - 1 && s.t < e.at + e.duration);
    if (danger) o.push(['shield', 3]);
    o.push(['lab', 4], ['ls', 3], ['gh', 3], ['shield', 3]);
    return o;
  },
  smartBank: (s, m) => { // like smart but stores air/food when power is high (for dust storms)
    const eff = S.solarEfficiency(s, m, R);
    if (eff > 0.7 && (s.o2 < 95 || s.food < 95)) return [['ls', 3], ['gh', 3], ['lab', 4], ['ls', 4]];
    return strategies.smart(s, m);
  },
};
function play(m, strat, choices) {
  let s = S.createState(m, R);
  s = fill(s, m, Object.entries(m.startPower));
  while (s.status === 'playing') {
    for (const { i, e, warning } of S.dueEvents(s, m)) {
      s = S.markFired(s, warning ? 'w' + i : i);
      if (warning) continue;
      if (e.decision) {
        const d = G.decisions[e.decision];
        const ch = choices[e.decision] === 'timeout' ? d.timeout : d.choices.find((c) => c.id === choices[e.decision]);
        s = S.applyChoice(s, e, ch, R);
      } else s = S.applyEvent(s, e);
    }
    s = fill(s, m, strat(s, m));
    s = S.step(s, dt, m, R);
  }
  return s;
}
const choiceSets = { good: { storm: 'fold', sep: 'shelter' }, bad: { storm: 'leave', sep: 'stay' }, timeout: { storm: 'timeout', sep: 'timeout' } };
let ok = true;
for (const m of G.missions.filter((x) => !x.live)) {
  console.log(`\n== ${m.id} (goal ${m.scienceGoal}, dose < ${m.doseLimit})`);
  for (const [sn, st] of Object.entries(strategies)) for (const [cn, cs] of Object.entries(choiceSets)) {
    const s = play(m, st, cs);
    console.log(`${sn.padEnd(11)} ${cn.padEnd(8)} ${s.status.padEnd(7)} ${String(s.failCause || '').padEnd(10)} sol ${s.t.toFixed(1).padStart(4)} sci ${s.science.toFixed(0).padStart(4)} dose ${s.dose.toFixed(1).padStart(5)} o2 ${s.o2.toFixed(0).padStart(3)} food ${s.food.toFixed(0).padStart(3)} ★${S.stars(s, m)}`);
  }
}
console.log('\nToday Earth–Mars light delay:', S.lightDelayMinutes().toFixed(1), 'min,', S.earthMarsDistanceAU().toFixed(3), 'AU');
