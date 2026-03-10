// ── Sheng Ji Game Logic ──────────────────────────────────────────────────────

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
export const LEVELS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

// Build 3 decks (162 cards + 6 jokers per deck = 162 + 18 = 180? No: 52*3=156 + 6 jokers*3=18 = 174? 
// Standard deck: 52 cards + 2 jokers = 54. 3 decks = 162 cards total.
export function buildDecks() {
  const cards = [];
  let id = 0;
  for (let d = 0; d < 3; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: id++, suit, rank, deck: d });
      }
    }
    cards.push({ id: id++, suit: 'JOKER', rank: 'BIG', deck: d });
    cards.push({ id: id++, suit: 'JOKER', rank: 'SMALL', deck: d });
  }
  return cards; // 162 cards
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dealCardsSequential(cards) {
  // Returns the full sequence of deals: [{seat, card}] then kitty at end
  const shuffled = shuffle(cards);
  const kitty = shuffled.slice(0, 6);
  const remaining = shuffled.slice(6);
  const sequence = remaining.map((card, i) => ({ seat: i % 4, card }));
  return { sequence, kitty };
}

export function dealCards(cards) {
  const shuffled = shuffle(cards);
  const kitty = shuffled.slice(0, 6);
  const remaining = shuffled.slice(6); // 156 cards
  const hands = [[], [], [], []];
  remaining.forEach((card, i) => hands[i % 4].push(card));
  return { hands, kitty };
}

// ── Trump helpers ─────────────────────────────────────────────────────────────

export function isTrump(card, trumpSuit, trumpNumber) {
  if (card.suit === 'JOKER') return true;
  if (card.rank === trumpNumber) return true;
  if (trumpSuit && card.suit === trumpSuit) return true;
  return false;
}

// Returns numeric rank for comparison within trump
// Higher = stronger
export function trumpRank(card, trumpSuit, trumpNumber) {
  if (card.suit === 'JOKER' && card.rank === 'BIG') return 1000;
  if (card.suit === 'JOKER' && card.rank === 'SMALL') return 999;
  if (card.rank === trumpNumber && card.suit === trumpSuit) return 998;
  if (card.rank === trumpNumber) return 997 - SUITS.indexOf(card.suit);
  // Regular trump suit card
  return RANKS.indexOf(card.rank);
}

// Returns numeric rank for comparison within a non-trump suit
export function suitRank(card) {
  return RANKS.indexOf(card.rank);
}

// ── Combo detection ───────────────────────────────────────────────────────────

// Group cards by their "effective key" for pairing/tripling
function cardKey(card, trumpSuit, trumpNumber) {
  if (card.suit === 'JOKER') return `JOKER_${card.rank}`;
  if (card.rank === trumpNumber && card.suit === trumpSuit) return `TRUMP_NUM_TRUMP_SUIT`;
  if (card.rank === trumpNumber) return `TRUMP_NUM_${card.suit}`;
  return `${card.suit}_${card.rank}`;
}

function groupByKey(cards, trumpSuit, trumpNumber) {
  const groups = {};
  for (const card of cards) {
    const key = cardKey(card, trumpSuit, trumpNumber);
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  }
  return groups;
}

// Get combo type from a set of played cards
export function detectCombo(cards, trumpSuit, trumpNumber) {
  const n = cards.length;
  const allTrump = cards.every(c => isTrump(c, trumpSuit, trumpNumber));
  const suits = [...new Set(cards.filter(c => c.suit !== 'JOKER').map(c => c.suit))];
  const nonTrumpSuits = suits.filter(s => s !== trumpSuit);

  const groups = groupByKey(cards, trumpSuit, trumpNumber);
  const keys = Object.keys(groups);
  const counts = keys.map(k => groups[k].length);

  // Single
  if (n === 1) return { type: 'single', valid: true };

  // Pair
  if (n === 2 && keys.length === 1 && counts[0] === 2) return { type: 'pair', valid: true };

  // Triple
  if (n === 3 && keys.length === 1 && counts[0] === 3) return { type: 'triple', valid: true };

  // Check tractor (consecutive pairs/triples in trump chain)
  if (allTrump || nonTrumpSuits.length <= 1) {
    const tractorResult = detectTractor(cards, trumpSuit, trumpNumber);
    if (tractorResult) return tractorResult;
  }

  // Mixed combo (big play) - valid if player claims it
  if (n > 1) return { type: 'mixed', valid: true, cards };

  return { type: 'invalid', valid: false };
}

