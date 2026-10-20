/**
 * Séance server: serves the page and turns "summon <ghost>" into an agent
 * session token. The API key, prompts and secrets stay here (ADR-1).
 *
 *   npm start
 */
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fish, FishApiError } from './fish.ts';
import { findGhost, publicGhosts, sessionRequest } from './ghosts.ts';
import { createLimiter } from './limit.ts';

const agentId = process.env.SEANCE_AGENT_ID?.trim();
if (!agentId) throw new Error('SEANCE_AGENT_ID is not set; run `npm run provision` first');

// Behind Vercel's proxy the client address is in X-Forwarded-For.
const app = Fastify({ logger: { level: 'info' }, trustProxy: Boolean(process.env.VERCEL) });

// Every session bills the key's workspace (~$0.06/min), so cap who can start them.
const perVisitor = createLimiter({ limit: 4, windowMs: 15 * 60_000 }); // a real visitor tries a few ghosts
const overall = createLimiter({ limit: 40, windowMs: 60 * 60_000 }); // spend ceiling per server instance
// Locally Fastify serves the page. On Vercel, public/ is served by the CDN and may not be
// bundled with the function at all, so only register when it's there.
const publicDir = fileURLToPath(new URL('../public', import.meta.url));
if (existsSync(publicDir)) app.register(fastifyStatic, { root: publicDir });

app.get('/api/ghosts', async () => publicGhosts());

app.post<{ Body: { ghost?: unknown } }>('/api/session', async (req, reply) => {
  // Checked first, so refused requests never reach the Fish API or cost anything.
  // Only when deployed: locally the server is bound to localhost and the only visitor is you.
  const limited = process.env.VERCEL ? [perVisitor.take(req.ip), overall.take('all')].find((r) => !r.ok) : undefined;
  if (limited && !limited.ok) {
    req.log.warn({ ip: req.ip }, 'session rate limited');
    return reply
      .code(429)
      .header('Retry-After', Math.ceil(limited.retryAfterMs / 1000))
      .send({ error: 'the spirits are weary' });
  }
  const ghost = findGhost(req.body?.ghost);
  if (!ghost) return reply.code(400).send({ error: 'unknown ghost' });
  try {
    // The response is the SDK's SessionToken; the browser passes it through unchanged.
    return await fish('POST', '/v1/agent/sessions', sessionRequest(ghost, agentId));
  } catch (err) {
    req.log.error(err);
    const status = err instanceof FishApiError && err.status === 402 ? 402 : 502;
    return reply.code(status).send({ error: status === 402 ? 'out of credit' : 'the spirits are not answering' });
  }
});

// Locally binds to localhost only. On Vercel it is public; the limiters above are
// per instance (see src/limit.ts), so add a Vercel Firewall rule for a hard cap.
const port = Number(process.env.PORT ?? 8790);
// Not awaited, and no other top-level await in this module: Vercel intercepts listen()
// instead of binding a port, so an awaited listen never resolves and every request hangs.
// A real startup failure (e.g. port in use) still crashes as an unhandled rejection.
app.listen(process.env.VERCEL ? { port } : { host: '127.0.0.1', port });
