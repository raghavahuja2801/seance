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

**Consequence.** Confirmed in R-4 and R-5: the live voice path passes the directions to Drama 3, which performs them ("audio is perfect with the tags"), and strips them from the transcript and stored text.

## ADR-4: Candles as a truth meter; tool use tuned by tests, not by feel

**Problem.** In the first play-test (R-5), the ghosts never snuffed candles and only spelled YES/NO/GOODBYE.

**Options considered**
1. Stronger wording ("use your powers often").
2. Fire effects from the page on a timer, without involving the model.
3. Give each power a **story meaning** the model can apply to any turn. Candles are the ghost's hold on this world and go out as the living get closer to the truth; spelling marks every revealed clue.

**Decision.** Option 3, measured with platform tool tests (R-6).

**Reasoning.** Effects stay tied to what is actually being said, which is the point of the demo. A timer would feel random. Stronger wording doesn't help when no rule covers the situation.

**Tradeoffs.** With five candles the room can go dark before the reveal. Watch for this in the next play-test; a relight on peace or more candles are easy follow-ups.

## ADR-5: Brand assets come from Fish's own repos, unmodified except trimming and fill

**Decision.**
- **Fish Audio:** the official dark-background logo (`repos/docs/logo/dark.png`), with its transparent padding trimmed by script.
- **LiveKit:** the wordmark Fish's own site already uses (`platform-web/public/images/enterprise/logo-livekit.svg`), with fill set to white for the dark page.
- Shown as a "Fish Audio × LiveKit" lockup top-left, per the user's request to show the joint effort. LiveKit is the realtime transport under every agent session.

**Why.** Don't hand-draw or guess brand marks. The first attempt cropped the PNG with CSS `clip-path` using a guessed offset, and cut the fish mark in half. Trimming the asset itself avoids magic offsets.

**Open.** Confirm co-branding is fine with LiveKit before this demo goes anywhere public.

## ADR-6: CI runs only free, deterministic checks

**Decision.**
- **In CI:** two GitHub Actions jobs on every PR and on pushes to main.
  - `unit`: typecheck + `node --test`.
  - `browser`: Playwright Chromium against the real server; the candle regression check (the ambience-levels check was removed with the sound, ADR-9).
- **Kept out:** the live checks (`check-candles.cjs`, `eval-tools.ts`).

**Why.**
- The live checks cost agent minutes, need the Fish API key as a repo secret, and are non-deterministic (the LLM can miss 1/36).
- The browser checks need no key: the server boots with a dummy `SEANCE_AGENT_ID`, and no session is created.
- `check-flame.cjs` was mutation-tested: injecting the old opacity-flicker keyframes makes it fail.

**Consequence.** Prompt or behaviour regressions in the ghosts aren't caught by CI. Run `eval-tools.ts` by hand after changing `src/ghosts.ts`. A manual `workflow_dispatch` job with an API-key secret would be the next step if that becomes a pain.

## ADR-7: Deploy on Vercel's zero-config Fastify, with import extensions rewritten

**Problem.** The first Vercel deploy 500'd on every request with `ERR_MODULE_NOT_FOUND: /var/task/src/fish.ts imported from /var/task/src/server.js`. Vercel compiles `src/server.ts` to JS but keeps the import specifiers as written. We write `./fish.ts` because Node runs the sources directly.

**Options considered**
1. **`.js` specifiers in source** (the common workaround). Breaks local `node src/server.ts`: Node's type stripping doesn't map `.js` to `.ts`.
2. **A separate build step and a bundled entry.** More moving parts, and it fights Vercel's entrypoint detection.
3. **`rewriteRelativeImportExtensions: true`** (TS ≥ 5.7). Sources keep `.ts`, and compiled output gets `.js`.

**Decision.** Option 3.
- **Verified locally:** compiling without the flag reproduces Vercel's exact output (`from './fish.ts'`). With the flag, it emits `"./fish.js"`, and the compiled server boots and serves `/api/ghosts`.
- **Also changed:**
  - `@fastify/static` only registers if `public/` exists (Vercel serves it from the CDN, and the function bundle may not include it).
  - `listen({ port })` on Vercel, matching Vercel's example.

**Not verified:** an actual Vercel build. That needs the user's Vercel account.

**Open risk.** A public URL plus no rate limit means anyone can run séances on our key. Keep Deployment Protection on until a limiter exists.

## ADR-8: In-memory rate limit on session creation, as a first line

**Problem.** On a public URL, anyone can call `POST /api/session` in a loop, and each session bills the Fish key (~$0.06/min, up to 10 min).