function getTrumpOrder(trumpSuit, trumpNumber) {
  // Returns ordered trump "slots" from lowest to highest
  // Each slot is a key
  const order = [];
  // Regular trump suit cards (by rank, excluding trump number)
  for (const rank of RANKS) {
    if (rank !== trumpNumber) {
      order.push(`${trumpSuit}_${rank}`);
    }
  }
  // Trump number of non-trump suits
  for (const suit of SUITS) {
    if (suit !== trumpSuit) {
      order.push(`TRUMP_NUM_${suit}`);
    }
  }
  // Trump number of trump suit
  order.push(`TRUMP_NUM_TRUMP_SUIT`);
  // Small jokers
  order.push(`JOKER_SMALL`);
  // Big jokers
  order.push(`JOKER_BIG`);
  return order;
}

function detectTractor(cards, trumpSuit, trumpNumber) {
  const groups = groupByKey(cards, trumpSuit, trumpNumber);
  const keys = Object.keys(groups);
  const counts = Object.values(groups).map(g => g.length);

  // All groups must have same count (all pairs or all triples)
  const groupSize = counts[0];
  if (!counts.every(c => c === groupSize)) return null;
  if (groupSize < 2) return null;

  const numGroups = keys.length;
  if (numGroups < 2) return null;

  // Check if all cards are trump
  const allTrump = cards.every(c => isTrump(c, trumpSuit, trumpNumber));

  if (allTrump) {
    const order = getTrumpOrder(trumpSuit, trumpNumber);
    const positions = keys.map(k => order.indexOf(k));
    if (positions.some(p => p === -1)) return null;
    positions.sort((a, b) => a - b);
    // Must be consecutive
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] !== positions[i - 1] + 1) return null;
    }
    if (groupSize === 2) return { type: numGroups >= 2 ? 'pair_tractor' : 'pair', valid: true, groups: numGroups, size: groupSize };
    if (groupSize === 3) return { type: numGroups >= 2 ? 'triple_tractor' : 'triple', valid: true, groups: numGroups, size: groupSize };
  } else {
    // Non-trump: all must be same suit, consecutive ranks
    const suits = [...new Set(cards.map(c => c.suit))];
    if (suits.length > 1) return null;
    const ranks = keys.map(k => RANKS.indexOf(k.split('_')[1]));
    ranks.sort((a, b) => a - b);
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] !== ranks[i - 1] + 1) return null;
    }
    if (groupSize === 2) return { type: 'pair_tractor', valid: true, groups: numGroups, size: groupSize };
    if (groupSize === 3) return { type: 'triple_tractor', valid: true, groups: numGroups, size: groupSize };
  }
  return null;
}

// ── Trick winning ─────────────────────────────────────────────────────────────

export function trickWinner(plays, trumpSuit, trumpNumber) {
  // plays: [{playerIdx, cards}]
  const lead = plays[0];
  const leadCards = lead.cards;
  const leadSuit = getLeadSuit(leadCards, trumpSuit, trumpNumber);

  let winner = 0;
  let winningCards = leadCards;

  for (let i = 1; i < plays.length; i++) {
    const c = plays[i].cards;
    if (beats(c, winningCards, leadSuit, trumpSuit, trumpNumber)) {
      winner = i;
      winningCards = c;
    }
  }
  return plays[winner].playerIdx;
}

function getLeadSuit(cards, trumpSuit, trumpNumber) {
  if (cards.every(c => isTrump(c, trumpSuit, trumpNumber))) return 'TRUMP';
  const nonTrump = cards.find(c => !isTrump(c, trumpSuit, trumpNumber));
  return nonTrump ? nonTrump.suit : 'TRUMP';
}

