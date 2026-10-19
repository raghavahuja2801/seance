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
