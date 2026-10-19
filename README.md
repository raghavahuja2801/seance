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
- [ ] Ambient sound (PR 6)

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
