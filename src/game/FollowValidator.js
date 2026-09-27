// Checks that a player following a lead obeys the follow-suit rules:
// play as many lead-suit cards as you can, and if the lead was a pair,
// triple or tractor, match that shape as closely as your hand allows.
//
//   const error = new FollowValidator(rules).validate(played, hand, leadCombo);
//   // error is a message string, or null if the play is legal

export class FollowValidator {
  constructor(rules) {
    this.rules = rules;
  }

  validate(playedCards, hand, leadCombo) {
    const rules = this.rules;
    const n = leadCombo.cards.length;
    if (playedCards.length !== n) return `Must play exactly ${n} cards`;

    const leadSuit = rules.leadSuitOf(leadCombo.cards);
    const suitInHand = rules.suitCards(hand, leadSuit);

    // Out of the lead suit: anything goes.
    if (suitInHand.length === 0) return null;

    const playedInSuit = rules.suitCards(playedCards, leadSuit);

    // Must use as many lead-suit cards as possible.
    const requiredSuitCards = Math.min(suitInHand.length, n);
    if (playedInSuit.length < requiredSuitCards) {
      return `Must play more ${leadSuit === 'TRUMP' ? 'trump' : leadSuit} cards — you have ${suitInHand.length}`;
    }

    switch (leadCombo.type) {
      case 'pair': return this._checkPair(suitInHand, playedInSuit);
      case 'triple': return this._checkTriple(suitInHand, playedInSuit);
      case 'pair_tractor': return this._checkPairTractor(suitInHand, playedInSuit, leadSuit, n);
      case 'triple_tractor': return this._checkTripleTractor(suitInHand, playedInSuit, leadSuit);
      default: return null;
    }
  }

  // Only exact pairs force a play; triples are exempt.
  _checkPair(suitInHand, playedInSuit) {
    const counts = this.rules.countByKey(suitInHand);
    const hasExactPair = Object.values(counts).some((c) => c === 2);
    if (hasExactPair && this.rules.countGroups(playedInSuit, 2) === 0) {
      return 'You have a pair in this suit — must play it';
    }
    return null;
  }

  _checkTriple(suitInHand, playedInSuit) {
    const rules = this.rules;
    const handTriples = rules.countGroups(suitInHand, 3);
    const handPairs = rules.countGroups(suitInHand, 2);
    const playedTriples = rules.countGroups(playedInSuit, 3);
    const playedPairs = rules.countGroups(playedInSuit, 2);

    if (handTriples > 0 && playedTriples === 0) return 'You have a triple — must play it first';
    if (handTriples === 0 && handPairs > 0 && playedPairs === 0) return 'You have a pair — must play it';
    return null;
  }

  // Use your longest pair tractor (up to the lead's length), then as many
  // other pairs as fit, then singles. Pairs that are part of a triple in
  // your hand are never forced.
  _checkPairTractor(suitInHand, playedInSuit, leadSuit, n) {
    const leadPairs = Math.floor(n / 2);

    const requiredRun = Math.min(this._longestExactPairRun(suitInHand, leadSuit), leadPairs);
    if (requiredRun >= 2 && this._longestRunOfGroups(playedInSuit, 2, leadSuit) < requiredRun) {
      return `You have a ${requiredRun}-pair tractor — must include it`;
    }

    const requiredPairs = Math.min(this._countExactPairs(suitInHand), leadPairs);
    const playedPairs = this.rules.countGroups(playedInSuit, 2);
    if (playedPairs < requiredPairs) {
      const missing = requiredPairs - playedPairs;
      return `You have ${missing} more pair${missing > 1 ? 's' : ''} — must include them`;
    }
    return null;
  }

  // Triple tractor → (pair tractor or triple, player's choice) → 2+ pairs → 1 pair → singles.
  _checkTripleTractor(suitInHand, playedInSuit, leadSuit) {
    const rules = this.rules;
    const handHasTripleTractor = this._longestRunOfGroups(suitInHand, 3, leadSuit) >= 2;
    const handHasPairTractor = this._longestRunOfGroups(suitInHand, 2, leadSuit) >= 2;
    const handTriples = rules.countGroups(suitInHand, 3);
    const handPairs = rules.countGroups(suitInHand, 2);

    // "Contains", not "is": the rest of the play can be filler cards.
    const playedTripleTractor = this._longestRunOfGroups(playedInSuit, 3, leadSuit) >= 2;
    const playedPairTractor = this._longestRunOfGroups(playedInSuit, 2, leadSuit) >= 2;
    const playedTriples = rules.countGroups(playedInSuit, 3);
    const playedPairs = rules.countGroups(playedInSuit, 2);

    if (handHasTripleTractor && !playedTripleTractor) return 'You have a triple tractor — must play it';

    if (!handHasTripleTractor && (handHasPairTractor || handTriples > 0)) {
      if (!playedPairTractor && playedTriples === 0) {
        return 'You have a pair tractor or triple — must play one of them';
      }
    }

    if (!handHasTripleTractor && !handHasPairTractor && handTriples === 0) {
      if (handPairs >= 2 && playedPairs < 2) return 'You have 2+ pairs — must play them';
      if (handPairs === 1 && playedPairs < 1) return 'You have a pair — must play it';
    }
    return null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Pairs of exactly two (a triple doesn't count as a pair here).
  _countExactPairs(cards) {
    return Object.values(this.rules.countByKey(cards)).filter((c) => c === 2).length;
  }

  // Number of pairs in the longest tractor of exact pairs, or 0 if there's
  // no tractor. (A lone pair is not a tractor: it's handled by the pairs rule.)
  _longestExactPairRun(cards, leadSuit) {
    const counts = this.rules.countByKey(cards);
    const eligibleKeys = Object.keys(counts).filter((k) => counts[k] === 2);
    if (eligibleKeys.length < 2) return 0;
    const run = FollowValidator._longestRun(this._uniqueSlots(eligibleKeys, leadSuit));
    return run >= 2 ? run : 0;
  }

  // Length of the longest run of consecutive ranks where each rank has at
  // least minSize cards (0 if there's no run of 2 or more).
  _longestRunOfGroups(cards, minSize, leadSuit) {
    const counts = this.rules.countByKey(cards);
    const keys = Object.keys(counts).filter((k) => counts[k] >= minSize);
    if (keys.length < 2) return 0;
    const run = FollowValidator._longestRun(this._uniqueSlots(keys, leadSuit));
    return run >= 2 ? run : 0;
  }

  // Sorted, de-duplicated rank slots of these keys (keys of equal rank share a slot).
  _uniqueSlots(keys, leadSuit) {
    const slots = keys.map((k) => this.rules.keyRankIndex(k, leadSuit)).filter((p) => p !== -1);
    return [...new Set(slots)].sort((a, b) => a - b);
  }

  // Longest run of consecutive integers in a sorted list (at least 1 if non-empty).
  static _longestRun(sorted) {
    let maxRun = 0;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) { run++; maxRun = Math.max(maxRun, run); } else run = 1;
    }
    return Math.max(maxRun, run);
  }
}
