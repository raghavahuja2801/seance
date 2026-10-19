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
- [ ] Séance page (PR 3)
- [ ] Atmosphere + write-up (PR 4)

Cost: agent minutes are billed at about $0.06/min to the workspace that owns the key.

## Run

```bash
npm start                   # http://127.0.0.1:8790
npm run audition            # optional: render each ghost's first line with Drama 3 into runs/audition/
```

Ghosts are defined in `src/ghosts.ts`. Each has a public epitaph and a private secret, clues, a peace condition and an anger trigger. The server only ever sends the browser `{id, name, epitaph}` and a session token.
