// Pure helpers shared by the page and the Node tests. No DOM access here.

export const BOARD_WORDS = ['YES', 'NO', 'GOODBYE'];
const MAX_SPELL = 16;

/**
 * Turn the ghost's seance_spell argument (model output, untrusted) into planchette stops.
 * Whole board words go straight to their spot; anything else becomes letters/digits,
 * with ' ' meaning "lift and pause".
 */
export function spellSteps(raw) {
  const text = String(raw ?? '').toUpperCase().trim();
  if (BOARD_WORDS.includes(text)) return [text];
  const chars = text.replace(/[^A-Z0-9 ]/g, '').replace(/ +/g, ' ').slice(0, MAX_SPELL);
  return [...chars];
}

/** Remove Drama 3 performance markup so captions show only the spoken words. */
export function stripDirections(text) {
  return String(text ?? '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/<\|[^|]*\|>/g, ' ')
    .replace(/<\/?[a-z]+>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function intensityOf(value) {
  return value === 'violent' ? 'violent' : 'gentle';
}

/** Board layout in % of the board box. Letters sit on two shallow arcs, as on a real Ouija board. */
export function boardLayout() {
  const spots = { YES: { x: 13, y: 13, r: -8 }, NO: { x: 87, y: 13, r: 8 }, GOODBYE: { x: 50, y: 90, r: 0 } };
  const arc = (letters, baseY) =>
    [...letters].forEach((ch, i, all) => {
      const t = (i / (all.length - 1)) * 2 - 1; // -1 .. 1
      spots[ch] = { x: 50 + t * 41, y: baseY - 9 * (1 - t * t), r: t * 18 };
    });
  arc('ABCDEFGHIJKLM', 44);
  arc('NOPQRSTUVWXYZ', 63);
  [...'1234567890'].forEach((d, i) => (spots[d] = { x: 26 + i * 5.33, y: 77, r: 0 }));
  return spots;
}
