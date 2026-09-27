// Unit tests for the game rules. Run with:  npm test
import { Deck, TrumpRules, Trick, FollowValidator, BigPlay, Scoring, TrumpDeclaration } from './index';

// Small helper for building cards by hand: card('♠', 'A'), card('JOKER', 'BIG')
let nextId = 1000;
const card = (suit, rank) => ({ id: nextId++, suit, rank, deck: 0 });
const cards = (...specs) => specs.map(([suit, rank]) => card(suit, rank));

// Hearts are trump and we're playing level 7.
const rules = new TrumpRules('♥', '7');

describe('Deck', () => {
  test('builds 3 decks of 54 cards with unique ids', () => {
    const all = Deck.build();
    expect(all).toHaveLength(162);
    expect(new Set(all.map((c) => c.id)).size).toBe(162);
    expect(all.filter((c) => c.suit === 'JOKER')).toHaveLength(6);
  });

  test('deals 156 cards round-robin and keeps a 6-card kitty', () => {
    const { sequence, kitty } = new Deck().dealSequential(2);
    expect(kitty).toHaveLength(6);
    expect(sequence).toHaveLength(156);
    expect(sequence[0].seat).toBe(2);
    expect(sequence[1].seat).toBe(3);
    expect(sequence[2].seat).toBe(0);
  });

  test('shuffle does not modify its input', () => {
    const all = Deck.build();
    const copy = [...all];
    Deck.shuffle(all);
    expect(all).toEqual(copy);
  });
});

