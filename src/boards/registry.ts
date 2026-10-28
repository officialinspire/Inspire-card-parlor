export interface BoardDefinition {
  id: string;
  name: string;
  description: string;
  /** Layered CSS background for the table surface. */
  felt: string;
  rim: string;
  unlock: { type: 'default' | 'level' | 'achievement' | 'story'; value?: number | string };
}

export const BOARDS: readonly BoardDefinition[] = [
  {
    id: 'velvet-green',
    name: 'Velvet Green',
    description: 'Classic parlor felt under a warm lamp.',
    felt: 'radial-gradient(120% 90% at 50% 35%, #2f7a4f 0%, #1d5236 55%, #10301f 100%)',
    rim: '#5a3a22',
    unlock: { type: 'default' },
  },
  {
    id: 'oxblood-lounge',
    name: 'Oxblood Lounge',
    description: 'Rich burgundy baize from the back room.',
    felt: 'radial-gradient(120% 90% at 50% 35%, #7d2a33 0%, #521820 55%, #2a0b10 100%)',
    rim: '#3b2516',
    unlock: { type: 'level', value: 2 },
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    description: 'Cool navy felt for late-night patience.',
    felt: 'radial-gradient(120% 90% at 50% 35%, #2b4a7a 0%, #1a2f52 55%, #0c172b 100%)',
    rim: '#2a2a33',
    unlock: { type: 'level', value: 5 },
  },
  {
    id: 'walnut-study',
    name: 'Walnut Study',
    description: 'Polished hardwood with a leather inlay.',
    felt: 'radial-gradient(110% 80% at 50% 40%, #6b4a2e 0%, #4a321f 60%, #2a1b10 100%)',
    rim: '#1f140c',
    unlock: { type: 'story', value: 'chapter-3' },
  },
  {
    id: 'rose-quartz',
    name: 'Rose Quartz',
    description: 'Soft blush felt, made for cozy evenings.',
    felt: 'radial-gradient(120% 90% at 50% 35%, #b77a86 0%, #8c5562 55%, #4f2d36 100%)',
    rim: '#4a2c2f',
    unlock: { type: 'achievement', value: 'collector-5' },
  },
];

export const getBoard = (id: string) => BOARDS.find((b) => b.id === id) ?? BOARDS[0]!;
