# TODO / PR stack

- [x] **PR 1: Scaffold + agent provisioning.** `provision.ts` is idempotent; Drama 3 spike done (R-2).
- [x] **PR 2: Ghost roster + session endpoint.** `src/ghosts.ts` (3 ghosts: voice, secret, anger trigger, Drama 3 syntax guide, tool usage), and `src/server.ts` with Fastify `POST /api/session {ghost}` that calls `/v1/agent/sessions` with overrides. Pick spooky voices from the public library.
- [x] **PR 3: Séance page.** `public/` with the board, candles, planchette and captions; SDK `@fishaudio/agent-client@0.3.0` via jsDelivr in `sessionToken` mode; tool handlers; endings. **Live check:** do `[...]` tags reach TTS, and how do they show in `lk.transcription`?
- [ ] **PR 4: Atmosphere + write-up.** Web Audio ambience, mobile, README demo script, `vault/Experiments/Séance.md`, update `vault/Features/Agents/08` with the answer.