**Options considered**
1. **In-memory sliding window in the server.** No new dependencies or accounts. Per instance only.
2. **Shared store** (Upstash/Redis via the Vercel Marketplace). A real global cap, but a new dependency, account and secret.
3. **Vercel Firewall rate-limit rule.** Edge-level and global, configured in the dashboard, not in code.
4. **Origin check.** Skipped: browsers on other sites already fail the CORS preflight for our JSON POST, and curl can forge Origin.

**Decision.** Option 1 now: 4 per IP per 15 min, 40 per instance per hour, applied only when deployed (`VERCEL` set). Locally the server is bound to localhost, and limiting would just block the developer. It runs before validation, so refused requests cost nothing, and it returns 429 with `Retry-After`. On Vercel, `trustProxy` reads the client IP from `X-Forwarded-For`. Option 3 is recommended in the README for a hard cap.

**Verified:**
- 3 unit tests (limit, sliding window, refusals don't extend the wait).
- HTTP: local, the 5th request gets 429 with `Retry-After: 900`. Vercel mode: per-`X-Forwarded-For` quotas are independent.
- The page shows "The spirits are weary" on 429.

### ADR-7 addendum: two more Vercel failures, found with the Vercel connector (runtime logs)
1. **`ERR_REQUIRE_ESM`** from `@fastify/static` 10. It `require()`s `content-disposition` 3, which is ESM-only. Node ≥ 22 allows require(esm), but Vercel's function loader (`/opt/rust/nodejs.js`) does not. Fix: pin `@fastify/static ~9.3` (Fastify 5, CommonJS `content-disposition` 1.x). Reproduced locally with `node --no-experimental-require-module`, and CI now starts the server with that flag.
2. **Every request hung with no logs.** Top-level `await app.listen()` (and `await app.register()`). Vercel intercepts `listen()`, so the awaited promise never resolves and the module never finishes loading. Fix: no top-level await, matching Vercel's own Fastify example.

Also: Vercel did **not** serve `public/` from its CDN for this Fastify project. Every path reached the function, so `@fastify/static` serves the page on Vercel too, and that works. Verified on the preview: `/`, `/seance.js`, `/brand/*.png` and `/api/ghosts` all return 200, with no runtime errors.

## ADR-9: Remove the synthesized ambience

**Problem.** Play-testing on the deployed site: "remove all the bg sound effects, it sounds like static". This came after two rounds of lowering the mix (0.9 → 0.6 → 0.42) and removing the planchette tap.

**Decision.** Delete `public/ambience.js` (drone + wind bed and every one-shot: candle hiss, planchette slide, creak/thud, peace chord, wrath hit), its offline level check, and the mute button, which had nothing left to mute. The ghosts' Drama 3 voices are unaffected.

**Why.** Noise-based synthesis (filtered white noise for wind, hiss and slide) reads as static on real speakers. The level checks proved the mix was balanced, not that it sounded good. Drama 3's performed breaths, sighs and whispers already carry the atmosphere. If sound returns, use recorded, licensed foley, not synthesized noise.

## ADR-10: Stagecraft refinement: a real board, real candles, and the curtains the direction promised

**Feedback.** "The ouija board looks off, make it more realistic, along with the candle; what happened to the curtains?"

**What changed** (refinement inside the Spirit Playbill world, recorded in the surface brief):
- **The board** is an aged wooden talking board again, not flat print:
  - SVG-turbulence wood grain, worn edge vignette, varnish sheen, period serif (IM Fell) lettering;
  - a drawn sun face and crescent moon, corner stars;
  - in perspective on the table;
  - a heart-shaped wooden planchette with a brass-ringed glass lens.
- **Candles return in place of the footlights.** Each is a shaded wax column with a drip, melt pool and wick, and a layered flame (white core, orange body, blue root) that flickers. Five sit around the board, with the back ones smaller for perspective. Same `.candle` / `.flame` / `.out` contract, so the snuff mechanic and the regression checks are unchanged.
- **The proscenium:** oxblood velvet curtains (two fold rhythms plus grain) and a valance with swags and gold fringe.
  - Closed while the séance connects.
  - They part as the spirit arrives, leaving a fold framing each wing.
  - They fall when the act ends, before the notice.
  - Reduced motion cuts instantly.
- **Why the curtains were missing:** the direction promised a stage and "raising the curtain", but the first build only shipped footlights. Recorded so that gap is visible.

**Detector notes:**
- The flame's blue-root radial gradient and the velvet's repeating fold gradient are the objects themselves (a flame, a cloth), not decoration; both are kept.
- The wood shadows were switched to neutral black.
