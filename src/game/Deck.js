import { SUITS, RANKS } from './constants';

// Cards are plain objects { id, suit, rank, deck } so they can be stored in
// Supabase as JSON and sent between players without any conversion.

export class Deck {
  static KITTY_SIZE = 6;
  static PLAYERS = 4;

  constructor(numDecks = 3) {
    this.cards = Deck.build(numDecks);
  }

  // 3 standard decks with jokers: 3 × 54 = 162 cards.
  static build(numDecks = 3) {
    const cards = [];
    let id = 0;
    for (let d = 0; d < numDecks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          cards.push({ id: id++, suit, rank, deck: d });
        }
      }
      cards.push({ id: id++, suit: 'JOKER', rank: 'BIG', deck: d });
      cards.push({ id: id++, suit: 'JOKER', rank: 'SMALL', deck: d });
    }
    return cards;
  }

  // Fisher–Yates shuffle. Returns a new array and leaves the input alone.
  static shuffle(cards, random = Math.random) {
    const a = [...cards];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Shuffle, set aside the kitty, and return the order cards are dealt in:
  // { sequence: [{ seat, card }], kitty }. startSeat gets the first card.
  dealSequential(startSeat = 0, random = Math.random) {
    const shuffled = Deck.shuffle(this.cards, random);
    const kitty = shuffled.slice(0, Deck.KITTY_SIZE);
    const sequence = shuffled
      .slice(Deck.KITTY_SIZE)
      .map((card, i) => ({ seat: (startSeat + i) % Deck.PLAYERS, card }));
    return { sequence, kitty };
  }
}
