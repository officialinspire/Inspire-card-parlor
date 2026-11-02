import { CHARACTERS } from './cast';
import {
  EPILOGUE,
  EPILOGUE_TITLE,
  NARRATOR,
  STAMPS,
  STORY_CHAPTERS,
  type DialogueLine,
  type StoryReward,
} from './campaign';
import { EVIDENCE } from './evidence';
import { LOCATIONS } from './locations';
import type { InfoCard } from './types';

/**
 * The complete script of THE THIRTEENTH HAND as Markdown, generated from the
 * campaign data so the document can never drift from the game
 * (docs/STORY_SCRIPT_COMPLETE.md; `npm run story:script` rewrites it, and a
 * unit test checks it is current).
 */

const name = (id: string) => CHARACTERS.find((c) => c.id === id)?.name ?? id;
const evidenceName = (id: string) => EVIDENCE.find((e) => e.id === id)?.name ?? id;

function line(l: DialogueLine): string {
  const found = l.discovers ? ` **[Clue: ${evidenceName(l.discovers)}]**` : '';
  if (l.who === NARRATOR) return `> _${l.text}_${found}`;
  const pose = l.pose ? ` _(${l.pose})_` : '';
  return `> **${name(l.who)}**${pose}: ${l.text}${found}`;
}

const scene = (title: string, lines: readonly DialogueLine[]) =>
  lines.length ? [`**${title}**`, '', ...lines.flatMap((l) => [line(l), '>']).slice(0, -1), ''] : [];

function reward(r: StoryReward): string {
  switch (r.kind) {
    case 'credits':
      return `${r.amount} credits`;
    case 'xp':
      return `${r.amount} XP`;
    case 'evidence':
      return `clue: ${evidenceName(r.id)}`;
    case 'stamp':
      return `passport stamp (${STAMPS.find((s) => s.id === r.id)?.label ?? r.id})`;
    default:
      return `${r.kind}: ${r.id}`;
  }
}

const note = (n: InfoCard) =>
  `- **${n.title}** (${n.kind === 'note' ? 'about the story' : n.kind}): ${n.text}${n.source ? ` _Source: ${n.source}._` : ''}`;

export function storyScriptMarkdown(): string {
  const out: string[] = [
    '# The Thirteenth Hand — complete script',
    '',
    '<!-- Generated from src/story/*.ts by `npm run story:script`. Do not edit by hand: change the campaign data and regenerate. -->',
    '',
    'Every scene of the campaign, in play order: each chapter’s arrival, each challenge’s scene before and after the game, the chapter’s departure, and the epilogue. The player is a silent observer — narration (in italics) speaks to them in the second person; they never speak.',
    '',
    'Poses in brackets are the character’s expression for that line. **[Clue]** marks the moment a piece of evidence is added to the journal.',
    '',
    '**History and legend.** Field notes marked _history_ are documented and give a source. Notes marked _about the story_ say what is invented. The ghosts, the card, Operation Thirteenth Hand, the tunnels and the unfinished game are fiction.',
    '',
    '## Contents',
    '',
    ...STORY_CHAPTERS.map((c) => `${c.index}. Chapter ${c.index}: ${c.title} — ${c.location}`),
    `10. ${EPILOGUE_TITLE}`,
    '',
  ];
  for (const c of STORY_CHAPTERS) {
    const loc = LOCATIONS.find((l) => l.id === c.locationId);
    out.push(
      `## Chapter ${c.index}: ${c.title}`,
      '',
      `**Place:** ${c.location} (${loc?.kind ?? 'fictional'}). **Host:** ${name(c.hostId)}. **Cast:** ${c.cast.map(name).join(', ')}. **Music:** ${c.music}.`,
      '',
      `_${c.description}_`,
      '',
      `**The mystery so far:** ${c.mysteryThread}`,
      '',
      ...scene('Arrival', c.intro),
    );
    for (const l of c.levels) {
      const opp = [l.setup.options?.opponent, ...(l.setup.options?.opponents ?? [])].filter(Boolean) as string[];
      out.push(
        `### ${c.index}.${l.number} ${l.title}${l.finale ? ' (finale)' : ''}`,
        '',
        `**Game:** ${l.game}${opp.length ? ` against ${opp.map(name).join(', ')}` : ''}. **Objective:** ${l.objectiveText} **Table:** ${l.setup.deckId} deck on ${l.setup.boardId}${l.setup.seed !== undefined ? `, deal ${l.setup.seed} (verified winnable)` : ', a fresh deal each try at an Easy table'}.`,
        '',
        ...scene('Before', l.intro),
      );
      if (l.puzzle)
        out.push(
          `**Puzzle:** _${l.puzzle.prompt}_ Answer: ${l.puzzle.answer.join(', ')}.`,
          '',
          ...scene('Hints after each wrong try (the last repeats)', l.puzzle.hints),
          ...scene('Solved', l.puzzle.solved),
        );
      out.push(...scene('After the win', l.outro));
      out.push(`**Rewards:** ${l.rewards.map(reward).join(', ')}.`, '');
      if (l.info?.length) out.push('**Field notes:**', '', ...l.info.map(note), '');
    }
    out.push(...scene('Departure', c.outro));
    out.push(`**Chapter rewards:** ${c.rewards.map(reward).join(', ')}.`, '');
    if (c.info?.length) out.push('**Chapter notes:**', '', ...c.info.map(note), '');
  }
  out.push(`## ${EPILOGUE_TITLE}`, '', ...scene('After the thirteenth hand', EPILOGUE));
  out.push(
    '## Evidence',
    '',
    '| Clue | Chapter | Kind | Importance | Description |',
    '| --- | --- | --- | --- | --- |',
    ...EVIDENCE.map(
      (e) => `| ${e.name} | ${e.chapter.replace('th-', '')} | ${e.kind} | ${e.importance} | ${e.description} |`,
    ),
    '',
  );
  return out.join('\n');
}
