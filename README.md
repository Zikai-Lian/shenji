# Shengji Online

A real-time, 4-player web version of Shengji (升级), the Chinese trick-taking
card game, played with three decks. Players join a room with a code from any
device, and every move syncs live to all four screens.

**Stack:** React, Supabase (PostgreSQL + realtime subscriptions), Vercel.

## How it's organized

```
src/
├── App.js            React UI, room/lobby flow, turn handling, Supabase sync
├── supabase.js       room create/join/update + realtime subscription
└── game/             the game rules, as plain classes with no React or network code
    ├── constants.js
    ├── Deck.js
    ├── TrumpRules.js
    ├── Trick.js
    ├── FollowValidator.js
    ├── BigPlay.js
    ├── Scoring.js
    ├── TrumpDeclaration.js
    ├── index.js
    └── game.test.js  unit tests (npm test)
```

The rules live in `src/game/` and know nothing about React or Supabase, so
they can be tested on their own.

| Class | Responsibility |
|---|---|
| `Deck` | Builds the 162-card, 3-deck shoe; shuffles; deals in seat order with a 6-card kitty |
| `TrumpRules` | Holds the current trump suit and trump number, and answers every "how do cards compare" question: is a card trump, its rank, what combo a play is (single, pair, triple, tractor, mixed) |
| `Trick` | Decides who wins a trick and how many points it holds |
| `FollowValidator` | Enforces follow-suit rules for players who didn't lead (match the suit, then pairs, triples and tractors) |
| `BigPlay` | Splits a multi-combo lead into components and finds the first player forced to challenge it |
| `Scoring` | Card points, kitty multiplier, level changes |
| `TrumpDeclaration` | Who can declare or override trump during the deal |

Most rules depend on the trump suit and trump number, so `Trick`,
`FollowValidator` and `BigPlay` each receive a `TrumpRules` object
(composition) instead of passing those two values through every function:

```js
const rules = new TrumpRules(game.trumpSuit, game.trumpNumber);
const combo = rules.detectCombo(selectedCards);
const error = new FollowValidator(rules).validate(selectedCards, hand, leadCombo);
const winner = new Trick(currentTrick, rules).winner();
```

Cards stay plain `{ id, suit, rank, deck }` objects rather than class
instances, because the whole game state is saved to Supabase as JSON and
broadcast to the other players.

## Running it

```bash
npm install
npm start      # dev server
npm test       # unit tests
npm run build  # production build
```

The Supabase project URL and publishable key are set in `src/supabase.js`.
