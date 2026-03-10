import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, createRoom, joinRoom, updateRoom, subscribeToRoom } from './supabase';
import {
  buildDecks, dealCards, dealCardsSequential, isTrump, trumpRank, suitRank,
  detectCombo, trickWinner, countPoints, cardPoints,
  attackerLevelGain, defenderLevelGain, kittyMultiplier,
  canDeclareTrump, getTrumpSuitFromDeclaration, validateFollow,
  findChallenger, decomposeCombo, LEVELS, SUITS, RANKS
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
  hand: { display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', padding: '20px 44px 8px 44px', gap: '0px', alignItems: 'flex-end', minHeight: '110px', WebkitOverflowScrolling: 'touch' },
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
  const isJoker = card.suit === 'JOKER';
  const rank = isJoker ? (card.rank === 'BIG' ? 'BIG' : 'SML') : card.rank;
  const suit = card.suit;
  const color = isRed ? '#cc2200' : '#1a1a1a';
  const w = small ? 40 : 64;
  const h = small ? 56 : 92;
  const fs = small ? 9 : 13;
  const marginLeft = selected ? (small ? -10 : -14) : (small ? -14 : -22);
  const PIP_LAYOUTS = {
    'A':  [[0.5,0.5,false]],
    '2':  [[0.2,0.5,false],[0.8,0.5,true]],
    '3':  [[0.2,0.5,false],[0.5,0.5,false],[0.8,0.5,true]],
    '4':  [[0.22,0.28,false],[0.22,0.72,false],[0.78,0.28,true],[0.78,0.72,true]],
    '5':  [[0.22,0.28,false],[0.22,0.72,false],[0.5,0.5,false],[0.78,0.28,true],[0.78,0.72,true]],
    '6':  [[0.22,0.28,false],[0.22,0.72,false],[0.5,0.28,false],[0.5,0.72,false],[0.78,0.28,true],[0.78,0.72,true]],
    '7':  [[0.2,0.28,false],[0.2,0.72,false],[0.37,0.5,false],[0.52,0.28,false],[0.52,0.72,false],[0.78,0.28,true],[0.78,0.72,true]],
    '8':  [[0.18,0.28,false],[0.18,0.72,false],[0.36,0.5,false],[0.5,0.28,false],[0.5,0.72,false],[0.64,0.5,true],[0.82,0.28,true],[0.82,0.72,true]],
    '9':  [[0.15,0.28,false],[0.15,0.72,false],[0.37,0.28,false],[0.37,0.72,false],[0.5,0.5,false],[0.63,0.28,true],[0.63,0.72,true],[0.85,0.28,true],[0.85,0.72,true]],
    '10': [[0.12,0.28,false],[0.12,0.72,false],[0.32,0.28,false],[0.32,0.72,false],[0.48,0.28,false],[0.48,0.72,false],[0.68,0.28,true],[0.68,0.72,true],[0.88,0.28,true],[0.88,0.72,true]],
  };
  const FACE = {
    'J': { bg:'#ddeeff', inner:'#aaccff33', symbol:'⚔️', label:'JACK',  col:'#1a3a7a' },
    'Q': { bg:'#ffdded', inner:'#ffaabb33', symbol:'♛', label:'QUEEN', col:'#8a1040' },
    'K': { bg:'#fff5d0', inner:'#ffe89933', symbol:'♚', label:'KING',  col:'#7a4a00' },
  };
  const isFace = ['J','Q','K'].includes(card.rank);
  const pips = PIP_LAYOUTS[card.rank];
  const pipSize = card.rank === 'A' ? (small ? 14 : 26) : (small ? 8 : 12);
  const cardStyle = {
    display: 'inline-block', width: `${w}px`, height: `${h}px`, minWidth: `${w}px`,
    background: (isFace && !small) ? `linear-gradient(160deg,${FACE[card.rank].bg},#fff)` :
                selected ? 'linear-gradient(160deg,#fffdf0,#fff6cc)' : 'linear-gradient(160deg,#ffffff,#f5f5f5)',
    border: `${selected ? 2 : 1.5}px solid ${selected ? GOLD : '#bbb'}`,
    borderRadius: small ? '4px' : '7px', cursor: 'pointer',
    boxShadow: selected ? `0 -12px 24px ${GOLD}66,0 4px 10px rgba(0,0,0,0.35)` : '0 2px 6px rgba(0,0,0,0.28)',
    transform: selected ? 'translateY(-18px)' : 'none', transition: 'all 0.12s ease',
    position: 'relative', marginLeft: `${marginLeft}px`,
    flexShrink: 0, overflow: 'hidden', userSelect: 'none', zIndex: selected ? 10 : 'auto',
  };
  const Corner = ({ flip }) => (
    <div style={{
      position:'absolute', [flip?'bottom':'top']:'2px', [flip?'right':'left']:'3px',
      display:'flex', flexDirection:'column', alignItems:'center',
      transform: flip ? 'rotate(180deg)' : 'none', lineHeight: 1.1,
    }}>
      <span style={{ fontSize:`${fs}px`, fontWeight:900, color, fontFamily:'Georgia,serif' }}>{rank}</span>
      {!small && !isJoker && <span style={{ fontSize:'9px', color, lineHeight:1 }}>{suit}</span>}
    </div>
  );
  return (
    <div style={cardStyle} onClick={onClick}>
      <Corner flip={false} />
      <Corner flip={true} />
      {isJoker && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
          <div style={{ fontSize: small?'18px':'28px' }}>{card.rank === 'BIG' ? '🃏' : '🤡'}</div>
          {!small && <div style={{ fontSize:'7px', color:'#888', marginTop:'2px', letterSpacing:'0.1em' }}>{card.rank} JOKER</div>}
        </div>
      )}
      {!isJoker && !small && (
        <div style={{ position:'absolute', top:`${Math.round(h*0.19)}px`, left:'4px', right:'4px', bottom:`${Math.round(h*0.19)}px` }}>
          {isFace ? (
            <div style={{
              width:'100%', height:'100%', border:`2px solid ${FACE[card.rank].col}44`,
              borderRadius:'4px', background: FACE[card.rank].inner,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2px'
            }}>
              <span style={{ fontSize:'22px', color:FACE[card.rank].col, lineHeight:1 }}>{FACE[card.rank].symbol}</span>
              <span style={{ fontSize:'7px', fontWeight:700, color:FACE[card.rank].col, letterSpacing:'0.06em' }}>{suit} {FACE[card.rank].label} {suit}</span>
              <span style={{ fontSize:'22px', color:FACE[card.rank].col, transform:'rotate(180deg)', lineHeight:1, marginTop:'2px' }}>{FACE[card.rank].symbol}</span>
            </div>
          ) : pips ? (
            pips.map(([top,left,flip],i) => (
              <span key={i} style={{
                position:'absolute', top:`${top*100}%`, left:`${left*100}%`,
                transform:`translate(-50%,-50%)${flip?' rotate(180deg)':''}`,
                fontSize:`${pipSize}px`, color, lineHeight:1, display:'block',
              }}>{suit}</span>
            ))
          ) : null}
        </div>
      )}
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
      if (updated.state === 'game' && updated.game) setScreen('game');
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
    const { sequence, kitty } = dealCardsSequential(decks);
    const initialGame = {
      phase: 'dealing',
      hands: [[], [], [], []],
      dealSequence: sequence,   // full sequence of {seat, card}
      dealIndex: 0,             // how many cards have been dealt so far
      dealComplete: false,
      kitty,
      kittyHolder: null,          // set after dealing: trump declarer (round 1) or first-card seat
      trumpDeclaration: null,
      trumpSuit: null,
      trumpNumber: LEVELS[0],
      firstCardSuit: sequence[0]?.card?.suit || '♠', // fallback trump
      firstCardSeat: sequence[0]?.seat ?? 0,          // who gets dealt first
      currentTrick: [],
      tricks: [],
      scores: [0, 0],
      levels: [0, 0],
      attackingTeam: 0,
      currentTurn: 0,
      selectedCards: [[], [], [], []],
      log: ['Dealing cards...'],
      roundNum: 1,
    };
    await updateRoom(room.id, { state: 'game', game: initialGame });
  };

  // ── Game Actions ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);
  const dealTimerRef = useRef(null);

  // ── Auto-deal animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!game || game.phase !== 'dealing' || game.dealComplete) return;
    if (game.dealIndex >= (game.dealSequence?.length || 0)) {
      // All cards dealt — check kitty for trump
      if (!game.trumpSuit) {
        const trumpNum = game.trumpNumber;
        let resolvedSuit = null;
        // Check kitty one by one for trump number
        for (const card of (game.kitty || [])) {
          if (card.rank === trumpNum && card.suit !== 'JOKER') {
            resolvedSuit = card.suit;
            break;
          }
        }
        // Fallback to first card dealt
        if (!resolvedSuit) resolvedSuit = game.firstCardSuit;
        if (mySeat === 0) { // host resolves this
          const kittyHolder = game.firstCardSeat ?? 0;
          updateRoom(room.id, { game: { ...game, trumpSuit: resolvedSuit, kittyHolder, currentTurn: kittyHolder, dealComplete: true, log: [...(game.log||[]), `No trump declared — trump suit set to ${resolvedSuit}. ${room.players[kittyHolder]?.name} holds the kitty.`] } });
        }
      } else {
        if (mySeat === 0) {
          // Trump was declared — kittyHolder is the declarer (round 1 rule)
          const kittyHolder = game.roundNum === 1
            ? (game.trumpDeclaration?.playerIdx ?? game.firstCardSeat ?? 0)
            : (game.firstCardSeat ?? 0);
          updateRoom(room.id, { game: { ...game, kittyHolder, currentTurn: kittyHolder, dealComplete: true } });
        }
      }
      return;
    }

    // Only host drives the deal timer to avoid race conditions
    if (mySeat !== 0) return;

    dealTimerRef.current = setTimeout(async () => {
      const seq = game.dealSequence;
      const idx = game.dealIndex;
      const { seat, card } = seq[idx];
      const newHands = game.hands.map((h, i) => i === seat ? [...h, card] : h);
      await updateRoom(room.id, { game: { ...game, hands: newHands, dealIndex: idx + 1 } });
    }, 250);

    return () => clearTimeout(dealTimerRef.current);
  }, [game?.dealIndex, game?.phase, game?.dealComplete]);

  const toggleCard = (cardId) => {
    setSelectedIds(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const selectedCards = myHand.filter(c => selectedIds.includes(c.id));

  const handleDeclareTrump = async () => {
    if (!game || selectedCards.length === 0) return;

    const allJokers = selectedCards.every(c => c.suit === 'JOKER');
    const existingDecl = game.trumpDeclaration;
    const newSuit = getTrumpSuitFromDeclaration(selectedCards);
    const declName = room.players[mySeat]?.name;

    // REINFORCEMENT: same player adds more same-suit trump numbers
    const isReinforcement = existingDecl &&
      existingDecl.playerIdx === mySeat &&
      !allJokers &&
      !existingDecl.locked &&
      newSuit === game.trumpSuit &&
      selectedCards.every(c => c.rank === game.trumpNumber && c.suit === newSuit);

    if (isReinforcement) {
      const newCount = (existingDecl.declarationCount || existingDecl.cards.length) + selectedCards.length;
      const isLocked = newCount >= 3;
      const logMsg = isLocked
        ? `${declName} reinforces and locks in ${newSuit} as trump (${newCount} ${game.trumpNumber}s — locked!)`
        : `${declName} reinforces ${newSuit} trump (${newCount} cards now — needs ${newCount + 1} to override).`;
      await updateRoom(room.id, { game: {
        ...game,
        trumpDeclaration: { ...existingDecl, declarationCount: newCount, locked: isLocked },
        log: [...(game.log || []), logMsg],
      }});
      setSelectedIds([]);
      return;
    }

    // Fresh declaration or override
    if (!canDeclareTrump(selectedCards, existingDecl, game.trumpNumber)) {
      return setError(`Select trump number cards (${game.trumpNumber}) or 2+ jokers to declare`);
    }
    const isLocked = !allJokers && selectedCards.length >= 3;
    const logMsg = isLocked
      ? `${declName} locks in ${newSuit} as trump with 3 ${game.trumpNumber}s!`
      : `${declName} declares trump${newSuit ? ` (${newSuit})` : ' (jokers — no suit)'}.`;
    await updateRoom(room.id, { game: {
      ...game,
      trumpDeclaration: { cards: selectedCards, playerIdx: mySeat, declarationCount: selectedCards.length, locked: isLocked },
      trumpSuit: newSuit,
      log: [...(game.log || []), logMsg],
    }});
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

    const isLeading = game.currentTrick.length === 0;

    if (!isLeading) {
      const leadPlay = game.currentTrick[0];
      const leadCombo = detectCombo(leadPlay.cards, game.trumpSuit, game.trumpNumber);
      const followErr = validateFollow(selectedCards, myHand, { ...leadCombo, cards: leadPlay.cards }, game.trumpSuit, game.trumpNumber);
      if (followErr) return setError(followErr);
    }

    // If leading with multiple cards, auto-detect if anyone must challenge
    if (isLeading && selectedCards.length > 1) {
      const newHand = myHand.filter(c => !selectedIds.includes(c.id));
      const newHands = game.hands.map((h, i) => i === mySeat ? newHand : h);
      // Check counterclockwise for a forced challenger
      const challengeResult = findChallenger(mySeat, newHands, selectedCards, game.trumpSuit, game.trumpNumber);
      if (challengeResult) {
        const { challengerSeat, components, beatableIndices } = challengeResult;
        await updateRoom(room.id, {
          game: {
            ...game,
            hands: newHands,
            phase: 'challenge',
            challenge: {
              leaderSeat: mySeat,
              leaderName: room.players[mySeat].name,
              playedCards: selectedCards,
              components,
              beatableIndices,
              challengerSeat,
            },
            log: [...(game.log || []), `${room.players[mySeat].name} leads ${selectedCards.length} cards — ${room.players[challengerSeat]?.name} must challenge!`],
          }
        });
        setSelectedIds([]);
        return;
      }
      // Nobody can challenge — commit play directly
    }

    await commitPlay(selectedCards, isLeading);
  };

  // Challenger picks which sub-combo the leader must keep
  const handleChallenge = async (keptCombo) => {
    if (!game.challenge) return;
    if (game.challenge.challengerSeat !== mySeat) return setError("Not your turn to challenge");
    if (keptCombo.length === 0) return setError("Select which cards the leader must keep");

    const { leaderSeat, playedCards } = game.challenge;
    const keptIds = new Set(keptCombo.map(c => c.id));
    const returnedCards = playedCards.filter(c => !keptIds.has(c.id));
    const leaderHand = [...(game.hands[leaderSeat] || []), ...returnedCards];
    const newHands = game.hands.map((h, i) => i === leaderSeat ? leaderHand : h);

    await updateRoom(room.id, {
      game: {
        ...game,
        hands: newHands,
        phase: 'playing',
        challenge: null,
        currentTrick: [{ playerIdx: leaderSeat, cards: keptCombo, playerName: room.players[leaderSeat].name }],
        currentTurn: (leaderSeat + 1) % 4,
        log: [...(game.log || []), `${room.players[mySeat].name} challenges! ${room.players[leaderSeat].name} must play ${keptCombo.length} cards.`],
      }
    });
    setSelectedIds([]);
  };

  const handlePassChallenge = async () => {}; // kept for compatibility, not used

  const commitPlay = async (cards, isLeading) => {
    const newHand = myHand.filter(c => !cards.map(c=>c.id).includes(c.id));
    const newHands = game.hands.map((h, i) => i === mySeat ? newHand : h);
    const newTrick = [...(game.currentTrick || []), { playerIdx: mySeat, cards, playerName: room.players[mySeat].name }];

    let newGame = { ...game, hands: newHands, currentTrick: newTrick };

    if (newTrick.length === 4) {
      const winner = trickWinner(newTrick, game.trumpSuit, game.trumpNumber);
      const trickPoints = newTrick.flatMap(p => p.cards).reduce((s, c) => s + cardPoints(c), 0);
      const winnerTeam = winner % 2;
      const newScores = [...game.scores];
      newScores[winnerTeam] += trickPoints;
      const newTricks = [...(game.tricks || []), { plays: newTrick, winner, points: trickPoints }];
      const log = [...(game.log || []), `${room.players[winner].name} wins trick (+${trickPoints} pts)`];

      const totalCards = newHands.reduce((s, h) => s + h.length, 0);
      if (totalCards === 0) {
        const kittyPts = countPoints(game.kitty || []);
        const lastTrickWinnerTeam = winner % 2;
        const mult = kittyMultiplier(newTrick.flatMap(p => p.cards), game.trumpSuit, game.trumpNumber);
        newScores[lastTrickWinnerTeam] += kittyPts * mult;
        const defScore = newScores[1 - game.attackingTeam];
        const atkGain = attackerLevelGain(defScore);
        const defGain = defenderLevelGain(defScore);
        newGame = { ...newGame, hands: newHands, currentTrick: [], tricks: newTricks, scores: newScores, phase: 'round_end', roundResult: { defScore, atkGain, defGain, kittyPts, kittyMult: mult }, log: [...log, `Round over! Defenders scored ${defScore} pts.`] };
      } else {
        newGame = { ...newGame, hands: newHands, currentTrick: [], tricks: newTricks, scores: newScores, currentTurn: winner, log };
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
    const { sequence, kitty } = dealCardsSequential(decks);
    // For round 2+, kittyHolder is whoever gets dealt the first card (resolved after dealing)
    const firstCardSeat = sequence[0]?.seat ?? 0;

    await updateRoom(room.id, {
      game: {
        ...game,
        phase: 'dealing',
        hands: [[], [], [], []],
        dealSequence: sequence,
        dealIndex: 0,
        dealComplete: false,
        firstCardSuit: sequence[0]?.card?.suit || '♠',
        firstCardSeat,
        kitty,
        kittyHolder: null,           // resolved after dealing completes
        trumpDeclaration: null,
        trumpSuit: null,
        trumpNumber: LEVELS[newLevels[newAttacking]],
        currentTrick: [],
        tricks: [],
        scores: [0, 0],
        levels: newLevels,
        attackingTeam: newAttacking,
        currentTurn: firstCardSeat,
        selectedCards: [[], [], [], []],
        log: [`Round ${game.roundNum + 1} starts. ${room.players[newKittyHolder].name} holds kitty.`],
        roundNum: (game.roundNum || 1) + 1,
        roundResult: null,
      }
    });
  };

  // ── Sort hand ────────────────────────────────────────────────────────────
  const SUIT_ORDER = ['♠', '♥', '♣', '♦'];
  const sortedHand = [...myHand].sort((a, b) => {
    if (!game) return 0;
    const aTrump = isTrump(a, game.trumpSuit, game.trumpNumber);
    const bTrump = isTrump(b, game.trumpSuit, game.trumpNumber);
    if (!aTrump && !bTrump) {
      const sd = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
      if (sd !== 0) return sd;
      return suitRank(a) - suitRank(b);
    }
    if (!aTrump && bTrump) return -1;
    if (aTrump && !bTrump) return 1;
    return trumpRank(a, game.trumpSuit, game.trumpNumber) - trumpRank(b, game.trumpSuit, game.trumpNumber);
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
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
          onChallenge={handleChallenge}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}

// ── Game Screen ───────────────────────────────────────────────────────────────
function GameScreen({ game, room, mySeat, myTeam, sortedHand, selectedIds, toggleCard, selectedCards, error, setError, onDeclareTrump, onTakeKitty, onDiscardKitty, onPlayCards, onNextRound, playerId, onChallenge }) {
  const [selectedCompIdx, setSelectedCompIdx] = useState(null);
  const isMyTurn = game.currentTurn === mySeat;
  useEffect(() => { if (game.phase !== 'challenge') setSelectedCompIdx(null); }, [game.phase]);

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
          <div style={{ color: GOLD, fontWeight: 700, marginBottom: '8px' }}>
            {game.dealComplete ? 'Dealing Complete — Declare Trump' : `Dealing Cards... (${game.dealIndex || 0}/${game.dealSequence?.length || 156})`}
          </div>

          {/* Progress bar */}
          {!game.dealComplete && (
            <div style={{ height: '4px', background: BORDER, borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: GOLD, borderRadius: '2px', width: `${((game.dealIndex || 0) / (game.dealSequence?.length || 156)) * 100}%`, transition: 'width 0.8s ease' }} />
            </div>
          )}

          <div style={{ color: MUTED, fontSize: '13px', marginBottom: '12px' }}>
            {game.trumpDeclaration
              ? `${room.players[game.trumpDeclaration.playerIdx]?.name} declared trump${game.trumpSuit ? ` (${game.trumpSuit})` : ' (no suit — jokers)'}. Someone can override with more cards.`
              : 'Select 2+ cards of the same rank to declare trump. You can declare any time during dealing.'}
          </div>

          <button style={S.btn(selectedCards.length >= 2 ? GOLD : '#333')} onClick={onDeclareTrump}>
            Declare Trump ({selectedCards.length} selected)
          </button>

          {isKittyHolder && game.dealComplete && (
            <button style={{ ...S.btn(GREEN), marginTop: '8px' }} onClick={onTakeKitty}>
              Take Kitty →
            </button>
          )}
          {!isKittyHolder && game.dealComplete && (
            <div style={{ color: MUTED, fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>
              Waiting for {room.players[game.kittyHolder]?.name} to take the kitty...
            </div>
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

      {/* Challenge Phase — mandatory challenger picks which sub-combo leader keeps */}
      {game.phase === 'challenge' && game.challenge && (() => {
        const ch = game.challenge;
        const isChallenger = ch.challengerSeat === mySeat;
        const isLeader = ch.leaderSeat === mySeat;
        const challName = room.players[ch.challengerSeat]?.name;

        const components = ch.components || [];

        return (
          <div style={{ background: SURFACE, border: `2px solid ${RED}66`, borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
            <div style={{ color: RED, fontWeight: 700, marginBottom: '8px' }}>
              ⚔ Challenge — {challName} must pick which part of {ch.leaderName}'s play to keep
            </div>

            {/* Show decomposed sub-combos — challenger clicks one to keep */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: MUTED, marginBottom: '8px' }}>
                {ch.leaderName}'s play broken into components (select one to keep):
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {components.map((comp, i) => (
                  <div
                    key={i}
                    onClick={isChallenger ? () => setSelectedCompIdx(i === selectedCompIdx ? null : i) : undefined}
                    style={{
                      border: `2px solid ${selectedCompIdx === i ? GOLD : '#555'}`,
                      borderRadius: '8px', padding: '8px',
                      background: selectedCompIdx === i ? '#2a2500' : SURFACE,
                      cursor: isChallenger ? 'pointer' : 'default',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {comp.type.replace('_', ' ')}
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {comp.cards.map(c => <PlayingCard key={c.id} card={c} small />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isChallenger && (
              <button
                style={S.btn(selectedCompIdx !== null ? RED : '#444')}
                onClick={() => selectedCompIdx !== null && onChallenge(components[selectedCompIdx].cards)}
                disabled={selectedCompIdx === null}
              >
                {selectedCompIdx !== null
                  ? `Force leader to keep only the ${components[selectedCompIdx].type.replace('_',' ')} (${components[selectedCompIdx].cards.length} cards)`
                  : 'Select a sub-combo above to keep'}
              </button>
            )}

            {!isChallenger && !isLeader && (
              <div style={{ color: MUTED, fontSize: '13px', marginTop: '8px' }}>
                Waiting for {challName} to pick which part to keep...
              </div>
            )}
            {isLeader && (
              <div style={{ color: MUTED, fontSize: '13px', marginTop: '8px' }}>
                {challName} is choosing which component of your play to keep...
              </div>
            )}
          </div>
        );
      })()}

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
}class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '20px', color: '#ff6b6b', background: '#1a1a2e', minHeight: '100vh' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>Something went wrong</div>
          <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: '#aaa' }}>{this.state.error?.message}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: '16px', padding: '8px 16px', background: '#3a3a5c', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer' }}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

