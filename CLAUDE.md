# Séance: Halloween Drama 3 agent demo

A Ouija-board web page where you talk by voice to ghosts. Each ghost is one session of a single Fish Audio voice agent speaking with **Drama 3**. Client tools let the ghost move the planchette, snuff candles and shake the room, and the built-in hang-up lets an offended ghost leave.

## Read first
- `context/decisions.md`: why the design is what it is (backend sessions, not a public agent).
- `context/research.md`: what we've verified against the live API.
- `context/TODO.md`: the PR stack and what's next.
- Platform background: `vault/Features/Agents/` (especially 03 runtime/protocol, 04 tools, 08 Drama 3 in agents).

## Layout
- `src/fish.ts`: tiny Agents API client (server-side only; carries the API key).
- `src/agent.ts`: declarative agent and client-tool definitions.
- `scripts/provision.ts`: idempotent create/update/publish of the agent and tools.
- `src/ghosts.ts`: the ghost roster and prompt builder (secrets stay server-side).
- `src/server.ts`: Fastify. `GET /api/ghosts` (public info) and `POST /api/session {ghost}` (returns the SDK session token). Binds to 127.0.0.1 only.
- `public/ambience.js`: synthesized room sound (Web Audio, no files): drone and wind bed ducked under the voice, plus effects for candles, planchette, shakes and endings. `scripts/check-ambience.cjs` renders it offline and asserts levels.
- `public/brand/`: logos. `fish-audio-logo.png` is the official docs `logo/dark.png`, trimmed of transparent padding; `livekit-logo.svg` is LiveKit's wordmark from platform-web `images/enterprise/logo-livekit.svg`, filled white.
- `public/`: the page. `index.html`, `seance.css`, `seance.js` (SDK from jsDelivr, tool handlers, endings) and `lib.js` (pure helpers, tested in Node).
- `scripts/audition.ts`: render each ghost's first line with Drama 3.
- `scripts/check-candles.cjs`: live end-to-end check that a ghost's snuff really darkens a candle (computed style). `scripts/check-ambience.cjs`: offline sound levels.
- `scripts/eval-tools.ts`: tool-use eval harness (platform tool tests on the draft; see research R-6).
- `scripts/spike-*.ts`: one-off experiments; results go in `context/research.md`.
- `test/`: `node --test` unit tests.

## Commands
- `npm start` / `npm run dev`: serve on http://127.0.0.1:8790.
- `npm run provision`: create or update the agent. Run it after any change to `src/agent.ts`.
- `npm test`, `npm run typecheck`.

## Conventions
- Node ≥ 22.18 runs `.ts` directly (type stripping); no build step. Same setup as `experiments/ASR_demo`.
- `.env` holds `FISH_API_KEY` and `SEANCE_AGENT_ID`. Never commit it, and never send the key to the browser.
- Client tool names are prefixed `seance_` because tools are workspace-wide.
- Git: private repo, stacked PRs (see the root `CLAUDE.md` §14).
