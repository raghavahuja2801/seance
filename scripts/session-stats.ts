/**
 * How expressive and how fast are the ghosts in real sessions? Reads the agent's
 * session history (no cost) and reports per ghost:
 *  - tool-first %: a tool call landed before the spoken reply, i.e. the LLM answered with
 *    tools only and the line was written in a later call. Those lines came out flatter and
 *    slower (research R-11). This is the number to push down.
 *  - one-call %: for reference only. The platform always makes a follow-up LLM call after
 *    any tool runs, so this stays low whenever a ghost uses its powers, whatever the order.
 *  - <tags> %: replies using paired Drama 3 tags. The platform strips [bracket]
 *    directions from stored text, so this is the only visible proxy for expressiveness.
 *
 *   node --env-file=.env scripts/session-stats.ts [sinceMinutes=60]
 */
import { fish } from '../src/fish.ts';

type Item = {
  type: string;
  role?: string;
  content?: string;
  created_at: string;
  llm_usage?: { call_count?: number };
};

const agentId = process.env.SEANCE_AGENT_ID;
if (!agentId) throw new Error('SEANCE_AGENT_ID is not set');
const since = Date.now() - Number(process.argv[2] ?? 60) * 60_000;

const { sessions } = await fish<{ sessions: { session_id: string; created_at: string; metadata?: { ghost?: string } }[] }>(
  'GET',
  `/v1/agent/sessions?agent_id=${agentId}&page_size=100`,
);
const stats: Record<string, { replies: number; oneCall: number; toolFirst: number; tagged: number }> = {};
for (const s of sessions.filter((x) => Date.parse(x.created_at) >= since)) {
  const st = (stats[s.metadata?.ghost ?? '?'] ??= { replies: 0, oneCall: 0, toolFirst: 0, tagged: 0 });
  const { items } = await fish<{ items: Item[] }>('GET', `/v1/agent/sessions/${s.session_id}`);
  let afterUser = false;
  let sawTool = false;
  for (const i of items) {
    if (i.type === 'message' && i.role === 'user') [afterUser, sawTool] = [true, false];
    else if (i.type === 'tool_call') sawTool = true;
    else if (i.type === 'message' && i.role === 'assistant' && afterUser) {
      st.replies++;
      if (i.llm_usage?.call_count === 1) st.oneCall++;
      if (sawTool) st.toolFirst++;
      if (/<(whisper|emphasis|soft|fast|slow|stress|forceful)>/.test(i.content ?? '')) st.tagged++;
      afterUser = false;
    }
  }
}

const pct = (n: number, d: number) => `${String(Math.round((100 * n) / d)).padStart(3)}%`;
console.log('ghost      replies  one-call  tool-first  <tags>');
for (const [g, s] of Object.entries(stats)) {
  if (s.replies) console.log(`${g.padEnd(9)} ${String(s.replies).padStart(7)}  ${pct(s.oneCall, s.replies).padStart(8)}  ${pct(s.toolFirst, s.replies).padStart(10)}  ${pct(s.tagged, s.replies).padStart(6)}`);
}
