/**
 * Render each ghost's first line with Drama 3 so the voices can be judged by ear.
 *
 *   node --env-file=.env scripts/audition.ts [outDir]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { API_BASE, fishApiKey } from '../src/fish.ts';
import { GHOSTS } from '../src/ghosts.ts';

const outDir = process.argv[2] ?? 'runs/audition';
await mkdir(outDir, { recursive: true });

for (const g of GHOSTS) {
  const res = await fetch(`${API_BASE}/v1/tts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fishApiKey()}`, 'Content-Type': 'application/json', model: 'drama-3' },
    body: JSON.stringify({ text: g.firstMessage, reference_id: g.voiceId, format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`${g.id}: ${res.status} ${await res.text()}`);
  const file = join(outDir, `${g.id}.mp3`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log(file);
}
