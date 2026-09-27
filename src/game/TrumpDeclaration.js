// Rules for declaring trump while cards are being dealt.

export class TrumpDeclaration {
  // Can these cards be declared (or override the current declaration)?
  static canDeclare(cards, currentDeclaration, trumpNumber) {
    if (!cards || cards.length === 0) return false;
    const allJokers = cards.every((c) => c.suit === 'JOKER');
    const allSameRank = cards.every((c) => c.rank === cards[0].rank);
    if (!allSameRank && !allJokers) return false;

    // Jokers: 2+ of the same kind (all big or all small, no mixing).
    if (allJokers) {
      const allBig = cards.every((c) => c.rank === 'BIG');
      const allSmall = cards.every((c) => c.rank === 'SMALL');
      if (!allBig && !allSmall) return false;
      if (cards.length < 2) return false;
    }
    if (!allJokers && cards[0].rank !== trumpNumber) return false;

    // Overriding needs more cards than the current declaration.
    if (currentDeclaration) {
      if (currentDeclaration.locked) return false;
      const currentCount = currentDeclaration.declarationCount || currentDeclaration.cards.length;
      if (cards.length <= currentCount) return false;
    }
    return true;
  }

  // Trump suit set by a declaration, or null for jokers (no trump suit).
  static trumpSuitOf(declCards) {
    if (!declCards || declCards.length === 0) return null;
    if (declCards.every((c) => c.suit === 'JOKER')) return null;
    return declCards[0].suit;
  }
}
