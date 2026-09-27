import { SUITS, RANKS } from './constants';

// Everything about how cards compare depends on the current trump suit and
// trump number (the level being played). TrumpRules holds those two values
// and answers questions about cards and combos under them.
//
//   const rules = new TrumpRules('♥', '7');
//   rules.isTrump(card); rules.detectCombo(cards); ...

export class TrumpRules {
  constructor(trumpSuit, trumpNumber) {
    this.trumpSuit = trumpSuit;
    this.trumpNumber = trumpNumber;
    this._trumpSlotMap = null;
  }

  // ── Single cards ──────────────────────────────────────────────────────────

  isTrump(card) {
    if (card.suit === 'JOKER') return true;
    if (card.rank === this.trumpNumber) return true;
    if (this.trumpSuit && card.suit === this.trumpSuit) return true;
    return false;
  }

  // Strength among trump cards (higher = stronger).
  trumpRank(card) {
    if (card.suit === 'JOKER' && card.rank === 'BIG') return 1000;
    if (card.suit === 'JOKER' && card.rank === 'SMALL') return 999;
    if (card.rank === this.trumpNumber && card.suit === this.trumpSuit) return 998;
    // Trump numbers in the other suits all have the same rank.
    if (card.rank === this.trumpNumber) return 997;
    return RANKS.indexOf(card.rank); // ordinary trump-suit card
  }

  // Strength within a non-trump suit.
  static suitRank(card) {
    return RANKS.indexOf(card.rank);
  }

  // Trump strength for trump cards, suit strength otherwise.
  rankOf(card) {
    return this.isTrump(card) ? this.trumpRank(card) : TrumpRules.suitRank(card);
  }

  // Sort order for displaying a hand: non-trump by suit then rank, then trump.
  compareForHand(a, b, suitOrder = ['♠', '♥', '♣', '♦']) {
    const aTrump = this.isTrump(a);
    const bTrump = this.isTrump(b);
    if (!aTrump && !bTrump) {
      const sd = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (sd !== 0) return sd;
      return TrumpRules.suitRank(a) - TrumpRules.suitRank(b);
    }
    if (!aTrump && bTrump) return -1;
    if (aTrump && !bTrump) return 1;
    // Equal-rank trump numbers are grouped by suit so the hand looks tidy.
    return this.trumpRank(a) - this.trumpRank(b) || suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
  }

  // ── Grouping ──────────────────────────────────────────────────────────────

  // Cards with the same key are interchangeable for pairs and triples.
  cardKey(card) {
    if (card.suit === 'JOKER') return `JOKER_${card.rank}`;
    if (card.rank === this.trumpNumber && card.suit === this.trumpSuit) return 'TRUMP_NUM_TRUMP_SUIT';
    if (card.rank === this.trumpNumber) return `TRUMP_NUM_${card.suit}`;
    return `${card.suit}_${card.rank}`;
  }

  // { key: [cards] }
  groupByKey(cards) {
    const groups = {};
    for (const card of cards) {
      const key = this.cardKey(card);
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    }
    return groups;
  }

