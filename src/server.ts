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

const agentId = process.env.SEANCE_AGENT_ID?.trim();
if (!agentId) throw new Error('SEANCE_AGENT_ID is not set; run `npm run provision` first');

const app = Fastify({ logger: { level: 'info' } });
// Locally Fastify serves the page. On Vercel, public/ is served by the CDN and may not be
// bundled with the function at all, so only register when it's there.
const publicDir = fileURLToPath(new URL('../public', import.meta.url));
if (existsSync(publicDir)) await app.register(fastifyStatic, { root: publicDir });

app.get('/api/ghosts', async () => publicGhosts());

app.post<{ Body: { ghost?: unknown } }>('/api/session', async (req, reply) => {
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

// shortcut: no rate limit, and every session bills the key's workspace. Locally it
// binds to localhost only. On Vercel it is public: keep Deployment Protection on, or
// add a limiter, before sharing the URL.
const port = Number(process.env.PORT ?? 8790);
await app.listen(process.env.VERCEL ? { port } : { host: '127.0.0.1', port });
