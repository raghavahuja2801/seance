# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The public, meeting it through a Halloween share: social posts and Fish Audio channels. Most have never heard of Fish Audio. They arrive curious, often on a phone, and want a few minutes of spooky fun. Success for them is a conversation with a ghost that feels uncanny and alive.

## Product Purpose
Séance is a voice-first Halloween experience. You pick a spirit, speak to it out loud, and coax out the truth of how it died. Uncover it and the spirit finds peace; insult it and it leaves in anger. It exists to show, through play rather than claims, what Fish Audio can do:
- **Drama 3 voices act:** whispers, sobs, laughter, performed delivery.
- **Realtime agents feel alive:** you just talk, and the character answers and reacts.
- **The agent drives the page:** the spirit moves the planchette and changes the room through tool calls.
- **Fish Audio and LiveKit:** the joint platform underneath.

## Positioning
A haunted conversation you have with your own voice, where the character performs and physically acts on the scene in real time. Not a chatbot with a spooky skin and not a pre-rendered video: every line is generated live, performed by Drama 3, and the spirit's actions are real tool calls.

## Operating Context
- **Platform:** a browser on desktop or phone. It needs microphone permission and works best with sound on. It's played in short sessions, usually a few minutes per spirit; visitors may try several.
- **Under the hood:** each spirit is a session of one Fish Audio voice agent (Drama 3 voice, per-spirit prompt and voice override), connected over LiveKit WebRTC. A small Fastify server creates sessions and hides prompts and secrets.
- **Hosting:** Vercel. It is rate limited per visitor (4 séances per 15 minutes).

## Capabilities and Constraints
- **The spirit's powers (agent client tools):**
  - spell on the board (letters, digits, YES, NO, GOODBYE);
  - "snuff a candle": a truth-is-near / displeasure signal;
  - shake the room (gentle or violent);
  - find peace;
  - hang up (built in).
- **Endings:** peace, wrath (spirit hung up), closed circle (visitor ended), or the connection lost.
- **Live captions:** the spirit's words; `[bracket]` directions are stripped by the platform, and `<whisper>`-style tags may appear in text. The visitor's own transcript is shown too.
- **Stack:** existing static HTML/CSS/vanilla JS in `public/`, served by Fastify. There is no build step, and the agent SDK loads from jsDelivr.
- **No background audio:** synthesized ambience was removed because it read as static. Sound comes only from the spirits' voices.
- **Undecided:** how the "truth is near" signal is visualized. Candles are not a binding requirement; the snuff power exists, but its visual expression is open.

## Brand Commitments
- **The Ouija board and planchette** are the core mechanic and stay: spelling, YES/NO/GOODBYE.
- **The six spirits, their stories, epitaphs, opening lines and ending copy** stay. They are defined in `src/ghosts.ts` and `public/seance.js`.
- **The "Fish Audio × LiveKit" lockup stays visible.** It uses the official assets in `public/brand/`.

## Evidence on Hand
- **Six authored spirits** with Drama 3 voices that were judged "perfect" in listening tests: Eleanor, Lou, Silas, Agnes, Tommy, Marvello.
- **Official logos:** `public/brand/fish-audio-logo.png`, `public/brand/livekit-logo.svg`.
- **No testimonials, usage numbers, or press exist.** Don't invent any.

## Product Principles
1. **The voice is the star.** Nothing on screen competes with a spirit while it speaks.
2. **Show the agent acting.** Every power the spirit uses must be unmistakable on screen.
3. **Seconds to the uncanny.** A first-time visitor should be talking to a spirit within moments, on any device.
4. **Play, not pitch.** The platform story is told by the experience and the lockup, not by marketing copy.

## Accessibility & Inclusion
- Respect reduced motion.
- Full keyboard operation.
- Captions for everything a spirit says.
- Readable contrast in a dark scene.
- Never require sound to understand the state of the séance.