function beats(challenger, current, leadSuit, trumpSuit, trumpNumber) {
  const chalTrump = challenger.every(c => isTrump(c, trumpSuit, trumpNumber));
  const currTrump = current.every(c => isTrump(c, trumpSuit, trumpNumber));
  const chalSuit = getLeadSuit(challenger, trumpSuit, trumpNumber);
  const currSuit = getLeadSuit(current, trumpSuit, trumpNumber);

  // Trump beats non-trump
  if (chalTrump && !currTrump) return true;
  if (!chalTrump && currTrump) return false;

  // Must follow lead suit to beat
  if (!chalTrump && chalSuit !== leadSuit) return false;

  // Compare highest cards
  const chalMax = Math.max(...challenger.map(c =>
    isTrump(c, trumpSuit, trumpNumber) ? trumpRank(c, trumpSuit, trumpNumber) : suitRank(c)
  ));
  const currMax = Math.max(...current.map(c =>
    isTrump(c, trumpSuit, trumpNumber) ? trumpRank(c, trumpSuit, trumpNumber) : suitRank(c)
  ));
  return chalMax > currMax;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function cardPoints(card) {
  if (card.suit === 'JOKER') return 0;
  if (card.rank === '5') return 5;
  if (card.rank === '10' || card.rank === 'K') return 10;
  return 0;
}

export function countPoints(cards) {
  return cards.reduce((sum, c) => sum + cardPoints(c), 0);
}

// Kitty multiplier: player chooses best interpretation
export function kittyMultiplier(winningCards, trumpSuit, trumpNumber) {
  // Find the lowest tier combo component and its card count
  // Tier: single=1, pair=2, triple=3, pair_tractor=4, triple_tractor=5
  const combo = detectCombo(winningCards, trumpSuit, trumpNumber);
  const tierSizes = { single: 1, pair: 2, triple: 3, pair_tractor: 4, triple_tractor: 6 };
  const size = tierSizes[combo.type] || 1;
  return size * 2;
}

// Attacker level gain based on defender score
export function attackerLevelGain(defenderScore) {
  if (defenderScore >= 120) return 0; // defenders win
  if (defenderScore >= 60) return 1;
  if (defenderScore >= 1) return 2;
  return 3; // 0 points
}

// Defender level gain when they win
export function defenderLevelGain(defenderScore) {
  return Math.floor(defenderScore / 60) - 2;
}

// ── Trump declaration ─────────────────────────────────────────────────────────

export function canDeclareTrump(cards, currentDeclaration, trumpNumber) {
  if (!cards || cards.length === 0) return false;

  const allJokers = cards.every(c => c.suit === 'JOKER');
  const allSameRank = cards.every(c => c.rank === cards[0].rank);

  if (!allSameRank && !allJokers) return false;

  // Jokers: need 2+ to declare, cannot use 1 joker
  if (allJokers && cards.length < 2) return false;

  // Non-joker cards: must be the trump number
  if (!allJokers) {
    if (cards[0].rank !== trumpNumber) return false;
    // 1 trump number = valid declaration (no minimum)
  }

  // Must have strictly more cards than current declaration to override
  if (currentDeclaration && cards.length <= currentDeclaration.cards.length) return false;

  return true;
}

// Check if 3 of the same trump number suit have been played -> lock in that suit
export function checkTripleLockIn(hands, trumpNumber) {
  // Count trump numbers by suit across all hands that have been removed (played)
  // This is called after dealing to check declarations
  return null; // handled in App.js via declaration tracking
}

export function getTrumpSuitFromDeclaration(declCards) {
  if (!declCards || declCards.length === 0) return null;
  if (declCards.every(c => c.suit === 'JOKER')) return null; // no trump suit
  return declCards[0].suit;
}

// ── Follow-suit enforcement ───────────────────────────────────────────────────

// Get all cards of the lead suit from a hand
function getSuitCards(hand, leadSuit, trumpSuit, trumpNumber) {
  if (leadSuit === 'TRUMP') {
    return hand.filter(c => isTrump(c, trumpSuit, trumpNumber));
  }
  return hand.filter(c => !isTrump(c, trumpSuit, trumpNumber) && c.suit === leadSuit);
}

// Count how many distinct groups of exactly `size` or more exist
function countGroups(cards, minSize, trumpSuit, trumpNumber) {
  const groups = {};
  for (const card of cards) {
    const key = cardKey(card, trumpSuit, trumpNumber);
    groups[key] = (groups[key] || 0) + 1;
  }
  return Object.values(groups).filter(count => count >= minSize).length;
}

// Check if cards contain a tractor of given group size (2=pair tractor, 3=triple tractor)
function hasTractor(cards, groupSize, leadSuit, trumpSuit, trumpNumber) {
  const groups = {};
  for (const card of cards) {
    const key = cardKey(card, trumpSuit, trumpNumber);
    groups[key] = (groups[key] || 0) + 1;
  }
  const eligibleKeys = Object.keys(groups).filter(k => groups[k] >= groupSize);
  if (eligibleKeys.length < 2) return false;

  if (leadSuit === 'TRUMP') {
    const order = getTrumpOrder(trumpSuit, trumpNumber);
    const positions = eligibleKeys.map(k => order.indexOf(k)).filter(p => p !== -1).sort((a, b) => a - b);
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] === positions[i - 1] + 1) return true;
    }
  } else {
    const ranks = eligibleKeys.map(k => {
      const parts = k.split('_');
      return RANKS.indexOf(parts[parts.length - 1]);
    }).filter(r => r !== -1).sort((a, b) => a - b);
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] === ranks[i - 1] + 1) return true;
    }
  }
  return false;
}

// Check played cards contain a tractor of given group size
function playedHasTractor(cards, groupSize, trumpSuit, trumpNumber) {
  const result = detectTractor(cards, trumpSuit, trumpNumber);
  if (!result) return false;
  if (groupSize === 3) return result.type === 'triple_tractor';
  if (groupSize === 2) return result.type === 'pair_tractor' || result.type === 'triple_tractor';
  return false;
}

