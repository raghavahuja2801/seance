/**
 * Spike: with tts_model=drama-3 and expressive=true, what does the agent's LLM
 * actually write? Drama 3 wants `[free-text direction]` and `<whisper>…</whisper>`;
 * the worker's expressive guide may teach a different tag dialect.
 *
 * Runs a text-only next_reply test against the agent's DRAFT config (no session
 * overrides), prints the raw replies, then deletes the test.
 *
 *   node --env-file=.env scripts/spike-directions.ts
 */
import { fish } from '../src/fish.ts';

const agentId = process.env.SEANCE_AGENT_ID;
if (!agentId) throw new Error('SEANCE_AGENT_ID is not set; run `npm run provision` first');

const test = await fish<{ test_id: string }>('POST', '/v1/agent/tests', {
  name: 'spike: drama-3 direction syntax',
  test_type: 'next_reply',
  agent_ids: [agentId],
  conversation: [
    { role: 'agent', text: 'Who... disturbs my rest?' },
    { role: 'user', text: "It's just us. We want to know how you died. Were you murdered?" },
  ],
  expectation: 'The spirit answers in an eerie, emotional way.',
});

try {
  const batch = await fish<{ batch_id: string }>('POST', `/v1/agent/agents/${agentId}/tests/run`, {
    test_ids: [test.test_id],
    repeat_count: 3,
  });
  type Run = { run_id: string; status: string; agent_reply?: string | null; error?: unknown };
  let runs: Run[] = [];
  for (let i = 0; i < 60; i++) {
    ({ runs } = await fish<{ runs: Run[] }>('GET', `/v1/agent/test-runs?batch_id=${batch.batch_id}&page_size=10`));
    if (runs.length === 3 && runs.every((r) => !['queued', 'running', 'pending'].includes(r.status))) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  // The list returns summaries; agent_reply is only on the single-run endpoint.
  for (const { run_id } of runs) {
    const r = await fish<Run>('GET', `/v1/agent/test-runs/${run_id}`);
    console.log(`--- [${r.status}]\n${r.agent_reply ?? JSON.stringify(r.error)}`);
  }
} finally {
  await fish('DELETE', `/v1/agent/tests/${test.test_id}`);
}
