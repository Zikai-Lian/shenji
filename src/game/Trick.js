import { comboTier } from './constants';
import { Scoring } from './Scoring';
import { BigPlay } from './BigPlay';

// One trick: the plays made so far, in order. plays = [{ playerIdx, cards }].

export class Trick {
  constructor(plays, rules) {
    this.plays = plays;
    this.rules = rules;
  }

  get leadCards() {
    return this.plays[0].cards;
  }

  get leadSuit() {
    return this.rules.leadSuitOf(this.leadCards);
  }

  // Seat of the player currently winning the trick.
  winner() {
    const leadSuit = this.leadSuit;
    const leadIsBigPlay = this.rules.detectCombo(this.leadCards).type === 'mixed';
    let winner = 0;
    let winningCards = this.leadCards;
    for (let i = 1; i < this.plays.length; i++) {
      const cards = this.plays[i].cards;
      const wins = leadIsBigPlay
        ? this.beatsBigPlay(cards, winningCards)
        : this.beats(cards, winningCards, leadSuit);
      if (wins) {
        winner = i;
        winningCards = cards;
      }
    }
    return this.plays[winner].playerIdx;
  }

  points() {
    return Scoring.countPoints(this.plays.flatMap((p) => p.cards));
  }

  // Does `challenger` beat the cards currently winning?
  beats(challenger, current, leadSuit) {
    const rules = this.rules;
    const chalTrump = challenger.every((c) => rules.isTrump(c));
    const currTrump = current.every((c) => rules.isTrump(c));
    const chalSuit = rules.leadSuitOf(challenger);

    // Trump beats non-trump only if the combo is at least as strong,
    // e.g. two unrelated trump singles can't beat a non-trump pair.
    if (chalTrump && !currTrump) {
      const chalTier = comboTier(rules.detectCombo(challenger).type);
      const currTier = comboTier(rules.detectCombo(current).type);
      return chalTier >= currTier;
    }
    if (!chalTrump && currTrump) return false;

    // Off-suit, non-trump cards can never win.
    if (!chalTrump && chalSuit !== leadSuit) return false;

    // Same suit: only like-for-like combos compete (a pair can't beat a single).
    const chalTier = comboTier(rules.detectCombo(challenger).type);
    const currTier = comboTier(rules.detectCombo(current).type);
    if (chalTier !== currTier) return false;

    // Highest card wins.
    const chalMax = Math.max(...challenger.map((c) => rules.rankOf(c)));
    const currMax = Math.max(...current.map((c) => rules.rankOf(c)));
    return chalMax > currMax;
  }

  // A big play that survived the challenge phase can only be beaten by
  // trumping it with the same shape (same mix of singles, pairs, tractors).
  // Between two such trump plays, the higher top card of the strongest
  // component wins.
  beatsBigPlay(challenger, current) {
    const rules = this.rules;
    const allTrump = (cards) => cards.every((c) => rules.isTrump(c));
    if (allTrump(this.leadCards)) return false; // a trump big play can't be beaten
    if (!allTrump(challenger)) return false;
    if (!this._sameShape(challenger, this.leadCards)) return false;
    if (!allTrump(current)) return true;
    return this._topOfStrongest(challenger) > this._topOfStrongest(current);
  }

  _shape(cards) {
    return new BigPlay(cards, this.rules).components
      .map((c) => `${c.type}:${c.cards.length}`)
      .sort()
      .join(',');
  }

  _sameShape(a, b) {
    return this._shape(a) === this._shape(b);
  }

  _topOfStrongest(cards) {
    const [strongest] = new BigPlay(cards, this.rules).components;
    return Math.max(...strongest.cards.map((c) => this.rules.rankOf(c)));
  }
}
