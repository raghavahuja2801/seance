import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GHOSTS, buildPrompt, findGhost, publicGhosts, sessionRequest } from '../src/ghosts.ts';
import { TOOLS } from '../src/agent.ts';

test('ghost ids are unique and lookups reject anything else', () => {
  assert.equal(new Set(GHOSTS.map((g) => g.id)).size, GHOSTS.length);
  assert.equal(findGhost('eleanor')?.name, 'Eleanor Vale');
  for (const bad of [undefined, null, '', 'ELEANOR', '__proto__', 42]) assert.equal(findGhost(bad), undefined);
});

test('the browser never sees secrets, clues or prompts', () => {
  const pub = JSON.stringify(publicGhosts());
  for (const g of GHOSTS) {
    assert.ok(!pub.includes(g.secret));
    for (const c of g.clues) assert.ok(!pub.includes(c));
  }
  assert.deepEqual(Object.keys(publicGhosts()[0]!).sort(), ['epitaph', 'id', 'name']);
});

test('every prompt names every tool and teaches Drama 3 brackets', () => {
  for (const g of GHOSTS) {
    const p = buildPrompt(g);
    for (const t of TOOLS) assert.ok(p.includes(t.name), `${g.id} prompt is missing ${t.name}`);
    assert.match(p, /square brackets/);
    assert.ok(p.includes(g.secret));
  }
});

test('session request overrides exactly the allowed fields', () => {
  const g = GHOSTS[0]!;
  const req = sessionRequest(g, 'agent123');
  assert.equal(req.agent_id, 'agent123');
  assert.deepEqual(Object.keys(req.overrides).sort(), ['first_message', 'system_prompt', 'voice_id']);
  assert.equal(req.overrides.voice_id, g.voiceId);
});
