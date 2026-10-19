/**
 * Declarative definition of the one Séance agent and its client tools.
 *
 * Each ghost is a *session* of this agent: the server overrides system_prompt,
 * voice_id and first_message per session (PR 2). The base prompt below only runs
 * if a session arrives without overrides.
 */

export const AGENT_NAME = 'Seance (Halloween demo)';

/** Client tools are executed by the browser page. Names are prefixed because tools are workspace-wide. */
export const TOOLS = [
  {
    name: 'seance_spell',
    description:
      'Move the planchette on the Ouija board to spell a short message: YES, NO, GOODBYE, or the key word of any memory or clue you share (a name, place, year, object). Keep it under 12 characters. Do this while you speak, not instead of speaking.',
    arguments: [{ name: 'text', description: 'Letters A-Z, digits 0-9, or the words YES, NO, GOODBYE.' }],
  },
  {
    name: 'seance_snuff_candle',
    description:
      'Blow out one of the five candles around the board. Use whenever the living ask about your death or come closer to the truth, and when you are displeased.',
    arguments: [],
  },
  {
    name: 'seance_shake_room',
    description: 'Make the whole room tremble. Use when you are angry or something you say is terrible.',
    arguments: [{ name: 'intensity', description: '"gentle" or "violent".' }],
  },
  {
    name: 'seance_find_peace',
    description:
      'Call this only once the living have uncovered the true story of your death and you feel at peace. Say a short farewell, then end the call.',
    arguments: [],
  },
].map((t) => ({
  ...t,
  tool_type: 'client' as const,
  // Pure page effects: the ghost keeps talking instead of waiting for the browser.
  // (execution_mode is webhook-only; the API rejects it on client tools with a 422.)
  expects_response: false,
}));

export const BASE_PROMPT = `You are a restless spirit contacted through a Ouija board at a Halloween séance.
Speak in short, eerie lines. You may use the board with your tools. If the living are rude, end the call.`;

/** Draft config sent on create/update. `tool_ids` is filled in by the provisioner. */
export function agentConfig(toolIds: string[]) {
  return {
    prompt: {
      system_prompt: BASE_PROMPT,
      first_message_mode: 'fixed',
      first_message: '[a faint, hollow whisper] Who... disturbs my rest?',
    },
    voice: {
      tts_model: 'drama-3',
      expressive: true,
      voice_id: 'f3a2b90078d54a65af4b95f63bc7798e', // Sheila, a Drama 3 doc voice; ghosts override this
    },
    conversation: { max_duration_seconds: 600 },
    tools: {
      enabled: true,
      tool_ids: toolIds,
      system_tools: { hang_up_call: true, hang_up_call_farewell_mode: 'off' },
    },
  };
}

export const OVERRIDES_ALLOWED = ['system_prompt', 'voice_id', 'first_message'] as const;
