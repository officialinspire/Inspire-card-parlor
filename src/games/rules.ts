import type { GameId } from '@/core/types';

/** Player-facing rules, matching the engines exactly (see WarGame.ts / GoFishGame.ts). */
export const RULES: Partial<Record<GameId, { title: string; sections: [string, string][] }>> = {
  klondike: {
    title: 'How to play Klondike',
    sections: [
      ['Goal', 'Move all 52 cards to the four foundations, building each suit up from Ace to King.'],
      ['The deal', 'Seven columns of 1 to 7 cards, the top card of each face up. The rest form the stock.'],
      [
        'Stock',
        'Tap the stock to turn 1 card (Draw 1) or 3 cards (Draw 3) onto the waste. Only the top waste card can be played. When the stock runs out, tap it to turn the waste back over.',
      ],
      [
        'Columns',
        'Build down in alternating colours (a red 7 on a black 8). You can move a whole run that follows this rule. Only a King, or a run starting with a King, may fill an empty column.',
      ],
      ['Turning up', 'When you uncover a face-down card it turns over by itself.'],
      ['Foundations', 'Build up by suit from the Ace. You may move the top foundation card back down onto a column.'],
      ['Finishing', 'Once the stock is empty and every card is face up, Auto-finish plays the rest.'],
      ['Scoring', 'Waste to column +5, to a foundation +10, turning a card up +5, foundation back to a column −15.'],
    ],
  },
  spider: {
    title: 'How to play Spider',
    sections: [
      ['Goal', 'Build eight runs from King down to Ace in a single suit. Each complete run is cleared away.'],
      [
        'The deck',
        'Two decks (104 cards). One-suit games use only spades, two-suit spades and hearts, four-suit all suits.',
      ],
      [
        'The deal',
        'Ten columns: the first four get six cards, the rest five. Only the top card shows. 50 cards stay in the stock.',
      ],
      [
        'Moving',
        'Any card can go on a card one rank higher, whatever the suit. A group of cards only moves together if it is a run of one suit.',
      ],
      ['Empty columns', 'Any card or single-suit run can go into an empty column.'],
      ['Dealing', 'Tap the stock to deal one card onto every column. You can’t deal while a column is empty.'],
      ['Clearing', 'A complete King-to-Ace run of one suit is removed at once, and the card beneath turns over.'],
      ['Scoring', 'Start at 500. Each move or deal costs 1; each cleared run earns 100.'],
    ],
  },
  freecell: {
    title: 'How to play FreeCell',
    sections: [
      ['Goal', 'Move all 52 cards to the four foundations, building each suit up from Ace to King.'],
      ['The deal', 'Every card is dealt face up into eight columns.'],
      ['Free cells', 'The four cells at the top each hold one card while you work.'],
      ['Columns', 'Build down in alternating colours. Any card can go into an empty column.'],
      [
        'Moving runs',
        'You can move a run of several cards at once if there is room to do it one card at a time: up to (empty free cells + 1) × 2 for each empty column. An empty column you are moving into doesn’t count.',
      ],
      ['Foundations', 'Build up by suit from the Ace. Cards on the foundations stay there.'],
      ['Scoring', '+10 for every card on a foundation.'],
    ],
  },
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
