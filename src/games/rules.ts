import type { GameId } from '@/core/types';

/** Player-facing rules, matching the engines exactly (see WarGame.ts / GoFishGame.ts). */
export const RULES: Partial<Record<GameId, { title: string; sections: [string, string][] }>> = {
  war: {
    title: 'How to play War',
    sections: [
      ['The deal', 'A standard 52-card deck is split evenly: 26 cards each, face down.'],
      ['Each round', 'You both turn over your top card. The higher card wins both. Aces are high; suits don’t matter.'],
      [
        'War',
        'If the cards tie, each player puts three cards face down and turns a fourth face up. The higher face-up card takes everything. Another tie means another war.',
      ],
      [
        'Running low',
        'Short of cards for a war? Put down all but your last card and turn that one up. If you have no card left to turn, you lose.',
      ],
      ['Winnings', 'Cards you win are shuffled and go to the bottom of your pile.'],
      ['Winning', 'Win every card in the deck.'],
    ],
  },
  'go-fish': {
    title: 'How to play Go Fish',
    sections: [
      ['The deal', 'Seven cards each with 2 or 3 players, five each with 4. The rest is the pond.'],
      ['Asking', 'On your turn, ask one opponent for a rank you already hold.'],
      ['Got some', 'They must hand over every card of that rank, and you ask again.'],
      [
        'Go fish',
        'If they have none, draw from the pond. Drew the rank you asked for? Show it and ask again. Otherwise your turn ends.',
      ],
      ['Books', 'Collect all four cards of a rank and lay them down as a book right away.'],
      [
        'Empty hand',
        'If your hand is empty when it’s your turn to ask, draw one card and carry on. If the pond is empty too, you sit out the rest of the game.',
      ],
      ['No one to ask', 'If every opponent’s hand is empty, draw a card instead of asking; your turn ends.'],
      ['Empty pond', 'If you must go fishing and the pond is empty, nothing is drawn and your turn ends.'],
      ['Winning', 'When all 13 books are down, the most books wins. Equal books share the win.'],
    ],
  },
};
