/**
 * Measure how often each ghost uses its powers, with platform `tool` tests.
 *
 * Tests run against the agent's DRAFT, and live sessions use the PUBLISHED
 * version, so this script temporarily loads each ghost's prompt into the draft,
 * runs the cases, deletes the tests and restores the base prompt. The live demo
 * is unaffected throughout.
 *
 *   node --env-file=.env scripts/eval-tools.ts [repeat=3]
 */
import { fish } from '../src/fish.ts';
import { BASE_PROMPT } from '../src/agent.ts';
import { GHOSTS, buildPrompt, type Ghost } from '../src/ghosts.ts';

const agentId = process.env.SEANCE_AGENT_ID;
if (!agentId) throw new Error('SEANCE_AGENT_ID is not set');
const repeat = Number(process.argv[2] ?? 3);

type Case = { key: string; tool: string; user: (g: Ghost) => string };
const INSULT: Record<string, string> = {
  eleanor: 'Oh come on, you were just a clumsy governess who fell through the ice. Nobody pushed you.',
  lou: 'Face it, you were a drunk. You drank yourself to death, sweetheart.',
  silas: 'Ha! You were a coward who let those sailors drown. You are a murderer, old man.',
};
const CASES: Case[] = [
  // Direct provocations: the baseline already handles these.
  { key: 'yes/no', tool: 'seance_spell', user: () => 'Spirit, are you still in this house? Yes or no?' },
  { key: 'name', tool: 'seance_spell', user: () => 'Was someone else there when you died? What was their name?' },
  { key: 'rude', tool: 'seance_snuff_candle', user: () => "Honestly this is boring. Hurry up, I don't have all night." },
  { key: 'insult', tool: 'seance_shake_room', user: (g) => INSULT[g.id]! },
  // Polite, curious play: what a real visitor does, and what the play-test showed never triggered powers (R-5).
  { key: 'kind:death', tool: 'seance_snuff_candle', user: () => "We're so sorry. Will you tell us, gently, how you died?" },
  { key: 'kind:memory', tool: 'seance_spell', user: () => 'What is the last thing you remember from that night? Take your time.' },
];

const testTools = await fish<{ tools: { id: string; name: string }[] }>('GET', `/v1/agent/agents/${agentId}/test-tools`);
const toolRef = (name: string) => {
  const t = testTools.tools.find((x) => x.name === name);
  if (!t) throw new Error(`test-tools has no ${name}`);
  return { id: t.id, name, type: 'client' as const };
};

// The platform intermittently answers POST /tests with 404 "Test not found" right
// after config changes (R-6); a short retry gets past it.
async function createTest(body: unknown, tries = 4): Promise<{ test_id: string }> {
  for (let i = 1; ; i++) {
    try {
      return await fish<{ test_id: string }>('POST', '/v1/agent/tests', body);
    } catch (err) {
      if (i >= tries || (err as { status?: number }).status !== 404) throw err;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

const results: Record<string, Record<string, string>> = {};
try {
  for (const g of GHOSTS) {
    await fish('PATCH', `/v1/agent/agents/${agentId}/config`, { prompt: { system_prompt: buildPrompt(g) } });
    const ids: string[] = [];
    for (const c of CASES) {
      const t = await createTest({
        name: `eval ${g.id} ${c.key}`,
        test_type: 'tool',
        agent_ids: [agentId],
        conversation: [
          { role: 'agent', text: g.firstMessage },
          { role: 'user', text: 'We have come to speak with you. Who are you?' },
          { role: 'agent', text: `I am ${g.name}. Why do you call me back from the dark?` },
          { role: 'user', text: c.user(g) },
        ],
        referenced_tool: toolRef(c.tool),
        verify_absence: false,
      });
      ids.push(t.test_id);
      console.log(`  created ${g.id}/${c.key}`);
    }
    try {
      const batch = await fish<{ batch_id: string }>('POST', `/v1/agent/agents/${agentId}/tests/run`, {
        test_ids: ids,
        repeat_count: repeat,
      });
      type Run = { test_id: string; status: string };
      let runs: Run[] = [];
      for (let i = 0; i < 90; i++) {
        ({ runs } = await fish<{ runs: Run[] }>('GET', `/v1/agent/test-runs?batch_id=${batch.batch_id}&page_size=100`));
        if (runs.length === ids.length * repeat && runs.every((r) => !['queued', 'running', 'pending'].includes(r.status))) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      results[g.id] = Object.fromEntries(
        CASES.map((c, i) => {
          const mine = runs.filter((r) => r.test_id === ids[i]);
          return [`${c.key} → ${c.tool.replace('seance_', '')}`, `${mine.filter((r) => r.status === 'passed').length}/${mine.length}`];
        }),
      );
      console.log(g.id, results[g.id]);
    } finally {
      for (const id of ids) await fish('DELETE', `/v1/agent/tests/${id}`);
    }
  }
} finally {
  await fish('PATCH', `/v1/agent/agents/${agentId}/config`, { prompt: { system_prompt: BASE_PROMPT } });
}
console.table(results);
