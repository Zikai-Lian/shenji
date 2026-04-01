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
  if (!trumpSuit || !trumpNumber) return order;
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

  // Trump beats non-trump ONLY if combo type matches
  // e.g. 2 trump singles cannot beat a non-trump pair
  if (chalTrump && !currTrump) {
    const chalCombo = detectCombo(challenger, trumpSuit, trumpNumber);
    const currCombo = detectCombo(current, trumpSuit, trumpNumber);
    const tiers = { single: 0, pair: 1, triple: 2, pair_tractor: 3, triple_tractor: 4, mixed: -1 };
    const chalTier = tiers[chalCombo.type] ?? -1;
    const currTier = tiers[currCombo.type] ?? -1;
    return chalTier >= currTier; // must match or exceed combo type to beat
  }
  if (!chalTrump && currTrump) return false;

  // Must be same suit as lead to beat
  if (!chalTrump && chalSuit !== leadSuit) return false;

  // Both same suit — detect combo types and enforce matching
  const chalCombo = detectCombo(challenger, trumpSuit, trumpNumber);
  const currCombo = detectCombo(current, trumpSuit, trumpNumber);

  const comboTier = (type) => {
    const tiers = { single: 0, pair: 1, triple: 2, pair_tractor: 3, triple_tractor: 4, mixed: -1 };
    return tiers[type] ?? -1;
  };

  const chalTier = comboTier(chalCombo.type);
  const currTier = comboTier(currCombo.type);

  // Challenger must be the SAME combo tier — a tractor cannot beat a pair,
  // a pair cannot beat a single. Only like-for-like combos compete.
  if (chalTier !== currTier) return false;

  // Compare highest individual card ranks
  const rankOf = (card) =>
    isTrump(card, trumpSuit, trumpNumber)
      ? trumpRank(card, trumpSuit, trumpNumber)
      : suitRank(card);

  const chalMax = Math.max(...challenger.map(rankOf));
  const currMax = Math.max(...current.map(rankOf));
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
  // Jokers: must be all BIG or all SMALL (no mixing), and need 2+
  if (allJokers) {
    const allBig = cards.every(c => c.rank === 'BIG');
    const allSmall = cards.every(c => c.rank === 'SMALL');
    if (!allBig && !allSmall) return false; // mixed jokers not allowed
    if (cards.length < 2) return false;
  }
  if (!allJokers && cards[0].rank !== trumpNumber) return false;
  if (currentDeclaration) {
    if (currentDeclaration.locked) return false;
    const currentCount = currentDeclaration.declarationCount || currentDeclaration.cards.length;
    if (cards.length <= currentCount) return false;
  }
  return true;
}

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
    // Normalize: all non-suit trump numbers are the same rank (equal in Sheng Ji)
    const normalize = (k) => k.startsWith('TRUMP_NUM_') && k !== 'TRUMP_NUM_TRUMP_SUIT' ? 'TRUMP_NUM_NONSUIT' : k;
    // Count total cards per normalized slot
    const normalGroups = {};
    for (const k of eligibleKeys) {
      const nk = normalize(k);
      normalGroups[nk] = (normalGroups[nk] || 0) + groups[k];
    }
    // Build normalized order (deduplicated)
    const normalOrder = [];
    const seen = new Set();
    for (const k of order) {
      const nk = normalize(k);
      if (!seen.has(nk)) { normalOrder.push(nk); seen.add(nk); }
    }
    // Check consecutive slots where each has >= groupSize cards
    const eligibleNorm = Object.keys(normalGroups).filter(k => normalGroups[k] >= groupSize);
    const positions = eligibleNorm.map(k => normalOrder.indexOf(k)).filter(p => p !== -1).sort((a, b) => a - b);
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
    // Only exact pairs force play — triples are exempt
    const groups = {};
    for (const card of suitInHand) {
      const k = cardKey(card, trumpSuit, trumpNumber);
      groups[k] = (groups[k] || 0) + 1;
    }
    const hasExactPair = Object.values(groups).some(n => n === 2);
    if (hasExactPair) {
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
    // Priority: pair tractor → exact pairs → singles
    // Triples (3-of-a-kind) are EXEMPT — cannot be forced as a pair
    const handHasPairTractor = hasTractor(suitInHand, 2, leadSuit, trumpSuit, trumpNumber);
    // Count only EXACT pairs (count===2), not triples or quads
    const countExactPairs = (cards) => {
      const groups = {};
      for (const card of cards) {
        const k = cardKey(card, trumpSuit, trumpNumber);
        groups[k] = (groups[k] || 0) + 1;
      }
      return Object.values(groups).filter(n => n === 2).length;
    };
    const handExactPairs = countExactPairs(suitInHand);
    const playedPairTractor = playedHasTractor(playedInSuit, 2, trumpSuit, trumpNumber);
    const playedPairs = countGroups(playedInSuit, 2, trumpSuit, trumpNumber);

    if (handHasPairTractor && !playedPairTractor) return `You have a pair tractor — must play it`;
    if (!handHasPairTractor && handExactPairs >= 2 && playedPairs < 2) return `You have 2 pairs — must play both`;
    if (!handHasPairTractor && handExactPairs === 1 && playedPairs < 1) return `You have a pair — must play it`;
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
  if (!cards || cards.length === 0) return [];
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

// Check if a hand can beat a specific sub-component of a big play.
// Only returns true if the hand has a card/combo that STRICTLY beats the component
// in the same suit context (or trump beating non-trump).
function canBeatComponent(hand, component, trumpSuit, trumpNumber) {
  const { type, cards } = component;
  const leadSuit = getLeadSuit(cards, trumpSuit, trumpNumber);

  // Get all cards in hand that are in the same suit as the component
  const suitCards = getSuitCards(hand, leadSuit, trumpSuit, trumpNumber);

  // For non-trump leads: also check if hand has any trump at all
  const handTrump = leadSuit !== 'TRUMP'
    ? hand.filter(c => isTrump(c, trumpSuit, trumpNumber))
    : [];

  // Rank of a card within trump ordering
  const tr = (card) => trumpRank(card, trumpSuit, trumpNumber);
  // Rank of a card within its non-trump suit
  const sr = (card) => RANKS.indexOf(card.rank);

  if (type === 'single') {
    const ledCard = cards[0];
    if (leadSuit === 'TRUMP') {
      // Need a higher trump card
      return suitCards.some(c => tr(c) > tr(ledCard));
    } else {
      // Need a higher card of the SAME non-trump suit specifically
      // Trump does NOT force a challenge on a non-trump single in a big play
      return suitCards.some(c => sr(c) > sr(ledCard));
    }
  }

  if (type === 'pair') {
    const ledRank = leadSuit === 'TRUMP' ? tr(cards[0]) : sr(cards[0]);
    // Build groups of 2+ in suitCards
    const groups = {};
    for (const c of suitCards) {
      const k = cardKey(c, trumpSuit, trumpNumber);
      if (!groups[k]) groups[k] = [];
      groups[k].push(c);
    }
    for (const [k, grp] of Object.entries(groups)) {
      if (grp.length >= 2) {
        const r = leadSuit === 'TRUMP' ? tr(grp[0]) : sr(grp[0]);
        if (r > ledRank) return true;
      }
    }
    // Challenge: only same-suit higher pair counts, not trump pairs
    return false;
  }

  if (type === 'triple') {
    const ledRank = leadSuit === 'TRUMP' ? tr(cards[0]) : sr(cards[0]);
    const groups = {};
    for (const c of suitCards) {
      const k = cardKey(c, trumpSuit, trumpNumber);
      if (!groups[k]) groups[k] = [];
      groups[k].push(c);
    }
    for (const [k, grp] of Object.entries(groups)) {
      if (grp.length >= 3) {
        const r = leadSuit === 'TRUMP' ? tr(grp[0]) : sr(grp[0]);
        if (r > ledRank) return true;
      }
    }
    // Challenge: only same-suit higher triple counts
    return false;
  }

  if (type === 'pair_tractor' || type === 'triple_tractor') {
    const groupSize = type === 'triple_tractor' ? 3 : 2;
    // Find highest rank in the led tractor
    let maxLedRank = -Infinity;
    for (const card of cards) {
      const r = leadSuit === 'TRUMP' ? tr(card) : sr(card);
      if (r > maxLedRank) maxLedRank = r;
    }
    // Build eligible keys (have groupSize+ copies) from suitCards
    const hg = {};
    for (const c of suitCards) {
      const k = cardKey(c, trumpSuit, trumpNumber);
      if (!hg[k]) hg[k] = { cards: [], key: k };
      hg[k].cards.push(c);
    }
    const eligible = Object.values(hg).filter(g => g.cards.length >= groupSize);
    if (eligible.length >= 2) {
      // Sort by rank
      eligible.sort((a, b) => {
        const ra = leadSuit === 'TRUMP' ? tr(a.cards[0]) : sr(a.cards[0]);
        const rb = leadSuit === 'TRUMP' ? tr(b.cards[0]) : sr(b.cards[0]);
        return ra - rb;
      });
      // Check for consecutive run with top rank > maxLedRank
      const order = leadSuit === 'TRUMP' ? getTrumpOrder(trumpSuit, trumpNumber) : null;
      for (let i = 1; i < eligible.length; i++) {
        const rPrev = leadSuit === 'TRUMP' ? order.indexOf(eligible[i-1].key) : sr(eligible[i-1].cards[0]);
        const rCurr = leadSuit === 'TRUMP' ? order.indexOf(eligible[i].key) : sr(eligible[i].cards[0]);
        const topR  = leadSuit === 'TRUMP' ? tr(eligible[i].cards[0]) : sr(eligible[i].cards[0]);
        if (rCurr === rPrev + 1 && topR > maxLedRank) return true;
      }
    }
    // Challenge: only same-suit higher tractor counts
    return false;
  }

  return false;
}


// Given a big play, find the first counterclockwise player who MUST challenge.
// Returns the seat index, or null if nobody can beat anything.
// Matches App.js call signature: findChallenger(leaderSeat, hands, playedCards, trumpSuit, trumpNumber)
// Returns { challengerSeat, components } or null
export function findChallenger(leaderSeat, hands, playedCards, trumpSuit, trumpNumber) {
  const components = decomposeCombo(playedCards, trumpSuit, trumpNumber);

  // Challenge only applies to big plays with MULTIPLE components
  // A single combo (one pair, one tractor, one triple etc.) cannot be challenged
  if (components.length < 2) return null;

  // Clockwise order: next seat, across, then prev seat
  const order = [(leaderSeat + 1) % 4, (leaderSeat + 2) % 4, (leaderSeat + 3) % 4];
  for (const seat of order) {
    const hand = hands[seat] || [];
    // Find which components this player can beat (only same non-trump suit)
    const beatableComponents = components.filter(comp =>
      canBeatComponent(hand, comp, trumpSuit, trumpNumber)
    );
    if (beatableComponents.length > 0) {
      // Challenger must force leader to keep one of the beatable components
      // (they pick which beatable component stays — the others go back to leader's hand)
      return { challengerSeat: seat, components, beatableComponents };
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
  const order = [(leaderSeat + 1) % 4, (leaderSeat + 2) % 4, (leaderSeat + 3) % 4];
  for (const seat of order) {
    const hand = hands[seat] || [];
    if (components.some(comp => canBeatComponent(comp, hand, trumpSuit, trumpNumber))) {
      return seat;
    }
  }
  return null;
}
