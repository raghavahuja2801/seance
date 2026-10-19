# Technical Decisions

## ADR-1: One agent, ghosts as per-session overrides, sessions created by our backend

**Problem.** Each ghost needs its own voice, personality and hidden secret, but we want one agent to provision and maintain.

**Options considered**
1. **Public (keyless) agent, browser-only.** No backend. However, keyless sessions accept only the `voice_id` and `language` overrides; `system_prompt` is rejected with a 400 (`docs/agents/deploy/public-agents.mdx`). Personality would have to come through `dynamic_variables`, which the visitor controls, and every ghost's secret would ship in the page source.
2. **One public agent per ghost.** No backend, but N agents to provision, and the secrets are still in the agents' configs, which is fine. It's more config to keep in sync, and the public rate limits apply.
3. **One agent + a small backend that creates sessions** with `overrides: {system_prompt, voice_id, first_message}` and hands the browser only the session token (the SDK's `sessionToken` mode).

**Decision.** Option 3.

**Reasoning.** It keeps the secrets server-side, there's one agent to provision, and new ghosts are pure data. The backend is a few lines of Fastify, in the same style as `ASR_demo`.

**Tradeoffs.** The demo needs a server; it can't be a static page. `tts_model` can't be overridden per session, so every ghost uses Drama 3, which is what we want anyway.

## ADR-2: Client tools are fire-and-forget page effects

**Decision.** `expects_response: false` on all four tools (spell, snuff candle, shake room, find peace).

**Reasoning.** The effects don't return anything the ghost needs, and waiting on a browser round-trip would add dead air mid-sentence.

**Note.** `execution_mode` is webhook-only; the API rejects it on client tools with a 422.

## ADR-3: Teach Drama 3 direction syntax in each ghost's prompt

**Problem.** We don't know whether the worker's "expressive" guide produces Drama 3 syntax.

**Evidence.** See research.md, R-2: with expressive on, test replies contained no tags at all.

**Decision.** Each ghost's system prompt explicitly teaches `[free-text direction]`, inline sounds and `<whisper>…</whisper>`. Keep `expressive: true` in case it helps.

**Consequence.** We still have to confirm that the live voice path passes brackets through to TTS; this is checked in PR 3.