// Returns error string if play is illegal, or null if legal
export function validateFollow(playedCards, hand, leadCombo, trumpSuit, trumpNumber) {
  const n = leadCombo.cards.length;
  if (playedCards.length !== n) return `Must play exactly ${n} cards`;

  const leadSuit = getLeadSuit(leadCombo.cards, trumpSuit, trumpNumber);

  // All suit cards available in hand (before this play)
  const suitInHand = getSuitCards(hand, leadSuit, trumpSuit, trumpNumber);

  // If no suit cards at all, anything goes
  if (suitInHand.length === 0) return null;

  // Cards actually played that match the lead suit
  const playedInSuit = getSuitCards(playedCards, leadSuit, trumpSuit, trumpNumber);

  // Must use as many suit cards as possible
  const requiredSuitCards = Math.min(suitInHand.length, n);
  if (playedInSuit.length < requiredSuitCards) {
    return `Must play more ${leadSuit === 'TRUMP' ? 'trump' : leadSuit} cards — you have ${suitInHand.length}`;
  }

  const type = leadCombo.type;

  // ── Pair ──────────────────────────────────────────────────────────────────
  if (type === 'pair') {
    const handPairs = countGroups(suitInHand, 2, trumpSuit, trumpNumber);
    if (handPairs > 0) {
      const playedPairs = countGroups(playedInSuit, 2, trumpSuit, trumpNumber);
      if (playedPairs === 0) return `You have a pair in this suit — must play it`;
    }
    return null;
  }

  // ── Triple ────────────────────────────────────────────────────────────────
  if (type === 'triple') {
    const handTriples = countGroups(suitInHand, 3, trumpSuit, trumpNumber);
    const handPairs   = countGroups(suitInHand, 2, trumpSuit, trumpNumber);
    const playedTriples = countGroups(playedInSuit, 3, trumpSuit, trumpNumber);
    const playedPairs   = countGroups(playedInSuit, 2, trumpSuit, trumpNumber);

    if (handTriples > 0 && playedTriples === 0) return `You have a triple — must play it first`;
    if (handTriples === 0 && handPairs > 0 && playedPairs === 0) return `You have a pair — must play it`;
    return null;
  }

  // ── Pair tractor ──────────────────────────────────────────────────────────
  if (type === 'pair_tractor') {
    // Priority: pair tractor → 2 pairs → 1 pair → singles (NO triples required)
    const handHasPairTractor = hasTractor(suitInHand, 2, leadSuit, trumpSuit, trumpNumber);
    const handPairs = countGroups(suitInHand, 2, trumpSuit, trumpNumber);
    const playedPairTractor = playedHasTractor(playedInSuit, 2, trumpSuit, trumpNumber);
    const playedPairs = countGroups(playedInSuit, 2, trumpSuit, trumpNumber);

    if (handHasPairTractor && !playedPairTractor) return `You have a pair tractor — must play it`;
    if (!handHasPairTractor && handPairs >= 2 && playedPairs < 2) return `You have 2 pairs — must play both`;
    if (!handHasPairTractor && handPairs === 1 && playedPairs < 1) return `You have a pair — must play it`;
    return null;
  }

  // ── Triple tractor ────────────────────────────────────────────────────────
  if (type === 'triple_tractor') {
    // Priority: triple tractor → (pair tractor OR triple, player's choice) → 2+ pairs → 1 pair → singles
    const handHasTripleTractor = hasTractor(suitInHand, 3, leadSuit, trumpSuit, trumpNumber);
    const handHasPairTractor   = hasTractor(suitInHand, 2, leadSuit, trumpSuit, trumpNumber);
    const handTriples = countGroups(suitInHand, 3, trumpSuit, trumpNumber);
    const handPairs   = countGroups(suitInHand, 2, trumpSuit, trumpNumber);

    const playedTripleTractor = playedHasTractor(playedInSuit, 3, trumpSuit, trumpNumber);
    const playedPairTractor   = playedHasTractor(playedInSuit, 2, trumpSuit, trumpNumber);
    const playedTriples = countGroups(playedInSuit, 3, trumpSuit, trumpNumber);
    const playedPairs   = countGroups(playedInSuit, 2, trumpSuit, trumpNumber);

    if (handHasTripleTractor && !playedTripleTractor) return `You have a triple tractor — must play it`;

    if (!handHasTripleTractor && (handHasPairTractor || handTriples > 0)) {
      // Player must play a pair tractor OR a triple (their choice)
      if (!playedPairTractor && playedTriples === 0) {
        return `You have a pair tractor or triple — must play one of them`;
      }
    }

    if (!handHasTripleTractor && !handHasPairTractor && handTriples === 0) {
      // Fall through to pairs
      if (handPairs >= 2 && playedPairs < 2) return `You have 2+ pairs — must play them`;
      if (handPairs === 1 && playedPairs < 1) return `You have a pair — must play it`;
    }
    return null;
  }

  return null;
}

// ── Combo decomposition & auto-challenge ─────────────────────────────────────

const TIER = { single: 0, pair: 1, triple: 2, pair_tractor: 3, triple_tractor: 4 };

