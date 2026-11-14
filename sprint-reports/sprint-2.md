# Sprint 2 — Game structure and playable prototype

**Team:** Red Sky Crew · **Challenge:** NASA Space Apps 2026 — Build a Junior Astronaut Mission Trainer · **Local event:** Niğde

## Goal
Design the game structure, wire up the first NASA data sources, and produce a playable prototype that covers all five chapters end to end.

## What we built

### Game structure
Five chapters, each centred on one real Mars constraint:
1. **Landing at Jezero** — life support and the first food (Perseverance landing, ISS lettuce)
2. **The Dust Wall** — solar power vs. a dust storm (Opportunity, 2018)
3. **The Late Warning** — communication delay and a radiation alert (September 2017 storm)
4. **The Biggest Storm** — crew dose vs. shelter (May 2024, Curiosity RAD)
5. **Today's Real Sun** — real NASA DONKI solar events of the last 30 days

### Prototype
- Phaser 3 web game (library served locally, no CDN).
- Painted backgrounds and character art made with an AI image tool, then edited by the team.
- All five chapters playable from start to finish with dialogue, choices and a power-sharing puzzle.
- Local pilot profiles: nickname and progress saved in localStorage; no server, no account.
- English voice lines generated with Kokoro-82M (open-source TTS, Apache-2.0).
- Ambient music and sound effects synthesized in code at runtime (Web Audio).

### NASA data — first integration
- NASA JPL orbit elements → today's Earth–Mars distance computed in the browser → the real light delay used in the radio countdown.
- NASA DONKI snapshot: a GitHub Action fetches the last 30 days of solar events once a day and saves `data/donki_latest.json`.
- NASA cards with source links after key story moments.
- "NASA data we used" page (`nasa.html`) listing every source, today's light delay and the DONKI snapshot.

### Early playtesting (team internal)
- The story flow felt natural and age-appropriate.
- Main feedback: too much reading, not enough doing; outcomes felt predictable.

## Decisions
- Keep the story format; make trade-offs visible on every choice (power, air, food, dose, science).
- Track a small set of resources so outcomes depend on the player's decisions.

## Next sprint
Add a simulation layer for replayability and wire up the remaining data resources.
