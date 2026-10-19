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