// Return rank index of a card key within a suit (for consecutive checking)
function keyRankIdx(key, leadSuit, trumpSuit, trumpNumber) {
  if (leadSuit === 'TRUMP') {
    const order = getTrumpOrder(trumpSuit, trumpNumber);
    return order.indexOf(key);
  }
  const parts = key.split('_');
  return RANKS.indexOf(parts[parts.length - 1]);
}

// Given an array of [key, count] entries (sorted by rank), find all maximal
// consecutive runs of length >= 2 where every key has count >= minSize.
function findTractors(sortedEntries, minSize, leadSuit, trumpSuit, trumpNumber) {
  // Returns array of arrays of keys that form tractors
  const eligible = sortedEntries.filter(([k, cnt]) => cnt >= minSize);
  if (eligible.length < 2) return [];

  const tractors = [];
  let run = [eligible[0]];
  for (let i = 1; i < eligible.length; i++) {
    const prevIdx = keyRankIdx(eligible[i-1][0], leadSuit, trumpSuit, trumpNumber);
    const currIdx = keyRankIdx(eligible[i][0], leadSuit, trumpSuit, trumpNumber);
    if (currIdx === prevIdx + 1) {
      run.push(eligible[i]);
    } else {
      if (run.length >= 2) tractors.push(run.map(([k]) => k));
      run = [eligible[i]];
    }
  }
  if (run.length >= 2) tractors.push(run.map(([k]) => k));
  return tractors;
}

// Decompose cards into sub-components with max-min tier optimization.
// Returns array of { type, cards } sorted highest tier first.
export function decomposeCombo(cards, trumpSuit, trumpNumber) {
  // Group cards by key
  const groups = {};
  for (const card of cards) {
    const key = cardKey(card, trumpSuit, trumpNumber);
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  }

  const leadSuit = getLeadSuit(cards, trumpSuit, trumpNumber);

  // Sort keys by rank
  const sortedEntries = Object.entries(groups).sort(([ka], [kb]) => {
    return keyRankIdx(ka, leadSuit, trumpSuit, trumpNumber) - keyRankIdx(kb, leadSuit, trumpSuit, trumpNumber);
  });

  const components = [];
  const remaining = {}; // key -> cards left to assign
  for (const [k, arr] of sortedEntries) remaining[k] = [...arr];

  const countRemaining = (k) => (remaining[k] || []).length;
  const takeCards = (key, n) => {
    const taken = remaining[key].splice(0, n);
    return taken;
  };

  // Helper: get sorted entries of what remains
  const getSortedRemaining = () =>
    sortedEntries.map(([k]) => k).filter(k => countRemaining(k) > 0)
      .map(k => [k, countRemaining(k)]);

  // 1. Greedily assign triple tractors first
  let changed = true;
  while (changed) {
    changed = false;
    const rem = getSortedRemaining();
    const tractors = findTractors(rem, 3, leadSuit, trumpSuit, trumpNumber);
    if (tractors.length > 0) {
      // Take longest triple tractor
      const best = tractors.sort((a, b) => b.length - a.length)[0];
      const tractorCards = [];
      for (const k of best) tractorCards.push(...takeCards(k, 3));
      components.push({ type: 'triple_tractor', cards: tractorCards });
      changed = true;
    }
  }

  // 2. Now decide: should we prefer triples or pair tractors?
  // We want to maximize min tier. Try both and pick the one with higher min tier.
  // Strategy: pair tractors and triples compete. Use a greedy approach —
  // assign pair tractors first (tier 3) then triples (tier 2), and check
  // if swapping improves the min tier.

  // Snapshot remaining for backtracking
  const snapRemaining = () => {
    const snap = {};
    for (const k of Object.keys(remaining)) snap[k] = [...remaining[k]];
    return snap;
  };
  const restoreRemaining = (snap) => {
    for (const k of Object.keys(remaining)) remaining[k] = [];
    for (const [k, arr] of Object.entries(snap)) remaining[k] = [...arr];
  };

  // Try option A: pair tractors before triples
  const snapA = snapRemaining();
  const compA = [];
  changed = true;
  while (changed) {
    changed = false;
    const rem = getSortedRemaining();
    const tractors = findTractors(rem, 2, leadSuit, trumpSuit, trumpNumber);
    if (tractors.length > 0) {
      const best = tractors.sort((a, b) => b.length - a.length)[0];
      const tractorCards = [];
      for (const k of best) tractorCards.push(...takeCards(k, 2));
      compA.push({ type: 'pair_tractor', cards: tractorCards });
      changed = true;
    }
  }
  // then triples
  for (const [k, cnt] of getSortedRemaining()) {
    while (countRemaining(k) >= 3) {
      compA.push({ type: 'triple', cards: takeCards(k, 3) });
    }
  }
  // then pairs
  for (const [k, cnt] of getSortedRemaining()) {
    while (countRemaining(k) >= 2) {
      compA.push({ type: 'pair', cards: takeCards(k, 2) });
    }
  }
  // then singles
  for (const [k] of getSortedRemaining()) {
    while (countRemaining(k) >= 1) {
      compA.push({ type: 'single', cards: takeCards(k, 1) });
    }
  }
  const minTierA = compA.length ? Math.min(...compA.map(c => TIER[c.type])) : 0;

  // Try option B: triples before pair tractors
  restoreRemaining(snapA);
  const compB = [];
  for (const [k] of getSortedRemaining()) {
    while (countRemaining(k) >= 3) {
      compB.push({ type: 'triple', cards: takeCards(k, 3) });
    }
  }
  changed = true;
  while (changed) {
    changed = false;
    const rem = getSortedRemaining();
    const tractors = findTractors(rem, 2, leadSuit, trumpSuit, trumpNumber);
    if (tractors.length > 0) {
      const best = tractors.sort((a, b) => b.length - a.length)[0];
      const tractorCards = [];
      for (const k of best) tractorCards.push(...takeCards(k, 2));
      compB.push({ type: 'pair_tractor', cards: tractorCards });
      changed = true;
    }
  }
  for (const [k] of getSortedRemaining()) {
    while (countRemaining(k) >= 2) {
      compB.push({ type: 'pair', cards: takeCards(k, 2) });
    }
  }
  for (const [k] of getSortedRemaining()) {
    while (countRemaining(k) >= 1) {
      compB.push({ type: 'single', cards: takeCards(k, 1) });
    }
  }
  const minTierB = compB.length ? Math.min(...compB.map(c => TIER[c.type])) : 0;

  // Pick whichever decomposition has the higher minimum tier
  const chosen = minTierA >= minTierB ? compA : compB;
  return [...components, ...chosen].sort((a, b) => TIER[b.type] - TIER[a.type]);
}

