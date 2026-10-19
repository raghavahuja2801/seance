# Research log

## R-1: Agents API behaviour verified while provisioning (2026-10-19)
- **Drama 3 accepted on the public API.** `PATCH /v1/agent/agents/{id}/config` accepts `voice.tts_model: "drama-3"`, even though `openapi.json`'s `PublicAgentVoicePatch` leaves it out. The code's `PublicAgentVoicePatch` inherits `AgentVoicePatch`, which has the field (`platform-api/apps/agents/public/schemas.py:64`). Read back: `tts_model: "drama-3"`.
- **`execution_mode` on client tools → 422** `"execution_mode is only supported for webhook tools"`.
- **`PATCH /v1/agent/tools/{id}` with `tool_type` → 422** `"Extra inputs are not permitted"`. It's create-only.
- **`GET /v1/agent/test-runs?batch_id=` returns summaries** without `agent_reply`. Use `GET /v1/agent/test-runs/{id}`.
- `POST /agents` with an inline `config` creates and configures the agent in one call. `overrides_allowed` is set separately via `PATCH /agents/{id}`.
- Agent: `e50a415a2d504903be9344809564ed7c` (published v1, Drama 3, voice Sheila `f3a2b900…`).

## R-2: Does expressive mode make the LLM write Drama 3 directions? (2026-10-19)
- **Hypothesis.** With `tts_model=drama-3` + `expressive=true`, the agent's replies contain `[direction]`-style tags.
- **Setup.** `scripts/spike-directions.ts`: a `next_reply` text test on the draft, base prompt (no syntax hints), default LLM `google/gemini-3.6-flash`, repeat 3.
- **Result.** 3/3 replies were plain prose with **no tags of any kind**, e.g. "Cold steel in the dark... yes, I was taken before my time. My blood still stains the cold floor beneath your feet."
- **Interpretation.** Inconclusive about the live path. The test runner may not include the expressive guide, since that guide is a TTS concern. Either way, expressive mode alone can't be relied on.
- **Next.** Ghost prompts teach the syntax (ADR-3). PR 3's live call checks that tags reach TTS and how the transcript stream shows them.

## R-3: Ghost voices + session overrides (2026-10-19)
- **Voices:** chosen from the public library by tags, then auditioned with Drama 3 (`npm run audition`, writes `runs/audition/*.mp3`, about 7 s each). All three render with `model: drama-3`:
  - Eleanor: "british woman narrat" `14a35dc1f1024e61a69cab445c0a8f7d`
  - Lou: "singer" `9dc77337699140d0b19a5686c2400383`
  - Silas: "Old man" `00731df901a74de5b9b000713f14718c`
- **Session overrides:** `POST /v1/agent/sessions` with `overrides: {system_prompt, voice_id, first_message}` plus `metadata` succeeded. It returned `transport: livekit`, `max_duration_seconds: 600` (from our config) and a `wss://fish-agent-….livekit.cloud` URL. Ending it right away (`POST /sessions/{id}/end` → 204) leaves `status: failed, end_reason: cancelled`, and the metadata comes back intact.

## R-4: First live call: page ↔ agent end to end (2026-10-19)
- **Setup.** Headless Chrome (Playwright, `--use-fake-device-for-media-stream`, so the "mic" is a test tone) → `/?debug` → summon Eleanor → wait 16 s → "Close the circle". Session `sess_7a53b245…`, 15 s, `completed / user_hangup`.
- **Works.** jsDelivr `+esm` build of `@fishaudio/agent-client@0.3.0` in `sessionToken` mode, LiveKit connect, first message spoken, `agentResponse` and `modeChange` events, `disconnect` → ending screen.
- **Directions are stripped from all text the client and API see.** First message `[a thin, frightened whisper, as if from under water] Is someone there? [shivering breath] It is so... very... cold.` arrived on `agentResponse` as `Is someone there? It is so... very... cold.`. The stored session `items[].content` is the same. So captions are clean without any work on our side; `stripDirections()` is now just a safety net.
- **Directions are not spoken aloud.** `GET /sessions/{id}/recording` returns per-role `.ogg` tracks (recording is on by default). Fish ASR on the agent track gave "Is someone there? It is so very cold." (12.0 s). Whether TTS *performed* them (vs. had them stripped) needs a human ear. Compare the agent track with `npm run audition`'s `eleanor.mp3`, which is direct Drama 3 with the directions.
- Not exercised by the test tone: client tools, peace and anger endings. They need a real conversation.
- **First human play-test (2026-10-19, Raghav, Mac via SSH tunnel):** the voice picks are "perfect for the use case". Keep all three.

