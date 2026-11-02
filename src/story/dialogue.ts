import type { DialogueLine } from './types';

/**
 * Dialogue pacing for the scene dialog: a beat longer than `max` characters
 * is shown as consecutive panels, split between sentences, so a panel never
 * holds a wall of text on a small phone. Only the presentation changes —
 * the campaign data is untouched, the speaker and pose carry over, and a
 * discovered clue appears with the last panel (where its sentence ends).
 */
export const PANEL_MAX_CHARS = 180;

/** Sentences, keeping their closing punctuation and any closing quote or dash. */
function sentences(text: string): string[] {
  const parts = text.match(/[^.!?…]+(?:[.!?…]+[”’"')\]]*|$)\s*/g) ?? [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Splits one text into panels of at most `max` characters where sentences allow (a single long sentence stays whole). */
export function splitText(text: string, max = PANEL_MAX_CHARS): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences(text)) {
    if (cur && cur.length + 1 + s.length > max) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  // Never leave a tiny last panel: fold it back if the two still fit comfortably.
  if (out.length > 1 && out.at(-1)!.length < 40 && out.at(-2)!.length + out.at(-1)!.length < max * 1.25)
    out.splice(-2, 2, `${out.at(-2)} ${out.at(-1)}`);
  return out;
}

export function paceDialogue(lines: readonly DialogueLine[], max = PANEL_MAX_CHARS): DialogueLine[] {
  return lines.flatMap((line) => {
    const parts = splitText(line.text, max);
    if (parts.length === 1) return [line];
    return parts.map((text, i): DialogueLine => {
      const { discovers, ...rest } = line;
      return { ...rest, text, ...(i === parts.length - 1 && discovers ? { discovers } : {}) };
    });
  });
}
