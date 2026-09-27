import { RANKS, TIER } from './constants';

// A "big play" is a lead made of several combos at once (e.g. a pair plus a
// single). BigPlay breaks it into components and finds whether another
// player can beat any component, which forces a challenge.
//
//   const play = new BigPlay(cards, rules);
//   play.components;                      // [{ type, cards }, ...]
//   play.findChallenger(leaderSeat, hands) // { challengerSeat, components, beatableComponents } or null

export class BigPlay {
  constructor(cards, rules) {
    this.cards = cards;
    this.rules = rules;
    this._components = null;
  }

  get leadSuit() {
    return this.rules.leadSuitOf(this.cards);
  }

  // Components sorted strongest first. Computed once, then cached.
  get components() {
    if (!this._components) this._components = this._decompose();
    return this._components;
  }

  // Only plays with 2+ components can be challenged. Players are checked
  // in turn order after the leader; the first who can beat any component
  // must challenge.
  findChallenger(leaderSeat, hands) {
    const components = this.components;
    if (components.length < 2) return null;

    const order = [1, 2, 3].map((offset) => (leaderSeat + offset) % 4);
    for (const seat of order) {
      const hand = hands[seat] || [];
      const beatableComponents = components.filter((comp) => this.canBeat(hand, comp));
      if (beatableComponents.length > 0) {
        return { challengerSeat: seat, components, beatableComponents };
      }
    }
    return null;
  }

  // Can this hand strictly beat one component, using the same suit?
  // (Trump doesn't force a challenge against a non-trump component.)
  canBeat(hand, component) {
    const rules = this.rules;
    const { type, cards } = component;
    const leadSuit = rules.leadSuitOf(cards);
    const suitCards = rules.suitCards(hand, leadSuit);
    const isTrumpLead = leadSuit === 'TRUMP';
    const rank = (card) => (isTrumpLead ? rules.trumpRank(card) : RANKS.indexOf(card.rank));

    if (type === 'single') {
      return suitCards.some((c) => rank(c) > rank(cards[0]));
    }

    if (type === 'pair' || type === 'triple') {
      const size = type === 'pair' ? 2 : 3;
      const ledRank = rank(cards[0]);
      return Object.values(rules.groupByKey(suitCards))
        .some((grp) => grp.length >= size && rank(grp[0]) > ledRank);
    }

    if (type === 'pair_tractor' || type === 'triple_tractor') {
      // Needs a tractor at least as long as the led one, ending above its top card.
      const groupSize = type === 'triple_tractor' ? 3 : 2;
      const needed = cards.length / groupSize;
      const maxLedRank = Math.max(-Infinity, ...cards.map(rank));
      const slotOf = (key) => rules.keyRankIndex(key, leadSuit);

      // Strongest group per slot, in slot order.
      const bySlot = new Map();
      for (const [key, grp] of Object.entries(rules.groupByKey(suitCards))) {
        if (grp.length < groupSize || slotOf(key) === -1) continue;
        const slot = slotOf(key);
        if (!bySlot.has(slot) || rank(grp[0]) > rank(bySlot.get(slot))) bySlot.set(slot, grp[0]);
      }
      const slots = [...bySlot.keys()].sort((a, b) => a - b);

      let run = 1;
      for (let i = 1; i < slots.length; i++) {
        run = slots[i] === slots[i - 1] + 1 ? run + 1 : 1;
        if (run >= needed && rank(bySlot.get(slots[i])) > maxLedRank) return true;
      }
      return false;
    }

    return false;
  }

  // ── Decomposition ─────────────────────────────────────────────────────────

  // Split the cards into combos, choosing the split whose weakest component
  // is as strong as possible. Triple tractors are always taken first; then
  // we try "pair tractors before triples" and "triples before pair tractors"
  // and keep whichever has the higher minimum tier.
  _decompose() {
    if (!this.cards || this.cards.length === 0) return [];
    const pool = new CardPool(this.cards, this.rules, this.leadSuit);

    const components = [];
    this._takeTractors(pool, 3, 'triple_tractor', components);

    const snapshot = pool.snapshot();

    const optionA = [];
    this._takeTractors(pool, 2, 'pair_tractor', optionA);
    this._takeGroups(pool, 3, 'triple', optionA);
    this._takeGroups(pool, 2, 'pair', optionA);
    this._takeGroups(pool, 1, 'single', optionA);

    pool.restore(snapshot);
    const optionB = [];
    this._takeGroups(pool, 3, 'triple', optionB);
    this._takeTractors(pool, 2, 'pair_tractor', optionB);
    this._takeGroups(pool, 2, 'pair', optionB);
    this._takeGroups(pool, 1, 'single', optionB);

    const minTier = (comps) => (comps.length ? Math.min(...comps.map((c) => TIER[c.type])) : 0);
    const chosen = minTier(optionA) >= minTier(optionB) ? optionA : optionB;
    return [...components, ...chosen].sort((a, b) => TIER[b.type] - TIER[a.type]);
  }

  // Repeatedly remove the longest tractor of this group size.
  _takeTractors(pool, groupSize, type, out) {
    for (;;) {
      const tractors = pool.findTractors(groupSize);
      if (tractors.length === 0) return;
      const best = tractors.sort((a, b) => b.length - a.length)[0];
      const cards = [];
      for (const key of best) cards.push(...pool.take(key, groupSize));
      out.push({ type, cards });
    }
  }

  // Remove every group of exactly `size` cards that's still available.
  _takeGroups(pool, size, type, out) {
    for (const [key] of pool.entries()) {
      while (pool.count(key) >= size) out.push({ type, cards: pool.take(key, size) });
    }
  }
}

// The cards left to assign while decomposing a big play, grouped by key and
// kept in rank order.
class CardPool {
  constructor(cards, rules, leadSuit) {
    this.rules = rules;
    this.leadSuit = leadSuit;
    const groups = rules.groupByKey(cards);
    this.orderedKeys = Object.keys(groups).sort(
      (a, b) => rules.keyRankIndex(a, leadSuit) - rules.keyRankIndex(b, leadSuit)
    );
    this.remaining = {};
    for (const key of this.orderedKeys) this.remaining[key] = [...groups[key]];
  }

  count(key) {
    return (this.remaining[key] || []).length;
  }

  take(key, n) {
    return this.remaining[key].splice(0, n);
  }

  // [[key, count]] for keys that still have cards, in rank order.
  entries() {
    return this.orderedKeys.filter((k) => this.count(k) > 0).map((k) => [k, this.count(k)]);
  }

  snapshot() {
    const snap = {};
    for (const key of Object.keys(this.remaining)) snap[key] = [...this.remaining[key]];
    return snap;
  }

  restore(snap) {
    for (const key of Object.keys(this.remaining)) this.remaining[key] = [];
    for (const [key, cards] of Object.entries(snap)) this.remaining[key] = [...cards];
  }

  // All maximal runs (length ≥ 2) of consecutive keys with ≥ minSize cards each.
  findTractors(minSize) {
    const eligible = this.entries().filter(([, count]) => count >= minSize);
    if (eligible.length < 2) return [];
    const idx = (key) => this.rules.keyRankIndex(key, this.leadSuit);

    const tractors = [];
    let run = [eligible[0]];
    for (let i = 1; i < eligible.length; i++) {
      if (idx(eligible[i][0]) === idx(eligible[i - 1][0]) + 1) {
        run.push(eligible[i]);
      } else {
        if (run.length >= 2) tractors.push(run.map(([k]) => k));
        run = [eligible[i]];
      }
    }
    if (run.length >= 2) tractors.push(run.map(([k]) => k));
    return tractors;
  }
}