// Check if a hand can beat a specific sub-component
// Returns true if the hand contains a strictly higher combo of the same type/suit
function canBeatComponent(hand, component, trumpSuit, trumpNumber) {
  const { type, cards } = component;
  const suit = getLeadSuit(cards, trumpSuit, trumpNumber);
  const suitCards = getSuitCards(hand, suit, trumpSuit, trumpNumber);

  if (type === 'single') {
    const rank = trumpRank(cards[0], trumpSuit, trumpNumber);
    // Can beat if has higher card of same suit, or trump beats non-trump
    if (suit !== 'TRUMP') {
      if (suitCards.some(c => !isTrump(c, trumpSuit, trumpNumber) &&
          RANKS.indexOf(c.rank) > RANKS.indexOf(cards[0].rank))) return true;
      // trump beats non-trump single
      if (getSuitCards(hand, 'TRUMP', trumpSuit, trumpNumber).length > 0) return true;
    } else {
      if (suitCards.some(c => trumpRank(c, trumpSuit, trumpNumber) > rank)) return true;
    }
  }

  if (type === 'pair') {
    const rank = RANKS.indexOf(cards[0].rank);
    const cardTrumpRank = trumpRank(cards[0], trumpSuit, trumpNumber);
    const groups = {};
    for (const c of suitCards) {
      const k = cardKey(c, trumpSuit, trumpNumber);
      groups[k] = (groups[k] || 0) + 1;
    }
    for (const [k, cnt] of Object.entries(groups)) {
      if (cnt >= 2) {
        // Find a sample card for this key
        const sample = suitCards.find(c => cardKey(c, trumpSuit, trumpNumber) === k);
        if (!sample) continue;
        if (suit === 'TRUMP') {
          if (trumpRank(sample, trumpSuit, trumpNumber) > cardTrumpRank) return true;
        } else {
          if (RANKS.indexOf(sample.rank) > rank) return true;
          // trump pair beats non-trump pair
          const trumpGroups = {};
          for (const c of getSuitCards(hand, 'TRUMP', trumpSuit, trumpNumber)) {
            const tk = cardKey(c, trumpSuit, trumpNumber);
            trumpGroups[tk] = (trumpGroups[tk] || 0) + 1;
          }
          if (Object.values(trumpGroups).some(n => n >= 2)) return true;
        }
      }
    }
  }

  if (type === 'triple') {
    const rank = suit === 'TRUMP' ? trumpRank(cards[0], trumpSuit, trumpNumber) : RANKS.indexOf(cards[0].rank);
    const groups = {};
    for (const c of suitCards) {
      const k = cardKey(c, trumpSuit, trumpNumber);
      groups[k] = (groups[k] || 0) + 1;
    }
    for (const [k, cnt] of Object.entries(groups)) {
      if (cnt >= 3) {
        const sample = suitCards.find(c => cardKey(c, trumpSuit, trumpNumber) === k);
        if (!sample) continue;
        const sampleRank = suit === 'TRUMP' ? trumpRank(sample, trumpSuit, trumpNumber) : RANKS.indexOf(sample.rank);
        if (sampleRank > rank) return true;
      }
    }
    // trump triple beats non-trump triple
    if (suit !== 'TRUMP') {
      const tg = {};
      for (const c of getSuitCards(hand, 'TRUMP', trumpSuit, trumpNumber)) {
        const tk = cardKey(c, trumpSuit, trumpNumber);
        tg[tk] = (tg[tk] || 0) + 1;
      }
      if (Object.values(tg).some(n => n >= 3)) return true;
    }
  }

  if (type === 'pair_tractor' || type === 'triple_tractor') {
    const groupSize = type === 'triple_tractor' ? 3 : 2;
    // Find the highest pair/triple in the tractor
    const tractorGroups = {};
    for (const c of cards) {
      const k = cardKey(c, trumpSuit, trumpNumber);
      tractorGroups[k] = (tractorGroups[k] || 0) + 1;
    }
    const tractorKeys = Object.keys(tractorGroups);
    let maxRank = -1;
    for (const k of tractorKeys) {
      const sample = cards.find(c => cardKey(c, trumpSuit, trumpNumber) === k);
      const r = suit === 'TRUMP' ? trumpRank(sample, trumpSuit, trumpNumber) : RANKS.indexOf(sample.rank);
      if (r > maxRank) maxRank = r;
    }
    // Can beat if has same-length or longer tractor in same suit with higher top rank
    if (hasTractor(suitCards, groupSize, suit, trumpSuit, trumpNumber)) {
      // Check if any tractor in suitCards beats this one
      const hg = {};
      for (const c of suitCards) {
        const k = cardKey(c, trumpSuit, trumpNumber);
        hg[k] = (hg[k] || 0) + 1;
      }
      const eligibleKeys = Object.keys(hg).filter(k => hg[k] >= groupSize);
      const order = suit === 'TRUMP' ? getTrumpOrder(trumpSuit, trumpNumber) : null;
      const getIdx = (k) => order ? order.indexOf(k) : RANKS.indexOf(k.split('_')[k.split('_').length-1]);
      eligibleKeys.sort((a, b) => getIdx(a) - getIdx(b));
      // Look for consecutive run with top > maxRank
      for (let i = 1; i < eligibleKeys.length; i++) {
        if (getIdx(eligibleKeys[i]) === getIdx(eligibleKeys[i-1]) + 1) {
          const topRank = getIdx(eligibleKeys[i]);
          if (topRank > maxRank) return true;
        }
      }
    }
    // Trump tractor beats non-trump tractor
    if (suit !== 'TRUMP' && hasTractor(getSuitCards(hand, 'TRUMP', trumpSuit, trumpNumber), groupSize, 'TRUMP', trumpSuit, trumpNumber)) return true;
  }

  return false;
}