  // { key: count }
  countByKey(cards) {
    const counts = {};
    for (const card of cards) {
      const key = this.cardKey(card);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  // Number of distinct keys with at least minSize cards.
  countGroups(cards, minSize) {
    return Object.values(this.countByKey(cards)).filter((count) => count >= minSize).length;
  }

  // ── Rank order ("slots") ──────────────────────────────────────────────────
  //
  // Tractors need consecutive ranks, so every card key maps to a slot number.
  // Keys in the same slot have equal rank (e.g. ♠7 and ♦7 when 7 is the level
  // and ♥ is trump), so they can never form a tractor with each other.
  //
  // Trump slots, weakest → strongest:
  //   trump-suit 2 … A (skipping the trump number)
  //   trump number in the other suits (one shared slot)
  //   trump number in the trump suit
  //   small joker, big joker
  // With no trump suit (jokers were declared) only the last three exist.

  get trumpSlotMap() {
    if (this._trumpSlotMap) return this._trumpSlotMap;
    const slots = [];
    if (this.trumpSuit) {
      for (const rank of RANKS) {
        if (rank !== this.trumpNumber) slots.push([`${this.trumpSuit}_${rank}`]);
      }
    }
    if (this.trumpNumber) {
      slots.push(SUITS.filter((s) => s !== this.trumpSuit).map((s) => `TRUMP_NUM_${s}`));
      if (this.trumpSuit) slots.push(['TRUMP_NUM_TRUMP_SUIT']);
    }
    slots.push(['JOKER_SMALL'], ['JOKER_BIG']);

    const map = {};
    slots.forEach((keys, i) => keys.forEach((key) => { map[key] = i; }));
    this._trumpSlotMap = map;
    return map;
  }

  // Slot of a trump key, or -1 if the key isn't trump.
  trumpSlot(key) {
    return this.trumpSlotMap[key] ?? -1;
  }

  // Slot of a non-trump key within its suit. The trump number is skipped,
  // so with 7 as the level, 6 and 8 are consecutive.
  suitSlot(key) {
    const parts = key.split('_');
    return RANKS.filter((r) => r !== this.trumpNumber).indexOf(parts[parts.length - 1]);
  }

  // Slot of a key in the context of the suit that was led.
  keyRankIndex(key, leadSuit) {
    return leadSuit === 'TRUMP' ? this.trumpSlot(key) : this.suitSlot(key);
  }

  // Are these distinct keys a run of consecutive slots?
  areConsecutive(keys, leadSuit) {
    const positions = keys.map((k) => this.keyRankIndex(k, leadSuit)).sort((a, b) => a - b);
    if (positions.some((p) => p === -1)) return false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] !== positions[i - 1] + 1) return false;
    }
    return true;
  }

  // ── Suits of a play ───────────────────────────────────────────────────────

  // 'TRUMP' if every card is trump, otherwise the suit of the first non-trump card.
  leadSuitOf(cards) {
    if (cards.every((c) => this.isTrump(c))) return 'TRUMP';
    const nonTrump = cards.find((c) => !this.isTrump(c));
    return nonTrump ? nonTrump.suit : 'TRUMP';
  }

  // Cards from `hand` that count as the lead suit.
  suitCards(hand, leadSuit) {
    if (leadSuit === 'TRUMP') return hand.filter((c) => this.isTrump(c));
    return hand.filter((c) => !this.isTrump(c) && c.suit === leadSuit);
  }

  // ── Combos ────────────────────────────────────────────────────────────────

  // What kind of play is this? Returns { type, valid, ... }.
  detectCombo(cards) {
    const n = cards.length;
    const allTrump = cards.every((c) => this.isTrump(c));
    const suits = [...new Set(cards.filter((c) => c.suit !== 'JOKER').map((c) => c.suit))];
    const nonTrumpSuits = suits.filter((s) => s !== this.trumpSuit);

    const groups = this.groupByKey(cards);
    const keys = Object.keys(groups);
    const counts = keys.map((k) => groups[k].length);

    if (n === 1) return { type: 'single', valid: true };
    if (n === 2 && keys.length === 1 && counts[0] === 2) return { type: 'pair', valid: true };
    if (n === 3 && keys.length === 1 && counts[0] === 3) return { type: 'triple', valid: true };

    if (allTrump || nonTrumpSuits.length <= 1) {
      const tractor = this.detectTractor(cards);
      if (tractor) return tractor;
    }

    // Anything else with 2+ cards is a "big play" (mixed combo).
    if (n > 1) return { type: 'mixed', valid: true, cards };
    return { type: 'invalid', valid: false };
  }

  // Consecutive pairs or triples, or null.
  detectTractor(cards) {
    const groups = this.groupByKey(cards);
    const keys = Object.keys(groups);
    const counts = Object.values(groups).map((g) => g.length);

    // Every group the same size (all pairs or all triples), at least two groups.
    const groupSize = counts[0];
    if (!counts.every((c) => c === groupSize)) return null;
    if (groupSize < 2) return null;
    const numGroups = keys.length;
    if (numGroups < 2) return null;

    const allTrump = cards.every((c) => this.isTrump(c));
    if (!allTrump) {
      // Non-trump tractors must be a single suit.
      const suits = [...new Set(cards.map((c) => c.suit))];
      if (suits.length > 1) return null;
    }
    if (!this.areConsecutive(keys, allTrump ? 'TRUMP' : 'SUIT')) return null;

    if (groupSize === 2) return { type: 'pair_tractor', valid: true, groups: numGroups, size: groupSize };
    if (groupSize === 3) return { type: 'triple_tractor', valid: true, groups: numGroups, size: groupSize };
    return null;
  }
}
