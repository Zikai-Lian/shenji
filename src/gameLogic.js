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

export function canDeclareTrump(cards, currentDeclaration) {
  // cards = cards being flipped to declare
  // currentDeclaration = { cards, playerIdx } or null
  if (!cards || cards.length === 0) return false;

  // 1 joker cannot declare
  if (cards.length === 1 && cards[0].suit === 'JOKER') return false;

  // Must all be same rank (or all jokers)
  const allSameRank = cards.every(c => c.rank === cards[0].rank);
  const allJokers = cards.every(c => c.suit === 'JOKER');
  if (!allSameRank && !allJokers) return false;

  // Must have more cards than current declaration to override
  if (currentDeclaration && cards.length <= currentDeclaration.cards.length) return false;

  return true;
}

export function getTrumpSuitFromDeclaration(declCards) {
  if (!declCards || declCards.length === 0) return null;
  if (declCards.every(c => c.suit === 'JOKER')) return null; // no trump suit
  return declCards[0].suit;
}
