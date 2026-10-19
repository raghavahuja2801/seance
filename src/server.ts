/**
 * Séance server: serves the page and turns "summon <ghost>" into an agent
 * session token. The API key, prompts and secrets stay here (ADR-1).
 *
 *   npm start
 */
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { fish, FishApiError } from './fish.ts';
import { findGhost, publicGhosts, sessionRequest } from './ghosts.ts';

const agentId = process.env.SEANCE_AGENT_ID?.trim();
if (!agentId) throw new Error('SEANCE_AGENT_ID is not set; run `npm run provision` first');

const app = Fastify({ logger: { level: 'info' } });
await app.register(fastifyStatic, { root: fileURLToPath(new URL('../public', import.meta.url)) });

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

// shortcut: binds to localhost with no rate limit, because every session bills
// the key's workspace. Add a limiter before exposing this beyond a demo laptop.
const port = Number(process.env.PORT ?? 8790);
await app.listen({ host: '127.0.0.1', port });
