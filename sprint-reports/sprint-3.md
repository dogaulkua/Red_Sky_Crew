# Sprint 3 — Simulation, remaining data resources and balance tests

**Team:** Red Sky Crew · **Challenge:** NASA Space Apps 2026 — Build a Junior Astronaut Mission Trainer · **Local event:** Niğde

## Goal
Make the game replayable with a simulation layer, integrate the remaining data resources the challenge lists, and check the balance with automated tests.

## What we built

### Simulation (`src/sim.js`, `src/mission.js`)
- Chapter resources: air, food, power, shield and science, plus the crew's radiation dose.
- A separate 10-sol "Mission Mode" prototype with seeded dust, wind cleaning and equipment breakdowns, and a nightly "What happened and why?" report with sources.
- In testing, the separate mode felt disconnected from the story and its report lines could not be voiced. In Sprint 4 we moved its best parts into the chapters instead (see Sprint 4).

### Data resources
| Source | Where it is used |
|---|---|
| NASA DONKI (api.nasa.gov, NASA CCMC) | Chapter 5: asks NASA directly first, falls back to the daily snapshot; always labelled |
| Curiosity RAD, 0.64 mSv/sol | Chapters 1, 4 and 5 — everyday cosmic-ray dose |
| NASA/JPL, May 2024 storm (8,100 µGy) | Chapter 4 |
| NASA/JPL, September 2017 storm | Chapter 3 — surface radiation doubled |
| NASA OCHMO radiation brief | Chapters 3 and 4 — shelter cuts solar-storm dose ~50%, cosmic rays only ~7%; 600 mSv career limit |
| ISS crew dose, 80–160 mSv per 6 months | Chapter 4 comparison |
| NASA OSDR RadLab (ISS dosimeters) | Chapter 4 — linked (its API does not accept requests from web pages) |
| MOXIE on Perseverance | Chapter 1 — the oxygen maker is modelled on it |
| NASA OSDR OSD-268 (lettuce in 33–56 days) | Chapter 1 greenhouse |
| NASA/JPL Opportunity dust (tau 0.5 → 10.8) | Chapter 2 |
| NASA/JPL Spirit panel cleaning (2009) | Chapter 1 |
| NASA JPL orbit elements | Today's Earth–Mars light delay |
| NASA Mars Trek | Chapter 1 — Jezero Crater |
| CSA food-production toolkit and STEM resources | Chapter 5 plant experiment and the teachers' section on `nasa.html` |
| NASA bone loss, 1–1.5% per month | Chapter 5 — Exercise job |
| NASA ISS radishes (27 days) | Chapter 5 — Plant experiment job |

### Testing
- Automated play-through of all five chapters in a headless browser after every change.
- `tests/balance.mjs` plays the chapter rules with several power strategies (all science, a fixed plan, no shield) and prints the resource outcomes, so no single strategy is always safe.
- No script errors in the final run.

### Honest notes
- DONKI watches the Sun from near Earth; Mars can face a different side, so the data is space-weather practice, not a Mars forecast. Chapter 5 says this on its DONKI card.
- Rates such as oxygen per power unit are game estimates and are labelled in the game and on `nasa.html`.

## Next sprint
More hands-on play, final polish, end-to-end testing and the submission deliverables.