// Given a big play, find the first counterclockwise player who MUST challenge.
// Returns the seat index, or null if nobody can beat anything.
// Matches App.js call signature: findChallenger(leaderSeat, hands, playedCards, trumpSuit, trumpNumber)
// Returns { challengerSeat, components } or null
export function findChallenger(leaderSeat, hands, playedCards, trumpSuit, trumpNumber) {
  const components = decomposeCombo(playedCards, trumpSuit, trumpNumber);
  const order = [(leaderSeat + 3) % 4, (leaderSeat + 2) % 4, (leaderSeat + 1) % 4];
  for (const seat of order) {
    const hand = hands[seat] || [];
    if (components.some(comp => canBeatComponent(hand, comp, trumpSuit, trumpNumber))) {
      return { challengerSeat: seat, components };
    }
  }
  return null;
}

// ── Combo decomposition & auto-challenge ─────────────────────────────────────

// Tier values for comparison (higher = better)

// Given a hand's cards in one suit, find all possible groups keyed by cardKey
function getGroupMap(cards, trumpSuit, trumpNumber) {
  const map = {};
  for (const c of cards) {
    const k = cardKey(c, trumpSuit, trumpNumber);
    if (!map[k]) map[k] = [];
    map[k].push(c);
  }
  return map;
}

// Get consecutive key sequences (for tractor detection) sorted by rank
function getConsecutiveRuns(keys, leadSuit, trumpSuit, trumpNumber) {
  if (leadSuit === 'TRUMP') {
    const order = getTrumpOrder(trumpSuit, trumpNumber);
    const pos = keys.map(k => ({ k, p: order.indexOf(k) })).filter(x => x.p !== -1).sort((a, b) => a.p - b.p);
    return pos.map(x => x.k);
  } else {
    return keys
      .map(k => ({ k, r: RANKS.indexOf(k.split('_').pop()) }))
      .filter(x => x.r !== -1)
      .sort((a, b) => a.r - b.r)
      .map(x => x.k);
  }
}