describe('TrumpRules', () => {
  test('jokers, the trump number and the trump suit are all trump', () => {
    expect(rules.isTrump(card('JOKER', 'SMALL'))).toBe(true);
    expect(rules.isTrump(card('♠', '7'))).toBe(true);
    expect(rules.isTrump(card('♥', '2'))).toBe(true);
    expect(rules.isTrump(card('♠', 'A'))).toBe(false);
  });

  test('trump order: big joker > small joker > trump-suit 7 > other 7s > trump-suit ace', () => {
    const order = cards(['♥', 'A'], ['♠', '7'], ['♥', '7'], ['JOKER', 'SMALL'], ['JOKER', 'BIG']);
    const ranks = order.map((c) => rules.trumpRank(c));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  test('detects singles, pairs, triples and mixed plays', () => {
    expect(rules.detectCombo(cards(['♠', 'K'])).type).toBe('single');
    expect(rules.detectCombo(cards(['♠', 'K'], ['♠', 'K'])).type).toBe('pair');
    expect(rules.detectCombo(cards(['♠', 'K'], ['♠', 'K'], ['♠', 'K'])).type).toBe('triple');
    expect(rules.detectCombo(cards(['♠', 'K'], ['♠', 'Q'])).type).toBe('mixed');
  });

  test('a tractor skips over the trump number', () => {
    // 7 is trump, so ♠6-6 and ♠8-8 are consecutive in spades.
    const tractor = cards(['♠', '6'], ['♠', '6'], ['♠', '8'], ['♠', '8']);
    expect(rules.detectCombo(tractor).type).toBe('pair_tractor');
  });

  test('trump tractors follow the trump order', () => {
    const tractor = cards(['JOKER', 'SMALL'], ['JOKER', 'SMALL'], ['JOKER', 'BIG'], ['JOKER', 'BIG']);
    expect(rules.detectCombo(tractor).type).toBe('pair_tractor');
  });
});

describe('Trick', () => {
  test('highest card of the led suit wins', () => {
    const trick = new Trick([
      { playerIdx: 0, cards: cards(['♠', '10']) },
      { playerIdx: 1, cards: cards(['♠', 'A']) },
      { playerIdx: 2, cards: cards(['♣', 'A']) }, // off-suit, can't win
      { playerIdx: 3, cards: cards(['♠', 'K']) },
    ], rules);
    expect(trick.winner()).toBe(1);
    expect(trick.points()).toBe(20); // the 10 and the K
  });

  test('a trump single beats a non-trump single', () => {
    const trick = new Trick([
      { playerIdx: 2, cards: cards(['♠', 'A']) },
      { playerIdx: 3, cards: cards(['♥', '2']) },
    ], rules);
    expect(trick.winner()).toBe(3);
  });

  test('two unrelated trump cards cannot beat a pair', () => {
    const trick = new Trick([
      { playerIdx: 0, cards: cards(['♠', '9'], ['♠', '9']) },
      { playerIdx: 1, cards: cards(['♥', '2'], ['♥', 'K']) },
    ], rules);
    expect(trick.winner()).toBe(0);
  });
});

describe('FollowValidator', () => {
  const validator = new FollowValidator(rules);
  const lead = cards(['♠', '9'], ['♠', '9']);
  const leadCombo = { ...rules.detectCombo(lead), cards: lead };

  test('must play the same number of cards', () => {
    const hand = cards(['♠', '2'], ['♠', '3']);
    expect(validator.validate(hand.slice(0, 1), hand, leadCombo)).toMatch(/exactly 2/);
  });

  test('must follow suit when possible', () => {
    const hand = cards(['♠', '2'], ['♣', '3'], ['♣', '4']);
    expect(validator.validate([hand[1], hand[2]], hand, leadCombo)).toMatch(/Must play more ♠/);
  });

  test('must play a pair when holding one in the led suit', () => {
    const hand = cards(['♠', '2'], ['♠', '4'], ['♠', '4']);
    expect(validator.validate([hand[0], hand[1]], hand, leadCombo)).toMatch(/pair/);
    expect(validator.validate([hand[1], hand[2]], hand, leadCombo)).toBeNull();
  });
});

describe('BigPlay', () => {
  test('splits a multi-combo lead into components, strongest first', () => {
    const lead = cards(['♠', 'A'], ['♠', 'K'], ['♠', 'K']);
    const types = new BigPlay(lead, rules).components.map((c) => c.type);
    expect(types).toEqual(['pair', 'single']);
  });

  test('the first later player who can beat a component must challenge', () => {
    const lead = cards(['♠', 'Q'], ['♠', '3'], ['♠', '3']);
    const hands = [
      [],
      cards(['♣', 'A']),          // seat 1: nothing in spades
      cards(['♠', 'K']),          // seat 2: beats the ♠Q single
      cards(['♠', 'A'], ['♠', 'A']),
    ];
    const result = new BigPlay(lead, rules).findChallenger(0, hands);
    expect(result.challengerSeat).toBe(2);
    expect(result.beatableComponents.map((c) => c.type)).toEqual(['single']);
  });

  test('a single combo cannot be challenged', () => {
    const lead = cards(['♠', '3'], ['♠', '3']);
    expect(new BigPlay(lead, rules).findChallenger(0, [[], cards(['♠', 'A'], ['♠', 'A']), [], []])).toBeNull();
  });
});

// One test per bug found in the original rules code.
describe('bug fixes', () => {
  test('1: a follower is not forced to play a "tractor" of unrelated trump pairs', () => {
    const lead = cards(['♥', '9'], ['♥', '9'], ['♥', '10'], ['♥', '10']);
    const leadCombo = { ...rules.detectCombo(lead), cards: lead };
    // ♠7 pair (off-suit trump number) and ♥2 pair are not consecutive.
    const hand = cards(['♠', '7'], ['♠', '7'], ['♥', '2'], ['♥', '2'], ['♥', '4'], ['♥', '5']);
    const validator = new FollowValidator(rules);
    // Both pairs must be played (pairs rule), but they are not a tractor.
    expect(validator.validate(hand.slice(0, 4), hand, leadCombo)).toBeNull();
    const onePair = validator.validate([hand[2], hand[3], hand[4], hand[5]], hand, leadCombo);
    expect(onePair).toMatch(/more pair/);
    expect(onePair).not.toMatch(/tractor/);
  });

  test('1b: a real trump tractor in hand is still enforced', () => {
    const lead = cards(['♥', '9'], ['♥', '9'], ['♥', '10'], ['♥', '10']);
    const leadCombo = { ...rules.detectCombo(lead), cards: lead };
    // ♥A pair then ♠7 pair: the top trump-suit card and the off-suit trump number are consecutive.
    const hand = cards(['♥', 'A'], ['♥', 'A'], ['♠', '7'], ['♠', '7'], ['♥', '2'], ['♥', '4']);
    expect(new FollowValidator(rules).validate([hand[0], hand[1], hand[4], hand[5]], hand, leadCombo)).toMatch(/tractor/);
    expect(new FollowValidator(rules).validate(hand.slice(0, 4), hand, leadCombo)).toBeNull();
  });

  test('9: two separate pairs do not lock the player out when a tractor is led', () => {
    const lead = cards(['♠', '2'], ['♠', '2'], ['♠', '3'], ['♠', '3']);
    const leadCombo = { ...rules.detectCombo(lead), cards: lead };
    const hand = cards(['♠', '9'], ['♠', '9'], ['♠', 'K'], ['♠', 'K'], ['♠', '4']);
    const validator = new FollowValidator(rules);
    // Playing both pairs is legal…
    expect(validator.validate(hand.slice(0, 4), hand, leadCombo)).toBeNull();
    // …and breaking a pair up is not.
    expect(validator.validate([hand[0], hand[1], hand[2], hand[4]], hand, leadCombo)).toMatch(/pair/);
  });

  test('10: a required tractor can be played alongside filler cards', () => {
    const noTrump = new TrumpRules(null, '6');
    const lead = cards(['♣', 'Q'], ['♣', 'Q'], ['♣', 'Q'], ['♣', 'K'], ['♣', 'K'], ['♣', 'K']);
    const leadCombo = { ...noTrump.detectCombo(lead), cards: lead };
    const hand = cards(['♣', '10'], ['♣', '10'], ['♣', 'J'], ['♣', 'J'], ['♣', '2'], ['♣', '7'], ['♠', '3']);
    const validator = new FollowValidator(noTrump);
    expect(validator.validate(hand.slice(0, 6), hand, leadCombo)).toBeNull();
    // leaving the tractor out is still rejected
    expect(validator.validate([hand[0], hand[2], hand[4], hand[5], hand[1], hand[6]], hand, leadCombo)).not.toBeNull();
  });

  test('10b: a triple in hand does not make a pair-tractor lead unplayable', () => {
    const spadesTrump = new TrumpRules('♠', '2');
    const lead = cards(['♦', '5'], ['♦', '5'], ['♦', '6'], ['♦', '6']);
    const leadCombo = { ...spadesTrump.detectCombo(lead), cards: lead };
    const hand = cards(['♦', 'J'], ['♦', 'J'], ['♦', 'J'], ['♦', '10'], ['♦', '10'], ['♣', '7']);
    expect(new FollowValidator(spadesTrump).validate(hand.slice(1, 5), hand, leadCombo)).toBeNull();
  });

  test('2: big-play decomposition finds tractors that skip the trump number', () => {
    const lead = cards(['♠', '6'], ['♠', '6'], ['♠', '8'], ['♠', '8'], ['♠', 'A']);
    expect(new BigPlay(lead, rules).components.map((c) => c.type)).toEqual(['pair_tractor', 'single']);
  });

  test('3: joker tractors count in a no-trump round', () => {
    const noTrump = new TrumpRules(null, '7');
    const jokers = cards(['JOKER', 'SMALL'], ['JOKER', 'SMALL'], ['JOKER', 'BIG'], ['JOKER', 'BIG']);
    expect(noTrump.detectCombo(jokers).type).toBe('pair_tractor');
    // and a trump-number pair below the small jokers joins the tractor
    const withSevens = cards(['♣', '7'], ['♣', '7'], ['JOKER', 'SMALL'], ['JOKER', 'SMALL']);
    expect(noTrump.detectCombo(withSevens).type).toBe('pair_tractor');
  });

  test('4: pairs of off-suit trump numbers are the same rank, not a tractor', () => {
    const sevens = cards(['♠', '7'], ['♠', '7'], ['♦', '7'], ['♦', '7']);
    expect(rules.detectCombo(sevens).type).toBe('mixed');
    // but off-suit 7s followed by the trump-suit 7s is a tractor
    const up = cards(['♠', '7'], ['♠', '7'], ['♥', '7'], ['♥', '7']);
    expect(rules.detectCombo(up).type).toBe('pair_tractor');
  });

  test('5: equal trump numbers — the first one played keeps the trick', () => {
    const trick = new Trick([
      { playerIdx: 0, cards: cards(['♦', '7']) },
      { playerIdx: 1, cards: cards(['♠', '7']) },
    ], rules);
    expect(trick.winner()).toBe(0);
  });

  test('6: a shorter tractor cannot challenge a longer one', () => {
    const lead = cards(['♠', '2'], ['♠', '2'], ['♠', '3'], ['♠', '3'], ['♠', '4'], ['♠', '4'], ['♣', 'A']);
    const twoPairTractor = cards(['♠', 'K'], ['♠', 'K'], ['♠', 'A'], ['♠', 'A']);
    const play = new BigPlay(lead, rules);
    const tractor = play.components.find((c) => c.type === 'pair_tractor');
    expect(play.canBeat(twoPairTractor, tractor)).toBe(false);
    const threePairTractor = cards(['♠', 'Q'], ['♠', 'Q'], ['♠', 'K'], ['♠', 'K'], ['♠', 'A'], ['♠', 'A']);
    expect(play.canBeat(threePairTractor, tractor)).toBe(true);
  });

  test('7: trumping a big play requires the same shape', () => {
    const lead = cards(['♠', 'A'], ['♠', 'K'], ['♠', 'K']); // single + pair
    const singles = cards(['♥', '3'], ['♥', '5'], ['♥', '9']);
    const matching = cards(['♥', '3'], ['♥', '9'], ['♥', '9']);
    expect(new Trick([{ playerIdx: 0, cards: lead }, { playerIdx: 1, cards: singles }], rules).winner()).toBe(0);
    expect(new Trick([{ playerIdx: 0, cards: lead }, { playerIdx: 1, cards: matching }], rules).winner()).toBe(1);
  });

  test('8: kitty multiplier uses the winning play, not the whole trick', () => {
    const winningPair = cards(['♥', 'A'], ['♥', 'A']);
    expect(Scoring.kittyMultiplier(winningPair, rules)).toBe(4);
  });
});

describe('Scoring', () => {
  test('5s are worth 5, 10s and Ks are worth 10', () => {
    expect(Scoring.countPoints(cards(['♠', '5'], ['♥', '10'], ['♣', 'K'], ['♦', 'A']))).toBe(25);
  });

  test('attacker level gain depends on defender score', () => {
    expect(Scoring.attackerLevelGain(0)).toBe(3);
    expect(Scoring.attackerLevelGain(40)).toBe(2);
    expect(Scoring.attackerLevelGain(80)).toBe(1);
    expect(Scoring.attackerLevelGain(120)).toBe(0);
  });

  test('kitty multiplier doubles the size of the winning combo', () => {
    expect(Scoring.kittyMultiplier(cards(['♠', 'A']), rules)).toBe(2);
    expect(Scoring.kittyMultiplier(cards(['♠', 'A'], ['♠', 'A']), rules)).toBe(4);
  });
});

describe('TrumpDeclaration', () => {
  test('declares with the trump number, overrides only with more cards', () => {
    const one = cards(['♠', '7']);
    const two = cards(['♦', '7'], ['♦', '7']);
    expect(TrumpDeclaration.canDeclare(one, null, '7')).toBe(true);
    expect(TrumpDeclaration.canDeclare(cards(['♠', '8']), null, '7')).toBe(false);
    const current = { cards: one, declarationCount: 1 };
    expect(TrumpDeclaration.canDeclare(two, current, '7')).toBe(true);
    expect(TrumpDeclaration.canDeclare(cards(['♣', '7']), current, '7')).toBe(false);
  });

  test('jokers set no trump suit', () => {
    expect(TrumpDeclaration.trumpSuitOf(cards(['JOKER', 'BIG'], ['JOKER', 'BIG']))).toBeNull();
    expect(TrumpDeclaration.trumpSuitOf(cards(['♦', '7']))).toBe('♦');
  });
});
