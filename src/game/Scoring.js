// Points and level changes. All static: scoring doesn't need any state.

export class Scoring {
  static cardPoints(card) {
    if (card.suit === 'JOKER') return 0;
    if (card.rank === '5') return 5;
    if (card.rank === '10' || card.rank === 'K') return 10;
    return 0;
  }

  static countPoints(cards) {
    return cards.reduce((sum, c) => sum + Scoring.cardPoints(c), 0);
  }

  // Kitty points are multiplied by 2 × the size of the last trick's winning combo.
  static kittyMultiplier(winningCards, rules) {
    const combo = rules.detectCombo(winningCards);
    const tierSizes = { single: 1, pair: 2, triple: 3, pair_tractor: 4, triple_tractor: 6 };
    const size = tierSizes[combo.type] || 1;
    return size * 2;
  }

  // Levels the attackers go up, based on how many points the defenders scored.
  static attackerLevelGain(defenderScore) {
    if (defenderScore >= 120) return 0; // defenders win
    if (defenderScore >= 60) return 1;
    if (defenderScore >= 1) return 2;
    return 3; // defenders scored nothing
  }

  // Levels the defenders go up when they win.
  static defenderLevelGain(defenderScore) {
    return Math.floor(defenderScore / 60) - 2;
  }
}
