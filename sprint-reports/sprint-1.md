# Sprint 1 — Challenge analysis, research and concept

**Team:** Red Sky Crew · **Challenge:** NASA Space Apps 2026 — Build a Junior Astronaut Mission Trainer · **Local event:** Niğde

## Goal
Understand the challenge brief, define the problem we are solving, agree on our approach, and divide the work.

## What we did

### Challenge analysis
- Read the full challenge text and listed every requirement: ages 7–12, real NASA data, life support, radiation shielding, power, food production, communication delay, browser-based, no account or download.
- Turned the requirements into a checklist: 2–3 core resources, plain language, replayability, real data always attributed, never show static data as live.

### Market research
- Scanned public app-store data (Google Play and App Store, US and Türkiye) with a reproducible Colab notebook: 14,788 usable reviews, 840 app-market listings, 41 apps with reviews.
  Notebook: https://colab.research.google.com/drive/1YlVNlJn4tZ8CwS-mM6pCxwo4xYGE2fwp?usp=sharing
- Key findings (keyword scan, approximate; reviewers are not necessarily children):
  - "Fun" words appear in 25.0% of 4–5★ kids'-app reviews, "learning" words in 2.85% → fun must come first; learning is built into the play.
  - Ads are mentioned in 25.4% of 1–2★ reviews of Mars and space mobile games → no ads, no purchases, no wait-to-play or energy timers.
  - Only 8 of 594 kids'-app listings mention NASA → verified NASA sources can be our differentiator.
- Steam returned no reviews, so we do not use it.

### NASA data collection
- Identified and checked the sources we can use:
  - NASA DONKI — real solar events (flares, CMEs, particle storms, geomagnetic storms)
  - Curiosity RAD — about 0.64 mSv per sol at the surface (Hassler et al. 2014)
  - NASA JPL planetary orbit elements — today's Earth–Mars light delay
  - NASA OSDR OSD-268 — ISS lettuce study
  - NASA/JPL mission records — Opportunity's dust storm (tau), Spirit's panel cleaning
  - The May 2024 and September 2017 solar-storm measurements on Mars

### Concept decision
- Name: **Mars Colony: Command Center · Red Sky Chronicles**.
- A story game where the player commands a fictional crew (Aylin, Deniz, Kerem) guided by NOVA, the base AI.
- Five chapters, each built around one real Mars constraint.
- Characters and backgrounds made by the team with an AI image tool, then edited.

## Task assignment
| Task | Owner |
|---|---|
| Game engine and core systems | Doğa |
| Story script and dialogue | Duru Derin |
| Character art and backgrounds | Zeynep |
| NASA data integration | Doğa |
| Voice line production | Duru Derin & Zeynep |

## Decisions
- Browser game, English only, no login (nickname saved only in the browser's localStorage).
- Every number in the game has a source link or is labelled "game estimate".
- Tech stack: Phaser 3 (local copy, no CDN), plain HTML/JS, no build step.

## Next sprint
Build a playable story prototype covering all five chapters.
