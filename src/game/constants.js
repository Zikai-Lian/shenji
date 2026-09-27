// ── Shared constants ─────────────────────────────────────────────────────────

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const LEVELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// How strong each combo type is (higher = stronger). Used to compare plays.
export const TIER = { single: 0, pair: 1, triple: 2, pair_tractor: 3, triple_tractor: 4 };

// Same as TIER, but a "mixed" big play ranks below everything.
export const COMBO_TIER = { ...TIER, mixed: -1 };

export const comboTier = (type) => COMBO_TIER[type] ?? -1;
