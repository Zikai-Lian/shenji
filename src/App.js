import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, createRoom, joinRoom, updateRoom, subscribeToRoom } from './supabase';
import {
  buildDecks, dealCards, isTrump, trumpRank, suitRank,
  detectCombo, trickWinner, countPoints, cardPoints,
  attackerLevelGain, defenderLevelGain, kittyMultiplier,
  canDeclareTrump, getTrumpSuitFromDeclaration, LEVELS, SUITS, RANKS
} from './gameLogic';

// ── Styles ────────────────────────────────────────────────────────────────────
const GOLD = '#c9a140';
const RED = '#e05252';
const GREEN = '#52a869';
const BG = '#0d1117';
const SURFACE = '#161b22';
const BORDER = '#30363d';
const TEXT = '#e6edf3';
const MUTED = '#7d8590';

const S = {
  app: { minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Noto Serif SC', 'Georgia', serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  title: { fontSize: 'clamp(28px, 6vw, 52px)', fontWeight: 700, color: GOLD, letterSpacing: '0.15em', textAlign: 'center', marginBottom: '8px', textShadow: `0 0 40px ${GOLD}44` },
  subtitle: { color: MUTED, fontSize: '13px', letterSpacing: '0.2em', textAlign: 'center', marginBottom: '40px', textTransform: 'uppercase' },
  card: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '440px' },
  input: { width: '100%', background: '#0d1117', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '12px 16px', color: TEXT, fontSize: '16px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: '12px' },
  btn: (color = GOLD) => ({ background: color, color: color === GOLD ? '#000' : '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: '8px', fontFamily: 'inherit', letterSpacing: '0.05em', transition: 'opacity 0.15s' }),
  btnOutline: { background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '12px 24px', fontSize: '15px', cursor: 'pointer', width: '100%', fontFamily: 'inherit' },
  label: { fontSize: '11px', color: MUTED, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' },
  section: { marginBottom: '20px' },
  error: { color: RED, fontSize: '13px', marginBottom: '12px', padding: '8px 12px', background: '#e0525211', borderRadius: '6px', border: `1px solid ${RED}44` },
  playingCard: (selected, suit) => ({
    display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
    width: '52px', height: '76px', background: selected ? '#fff9e6' : '#fff',
    border: `2px solid ${selected ? GOLD : '#ddd'}`,
    borderRadius: '6px', cursor: 'pointer', padding: '4px 5px',
    color: (suit === '♥' || suit === '♦' || suit === 'JOKER') ? '#e03030' : '#111',
    fontSize: '13px', fontWeight: 700, userSelect: 'none', flexShrink: 0,
    boxShadow: selected ? `0 0 12px ${GOLD}88` : '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'all 0.1s', transform: selected ? 'translateY(-8px)' : 'none',
    position: 'relative',
  }),
  hand: { display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', padding: '8px 0' },
  trickSlot: { width: '60px', height: '88px', border: `1px dashed ${BORDER}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: '11px' },
  badge: (color) => ({ background: `${color}22`, border: `1px solid ${color}66`, color, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }),
  playerSlot: (active, isMe) => ({
    padding: '10px 16px', borderRadius: '8px', border: `1px solid ${active ? GOLD : isMe ? '#3fb95044' : BORDER}`,
    background: active ? `${GOLD}11` : isMe ? '#3fb95011' : 'transparent',
    transition: 'all 0.2s',
  }),
};

// ── Card component ────────────────────────────────────────────────────────────
function PlayingCard({ card, selected, onClick, small }) {
  const isRed = card.suit === '♥' || card.suit === '♦' || card.suit === 'JOKER';
  const display = card.suit === 'JOKER'
    ? (card.rank === 'BIG' ? '🃏' : '🤡')
    : card.rank;
  const suitDisplay = card.suit === 'JOKER' ? (card.rank === 'BIG' ? 'BIG' : 'SML') : card.suit;

  if (small) {
    return (
      <div style={{
        ...S.playingCard(selected, card.suit),
        width: '36px', height: '52px', fontSize: '11px', padding: '2px 3px'
      }} onClick={onClick}>
        <span style={{ color: isRed ? '#e03030' : '#111', lineHeight: 1 }}>{display}</span>
        <span style={{ fontSize: '10px', color: isRed ? '#e03030' : '#111' }}>{suitDisplay}</span>
      </div>
    );
  }

  return (
    <div style={S.playingCard(selected, card.suit)} onClick={onClick}>
      <div style={{ fontSize: '12px', lineHeight: 1 }}>{display}</div>
      <div style={{ fontSize: '16px', lineHeight: 1 }}>{suitDisplay}</div>
      <div style={{ fontSize: '12px', lineHeight: 1, transform: 'rotate(180deg)' }}>{display}</div>
    </div>
  );
}

// ── Lobby Screen ──────────────────────────────────────────────────────────────
function LobbyScreen({ room, playerId, onStart }) {
  const isHost = room.host_id === playerId;
  const canStart = room.players.length === 4;
  const me = room.players.find(p => p.id === playerId);

  return (
    <div style={{ width: '100%', maxWidth: '440px' }}>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={S.label}>Room Code</span>
          <span style={{ fontSize: '28px', fontWeight: 900, color: GOLD, letterSpacing: '0.3em' }}>{room.code}</span>
        </div>
        <div style={{ marginBottom: '20px' }}>
          {[0, 1, 2, 3].map(seat => {
            const player = room.players.find(p => p.seat === seat);
            const team = seat % 2 === 0 ? 'Team A' : 'Team B';
            const teamColor = seat % 2 === 0 ? GOLD : '#52a8a8';
            return (
              <div key={seat} style={{ ...S.playerSlot(false, player?.id === playerId), marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={S.badge(teamColor)}>{team}</span>
                  <span style={{ color: player ? TEXT : MUTED }}>
                    {player ? player.name : 'Waiting...'}
                  </span>
                </div>
                {player?.id === playerId && <span style={S.badge(GREEN)}>YOU</span>}
                {player?.id === room.host_id && <span style={S.badge(GOLD)}>HOST</span>}
              </div>
            );
          })}
        </div>
        <div style={{ color: MUTED, fontSize: '12px', marginBottom: '16px', textAlign: 'center' }}>
          Teams: Seats 1 & 3 vs Seats 2 & 4
        </div>
        {isHost && (
          <button style={S.btn(canStart ? GOLD : '#444')} disabled={!canStart} onClick={onStart}>
            {canStart ? '▶ Start Game' : `Waiting for players (${room.players.length}/4)`}
          </button>
        )}
        {!isHost && (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: '13px' }}>
            Waiting for host to start...
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const subRef = useRef(null);

  // Game state (from room.game)
  const game = room?.game;
  const mySeat = room?.players?.find(p => p.id === playerId)?.seat ?? -1;
  const myHand = game?.hands?.[mySeat] ?? [];
  const myTeam = mySeat % 2; // 0 = team A (seats 0,2), 1 = team B (seats 1,3)

  // ── Supabase subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!room) return;
    if (subRef.current) subRef.current.unsubscribe();
    subRef.current = subscribeToRoom(room.id, (updated) => {
      setRoom(updated);
      if (updated.state === 'game') setScreen('game');
    });
    return () => { if (subRef.current) subRef.current.unsubscribe(); };
  }, [room?.id]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!playerName.trim()) return setError('Enter your name');
    setLoading(true); setError('');
    try {
      const { room: r, playerId: pid } = await createRoom(playerName.trim());
      setRoom(r); setPlayerId(pid); setScreen('lobby');
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!playerName.trim()) return setError('Enter your name');
    if (!joinCode.trim()) return setError('Enter room code');
    setLoading(true); setError('');
    try {
      const { room: r, playerId: pid } = await joinRoom(joinCode, playerName.trim());
      setRoom(r); setPlayerId(pid); setScreen('lobby');
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleStartGame = async () => {
    const decks = buildDecks();
    const { hands, kitty } = dealCards(decks);
    const initialGame = {
      phase: 'dealing', // dealing | kitty | playing | round_end
      hands,
      kitty,
      kittyHolder: 0,
      trumpDeclaration: null,
      trumpSuit: null,
      trumpNumber: LEVELS[0], // '2'
      currentTrick: [],
      tricks: [],
      scores: [0, 0], // [team0, team1]
      levels: [0, 0], // index into LEVELS array
      attackingTeam: 0,
      currentTurn: 0,
      selectedCards: [[], [], [], []],
      log: [],
      roundNum: 1,
    };
    await updateRoom(room.id, { state: 'game', game: initialGame });
  };

  // ── Game Actions ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);

  const toggleCard = (cardId) => {
    setSelectedIds(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const selectedCards = myHand.filter(c => selectedIds.includes(c.id));

  const handleDeclareTrump = async () => {
    if (!game || selectedCards.length === 0) return;
    if (!canDeclareTrump(selectedCards, game.trumpDeclaration)) {
      return setError('Invalid trump declaration');
    }
    const trumpSuit = getTrumpSuitFromDeclaration(selectedCards);
    const newGame = {
      ...game,
      trumpDeclaration: { cards: selectedCards, playerIdx: mySeat },
      trumpSuit,
    };
    await updateRoom(room.id, { game: newGame });
    setSelectedIds([]);
  };

  const handleTakeKitty = async () => {
    if (mySeat !== game.kittyHolder) return;
    const newHand = [...myHand, ...game.kitty];
    const newHands = game.hands.map((h, i) => i === mySeat ? newHand : h);
    await updateRoom(room.id, { game: { ...game, phase: 'kitty', hands: newHands, kitty: [] } });
  };

  const handleDiscardKitty = async () => {
    if (mySeat !== game.kittyHolder) return;
    if (selectedCards.length !== 6) return setError('Select exactly 6 cards to discard');
    const newHand = myHand.filter(c => !selectedIds.includes(c.id));
    const newHands = game.hands.map((h, i) => i === mySeat ? newHand : h);
    await updateRoom(room.id, {
      game: { ...game, phase: 'playing', hands: newHands, kitty: selectedCards, currentTurn: game.kittyHolder, log: [...(game.log || []), `${room.players[mySeat].name} discarded kitty and set trump.`] }
    });
    setSelectedIds([]);
  };

  const handlePlayCards = async () => {
    if (game.currentTurn !== mySeat) return setError("Not your turn");
    if (selectedCards.length === 0) return setError('Select cards to play');

    const combo = detectCombo(selectedCards, game.trumpSuit, game.trumpNumber);
    if (!combo.valid) return setError('Invalid combo');

    // Check if leading or following
    const isLeading = game.currentTrick.length === 0;
    if (!isLeading) {
      // Validate follow — simplified: must follow suit if possible
      const leadSuit = game.currentTrick[0].suit;
      const hasSuit = myHand.filter(c => !selectedIds.includes(c.id)).some(c =>
        leadSuit === 'TRUMP' ? isTrump(c, game.trumpSuit, game.trumpNumber) : c.suit === leadSuit && !isTrump(c, game.trumpSuit, game.trumpNumber)
      );
      // Basic follow check — more complex validation would go here
    }

    const newHand = myHand.filter(c => !selectedIds.includes(c.id));
    const newHands = game.hands.map((h, i) => i === mySeat ? newHand : h);
    const newTrick = [...game.currentTrick, { playerIdx: mySeat, cards: selectedCards, playerName: room.players[mySeat].name }];

    let newGame = { ...game, hands: newHands, currentTrick: newTrick };

    if (newTrick.length === 4) {
      // Resolve trick
      const winner = trickWinner(newTrick, game.trumpSuit, game.trumpNumber);
      const trickPoints = newTrick.flatMap(p => p.cards).reduce((s, c) => s + cardPoints(c), 0);
      const winnerTeam = winner % 2;
      const newScores = [...game.scores];
      newScores[winnerTeam] += trickPoints;

      const newTricks = [...(game.tricks || []), { plays: newTrick, winner, points: trickPoints }];
      const log = [...(game.log || []), `${room.players[winner].name} wins trick (+${trickPoints} pts)`];

      // Check if round over
      const totalCards = newHands.reduce((s, h) => s + h.length, 0);
      if (totalCards === 0) {
        // Round over — add kitty points
        const kittyPts = countPoints(game.kitty || []);
        const lastTrickWinnerTeam = winner % 2;
        const mult = kittyMultiplier(newTrick.flatMap(p => p.cards), game.trumpSuit, game.trumpNumber);
        newScores[lastTrickWinnerTeam] += kittyPts * mult;

        const defScore = newScores[1 - game.attackingTeam];
        const atkGain = attackerLevelGain(defScore);
        const defGain = defenderLevelGain(defScore);

        newGame = {
          ...newGame,
          hands: newHands,
          currentTrick: [],
          tricks: newTricks,
          scores: newScores,
          phase: 'round_end',
          roundResult: { defScore, atkGain, defGain, kittyPts, kittyMult: mult },
          log: [...log, `Round over! Defenders scored ${defScore} pts.`],
        };
      } else {
        newGame = {
          ...newGame,
          hands: newHands,
          currentTrick: [],
          tricks: newTricks,
          scores: newScores,
          currentTurn: winner,
          log,
        };
      }
    } else {
      newGame.currentTurn = (mySeat + 1) % 4;
    }

    await updateRoom(room.id, { game: newGame });
    setSelectedIds([]);
  };

  const handleNextRound = async () => {
    const r = game.roundResult;
    const newLevels = [...game.levels];
    const newAttacking = r.defScore >= 120
      ? 1 - game.attackingTeam  // defenders win, switch
      : game.attackingTeam;

    if (r.defScore >= 120) {
      newLevels[1 - game.attackingTeam] = Math.max(0, (newLevels[1 - game.attackingTeam] || 0) + Math.max(0, r.defGain));
    } else {
      newLevels[game.attackingTeam] = Math.min(12, (newLevels[game.attackingTeam] || 0) + r.atkGain);
    }

    // Check win
    if (newLevels[0] > 12 || newLevels[1] > 12) {
      await updateRoom(room.id, { game: { ...game, phase: 'game_over', levels: newLevels } });
      return;
    }

    const decks = buildDecks();
    const { hands, kitty } = dealCards(decks);
    const newKittyHolder = (game.kittyHolder + (r.defScore >= 120 ? 1 : 2)) % 4;

    await updateRoom(room.id, {
      game: {
        ...game,
        phase: 'dealing',
        hands,
        kitty,
        kittyHolder: newKittyHolder,
        trumpDeclaration: null,
        trumpSuit: null,
        trumpNumber: LEVELS[newLevels[newAttacking]],
        currentTrick: [],
        tricks: [],
        scores: [0, 0],
        levels: newLevels,
        attackingTeam: newAttacking,
        currentTurn: newKittyHolder,
        selectedCards: [[], [], [], []],
        log: [`Round ${game.roundNum + 1} starts. ${room.players[newKittyHolder].name} holds kitty.`],
        roundNum: (game.roundNum || 1) + 1,
        roundResult: null,
      }
    });
  };

  // ── Sort hand ────────────────────────────────────────────────────────────
  const sortedHand = [...myHand].sort((a, b) => {
    if (!game) return 0;
    const aTrump = isTrump(a, game.trumpSuit, game.trumpNumber);
    const bTrump = isTrump(b, game.trumpSuit, game.trumpNumber);
    if (aTrump && !bTrump) return 1;
    if (!aTrump && bTrump) return -1;
    if (aTrump && bTrump) return trumpRank(a, game.trumpSuit, game.trumpNumber) - trumpRank(b, game.trumpSuit, game.trumpNumber);
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return suitRank(a) - suitRank(b);
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={S.title}>升级</div>
      <div style={S.subtitle}>Sheng Ji · 3 Decks</div>

      {screen === 'home' && (
        <div style={S.card}>
          <div style={S.section}>
            <label style={S.label}>Your Name</label>
            <input style={S.input} placeholder="Enter your name" value={playerName} onChange={e => setPlayerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          </div>
          {error && <div style={S.error}>{error}</div>}
          <button style={S.btn(GOLD)} onClick={handleCreate} disabled={loading}>
            {loading ? '...' : '+ Create Room'}
          </button>
          <div style={{ ...S.section, marginTop: '20px' }}>
            <label style={S.label}>Join with Code</label>
            <input style={S.input} placeholder="4-letter code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={4} />
            <button style={S.btn('#3a4a6b')} onClick={handleJoin} disabled={loading}>
              {loading ? '...' : '→ Join Room'}
            </button>
          </div>
        </div>
      )}

      {screen === 'lobby' && room && (
        <LobbyScreen room={room} playerId={playerId} onStart={handleStartGame} />
      )}

      {screen === 'game' && game && (
        <GameScreen
          game={game} room={room} mySeat={mySeat} myTeam={myTeam}
          sortedHand={sortedHand} selectedIds={selectedIds} toggleCard={toggleCard}
          selectedCards={selectedCards} error={error} setError={setError}
          onDeclareTrump={handleDeclareTrump} onTakeKitty={handleTakeKitty}
          onDiscardKitty={handleDiscardKitty} onPlayCards={handlePlayCards}
          onNextRound={handleNextRound} playerId={playerId}
        />
      )}
    </div>
  );
}

// ── Game Screen ───────────────────────────────────────────────────────────────
function GameScreen({ game, room, mySeat, myTeam, sortedHand, selectedIds, toggleCard, selectedCards, error, setError, onDeclareTrump, onTakeKitty, onDiscardKitty, onPlayCards, onNextRound, playerId }) {
  const isMyTurn = game.currentTurn === mySeat;
  const isKittyHolder = game.kittyHolder === mySeat;
  const attackTeamName = `Team ${game.attackingTeam === 0 ? 'A' : 'B'}`;
  const myTeamAttacking = myTeam === game.attackingTeam;

  return (
    <div style={{ width: '100%', maxWidth: '640px' }}>

      {/* Scores & Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ ...S.label, marginBottom: '4px' }}>Team A Level</div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: game.attackingTeam === 0 ? GOLD : TEXT }}>
            {LEVELS[game.levels[0]]}
          </div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ ...S.label, marginBottom: '2px' }}>Trump</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: GOLD }}>{game.trumpNumber}</div>
          <div style={{ fontSize: '13px', color: game.trumpSuit ? RED : MUTED }}>{game.trumpSuit || 'No suit yet'}</div>
        </div>
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ ...S.label, marginBottom: '4px' }}>Team B Level</div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: game.attackingTeam === 1 ? GOLD : TEXT }}>
            {LEVELS[game.levels[1]]}
          </div>
        </div>
      </div>

      {/* Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        {[0, 1].map(team => (
          <div key={team} style={{ background: SURFACE, border: `1px solid ${team === myTeam ? GOLD + '44' : BORDER}`, borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: MUTED, fontSize: '12px' }}>Team {team === 0 ? 'A' : 'B'} {team === game.attackingTeam ? '⚔' : '🛡'}</span>
            <span style={{ fontWeight: 700, color: team === game.attackingTeam ? GOLD : TEXT }}>{game.scores[team]} pts</span>
          </div>
        ))}
      </div>

      {/* Players */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
        {room.players.map(p => (
          <div key={p.id} style={{ ...S.playerSlot(game.currentTurn === p.seat, p.id === playerId), textAlign: 'center', padding: '6px 4px' }}>
            <div style={{ fontSize: '11px', color: p.id === playerId ? GREEN : TEXT, fontWeight: p.id === playerId ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            <div style={{ fontSize: '10px', color: MUTED }}>{game.hands[p.seat]?.length ?? 0} cards</div>
            {game.currentTurn === p.seat && <div style={{ fontSize: '9px', color: GOLD }}>▶ TURN</div>}
          </div>
        ))}
      </div>

      {/* Current Trick */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
        <div style={{ ...S.label, marginBottom: '8px' }}>Current Trick</div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {game.currentTrick.length === 0 ? (
            <div style={{ color: MUTED, fontSize: '13px', padding: '8px' }}>No cards played yet</div>
          ) : (
            game.currentTrick.map((play, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: MUTED, marginBottom: '4px' }}>{play.playerName}</div>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {play.cards.map(c => <PlayingCard key={c.id} card={c} small />)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Phase-specific actions */}
      {game.phase === 'dealing' && (
        <div style={{ background: SURFACE, border: `1px solid ${GOLD}44`, borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ color: GOLD, fontWeight: 700, marginBottom: '8px' }}>Trump Declaration Phase</div>
          <div style={{ color: MUTED, fontSize: '13px', marginBottom: '12px' }}>
            Select cards from your hand to declare trump. Need 2+ cards (not 1 joker).
            {game.trumpDeclaration && ` Current: ${room.players[game.trumpDeclaration.playerIdx]?.name} declared ${game.trumpSuit || 'no suit'}.`}
          </div>
          <button style={S.btn(GOLD)} onClick={onDeclareTrump}>
            Declare Trump ({selectedCards.length} selected)
          </button>
          {isKittyHolder && (
            <button style={S.btn(GREEN)} onClick={onTakeKitty}>
              Take Kitty & End Dealing
            </button>
          )}
        </div>
      )}

      {game.phase === 'kitty' && isKittyHolder && (
        <div style={{ background: SURFACE, border: `1px solid ${GOLD}44`, borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ color: GOLD, fontWeight: 700, marginBottom: '8px' }}>Discard Kitty</div>
          <div style={{ color: MUTED, fontSize: '13px', marginBottom: '12px' }}>Select exactly 6 cards to discard (they score for whoever wins the last trick)</div>
          <button style={S.btn(selectedCards.length === 6 ? RED : '#444')} onClick={onDiscardKitty}>
            Discard {selectedCards.length}/6 cards
          </button>
        </div>
      )}

      {game.phase === 'kitty' && !isKittyHolder && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px', marginBottom: '12px', textAlign: 'center', color: MUTED }}>
          Waiting for {room.players[game.kittyHolder]?.name} to discard kitty...
        </div>
      )}

      {game.phase === 'playing' && (
        <div style={{ background: SURFACE, border: `1px solid ${isMyTurn ? GOLD + '66' : BORDER}`, borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
          {isMyTurn ? (
            <>
              <div style={{ color: GOLD, fontWeight: 700, marginBottom: '8px' }}>Your Turn — Select cards to play</div>
              <button style={S.btn(GOLD)} onClick={onPlayCards}>
                Play {selectedCards.length} card{selectedCards.length !== 1 ? 's' : ''}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: MUTED }}>
              Waiting for {room.players[game.currentTurn]?.name}...
            </div>
          )}
        </div>
      )}

      {game.phase === 'round_end' && game.roundResult && (
        <div style={{ background: SURFACE, border: `1px solid ${GOLD}44`, borderRadius: '10px', padding: '20px', marginBottom: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: GOLD, marginBottom: '12px' }}>Round Over!</div>
          <div style={{ color: TEXT, marginBottom: '8px' }}>Defenders scored <strong>{game.roundResult.defScore}</strong> points</div>
          <div style={{ color: TEXT, marginBottom: '8px' }}>Kitty: {game.roundResult.kittyPts} pts × {game.roundResult.kittyMult}x multiplier</div>
          {game.roundResult.defScore >= 120
            ? <div style={{ color: GREEN, fontWeight: 700, marginBottom: '12px' }}>Defenders win! +{Math.max(0, game.roundResult.defGain)} levels</div>
            : <div style={{ color: GOLD, fontWeight: 700, marginBottom: '12px' }}>Attackers win! +{game.roundResult.atkGain} levels</div>
          }
          {mySeat === 0 && <button style={S.btn(GOLD)} onClick={onNextRound}>Next Round →</button>}
          {mySeat !== 0 && <div style={{ color: MUTED, fontSize: '13px' }}>Waiting for host to start next round...</div>}
        </div>
      )}

      {game.phase === 'game_over' && (
        <div style={{ background: SURFACE, border: `1px solid ${GOLD}`, borderRadius: '10px', padding: '24px', marginBottom: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 900, color: GOLD, marginBottom: '8px' }}>🎉 Game Over!</div>
          <div style={{ color: TEXT, fontSize: '18px' }}>
            {game.levels[0] > 12 ? 'Team A wins!' : 'Team B wins!'}
          </div>
        </div>
      )}

      {error && <div style={{ ...S.error, marginBottom: '12px' }}>{error}<span style={{ float: 'right', cursor: 'pointer' }} onClick={() => setError('')}>✕</span></div>}

      {/* My Hand */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={S.label}>Your Hand ({sortedHand.length} cards)</span>
          <span style={S.badge(myTeam === 0 ? GOLD : '#52a8a8')}>Team {myTeam === 0 ? 'A' : 'B'} {myTeamAttacking ? '⚔' : '🛡'}</span>
        </div>
        <div style={S.hand}>
          {sortedHand.map(card => (
            <PlayingCard
              key={card.id}
              card={card}
              selected={selectedIds.includes(card.id)}
              onClick={() => toggleCard(card.id)}
            />
          ))}
        </div>
      </div>

      {/* Log */}
      {game.log && game.log.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px', marginTop: '8px', maxHeight: '100px', overflowY: 'auto' }}>
          {[...game.log].reverse().map((entry, i) => (
            <div key={i} style={{ fontSize: '11px', color: MUTED, padding: '2px 0', borderBottom: i < game.log.length - 1 ? `1px solid ${BORDER}` : 'none' }}>{entry}</div>
          ))}
        </div>
      )}
    </div>
  );
}
