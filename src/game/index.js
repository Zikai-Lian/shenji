// Shengji game rules, organized as classes:
//
//   Deck             building, shuffling and dealing the 3-deck shoe
//   TrumpRules       how cards and combos compare under the current trump
//   Trick            who wins a trick and how many points it's worth
//   FollowValidator  follow-suit rules for non-leading players
//   BigPlay          splitting a multi-combo lead and finding a challenger
//   Scoring          card points, kitty multiplier, level changes
//   TrumpDeclaration who can declare trump during the deal
//
// Cards are plain { id, suit, rank, deck } objects so game state can be
// saved to Supabase as JSON.

export { SUITS, RANKS, LEVELS, TIER } from './constants';
export { Deck } from './Deck';
export { TrumpRules } from './TrumpRules';
export { Trick } from './Trick';
export { FollowValidator } from './FollowValidator';
export { BigPlay } from './BigPlay';
export { Scoring } from './Scoring';
export { TrumpDeclaration } from './TrumpDeclaration';