// Find the longest tractor (consecutive pairs/triples) starting at each position
function findTractors(groupMap, minGroupSize, sortedKeys) {
  const tractors = [];
  for (let i = 0; i < sortedKeys.length; i++) {
    if ((groupMap[sortedKeys[i]] || []).length < minGroupSize) continue;
    let len = 1;
    while (i + len < sortedKeys.length && (groupMap[sortedKeys[i + len]] || []).length >= minGroupSize) len++;
    if (len >= 2) {
      tractors.push({ start: i, length: len, keys: sortedKeys.slice(i, i + len) });
    }
  }
  return tractors;
}

// Decompose a set of same-suit cards into the optimal sub-components
// "Optimal" = maximize the minimum tier across all components

// ── Auto-challenge detection ─────────────────────────────────────────────────


function getSortedKeys(map, leadSuit, trumpSuit, trumpNumber) {
  const keys = Object.keys(map);
  if (leadSuit === 'TRUMP') {
    const order = getTrumpOrder(trumpSuit, trumpNumber);
    return keys.filter(k => order.includes(k)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  return keys.sort((a, b) => RANKS.indexOf(a.split('_').pop()) - RANKS.indexOf(b.split('_').pop()));
}

function findTractorRuns(map, minGroupSize, sortedKeys) {
  const tractors = [];
  let i = 0;
  while (i < sortedKeys.length) {
    if ((map[sortedKeys[i]] || []).length < minGroupSize) { i++; continue; }
    let len = 1;
    while (i + len < sortedKeys.length && (map[sortedKeys[i + len]] || []).length >= minGroupSize) len++;
    if (len >= 2) tractors.push({ start: i, length: len, keys: sortedKeys.slice(i, i + len) });
    i += len;
  }
  return tractors;
}

function applyUsed(map, keys, count) {
  const copy = {};
  for (const k of Object.keys(map)) copy[k] = [...map[k]];
  for (const k of keys) {
    copy[k] = (copy[k] || []).slice(count);
    if (!copy[k].length) delete copy[k];
  }
  return copy;
}

// Decompose cards into components, maximizing the minimum tier
export function decomposeCards(cards, leadSuit, trumpSuit, trumpNumber) {
  const baseMap = getGroupMap(cards, trumpSuit, trumpNumber);

  function solve(map) {
    const sortedKeys = getSortedKeys(map, leadSuit, trumpSuit, trumpNumber);
    if (!sortedKeys.length) return { components: [], minTier: 999 };

    let best = null;

    const tryOption = (type, tier, usedKeys, usedCount, usedCards) => {
      const rest = solve(applyUsed(map, usedKeys, usedCount));
      const minTier = Math.min(tier, rest.minTier);
      const comp = { type, tier, cards: usedCards };
      if (!best || minTier > best.minTier) best = { components: [comp, ...rest.components], minTier };
    };

    // Triple tractor
    const tt = findTractorRuns(map, 3, sortedKeys);
    for (const t of tt) {
      for (let len = t.length; len >= 2; len--) {
        const tKeys = t.keys.slice(0, len);
        tryOption('triple_tractor', TIER.triple_tractor, tKeys, 3, tKeys.flatMap(k => map[k].slice(0, 3)));
      }
    }

    // Pair tractor
    const pt = findTractorRuns(map, 2, sortedKeys);
    for (const t of pt) {
      for (let len = t.length; len >= 2; len--) {
        const tKeys = t.keys.slice(0, len);
        tryOption('pair_tractor', TIER.pair_tractor, tKeys, 2, tKeys.flatMap(k => map[k].slice(0, 2)));
      }
    }

    // Triple
    for (const k of sortedKeys) {
      if ((map[k] || []).length >= 3) {
        tryOption('triple', TIER.triple, [k], 3, map[k].slice(0, 3));
        break;
      }
    }

    // Pair
    for (const k of sortedKeys) {
      if ((map[k] || []).length >= 2) {
        tryOption('pair', TIER.pair, [k], 2, map[k].slice(0, 2));
        break;
      }
    }

    // Single
    const sk = sortedKeys[0];
    tryOption('single', TIER.single, [sk], 1, [map[sk][0]]);

    return best || { components: [], minTier: 0 };
  }

  return solve(baseMap).components;
}

export function findMandatoryChallenger(leaderSeat, hands, leadCards, trumpSuit, trumpNumber) {
  const leadSuit = getLeadSuit(leadCards, trumpSuit, trumpNumber);
  const components = decomposeCards(leadCards, leadSuit, trumpSuit, trumpNumber);
  const order = [(leaderSeat + 3) % 4, (leaderSeat + 2) % 4, (leaderSeat + 1) % 4];
  for (const seat of order) {
    const hand = hands[seat] || [];
    if (components.some(comp => canBeatComponent(comp, hand, trumpSuit, trumpNumber))) {
      return seat;
    }
  }
  return null;
}
