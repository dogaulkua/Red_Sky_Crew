# Sprint 4 — Hands-on play, real-data moments and delivery

**Team:** Red Sky Crew · **Challenge:** NASA Space Apps 2026 — Build a Junior Astronaut Mission Trainer · **Local event:** Niğde

## Goal
Make kids *do* things, not only read; finish end-to-end testing; prepare the submission deliverables.

## What we built

### Six hands-on mini-games (`src/minis.js`)
Each one puts the player in charge of one real Mars constraint. The score changes the chapter's numbers.

| Mini-game | Constraint | Real science behind it |
|---|---|---|
| Oxygen valve | Life support | Keep the pressure needle in the safe zone while the oxygen maker starts (modelled on MOXIE) |
| Plant care | Food | Fix dry trays and dim lights while lettuce grows (ISS lettuce: 33–56 days, OSDR OSD-268) |
| Fold the panels | Power vs. dust | Fold every panel before the dust wall arrives (Opportunity, 2018) |
| Find Earth | Communication | Turn the dish and hold the signal; the warning still arrives after the real light delay |
| Into the shelter | Radiation | Move the whole crew inside before the particles arrive (NASA OCHMO shielding data) |
| Rover dash | Radiation vs. time | Race back to base; every crash means more time — and more dose — outside |

### Voiced "Why?" moments
NOVA says one real fact out loud while a card shows its source link:
- Chapter 1: Jezero Crater in NASA Mars Trek, MOXIE, Curiosity RAD.
- Chapter 2: Opportunity's dust (tau 0.5 → 10.8).
- Chapter 3: how much the shelter really helps (NASA OCHMO).
- Chapter 4: the crew's dose next to Curiosity, ISS crews (with a RadLab link) and NASA's 600 mSv career limit.
- Chapter 5: the science behind the crew job the player picks.

### Chapter 5 — real Sun and crew job
- The game first asks NASA DONKI in the browser (api.nasa.gov, then NASA CCMC) for the last 30 days.
- If that works it says "fetched from NASA DONKI just now"; otherwise it uses the daily snapshot and says so.
- After the real events the player picks the crew's job (EVA, exercise, plant experiment, machine check). A stormy real month makes the EVA riskier.

### `nasa.html`
- Every source, where it appears in the game, today's light delay and the latest DONKI events.
- A section for teachers and parents with CSA STEM resources and the CSA food-production toolkit.

### Testing
- Automated play-through of all five chapters with zero script errors.
- Snapshot fallback and its label checked. The direct NASA request depends on NASA's API being reachable from the player's browser.
- Runs on any static web host (or `python3 serve.py` locally); no backend, no account, no CDN.

## Deliverables
- [x] Playable browser game (`index.html`)
- [x] Five chapters with mini-games, voice and NASA cards
- [x] `nasa.html` — every data source with links
- [x] Sprint reports 1–4
- [x] Project presentation (slide deck)
- [x] Project documentation
- [x] Demo video (unlisted YouTube link)

## Honest notes
- All character voices are synthetic (Kokoro-82M, Apache-2.0); no real person's voice is used.
- Backgrounds and characters were made with an AI image tool and edited by the team. No number in the game is AI-generated.
- Game-estimate values are labelled in the game and on `nasa.html`.

## Reflection
Starting from a market scan and a requirements checklist, we built a voiced, browser-based story game where kids make the trade-offs and do the work with their hands, and every number has a source or an honest label.
