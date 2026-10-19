import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, agentConfig } from '../src/agent.ts';

test('client tool names satisfy the platform naming rule and are unique', () => {
  const names = TOOLS.map((t) => t.name);
  for (const n of names) assert.match(n, /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/);
  assert.equal(new Set(names).size, names.length);
});

test('agent config speaks with Drama 3 and wires every tool plus hang-up', () => {
  const cfg = agentConfig(['a', 'b']);
  assert.equal(cfg.voice.tts_model, 'drama-3');
  assert.deepEqual(cfg.tools.tool_ids, ['a', 'b']);
  assert.equal(cfg.tools.system_tools.hang_up_call, true);
});