## R-5: Play-test results (2026-10-19, Raghav)
- **Drama 3 directions ARE performed in the agent path.** "Audio is perfect with the tags." Together with R-4: the worker passes `[...]` / `<whisper>` to Drama 3 TTS and strips them only from the text channels (transcript, stored items). This resolves the open question from R-2 and the vault's Agents/08.
- **Tools:** the planchette moved, but only for YES / NO / GOODBYE. The ghosts never spelled a clue word and **never snuffed a candle**. So the LLM (Gemini 3.6 Flash) under-uses the tools with the current "use a power every two or three turns" wording. Tuned in PR 4.
- UI works but should feel more natural and immersive. Deferred to PR 5.

## R-6: Tuning tool use with platform tool tests (2026-10-19)
- **Harness.** `scripts/eval-tools.ts`. For each ghost it loads `buildPrompt(g)` into the agent's **draft** (live sessions use the published version, so they're unaffected), creates 6 `tool` tests, runs them with `repeat_count: 3`, deletes them, and restores the base prompt. Model: Gemini 3.6 Flash.
- **Cases:** 4 direct provocations (yes/no → spell, "what was their name" → spell, rude → snuff, ghost-specific insult → shake), and 2 **polite-play** cases that mirror the R-5 play-test (kind "how did you die" → snuff; "what do you remember" → spell).

| Prompt version | yes/no | name | rude | insult | kind:death → snuff | kind:memory → spell |
|---|---|---|---|---|---|---|
| v1 baseline ("use a power every two or three turns") | 9/9 | 9/9 | 9/9 | 8/9 | **0/9** | 9/9 |
| v2: candles = "your hold on this world", go out as the truth gets closer | 9/9 | 9/9 | 9/9 | 9/9 | **9/9** | **2/9** |
| v3: + "share a memory → ALSO spell its key word" + "you may use more than one power per turn" | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 | 9/9 |

- **Lessons:**
  - The model under-used tools only where no rule covered the situation. The fix was a **game mechanic** (candles track closeness to the truth), not stronger wording.
  - With v2, the model chose **one tool per turn**, so a new rule displaced an old one. Saying explicitly that powers can combine fixed it.
  - Edit both the prompt and the tool's own `description`.
- **Platform quirk.** `POST /v1/agent/tests` intermittently returns `404 {"message":"Test not found"}`, seen twice right after config/tool changes. The same payload succeeds on retry. The harness retries 404s.
- **Caveats.** Single-turn tests with 3 repeats is a small sample. Not measured: whether the ghost now snuffs too often (5 candles can run out before the truth comes out), and whether `find_peace` fires at the right moment. Next play-test should check both.

## R-7: Ambience levels, measured offline (2026-10-19)
- `scripts/check-ambience.cjs` renders `createAmbience(new OfflineAudioContext(...))` in headless Chrome and asserts on RMS levels.
- **It caught a real problem.** The first mix had the bed at RMS 0.14, loud enough to compete with the ghost's voice. A violent creak was only 1.2× the bed, because the compressor's defaults (-24 dB, 12:1) squashed every effect into the bed.
- **Fixes:** drone and wind about 3× quieter; compressor at -10 dB, 4:1; creak band-pass Q 6 → 3.
- **Final:** bed 0.033, violent creak 0.080 (+7.7 dB over the bed), ducked bed 0.012 (-8.8 dB), muted 0, peak 0.45 (no clipping).
- Not checked: how it sounds to a human. Next play-test.
- **After the first listen (user: "reduce the volume for the bg effects slightly"):** master level 0.9 → 0.6 (about −3.5 dB). Bed 0.022, violent creak 0.053, peak 0.30. All checks still pass.
- **Removed the planchette "tap" on each letter** (user: "I don't like the tap sound… remove it completely"). Only the soft slide remains.

## R-8: Three more ghosts (2026-10-19)
- **Agnes Whitlock** (Salem 1692, falsely accused). Voice "Old Woman Audio" `7e4baf13677e4b95b5e25a60b9a717b4`. The accusers are invented names, not real Salem figures.
- **Tommy Hale** (8-year-old, 1918, stuck in a dumbwaiter). Voice "Kid" `1ec4fec8af974d82a2ec69d86a81dc3d`.
- **The Great Marvello** (magician, 1911, his assistant swapped the lock). Voice "Theatrical Showman" `58b3344db8b44d6ba27cc67dd908ccb2`.
- Voice rule: generic library voices only. Celebrity and franchise clones (e.g. "Scarlet Witch", "Pomni") were skipped.
- **Tool-use eval** (`eval-tools.ts 3 agnes,tommy,marvello`): **54/54**, all six cases on the first try. The PR 4 prompt structure carries over to new characters without tuning.
- **Live:** Tommy's opening line ("Ready or not... you have to find me!") streamed on desktop and phone. Auditions are rendered via `npm run audition`; the voices haven't been judged by a human yet.
