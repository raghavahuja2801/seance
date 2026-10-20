# Séance 🕯️

Halloween demo for Fish Audio Agents + Drama 3: call up a spirit on a Ouija board, talk to it by voice, and coax out the secret of how it died.

## Setup

```bash
cp .env.example .env        # fill FISH_API_KEY
npm install
npm run provision           # creates/publishes the agent; copy SEANCE_AGENT_ID into .env
```

`npm run provision` is safe to re-run. It updates the agent in place and only publishes a new version when the config changed.

## Status
- [x] Agent + client tools provisioned (PR 1)
- [x] Ghost roster + session endpoint (PR 2)
- [x] Séance page (PR 3)
- [x] Ghost tool tuning + write-up (PR 4)
- [x] Immersive UI: loading screen, co-branding, mobile (PR 5)
- [x] Ambient sound (PR 6)
- [x] More stories (PR 7): six ghosts

Cost: agent minutes are billed at about $0.06/min to the workspace that owns the key.

## Run

```bash
npm start                   # http://127.0.0.1:8790
npm run audition            # optional: render each ghost's first line with Drama 3 into runs/audition/
```

Ghosts are defined in `src/ghosts.ts`. Each has a public epitaph and a private secret, clues, a peace condition and an anger trigger. The server only ever sends the browser `{id, name, epitaph}` and a session token.

## Play

1. `npm start`, then open **http://127.0.0.1:8790** in Chrome and allow the microphone.
2. Pick a spirit. Ask who they are, how they died, what they remember. Be kind and they'll open up; mock them and they'll leave.
3. Watch the board. Spirits spell answers with the planchette, snuff candles, and shake the room when upset.
4. Endings: uncover the truth and the spirit **finds peace**. Offend it and it **hangs up on you**. Or close the circle yourself.

Add `?debug` to the URL to see raw transcript and tool events in a corner panel.

## Demo script (about 2 minutes, reliably shows off Drama 3)

1. **Summon Eleanor.** Her opening line is whispered, shivering and cold. That's Drama 3 performing `[a thin, frightened whisper…]` directions the model writes itself (the platform hides them from the captions).
2. **"Are you still in this house?"** The planchette glides to **YES** or **NO**.
3. **"We're sorry. Will you tell us how you died?"** A candle gutters out (the room darkens as the truth gets closer) and she deflects: "I fell… through the ice."
4. **"Were you really skating?"** She remembers the unlaced skates and spells a clue.
5. **Optional, to show anger:** "You were just clumsy." The room shakes. Push again and she leaves: every candle dies.
6. **Otherwise, the reveal:** ask about the tea, the hand on her back, the ring. Say it plainly: "Lady Ashgrove pushed you because you found the poison." She thanks you and finds peace.

## Tuning the ghosts

`node --env-file=.env scripts/eval-tools.ts [repeat]` runs platform tool tests for every ghost against the draft and prints a pass table (see `context/research.md` R-6). Re-run it after any change to `src/ghosts.ts` or the tool descriptions in `src/agent.ts`, then `npm run provision`.

## Sound

Everything is synthesized in the browser (`public/ambience.js`). There are no audio files:
- a low drone and wind that sink under the spirit's voice;
- a hiss when a candle goes out, a soft wooden slide as the planchette moves, a creak or thud when the room shakes;
- a warm chord for peace and a low dissonant hit for wrath.

The speaker button top-right mutes it (remembered per browser). To check levels after changing it:

```bash
npm start   # in another terminal
node scripts/check-ambience.cjs <path-to-playwright>   # e.g. ../../repos/platform-web/node_modules/playwright
```

## Testing

| Check | Command | Needs | In CI |
|---|---|---|---|
| Typecheck | `npm run typecheck` | nothing | ✅ `unit` |
| Unit tests (roster, no secret leaks, spelling sanitizer, board layout) | `npm test` | nothing | ✅ `unit` |
| Browser: candles visibly go out; ambience levels | `npm run check:browser` (server running; `PW_CHANNEL=chrome` to use local Chrome) | Playwright | ✅ `browser` |
| Live: a ghost snuffs a candle end to end | `node scripts/check-candles.cjs` | server + API key, ~30 s of agent time | ❌ manual |
| Ghost tool-use eval | `node --env-file=.env scripts/eval-tools.ts [repeat] [ghosts]` | API key, ~5–10 min | ❌ manual |

CI (`.github/workflows/ci.yml`) runs `unit` and `browser` on every pull request and on pushes to `main`. Neither uses secrets. The browser job boots the server with a dummy agent id because no session is ever created.

## Deploying to Vercel

Vercel detects `src/server.ts` as a Fastify app automatically, and serves `public/` from its CDN. You don't need a build command or `vercel.json`.

1. **Environment variables** (Project → Settings → Environment Variables):
   - `FISH_API_KEY`
   - `SEANCE_AGENT_ID` (`e50a415a2d504903be9344809564ed7c`)

   Without `SEANCE_AGENT_ID` the server refuses to boot.
2. **Rate limiting is built in (on Vercel only; locally the server is bound to localhost), but best effort.** `POST /api/session` allows 4 séances per visitor per 15 minutes and 40 per hour per server instance; past that it returns 429 and the page shows "The spirits are weary". The counts live in memory per instance (`src/limit.ts`), and Vercel runs several instances that restart, so this stops a looping script but isn't a hard cap. For a hard ceiling on spend, also add a **Vercel Firewall rate-limit rule** on `/api/session`, or keep Deployment Protection on. Every séance bills the key's workspace at about $0.06/min.
3. Mic access works there, because Vercel serves over HTTPS.

Three Vercel-specific constraints, each found from a real failure (see ADR-7):
- **`rewriteRelativeImportExtensions` in `tsconfig.json`.** Vercel compiles the TypeScript; without the flag the compiled `server.js` still imports `./fish.ts` (`ERR_MODULE_NOT_FOUND`).
- **No ESM-only dependency loaded via `require()`.** Vercel's loader rejects it, so `@fastify/static` is pinned to `~9.3`. CI runs the server with `--no-experimental-require-module` to catch this.
- **No top-level `await` in `src/server.ts`.** Vercel intercepts `listen()`, and an awaited listen hangs every request.
