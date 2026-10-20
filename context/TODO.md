# TODO / PR stack

- [x] **PR 1: Scaffold + agent provisioning.** `provision.ts` is idempotent; Drama 3 spike done (R-2).
- [x] **PR 2: Ghost roster + session endpoint.** `src/ghosts.ts` (3 ghosts) and `src/server.ts` (`POST /api/session`).
- [x] **PR 3: Séance page.** Board, candles, planchette, captions, tool handlers, endings. Directions are performed by Drama 3 and stripped from text (R-4, R-5).
- [x] **PR 4: Ghost tool tuning + write-up.** Make the ghosts spell clue words and snuff candles (R-5), measured with platform `tool` tests run on the draft (live sessions use the published version, so they're unaffected). README demo script, vault write-up.
- [x] **PR 5: Immersive UI.** Loading screen, Fish Audio × LiveKit lockup, tilted wood-grain board, fog, dust, candlelight that follows flicker and voice, candles lit one by one, ink-like captions, calling-card picker, mobile layout.
- [x] **PR 6: Ambient sound.** Web Audio drone, wind, creak on shake, hiss on snuff, planchette clicks; ducked under the ghost voice; mute toggle.
- [x] **PR 7: More stories.** Three new ghosts (Salem accused witch, a lost child, a stage magician), auditioned voices, eval-tools pass, sigils.
- [x] **PR 8: Play-test fixes.** Candles now visibly go out (CSS animation overrode opacity, R-9); mix lowered again; `check-candles.cjs` end-to-end check.
- [x] **PR 9: Story variety.** Silas burns in the lantern room, Marvello dies in the Bullet Catch; six distinct deaths.
- [x] **Remove ambience.** Synthesized sound read as static on real speakers; removed with its check and the mute button (ADR-9).
