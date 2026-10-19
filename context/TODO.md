# TODO / PR stack

- [x] **PR 1: Scaffold + agent provisioning.** `provision.ts` is idempotent; Drama 3 spike done (R-2).
- [x] **PR 2: Ghost roster + session endpoint.** `src/ghosts.ts` (3 ghosts) and `src/server.ts` (`POST /api/session`).
- [x] **PR 3: Séance page.** Board, candles, planchette, captions, tool handlers, endings. Directions are performed by Drama 3 and stripped from text (R-4, R-5).
- [x] **PR 4: Ghost tool tuning + write-up.** Make the ghosts spell clue words and snuff candles (R-5), measured with platform `tool` tests run on the draft (live sessions use the published version, so they're unaffected). README demo script, vault write-up.
- [ ] **PR 5: Immersive UI.** More natural and immersive room (user request), Web Audio ambience (drone, wind, creaks on effects), mobile layout.
