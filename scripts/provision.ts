/**
 * Idempotently create or update the Séance agent and its client tools, then
 * publish only if the draft differs from the latest published version.
 *
 *   npm run provision
 */
import { fish } from '../src/fish.ts';
import { AGENT_NAME, OVERRIDES_ALLOWED, TOOLS, agentConfig } from '../src/agent.ts';

type Tool = { tool_id: string; name: string };
type Agent = { agent_id: string; name: string; publication_state: string };

async function upsertTool(def: (typeof TOOLS)[number]): Promise<string> {
  const { tools } = await fish<{ tools: Tool[] }>('GET', `/v1/agent/tools?search=${encodeURIComponent(def.name)}&page_size=50`);
  const existing = tools.find((t) => t.name === def.name);
  if (existing) {
    const { tool_type: _, ...patch } = def; // tool_type is create-only; PATCH rejects it with a 422
    await fish('PATCH', `/v1/agent/tools/${existing.tool_id}`, patch);
    console.log(`tool  ${def.name}: updated ${existing.tool_id}`);
    return existing.tool_id;
  }
  const created = await fish<Tool>('POST', '/v1/agent/tools', def);
  console.log(`tool  ${def.name}: created ${created.tool_id}`);
  return created.tool_id;
}

const toolIds: string[] = [];
for (const def of TOOLS) toolIds.push(await upsertTool(def));

const { agents } = await fish<{ agents: Agent[] }>('GET', `/v1/agent/agents?search=${encodeURIComponent('Seance')}&page_size=50`);
let agent = agents.find((a) => a.name === AGENT_NAME);
if (agent) {
  await fish('PATCH', `/v1/agent/agents/${agent.agent_id}/config`, agentConfig(toolIds));
  console.log(`agent ${agent.agent_id}: draft updated`);
} else {
  agent = await fish<Agent>('POST', '/v1/agent/agents', {
    name: AGENT_NAME,
    description: 'Halloween Ouija-board demo. Ghosts are per-session overrides. Managed by experiments/seance/scripts/provision.ts.',
    config: agentConfig(toolIds),
  });
  console.log(`agent ${agent.agent_id}: created`);
}
await fish('PATCH', `/v1/agent/agents/${agent.agent_id}`, { overrides_allowed: OVERRIDES_ALLOWED });

const draft = await fish<{ config_hash: string; voice: Record<string, unknown>; llm: { model: string } }>('GET', `/v1/agent/agents/${agent.agent_id}/config`);
const { versions } = await fish<{ versions: { version_number: number; config_hash: string }[] }>(
  'GET',
  `/v1/agent/agents/${agent.agent_id}/versions?page_size=100`,
);
// shortcut: assumes the latest version is in the first 100; fine for a demo agent.
const latest = versions.reduce<(typeof versions)[number] | undefined>((a, v) => (!a || v.version_number > a.version_number ? v : a), undefined);

if (latest?.config_hash === draft.config_hash) {
  console.log(`agent ${agent.agent_id}: already published as v${latest.version_number}, nothing to do`);
} else {
  const pub = await fish<{ version_number: number }>('POST', `/v1/agent/agents/${agent.agent_id}/publish`, {
    version_title: 'provision.ts',
  });
  console.log(`agent ${agent.agent_id}: published v${pub.version_number}`);
}

if (draft.voice.tts_model !== 'drama-3') throw new Error(`voice.tts_model is ${String(draft.voice.tts_model)}, expected drama-3`);
if (draft.llm.model !== agentConfig([]).llm.model) throw new Error(`llm.model is ${draft.llm.model}, expected ${agentConfig([]).llm.model}`);
console.log(`\nSEANCE_AGENT_ID=${agent.agent_id}`);
