import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, createRoom, joinRoom, updateRoom as updateRoomRemote, subscribeToRoom } from './supabase';
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
  app: { minHeight: '100vh', background: BG, color: TEXT, fontFamily: "'Noto Serif SC', 'Georgia', serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0' },
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
function FacePortrait({ rank, suit, color, w, h }) {
  const isRed = color === '#cc2200';
  const cx = w / 2;
  const innerW = w - 10;
  const innerH = h - 4;

  const faceY = rank === 'K' ? 22 : rank === 'Q' ? 20 : 21;
  const faceRx = rank === 'Q' ? 10 : 9;
  const faceRy = rank === 'Q' ? 12 : 10;

  const hairCol = isRed ? '#7a1a00' : '#1a0a00';
  const skinCol = '#f5d5a0';
  const clothCol = isRed ? '#cc2200' : '#0a1a4a';
  const crownCol = '#c9a140';

  return (
    <svg width={innerW} height={innerH} viewBox={`0 0 ${innerW} ${innerH}`} style={{display:'block'}}>
      <rect width={innerW} height={innerH} fill={isRed ? '#fff5f5' : '#f5f5ff'} rx="3"/>
      <rect x="1.5" y="1.5" width={innerW-3} height={innerH-3} fill="none" stroke={color} strokeWidth="1" rx="2" opacity="0.4"/>

      {rank === 'K' && <>
        <polygon points={`5,20 ${cx-6},12 ${cx},6 ${cx+6},12 ${innerW-5},20`} fill={crownCol} stroke="#8a6010" strokeWidth="0.8"/>
        <rect x="4" y="19" width={innerW-8} height="4" fill={crownCol} stroke="#8a6010" strokeWidth="0.8"/>
        <circle cx={cx} cy="8" r="3" fill="#cc3333"/>
        <circle cx={cx-7} cy="13" r="2" fill="#3333cc"/>
        <circle cx={cx+7} cy="13" r="2" fill="#33cc33"/>
      </>}
      {rank === 'Q' && <>
        <polygon points={`8,19 ${cx-5},13 ${cx},8 ${cx+5},13 ${innerW-8},19`} fill={crownCol} stroke="#8a6010" strokeWidth="0.8"/>
        <rect x="7" y="18" width={innerW-14} height="3" fill={crownCol} stroke="#8a6010" strokeWidth="0.8"/>
        <circle cx={cx} cy="10" r="2.5" fill={isRed ? '#cc3333' : '#3333cc'}/>
      </>}
      {rank === 'J' && <>
        <path d={`M${cx-10},20 Q${cx-6},8 ${cx},6 Q${cx+6},8 ${cx+10},20 Z`} fill={clothCol} opacity="0.9"/>
        <circle cx={cx} cy="5" r="3" fill={isRed ? '#e05252' : '#4466cc'}/>
      </>}

      {rank === 'K' && <ellipse cx={cx} cy={faceY+2} rx={faceRx+3} ry={faceRy+6} fill={hairCol}/>}
      {rank === 'Q' && <>
        <ellipse cx={cx} cy={faceY+2} rx={faceRx+4} ry={faceRy+8} fill={hairCol}/>
        <path d={`M${cx-faceRx-2},${faceY+6} Q${cx-faceRx-8},${faceY+12} ${cx-faceRx-4},${faceY+18}`} fill="none" stroke={hairCol} strokeWidth="3"/>
        <path d={`M${cx+faceRx+2},${faceY+6} Q${cx+faceRx+8},${faceY+12} ${cx+faceRx+4},${faceY+18}`} fill="none" stroke={hairCol} strokeWidth="3"/>
      </>}
      {rank === 'J' && <ellipse cx={cx} cy={faceY+1} rx={faceRx+2} ry={faceRy+2} fill={hairCol}/>}

      <ellipse cx={cx} cy={faceY+4} rx={faceRx} ry={faceRy} fill={skinCol}/>

      <ellipse cx={cx-4} cy={faceY+1} rx="2" ry="1.5" fill="#1a1a1a"/>
      <ellipse cx={cx+4} cy={faceY+1} rx="2" ry="1.5" fill="#1a1a1a"/>
      <circle cx={cx-3.5} cy={faceY+0.8} r="0.6" fill="white"/>
      <circle cx={cx+4.5} cy={faceY+0.8} r="0.6" fill="white"/>

      <path d={`M${cx-6},${faceY-2} Q${cx-4},${faceY-3.5} ${cx-2},${faceY-2}`} fill="none" stroke={hairCol} strokeWidth="1.2" strokeLinecap="round"/>
      <path d={`M${cx+2},${faceY-2} Q${cx+4},${faceY-3.5} ${cx+6},${faceY-2}`} fill="none" stroke={hairCol} strokeWidth="1.2" strokeLinecap="round"/>

      <path d={`M${cx},${faceY+3} Q${cx+2},${faceY+6} ${cx},${faceY+7}`} fill="none" stroke="#c8a070" strokeWidth="0.8"/>

      {rank === 'K' && <>
        <path d={`M${cx-5},${faceY+8} Q${cx},${faceY+10} ${cx+5},${faceY+8}`} fill="none" stroke={hairCol} strokeWidth="1.5" strokeLinecap="round"/>
        <ellipse cx={cx} cy={faceY+11} rx="5" ry="3" fill={hairCol} opacity="0.7"/>
      </>}
      {rank === 'Q' && <path d={`M${cx-4},${faceY+8} Q${cx},${faceY+11} ${cx+4},${faceY+8}`} fill="none" stroke={isRed?'#cc2200':'#883333'} strokeWidth="1.5" strokeLinecap="round"/>}
      {rank === 'J' && <path d={`M${cx-3},${faceY+8} Q${cx},${faceY+10} ${cx+3},${faceY+8}`} fill="none" stroke="#883333" strokeWidth="1" strokeLinecap="round"/>}

      <path d={`M${cx-innerW/2+2},${innerH} L${cx-8},${faceY+faceRy+4} L${cx},${faceY+faceRy+8} L${cx+8},${faceY+faceRy+4} L${cx+innerW/2-2},${innerH}`} fill={clothCol}/>
      <path d={`M${cx-8},${faceY+faceRy+4} L${cx},${faceY+faceRy+6} L${cx+8},${faceY+faceRy+4}`} fill="none" stroke={isRed?'#ff9999':'#9999ff'} strokeWidth="1"/>
      <text x={cx} y={innerH-8} textAnchor="middle" fontSize="10" fill={isRed?'#ffaaaa':'#aaaaff'} opacity="0.8">{suit}</text>
    </svg>
  );
}


function PlayingCard({ card, selected, onClick, small }) {
  const isRed = card.suit === '\u2665' || card.suit === '\u2666' || card.suit === 'JOKER';
  const isJoker = card.suit === 'JOKER';
  const rank = isJoker ? (card.rank === 'BIG' ? 'BIG' : 'SML') : card.rank;
  const suit = card.suit;
  const color = isRed ? '#cc2200' : '#111111';
  const w = small ? 40 : 64;
  const h = small ? 56 : 92;
  const fs = small ? 9 : 13;
  const marginLeft = 0;

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

  const isFace = ['J','Q','K'].includes(card.rank);
  const pips = PIP_LAYOUTS[card.rank];
  const pipSize = card.rank === 'A' ? (small ? 14 : 26) : (small ? 8 : 12);

  const cardStyle = {
    display: 'inline-block', width: `${w}px`, height: `${h}px`, minWidth: `${w}px`,
    background: 'linear-gradient(160deg,#ffffff,#f5f5f5)',
    border: `${selected ? 2 : 1.5}px solid ${selected ? GOLD : '#bbb'}`,
    borderRadius: small ? '4px' : '7px', cursor: 'pointer',
    boxShadow: selected ? `0 -12px 24px ${GOLD}66,0 4px 10px rgba(0,0,0,0.35)` : '0 2px 6px rgba(0,0,0,0.28)',
    transform: selected ? 'translateY(-18px)' : 'none', transition: 'all 0.12s ease',
    position: 'relative', marginLeft: `${marginLeft}px`,
    flexShrink: 0, overflow: 'hidden', userSelect: 'none',
  };

  const Corner = ({ flip }) => (
    <div style={{
      position:'absolute',
      top: flip ? 'auto' : '3px',
      bottom: flip ? '3px' : 'auto',
      left: flip ? 'auto' : '4px',
      right: flip ? '4px' : 'auto',
      display:'flex', flexDirection:'column', alignItems:'center',
      lineHeight: 1.1, zIndex: 2,
      transform: flip ? 'rotate(180deg)' : 'none',
    }}>
      <span style={{ fontSize:`${fs}px`, fontWeight:900, color, fontFamily:'Georgia,serif', display:'block' }}>{rank}</span>
      {!isJoker && <span style={{ fontSize: small ? '7px' : '9px', color, lineHeight:1, display:'block', marginTop:'1px' }}>{suit}</span>}
    </div>
  );

  return (
    <div style={cardStyle} onClick={onClick}>
      <Corner flip={false} />
      <Corner flip={true} />
      {isJoker && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center' }}>
          <div style={{ fontSize: small?'18px':'28px' }}>{card.rank === 'BIG' ? '\uD83C\uDCCF' : '\uD83E\uDD21'}</div>
          {!small && <div style={{ fontSize:'7px', color:'#888', marginTop:'2px', letterSpacing:'0.1em' }}>{card.rank} JOKER</div>}
        </div>
      )}
      {!isJoker && !small && isFace && (
        <div style={{ position:'absolute', top:'22px', left:'5px', right:'5px', bottom:'22px' }}>
          <FacePortrait rank={card.rank} suit={suit} color={color} w={w-10} h={h-36} />
        </div>
      )}
      {!isJoker && !small && !isFace && pips && (
        <div style={{ position:'absolute', top:`${Math.round(h*0.19)}px`, left:'4px', right:'4px', bottom:`${Math.round(h*0.19)}px` }}>
          {pips.map(([top,left,flip],i) => (
            <span key={i} style={{
              position:'absolute', top:`${top*100}%`, left:`${left*100}%`,
              transform:`translate(-50%,-50%)${flip?' rotate(180deg)':''}`,
              fontSize:`${pipSize}px`, color, lineHeight:1, display:'block',
            }}>{suit}</span>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Lobby Screen ──────────────────────────────────────────────────────────────
function LobbyScreen({ room, playerId, onStart, onKick, onClaimSeat, onLeaveSeat, onLeave }) {
  const isHost = room.host_id === playerId;
  const me = room.players.find(p => p.id === playerId);
  const mySeatedSeat = me?.seat ?? -1; // -1 means spectating (no seat claimed)
  const seatedCount = room.players.filter(p => p.seat !== -1).length;
  const canStart = seatedCount === 4;
  const TEAM_A_COLOR = GOLD;
  const TEAM_B_COLOR = '#52a8a8';

  return (
    <div style={{ width: '100%', maxWidth: '480px' }}>
      <div style={S.card}>
        {/* Room code */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <span style={S.label}>Room Code</span>
          <span style={{ fontSize: '28px', fontWeight: 900, color: GOLD, letterSpacing: '0.3em' }}>{room.code}</span>
        </div>

        {/* My status banner */}
        <div style={{ background: mySeatedSeat === -1 ? '#1a1200' : `${mySeatedSeat % 2 === 0 ? TEAM_A_COLOR : TEAM_B_COLOR}11`,
          border: `1px solid ${mySeatedSeat === -1 ? GOLD + '33' : mySeatedSeat % 2 === 0 ? TEAM_A_COLOR + '44' : TEAM_B_COLOR + '44'}`,
          borderRadius: '8px', padding: '10px 14px', marginBottom: '18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: mySeatedSeat === -1 ? MUTED : TEXT }}>
            {mySeatedSeat === -1 ? '👀 You are spectating — pick a seat below' : `✓ You are in Seat ${mySeatedSeat + 1} (${mySeatedSeat % 2 === 0 ? 'Team A' : 'Team B'})`}
          </span>
          {mySeatedSeat !== -1 && (
            <button onClick={onLeaveSeat} style={{
              background: 'transparent', border: '1px solid #55555588', color: MUTED,
              borderRadius: '6px', padding: '3px 10px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit'
            }}>Leave seat</button>
          )}
        </div>

        {/* Team labels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div style={{ textAlign: 'center', fontSize: '11px', color: TEAM_A_COLOR, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Team A</div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: TEAM_B_COLOR, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Team B</div>
        </div>

        {/* Seat grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          {[0, 1, 2, 3].map(seat => {
            const player = room.players.find(p => p.seat === seat);
            const isMyCurrentSeat = seat === mySeatedSeat;
            const isOccupied = !!player && player.seat === seat && player.seat !== -1;
            const teamColor = seat % 2 === 0 ? TEAM_A_COLOR : TEAM_B_COLOR;
            const canSit = !isOccupied && mySeatedSeat === -1; // only can sit if seat free AND I have no seat

            return (
              <div key={seat} style={{
                border: `1px solid ${isMyCurrentSeat ? teamColor : isOccupied ? BORDER : BORDER + '88'}`,
                background: isMyCurrentSeat ? `${teamColor}18` : isOccupied ? SURFACE : '#0d1117',
                borderRadius: '10px', padding: '14px', minHeight: '90px',
                display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
                <div style={{ fontSize: '10px', color: teamColor, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Seat {seat + 1}
                </div>

                {isOccupied ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flex: 1 }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: isMyCurrentSeat ? 700 : 400, color: TEXT }}>
                        {player.name}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {isMyCurrentSeat && <span style={S.badge(GREEN)}>YOU</span>}
                        {player.id === room.host_id && <span style={S.badge(GOLD)}>HOST</span>}
                      </div>
                    </div>
                    {isHost && !isMyCurrentSeat && (
                      <button onClick={() => onKick(player.id)} style={{
                        background: 'transparent', border: '1px solid #e0525244', color: '#e05252',
                        borderRadius: '6px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer',
                      }}>Kick</button>
                    )}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    {canSit ? (
                      <button onClick={() => onClaimSeat(seat)} style={{
                        ...S.btn(teamColor), padding: '7px 10px', fontSize: '12px', marginBottom: 0
                      }}>Sit here</button>
                    ) : mySeatedSeat !== -1 && !isMyCurrentSeat ? (
                      <span style={{ color: BORDER, fontSize: '12px', fontStyle: 'italic' }}>
                        Leave your seat first
                      </span>
                    ) : (
                      <span style={{ color: MUTED, fontSize: '12px', fontStyle: 'italic' }}>Empty</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ color: MUTED, fontSize: '12px', marginBottom: '16px', textAlign: 'center' }}>
          Seats 1 & 3 = Team A &nbsp;·&nbsp; Seats 2 & 4 = Team B
        </div>

        {isHost ? (
          <button style={S.btn(canStart ? GOLD : '#444')} disabled={!canStart} onClick={onStart}>
            {canStart ? '▶ Start Game' : `Waiting for all seats (${seatedCount}/4)`}
          </button>
        ) : (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: '13px', marginBottom: '12px' }}>
            Waiting for host to start...
          </div>
        )}
        <button onClick={onLeave} style={{
          background: 'transparent', border: '1px solid #e0525244', color: '#e05252',
          borderRadius: '8px', padding: '10px', fontSize: '13px', cursor: 'pointer',
          width: '100%', marginTop: '8px', fontFamily: 'inherit'
        }}>Leave Room</button>
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
  const [game, setGame] = useState(null);

  // Wrapper: write to Supabase AND update local state immediately
  // (Supabase realtime doesn't echo your own writes back)
  // gameRef always holds latest game state synchronously
  const gameRef = useRef(game);
  const setGameAndRef = (newGame) => {
    if (typeof newGame === 'function') {
      setGame(prev => {
        const next = newGame(prev);
        gameRef.current = next;
        return next;
      });
    } else {
      gameRef.current = newGame;
      setGame(newGame);
    }
  };


const updateRoom = async (roomId, updates) => {
    await updateRoomRemote(roomId, updates);
    // Immediately reflect own writes (Supabase realtime doesn't echo back to writer)
    if (updates.game !== undefined) setGameAndRef({ ...updates.game });
    if (updates.players !== undefined || updates.state !== undefined || updates.host_id !== undefined) {
      setRoom(r => r ? { ...r, ...updates } : r);
    }
  };
  const [playerId, setPlayerId] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const subRef = useRef(null);

  // ── Restore session on refresh ───────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('shengji_session');
    if (saved) {
      try {
        const { roomId, playerId: pid } = JSON.parse(saved);
        // Re-fetch the room and rejoin if our seat is still there
        supabase.from('rooms').select('*').eq('id', roomId).single()
          .then(({ data, error }) => {
            if (!error && data && data.players.find(p => p.id === pid)) {
              setRoom(data);
              setGameAndRef(data.game);
              setPlayerId(pid);
              setScreen(data.state === 'game' ? 'game' : 'lobby');
            } else {
              // Room gone or player removed — clear stale session
              localStorage.removeItem('shengji_session');
            }
            setRestoring(false);
          });
      } catch {
        localStorage.removeItem('shengji_session');
        setRestoring(false);
      }
    } else {
      setRestoring(false);
    }
  }, []);

  // Game state (from room.game)
  const mySeat = room?.players?.find(p => p.id === playerId)?.seat ?? -1;
  const myHand = (mySeat >= 0 && game?.hands?.[mySeat]) ? [...game.hands[mySeat]] : [];
  const myTeam = mySeat % 2; // 0 = team A (seats 0,2), 1 = team B (seats 1,3)

  // ── Supabase subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!room) return;
    if (subRef.current) subRef.current.unsubscribe();
    subRef.current = subscribeToRoom(room.id, (updated) => {
      setRoom(updated);
      if (updated.game !== undefined) setGameAndRef(updated.game);
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
      setRoom(r); setGameAndRef(r.game); setPlayerId(pid); setScreen('lobby'); setConfirmLeave(false);;
      localStorage.setItem('shengji_session', JSON.stringify({ roomId: r.id, playerId: pid }));
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!playerName.trim()) return setError('Enter your name');
    if (!joinCode.trim()) return setError('Enter room code');
    setLoading(true); setError('');
    try {
      const { room: r, playerId: pid } = await joinRoom(joinCode, playerName.trim());
      setRoom(r); setGameAndRef(r.game); setPlayerId(pid); setScreen('lobby'); setConfirmLeave(false);;
      localStorage.setItem('shengji_session', JSON.stringify({ roomId: r.id, playerId: pid }));
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleStartGame = async () => {
    // Ensure all players have proper seats 0-3 (assign by order if any are -1)
    const seatedPlayers = [...room.players].sort((a, b) => a.seat - b.seat);
    const normalizedPlayers = seatedPlayers.map((p, i) => ({
      ...p,
      seat: p.seat >= 0 ? p.seat : i
    }));
    // Update players with normalized seats before starting
    if (normalizedPlayers.some((p, i) => p.seat !== room.players[i]?.seat)) {
      await updateRoom(room.id, { players: normalizedPlayers });
    }
    const decks = buildDecks();
    const { sequence, kitty } = dealCardsSequential(decks);
    const initialGame = {
      phase: 'dealing',
      hands: [[], [], [], []],
      dealSequence: sequence,   // full sequence of {seat, card}
      dealIndex: 0,             // how many cards have been dealt so far
      dealComplete: false,
      trumpConfirmed: [],   // seats who confirmed they pass on declaring
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
      setGameAndRef(initialGame);
      setRoom(r => r ? { ...r, state: 'game', game: initialGame } : r);
  };

  // ── Game Actions ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);
  const dealTimerRef = useRef(null);

  // ── Auto-deal animation ──────────────────────────────────────────────────
  // ── Trick end delay — host waits 2s then resolves ──────────────────────────
  useEffect(() => {
    // Any seated player drives trick_end — first writer wins, others are no-ops
    // This means if host disconnects, someone else resolves the trick
    if (!game || game.phase !== 'trick_end' || mySeat < 0) return;
    const jitter = mySeat * 150; // stagger by seat to avoid simultaneous writes
    const timer = setTimeout(async () => {
      // Use game directly from closure (captured when useEffect ran, which is correct)
      // Re-fetch to get latest state — prevents overwriting if phase already advanced
      const { data: tr } = await supabase.from('rooms').select('game').eq('id', room?.id).single();
      const g = tr?.game;
      if (!g || g.phase !== 'trick_end') return;
      const winner = g.trickEndWinner;
      const log = g.trickEndLog || g.log;
      const newHands = g.hands;
      const newTricks = g.tricks || [];
      const newScores = g.scores;
      const totalCards = newHands.reduce((s, h) => s + h.length, 0);

      if (totalCards === 0) {
        const kittyPts = countPoints(g.kitty || []);
        const lastWinnerTeam = winner % 2;
        const mult = kittyMultiplier(
          (newTricks[newTricks.length - 1]?.plays || []).flatMap(p => p.cards),
          g.trumpSuit, g.trumpNumber
        );
        const finalScores = [...newScores];
        finalScores[lastWinnerTeam] += kittyPts * mult;
        const defScore = finalScores[1 - g.attackingTeam];
        const atkGain = attackerLevelGain(defScore);
        const defGain = defenderLevelGain(defScore);
        await updateRoom(room.id, { game: { ...g, currentTrick: [], scores: finalScores,
          phase: 'round_end',
          roundResult: { defScore, atkGain, defGain, kittyPts, kittyMult: mult },
          log: [...log, `Round over! Defenders scored ${defScore} pts.`] } });
      } else {
        await updateRoom(room.id, { game: { ...g, currentTrick: [], tricks: newTricks, currentTurn: winner, phase: 'playing', scores: newScores, log } });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [game?.phase, game?.trickEndWinner]);

    useEffect(() => {
    // Only host drives dealing
    if (!room || !game || game.phase !== 'dealing' || game.dealComplete || mySeat !== 0) return;
    clearTimeout(dealTimerRef.current);
    dealTimerRef.current = setTimeout(async () => {
      // Fetch fresh state
      const { data: freshRoom } = await supabase.from('rooms').select('*').eq('id', room.id).single();
      const g = freshRoom?.game;
      if (!g || g.dealComplete || g.phase !== 'dealing') return;
      // Check all-pass mid-deal (only if no trump declared yet)
      const midConfirmed = g.trumpConfirmed || [];
      if (!g.trumpDeclaration && midConfirmed.length >= 4) {
        let resolvedSuit = null;
        for (const card of (g.kitty || [])) {
          if (card.rank === g.trumpNumber && card.suit !== 'JOKER') { resolvedSuit = card.suit; break; }
        }
        if (!resolvedSuit) resolvedSuit = g.firstCardSuit || '♠';
        const kittyHolder = g.firstCardSeat ?? 0;
        const midPassGame = { ...g, trumpSuit: resolvedSuit, kittyHolder, currentTurn: kittyHolder, dealComplete: true,
          log: [...(g.log||[]), `All players passed — trump auto-set to ${resolvedSuit}.`] };
        await updateRoomRemote(room.id, { game: midPassGame });
        setGameAndRef({ ...midPassGame });
        return;
      }

      // All cards dealt?
      if (g.dealIndex >= (g.dealSequence?.length || 0)) {
        if (g.trumpDeclaration) {
          // If locked (3+ cards), finalize immediately — no passes needed
          // If not locked, wait for all non-declarers to pass
          const declarerSeat = g.trumpDeclaration.playerIdx;
          const confirmed = g.trumpConfirmed || [];
          const nonDeclarers = [0,1,2,3].filter(s => s !== declarerSeat);
          const allPassed = g.trumpDeclaration.locked || nonDeclarers.every(s => confirmed.includes(s));
          if (allPassed && !g.dealComplete) {
            // Round 2+: kitty goes to the designated dealer (nextKittyHolder), not trump declarer
          const kittyHolder = g.roundNum === 1
            ? (g.trumpDeclaration?.playerIdx ?? g.nextKittyHolder ?? 0)
            : (g.nextKittyHolder ?? g.trumpDeclaration?.playerIdx ?? 0);
            const finalGame = { ...g, kittyHolder, currentTurn: kittyHolder, dealComplete: true };
            await updateRoomRemote(room.id, { game: finalGame });
            setGameAndRef({ ...finalGame });
          }
        } else {
          // No trump declared — check if all 4 passed
          const confirmed = g.trumpConfirmed || [];
          if (confirmed.length >= 4 && !g.dealComplete) {
            let resolvedSuit = null;
            for (const card of (g.kitty || [])) {
              if (card.rank === g.trumpNumber && card.suit !== 'JOKER') { resolvedSuit = card.suit; break; }
            }
            if (!resolvedSuit) resolvedSuit = g.firstCardSuit || '♠';
            const kittyHolder = g.firstCardSeat ?? 0;
            const finalGame = { ...g, trumpSuit: resolvedSuit, kittyHolder, currentTurn: kittyHolder, dealComplete: true,
              log: [...(g.log||[]), `All players passed — trump auto-set to ${resolvedSuit}.`] };
            await updateRoomRemote(room.id, { game: finalGame });
            setGameAndRef({ ...finalGame });
          }
        }
        // Not ready yet — wait for passes (deps include trumpConfirmed.length so will re-run)
        return;
      }

      // Deal next card — second fresh fetch right before write to prevent double-deals
      const { data: preWrite } = await supabase.from('rooms').select('game').eq('id', room.id).single();
      const pg = preWrite?.game;
      if (!pg || pg.dealIndex !== g.dealIndex) return; // already dealt by another timer fire
      const seq = pg.dealSequence;
      const { seat, card } = seq[pg.dealIndex];
      const newHands = pg.hands.map((h, i) => i === seat ? [...h, card] : h);
      const dealtGame = { ...pg, hands: newHands, dealIndex: pg.dealIndex + 1,
        firstCardSeat: pg.dealIndex === 0 ? seat : pg.firstCardSeat,
        firstCardSuit: pg.dealIndex === 0 ? card.suit : pg.firstCardSuit,
      };
      await updateRoomRemote(room.id, { game: dealtGame });
      setGameAndRef({ ...dealtGame });
    }, 125);

    return () => clearTimeout(dealTimerRef.current);
  }, [game?.dealIndex, game?.phase, game?.dealComplete, game?.trumpConfirmed?.length, !!game?.trumpDeclaration, game?.trumpDeclaration?.locked]);

  // ── Auto-pass when player has no valid trump declaration options ──────────
  useEffect(() => {
    if (!game || !room || mySeat < 0) return;
    if (game.phase !== 'dealing') return;
    if (game.dealComplete) return; // already finalized

    // Only trigger after all cards are dealt
    const allDealt = game.dealIndex >= (game.dealSequence?.length || 156);
    if (!allDealt) return;

    // Don't autopass if already passed or is the current declarer
    const confirmed = game.trumpConfirmed || [];
    if (confirmed.includes(mySeat)) return;
    const existingDecl = game.trumpDeclaration;
    if (existingDecl?.playerIdx === mySeat) return; // I'm the declarer, don't autopass

    // Check if this player has ANY valid declaration options
    const myCurrentHand = game.hands?.[mySeat] || [];
    const trumpNumber = game.trumpNumber;

    // Can declare if: has any trump number card, or has 2+ same jokers
    const hasTrumpNumberCard = myCurrentHand.some(card => card.rank === trumpNumber);
    const bigJokers = myCurrentHand.filter(c => c.suit === 'JOKER' && c.rank === 'BIG');
    const smallJokers = myCurrentHand.filter(c => c.suit === 'JOKER' && c.rank === 'SMALL');
    const hasJokerPair = bigJokers.length >= 2 || smallJokers.length >= 2;
    const canDeclare = hasTrumpNumberCard || hasJokerPair;

    // If cannot declare anything, autopass after a short delay
    if (!canDeclare) {
      const timer = setTimeout(async () => {
        // Re-check with fresh state to be safe
        const { data: freshRoom } = await supabase.from('rooms').select('game').eq('id', room.id).single();
        const freshGame = freshRoom?.game;
        if (!freshGame) return;
        const freshConfirmed = freshGame.trumpConfirmed || [];
        if (freshConfirmed.includes(mySeat)) return; // already passed
        if (freshGame.trumpDeclaration?.playerIdx === mySeat) return; // became declarer
        if (freshGame.dealComplete) return; // already finalized
        // Autopass
        await updateRoom(room.id, { game: { ...freshGame, trumpConfirmed: [...freshConfirmed, mySeat] } });
      }, 500); // small delay to let subscription catch up first
      return () => clearTimeout(timer);
    }
  }, [game?.dealIndex, game?.dealComplete, game?.phase, mySeat, game?.trumpConfirmed?.length, game?.trumpDeclaration?.playerIdx]);

  // ── Challenge timeout — cancel after 30s if challenger doesn't act ─────────
  useEffect(() => {
    if (!game || game.phase !== 'challenge' || !game.challenge || mySeat < 0) return;
    const iAmChallenger = game.challenge.challengerSeat === mySeat;
    if (!iAmChallenger) return;
    // If challenger doesn't act in 30s, auto-cancel the challenge
    const timer = setTimeout(async () => {
      const { data: fr } = await supabase.from('rooms').select('*').eq('id', room?.id).single();
      const fg = fr?.game;
      if (!fg || fg.phase !== 'challenge') return; // already resolved
      const { leaderSeat, playedCards } = fg.challenge;
      // Auto-keep the highest-ranked component (best for leader)
      const comps = fg.challenge.components || [];
      const keptComp = comps[comps.length - 1]; // last = highest ranked
      if (!keptComp) return;
      const keptIds = new Set(keptComp.cards.map(c => c.id));
      const returnedCards = playedCards.filter(c => !keptIds.has(c.id));
      const leaderHand = [...(fg.hands[leaderSeat] || []), ...returnedCards];
      const newHands = fg.hands.map((h, i) => i === leaderSeat ? leaderHand : h);
      await updateRoom(room.id, { game: {
        ...fg, hands: newHands, phase: 'playing', challenge: null,
        currentTrick: [{ playerIdx: leaderSeat, cards: keptComp.cards, playerName: room.players.find(p => p.seat === leaderSeat)?.name }],
        currentTurn: (leaderSeat + 1) % 4,
        log: [...(fg.log || []), 'Challenge timed out — auto-resolved.'],
      }});
    }, 30000);
    return () => clearTimeout(timer);
  }, [game?.phase, game?.challenge?.challengerSeat]);

  const toggleCard = (cardId) => {
    setSelectedIds(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const selectedCards = myHand.filter(c => selectedIds.includes(c.id));

  const handleKick = async (kickedId) => {
    if (!room || room.host_id !== playerId) return;
    const updated = room.players.filter(p => p.id !== kickedId);
    await updateRoom(room.id, { players: updated });
  };

  const handleClaimSeat = async (seat) => {
    if (!room) return;
    // Only claim if seat is free and I have no seat
    if (room.players.find(p => p.seat === seat)) return;
    const me = room.players.find(p => p.id === playerId);
    if (me?.seat !== -1 && me?.seat !== undefined) return; // already seated
    const updated = room.players.map(p =>
      p.id === playerId ? { ...p, seat } : p
    );
    await updateRoom(room.id, { players: updated });
  };

  const handleLeaveSeat = async () => {
    if (!room) return;
    const updated = room.players.map(p =>
      p.id === playerId ? { ...p, seat: -1 } : p
    );
    await updateRoom(room.id, { players: updated });
  };


  const handleLeave = async () => {
    if (!room) return;
    setConfirmLeave(false);
    // Remove self from players
    const updated = room.players.filter(p => p.id !== playerId);
    // If host is leaving, transfer host to next player (or delete room if empty)
    let updates = { players: updated };
    if (room.host_id === playerId && updated.length > 0) {
      updates.host_id = updated[0].id;
    }
    try {
      if (updated.length === 0) {
        // Last player — just clear the room state
        await updateRoom(room.id, { state: 'lobby', players: [], game: null, ...updates });
      } else {
        await updateRoom(room.id, updates);
      }
    } catch (e) { /* ignore */ }
    localStorage.removeItem('shengji_session');
    setRoom(null);
    setPlayerId(null);
    setScreen('home');
  };


  const handleDeclareTrump = async () => {
    if (selectedIds.length === 0) return;

    // MUST fetch fresh state — another player may have declared since our last render
    const { data: freshRoom } = await supabase.from('rooms').select('*').eq('id', room.id).single();
    const g = freshRoom?.game;
    if (!g) return;

    // Build selected cards from fresh hand
    const myCurrentHand = g.hands?.[mySeat] || [];
    const declSelected = myCurrentHand.filter(card => selectedIds.includes(card.id));
    if (declSelected.length === 0) return setError('Selected cards not in hand');

    const allJokers = declSelected.every(c => c.suit === 'JOKER');
    const existingDecl = g.trumpDeclaration;
    const newSuit = getTrumpSuitFromDeclaration(declSelected);
    const declName = room.players.find(p => p.seat === mySeat)?.name || `Seat ${mySeat+1}`;
    const currentCount = existingDecl ? (existingDecl.declarationCount || existingDecl.cards?.length || 1) : 0;
    const iAmDeclarer = existingDecl?.playerIdx === mySeat;

    // Validate: must be all trump number of same suit, or all same joker type
    if (!allJokers) {
      if (!declSelected.every(c => c.rank === g.trumpNumber))
        return setError(`Must select ${g.trumpNumber}s (the trump number) to declare trump`);
      if (!declSelected.every(c => c.suit === declSelected[0].suit))
        return setError('All selected cards must be the same suit');
    } else {
      const allBig = declSelected.every(c => c.rank === 'BIG');
      const allSmall = declSelected.every(c => c.rank === 'SMALL');
      if (!allBig && !allSmall) return setError('Joker declaration must be all Big or all Small jokers');
      if (declSelected.length < 2) return setError('Need at least 2 jokers to declare');
    }

    // ── CASE 1: No existing declaration ────────────────────────────────────
    if (!existingDecl) {
      const isLocked = !allJokers && declSelected.length >= 3;
      await updateRoom(room.id, { game: {
        ...g,
        trumpDeclaration: { cards: declSelected, playerIdx: mySeat, declarationCount: declSelected.length, locked: isLocked },
        trumpSuit: newSuit,
        log: [...(g.log || []), `${declName} declares trump${newSuit ? ` (${newSuit})` : ' (jokers)'} with ${declSelected.length} card${declSelected.length>1?'s':''}.`],
      }});
      setSelectedIds([]);
      return;
    }

    // ── CASE 2: Locked ──────────────────────────────────────────────────────
    if (existingDecl.locked) return setError('Trump is locked — cannot be changed');

    // ── CASE 3: I am the declarer — reinforce only ─────────────────────────
    if (iAmDeclarer) {
      if (newSuit !== g.trumpSuit) return setError('You can only reinforce the same suit');
      if (allJokers) return setError('Cannot switch to jokers after declaring a suit');
      const newCount = declSelected.length;
      if (newCount <= currentCount) return setError(`Must show more than ${currentCount} card${currentCount>1?'s':''} to reinforce`);
      const isLocked = newCount >= 3;
      await updateRoom(room.id, { game: {
        ...g,
        trumpDeclaration: { ...existingDecl, cards: declSelected, declarationCount: newCount, locked: isLocked },
        log: [...(g.log || []), isLocked
          ? `${declName} reinforces and locks in ${newSuit} as trump (${newCount} cards — locked!)`
          : `${declName} reinforces ${newSuit} trump (now ${newCount} cards).`],
      }});
      setSelectedIds([]);
      return;
    }

    // ── CASE 4: Opponent override ───────────────────────────────────────────
    if (declSelected.length <= currentCount)
      return setError(`Need more than ${currentCount} card${currentCount>1?'s':''} to override`);
    const isLocked = !allJokers && declSelected.length >= 3;
    const resetConfirmed = (g.trumpConfirmed || []).filter(s => s === mySeat);
    await updateRoom(room.id, { game: {
      ...g,
      trumpDeclaration: { cards: declSelected, playerIdx: mySeat, declarationCount: declSelected.length, locked: isLocked },
      trumpSuit: newSuit,
      trumpConfirmed: resetConfirmed,
      log: [...(g.log || []), isLocked
        ? `${declName} overrides and locks in ${newSuit} as trump with ${declSelected.length} cards!`
        : `${declName} overrides trump${newSuit ? ` → ${newSuit}` : ' → jokers'} with ${declSelected.length} cards.`],
    }});
    setSelectedIds([]);
  };


  const handleConfirmPass = async () => {
    const g = gameRef.current;
    if (!g) return;
    const confirmed = g.trumpConfirmed || [];
    if (confirmed.includes(mySeat)) return;
    await updateRoom(room.id, { game: { ...g, trumpConfirmed: [...confirmed, mySeat] } });
  };

  
  const handleTakeKitty = async () => {
    const g = gameRef.current;
    if (!g) return;
    const effectiveKittyHolder = g.kittyHolder ??
      (g.roundNum === 1
        ? (g.trumpDeclaration?.playerIdx ?? g.firstCardSeat ?? 0)
        : (g.firstCardSeat ?? 0));
    if (mySeat !== effectiveKittyHolder) return;
    const myCurrentHand = g.hands?.[mySeat] || [];
    const newHand = [...myCurrentHand, ...(g.kitty || [])];
    const newHands = g.hands.map((h, i) => i === mySeat ? newHand : h);
    await updateRoom(room.id, { game: { ...g, phase: 'kitty', kittyHolder: effectiveKittyHolder, hands: newHands, kitty: [], dealComplete: true } });
    setSelectedIds([]);
  };

  
  const handleDiscardKitty = async () => {
    const g = gameRef.current;
    if (!g) return;
    if (mySeat !== (g.kittyHolder ?? g.trumpDeclaration?.playerIdx)) return;
    if (selectedIds.length !== 6) return setError('Select exactly 6 cards to discard');
    const myCurrentHand = g.hands?.[mySeat] || [];
    const discarded = myCurrentHand.filter(card => selectedIds.includes(card.id));
    if (discarded.length !== 6) return setError(`Select exactly 6 cards to discard (matched ${discarded.length})`);
    const newHand = myCurrentHand.filter(card => !selectedIds.includes(card.id));
    const newHands = g.hands.map((h, i) => i === mySeat ? newHand : h);
    const playerName = room.players.find(p => p.seat === mySeat)?.name || `Seat ${mySeat+1}`;
    await updateRoom(room.id, {
      game: { ...g, phase: 'playing', hands: newHands, kitty: discarded,
        currentTurn: g.kittyHolder ?? g.trumpDeclaration?.playerIdx ?? mySeat,
        scores: g.scores || [0, 0],
        currentTrick: [],
        log: [...(g.log || []), `${playerName} discarded kitty.`] }
    });
    setSelectedIds([]);
  };

  
  const handlePlayCards = async () => {
    if (selectedIds.length === 0) return setError('Select cards to play');
    const g = gameRef.current;
    if (!g) return;
    if (g.currentTurn !== mySeat) return setError('Not your turn');
    const myCurrentHand = g.hands?.[mySeat] || [];
    const freshSelected = myCurrentHand.filter(card => selectedIds.includes(card.id));
    if (freshSelected.length === 0) return setError('Selected cards not found in hand');

    const combo = detectCombo(freshSelected, g.trumpSuit, g.trumpNumber);
    if (!combo.valid) return setError('Invalid combo');

    const isLeading = (g.currentTrick || []).length === 0;

    if (!isLeading) {
      const leadPlay = g.currentTrick[0];
      const leadCombo = detectCombo(leadPlay.cards, g.trumpSuit, g.trumpNumber);
      const followErr = validateFollow(freshSelected, myCurrentHand, { ...leadCombo, cards: leadPlay.cards }, g.trumpSuit, g.trumpNumber);
      if (followErr) return setError(followErr);
    }

    // Challenge detection
    if (isLeading && freshSelected.length > 1) {
      const newHand = myCurrentHand.filter(card => !selectedIds.includes(card.id));
      const newHands = g.hands.map((h, i) => i === mySeat ? newHand : h);
      const challengeResult = findChallenger(mySeat, newHands, freshSelected, g.trumpSuit, g.trumpNumber);
      if (challengeResult) {
        const { challengerSeat, components, beatableComponents } = challengeResult;
        await updateRoom(room.id, {
          game: {
            ...g,
            hands: newHands,
            phase: 'challenge',
            challenge: {
              leaderSeat: mySeat,
              leaderName: room.players.find(p => p.seat === mySeat)?.name || `Seat ${mySeat+1}`,
              playedCards: freshSelected,
              components,
              beatableComponents,
              challengerSeat,
            },
            log: [...(g.log || []), `${room.players.find(p => p.seat === mySeat)?.name} leads ${freshSelected.length} cards — ${room.players.find(p => p.seat === challengerSeat)?.name} must challenge!`],
          }
        });
        setSelectedIds([]);
        return;
      }
    }

    await commitPlay(freshSelected, isLeading, g);
    setSelectedIds([]);
  };

  
  const handleChallenge = async (keptCombo) => {
    const g = gameRef.current;
    if (!g?.challenge) return;
    if (g.challenge.challengerSeat !== mySeat) return setError('Not your turn to challenge');
    if (keptCombo.length === 0) return setError('Select which cards the leader must keep');

    const { leaderSeat, playedCards } = g.challenge;
    const keptIds = new Set(keptCombo.map(c => c.id));
    const returnedCards = playedCards.filter(c => !keptIds.has(c.id));
    const leaderHand = [...(g.hands[leaderSeat] || []), ...returnedCards];
    const newHands = g.hands.map((h, i) => i === leaderSeat ? leaderHand : h);
    const playerName = room.players.find(p => p.seat === mySeat)?.name || `Seat ${mySeat+1}`;
    const leaderName = room.players.find(p => p.seat === leaderSeat)?.name || `Seat ${leaderSeat+1}`;

    await updateRoom(room.id, { game: {
      ...g,
      hands: newHands,
      phase: 'playing',
      challenge: null,
      scores: g.scores || [0,0],
      currentTrick: [{ playerIdx: leaderSeat, cards: keptCombo, playerName: leaderName }],
      currentTurn: (leaderSeat + 1) % 4,
      log: [...(g.log || []), `${playerName} challenges! ${leaderName} must play ${keptCombo.length} card${keptCombo.length>1?'s':''}.`],
    }});
    setSelectedIds([]);
  };

  
  const handlePassChallenge = async () => {}; // kept for compatibility, not used

  const commitPlay = async (cards, isLeading, g) => {
    if (!g) g = gameRef.current;
    if (!g) return;
    const myCurrentHand = g.hands?.[mySeat] || [];
    const newHand = myCurrentHand.filter(card => !cards.map(c=>c.id).includes(card.id));
    const newHands = g.hands.map((h, i) => i === mySeat ? newHand : h);
    const playerName = room.players.find(p => p.seat === mySeat)?.name || `Seat ${mySeat+1}`;
    const newTrick = [...(g.currentTrick || []), { playerIdx: mySeat, cards, playerName }];

    let newGame = { ...g, hands: newHands, currentTrick: newTrick };

    if (newTrick.length === 4) {
      const winner = trickWinner(newTrick, g.trumpSuit, g.trumpNumber);
      const trickPoints = newTrick.flatMap(p => p.cards).reduce((s, c) => s + cardPoints(c), 0);
      const winnerTeam = winner % 2;
      const newScores = [...(g.scores || [0,0])];
      newScores[winnerTeam] += trickPoints;
      const newTricks = [...(g.tricks || []), { plays: newTrick, winner, points: trickPoints }];
      const log = [...(g.log || []), `${room.players.find(p => p.seat === winner)?.name || `Seat ${winner+1}`} wins trick (+${trickPoints} pts)`];
      newGame = { ...newGame, tricks: newTricks, scores: newScores,
        phase: 'trick_end', trickEndWinner: winner, trickEndLog: log, log };
    } else {
      newGame.currentTurn = (mySeat + 1) % 4;
    }

    await updateRoom(room.id, { game: newGame });
  };

  
  const handleNextRound = async () => {
    const g = gameRef.current;
    if (!g?.roundResult) return;
    const r = g.roundResult;
    const newLevels = [...(g.levels || [0,0])];
    const newAttacking = r.defScore >= 120
      ? 1 - g.attackingTeam
      : g.attackingTeam;

    if (r.defScore >= 120) {
      newLevels[1 - g.attackingTeam] = Math.min(
        LEVELS.length - 1,
        (newLevels[1 - g.attackingTeam] || 0) + Math.max(0, r.defGain || 0)
      );
    } else {
      newLevels[g.attackingTeam] = Math.min(
        LEVELS.length - 1,
        (newLevels[g.attackingTeam] || 0) + Math.max(0, r.atkGain || 0)
      );
    }

    const decks = buildDecks();
    const { sequence, kitty } = dealCardsSequential(decks);
    // After round 1, kitty always goes to the dealer (whoever declared trump / held kitty)
    // Win: defenders become attackers, dealer = teammate of prev dealer
    // Loss: attackers stay, dealer = next clockwise from prev dealer
    const prevKittyHolder = g.kittyHolder ?? g.trumpDeclaration?.playerIdx ?? 0;
    const defendersWon = r.defScore >= 120;
    const nextKittyHolder = defendersWon
      ? (prevKittyHolder + 2) % 4  // teammate of previous dealer
      : (prevKittyHolder + 1) % 4; // next clockwise

    const initialGame = {
      phase: 'dealing',
      hands: [[], [], [], []],
      dealSequence: sequence,
      dealIndex: 0,
      dealComplete: false,
      trumpConfirmed: [],
      kitty,
      kittyHolder: null,
      trumpDeclaration: null,
      trumpSuit: null,
      trumpNumber: LEVELS[newLevels[newAttacking]],
      scores: [0, 0],
      tricks: [],
      currentTrick: [],
      currentTurn: nextKittyHolder,
      attackingTeam: newAttacking,
      levels: newLevels,
      roundNum: (g.roundNum || 1) + 1,
      firstCardSeat: null,
      firstCardSuit: null,
      nextKittyHolder,
      log: [`Round ${(g.roundNum || 1) + 1} — Team ${newAttacking === 0 ? 'A' : 'B'} attacks at level ${LEVELS[newLevels[newAttacking]]}`],
    };
    await updateRoom(room.id, { game: initialGame });
  };

  
  const SUIT_ORDER = ['♠', '♥', '♣', '♦'];
  const sortedHand = [...(myHand || [])].sort((a, b) => {
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

      {restoring && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{ color: GOLD, fontSize: '14px', letterSpacing: '0.1em' }}>Reconnecting...</div>
        </div>
      )}
      {!restoring && screen === 'home' && (
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

      {!restoring && screen === 'lobby' && room && (
        <LobbyScreen room={room} playerId={playerId} onStart={handleStartGame} onKick={handleKick} onClaimSeat={handleClaimSeat} onLeaveSeat={handleLeaveSeat} onLeave={handleLeave} />
      )}

      {!restoring && screen === 'game' && game && (
        <GameScreen
          game={game} room={room} mySeat={mySeat} myTeam={myTeam}
          sortedHand={sortedHand} selectedIds={selectedIds} toggleCard={toggleCard}
          selectedCards={selectedCards} error={error} setError={setError}
          onDeclareTrump={handleDeclareTrump} onTakeKitty={handleTakeKitty}
          onDiscardKitty={handleDiscardKitty} onPlayCards={handlePlayCards}
          onNextRound={handleNextRound} playerId={playerId}
          onChallenge={handleChallenge} onConfirmPass={handleConfirmPass} onLeave={handleLeave}
          confirmLeave={confirmLeave} setConfirmLeave={setConfirmLeave}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}

// ── Game Screen ───────────────────────────────────────────────────────────────
function GameScreen({ game, room, mySeat, myTeam, sortedHand, selectedIds, toggleCard, selectedCards, error, setError, onDeclareTrump, onTakeKitty, onDiscardKitty, onPlayCards, onNextRound, playerId, onChallenge, onConfirmPass, onLeave, confirmLeave, setConfirmLeave }) {
  const [selectedCompIdx, setSelectedCompIdx] = useState(null);
  const phase = game?.phase;
  const isMyTurn = game.currentTurn === mySeat && (phase === 'playing' || phase === 'trick_end');
  const canPlay = (game.currentTurn === mySeat || game.currentTurn == null) && phase === 'playing';
  useEffect(() => { if (game.phase !== 'challenge') setSelectedCompIdx(null); }, [game.phase]);

  const effectiveKittyHolder = game.kittyHolder ??
    (game.roundNum === 1
      ? (game.trumpDeclaration?.playerIdx ?? game.firstCardSeat ?? 0)
      : (game.firstCardSeat ?? 0));
  const isKittyHolder = effectiveKittyHolder === mySeat;
  const attackTeamName = `Team ${game.attackingTeam === 0 ? 'A' : 'B'}`;
  const myTeamAttacking = myTeam === game.attackingTeam;

  return (
    <div style={{ width: '100%', maxWidth: '640px' }}>

      {/* Leave room confirmation */}
      {confirmLeave && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: SURFACE, border: `1px solid ${RED}`, borderRadius: '12px', padding: '24px', maxWidth: '320px', width: '90%', textAlign: 'center' }}>
            <div style={{ color: RED, fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>Leave Game?</div>
            <div style={{ color: MUTED, fontSize: '13px', marginBottom: '20px' }}>Are you sure you want to leave? This may disrupt the game for other players.</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ ...S.btn(MUTED), flex: 1 }} onClick={() => setConfirmLeave(false)}>Cancel</button>
              <button style={{ ...S.btn(RED), flex: 1 }} onClick={onLeave}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {/* Scores & Info */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px', marginBottom: '4px' }}>
        <button onClick={() => setConfirmLeave(true)} style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Leave Game
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px', padding: '0 16px' }}>
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

          {/* Progress bar while dealing */}
          {!game.dealComplete && (<>
            <div style={{ color: GOLD, fontWeight: 700, marginBottom: '8px' }}>
              Dealing Cards... ({game.dealIndex || 0}/{game.dealSequence?.length || 156})
            </div>
            <div style={{ height: '4px', background: BORDER, borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: GOLD, borderRadius: '2px', width: `${((game.dealIndex || 0) / (game.dealSequence?.length || 156)) * 100}%`, transition: 'width 0.8s ease' }} />
            </div>
          </>)}

          {/* Declaration status */}
          {game.trumpDeclaration ? (
            <div style={{ color: MUTED, fontSize: '13px', marginBottom: '12px' }}>
              <span style={{ color: GOLD, fontWeight: 700 }}>
                {room.players.find(p => p.seat === game.trumpDeclaration.playerIdx)?.name}
              </span> declared trump{game.trumpSuit ? ` (${game.trumpSuit})` : ' (jokers)'} with {game.trumpDeclaration.declarationCount} card{game.trumpDeclaration.declarationCount > 1 ? 's' : ''}.
              {!game.trumpDeclaration.locked && ' Can be overridden with more cards.'}
              {game.trumpDeclaration.locked && <span style={{ color: GREEN }}> 🔒 Locked.</span>}
            </div>
          ) : (
            <div style={{ color: MUTED, fontSize: '13px', marginBottom: '12px' }}>
              {game.dealComplete ? 'Dealing complete. Declare trump or pass.' : 'You can declare trump any time during dealing.'}
            </div>
          )}

          {/* Declare button — always available during dealing */}
          <button style={S.btn(selectedCards.length >= 1 ? GOLD : '#333')} onClick={onDeclareTrump}>
            {selectedCards.length === 0 ? 'Select cards to declare trump' : `Declare Trump (${selectedCards.length} card${selectedCards.length > 1 ? 's' : ''})`}
          </button>

          {/* Pass button — shown after all cards dealt, when nobody has declared */}
          {(game.dealComplete || (game.dealIndex >= (game.dealSequence?.length || 156))) && !game.trumpDeclaration && (() => {
            const confirmed = game.trumpConfirmed || [];
            const iConfirmed = confirmed.includes(mySeat);
            const waitingOn = [0,1,2,3]
              .filter(s => !confirmed.includes(s))
              .map(s => room.players.find(p => p.seat === s)?.name).filter(Boolean);
            return (
              <div style={{ marginTop: '10px' }}>
                {!iConfirmed ? (
                  <button style={{ ...S.btn(MUTED), marginBottom: '6px' }} onClick={onConfirmPass}>
                    Pass — decide trump from kitty
                  </button>
                ) : (
                  <div style={{ color: GREEN, fontSize: '12px', marginBottom: '4px' }}>✓ You passed.</div>
                )}
                {waitingOn.length > 0 && (
                  <div style={{ fontSize: '11px', color: MUTED }}>Waiting for: {waitingOn.join(', ')}</div>
                )}
              </div>
            );
          })()}


          {/* Pass block for when someone has declared — non-declarers must pass */}
          {(game.dealComplete || game.dealIndex >= (game.dealSequence?.length || 156)) && game.trumpDeclaration && !game.trumpDeclaration.locked && (() => {
            const confirmed = game.trumpConfirmed || [];
            const declarerSeat = game.trumpDeclaration.playerIdx;
            const iNeedToPass = mySeat !== declarerSeat && !confirmed.includes(mySeat);
            const waitingOn = [0,1,2,3]
              .filter(s => s !== declarerSeat && !confirmed.includes(s))
              .map(s => room.players.find(p => p.seat === s)?.name).filter(Boolean);
            const allPassed = waitingOn.length === 0;
            if (allPassed) return null;
            return (
              <div style={{ marginTop: '10px' }}>
                {iNeedToPass && (
                  <button style={{ ...S.btn(MUTED), marginBottom: '6px' }} onClick={onConfirmPass}>
                    Pass — I accept this trump call
                  </button>
                )}
                {!iNeedToPass && mySeat !== declarerSeat && (
                  <div style={{ color: GREEN, fontSize: '12px', marginBottom: '4px' }}>✓ You accepted.</div>
                )}
                <div style={{ fontSize: '11px', color: MUTED }}>
                  Waiting for: {waitingOn.join(', ')}
                </div>
              </div>
            );
          })()}

          {(game.dealComplete || game.dealIndex >= (game.dealSequence?.length || 156)) && game.trumpDeclaration && (() => {
            const confirmed = game.trumpConfirmed || [];
            const decl = game.trumpDeclaration;
            const declarerSeat = decl?.playerIdx ?? -1;
            const allPassed = [0,1,2,3].every(s => s === declarerSeat || confirmed.includes(s));
            if (!allPassed) return null;
            return isKittyHolder ? (
              <button style={{ ...S.btn(GREEN), marginTop: '8px' }} onClick={onTakeKitty}>
                Take Kitty →
              </button>
            ) : (
              <div style={{ color: MUTED, fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>
                Waiting for {room.players.find(p => p.seat === game.kittyHolder)?.name} to take the kitty...
              </div>
            );
          })()}
        </div>
      )}

      {game.phase === 'kitty' && isKittyHolder && (
        <div style={{ background: SURFACE, border: `1px solid ${GOLD}44`, borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ color: GOLD, fontWeight: 700, marginBottom: '8px' }}>Discard Kitty</div>
          <div style={{ color: MUTED, fontSize: '13px', marginBottom: '12px' }}>Select exactly 6 cards to discard — they score for whoever wins the last trick.</div>
          {selectedCards.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: MUTED, marginBottom: '6px' }}>Selected to discard ({selectedCards.length}/6):</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedCards.map(card => <PlayingCard key={card.id} card={card} small />)}
              </div>
            </div>
          )}
          <button style={S.btn(selectedCards.length === 6 ? RED : '#444')} onClick={onDiscardKitty}>
            Discard {selectedCards.length}/6 cards
          </button>
        </div>
      )}

      {game.phase === 'kitty' && !isKittyHolder && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px', marginBottom: '12px', textAlign: 'center', color: MUTED }}>
          Waiting for {room.players.find(p => p.seat === game.kittyHolder)?.name} to discard kitty...
        </div>
      )}

      {/* Challenge Phase — mandatory challenger picks which sub-combo leader keeps */}
      {game.phase === 'challenge' && game.challenge && (() => {
        const ch = game.challenge;
        const isChallenger = ch.challengerSeat === mySeat;
        const isLeader = ch.leaderSeat === mySeat;
        const challName = room.players.find(p => p.seat === ch.challengerSeat)?.name;

        const components = ch.components || [];
        const beatableComponents = ch.beatableComponents || components;
        // Beatable component IDs (by their first card id) for quick lookup
        const beatableIds = new Set(beatableComponents.map(comp => comp.cards[0].id));

        return (
          <div style={{ background: SURFACE, border: `2px solid ${RED}66`, borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
            <div style={{ color: RED, fontWeight: 700, marginBottom: '8px' }}>
              ⚔ Challenge — {challName} must pick which part of {ch.leaderName}'s play to keep
            </div>

            {/* Show decomposed sub-combos — only beatable ones are selectable */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: MUTED, marginBottom: '8px' }}>
                {isChallenger
                  ? `Select which component you can beat — that component stays, the rest go back to ${ch.leaderName}.`
                  : `${challName} is choosing which component to challenge...`}
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {components.map((comp, i) => {
                  const isBeatable = beatableIds.has(comp.cards[0].id);
                  const isSelected = selectedCompIdx === i;
                  return (
                  <div
                    key={i}
                    onClick={isChallenger && isBeatable ? () => setSelectedCompIdx(i === selectedCompIdx ? null : i) : undefined}
                    style={{
                      border: `2px solid ${isSelected ? GOLD : isBeatable ? RED + '88' : '#333'}`,
                      borderRadius: '8px', padding: '8px',
                      background: isSelected ? '#2a2500' : isBeatable ? '#1a0000' : '#0d0d0d',
                      cursor: isChallenger && isBeatable ? 'pointer' : 'default',
                      opacity: isBeatable ? 1 : 0.4,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: isBeatable ? RED : MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {comp.type.replace('_', ' ')}{isBeatable ? ' ← can beat' : " (can't beat)"}
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {comp.cards.map(card => <PlayingCard key={card.id} card={card} small />)}
                    </div>
                  </div>
                  );
                })}
              </div>
            
            </div>

            {isChallenger && (
              <button
                style={S.btn(selectedCompIdx !== null ? RED : '#444')}
                onClick={() => selectedCompIdx !== null && onChallenge(components[selectedCompIdx].cards)}
                disabled={selectedCompIdx === null}
              >
                {selectedCompIdx !== null
                  ? `You beat the ${components[selectedCompIdx].type.replace('_',' ')} — ${ch.leaderName} must play it, rest returned`
                  : 'Select a component you can beat above'}
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


      {phase === 'playing' && isKittyHolder && game.kitty && game.kitty.length > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Your discarded kitty</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {game.kitty.map(card => <PlayingCard key={card.id} card={card} small />)}
          </div>
        </div>
      )}

      {(phase === 'playing' || phase === 'trick_end') && (
        <div style={{ background: SURFACE, border: `1px solid ${isMyTurn ? GOLD + '66' : BORDER}`, borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
          {canPlay ? (
            <>
              <div style={{ color: GOLD, fontWeight: 700, marginBottom: '8px' }}>Your Turn — Select cards to play</div>
              <button style={S.btn(GOLD)} onClick={onPlayCards}>
                Play {selectedCards.length} card{selectedCards.length !== 1 ? 's' : ''}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: MUTED }}>
              Waiting for {room.players.find(p => p.seat === game.currentTurn)?.name}...
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
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '0', padding: '8px 0', overflow: 'visible', background: 'transparent', border: 'none', overflow: 'visible' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 16px' }}>
          <span style={S.label}>Your Hand ({sortedHand.length} cards)</span>
          <span style={S.badge(myTeam === 0 ? GOLD : '#52a8a8')}>Team {myTeam === 0 ? 'A' : 'B'} {myTeamAttacking ? '⚔' : '🛡'}</span>
        </div>
        {/* Group hand by suit */}
        {(() => {
          const nonTrump = sortedHand.filter(card => !isTrump(card, game.trumpSuit, game.trumpNumber));
          const trumpCards = sortedHand.filter(card => isTrump(card, game.trumpSuit, game.trumpNumber));
          const rows = [];
          if (nonTrump.length) rows.push({ label: 'Non-Trump', cards: nonTrump, color: TEXT });
          if (trumpCards.length) rows.push({ label: `Trump${game.trumpSuit ? ' '+game.trumpSuit : ''}`, cards: trumpCards, color: GOLD });
          const OVERLAP = 36; // px overlap between cards
          const CARD_W = 64;
          return rows.map(({ label, cards, color }) => (
            <div key={label} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '6px', paddingLeft: '16px' }}>
                {label} ({cards.length})
              </div>
              <div style={{ overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', flexWrap: 'nowrap', paddingLeft: '16px', paddingRight: '16px', paddingTop: '28px', paddingBottom: '4px', width: 'max-content', minWidth: '100%' }}>
                  {cards.map((card, i) => (
                    <div key={card.id} style={{ marginLeft: i === 0 ? 0 : -OVERLAP, zIndex: selectedIds.includes(card.id) ? 100 : i, position: 'relative' }}>
                      <PlayingCard card={card}
                        selected={selectedIds.includes(card.id)}
                        onClick={() => toggleCard(card.id)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Log + played cards history */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px', marginTop: '8px' }}>
        <div style={{ fontSize: '11px', color: GOLD, fontWeight: 700, marginBottom: '6px', letterSpacing: '0.1em' }}>GAME LOG</div>
        {/* Tricks history */}
        {(game.tricks || []).length > 0 && (
          <div style={{ marginBottom: '8px', maxHeight: '140px', overflowY: 'auto' }}>
            {[...(game.tricks || [])].reverse().map((trick, ti) => {
              const trickNum = (game.tricks || []).length - ti;
              const winnerName = room.players.find(p => p.seat === trick.winner)?.name || `Seat ${trick.winner+1}`;
              return (
                <div key={ti} style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: '10px', color: MUTED, marginBottom: '3px' }}>
                    Trick {trickNum} — <span style={{ color: trick.winner % 2 === 0 ? GOLD : '#52a8a8' }}>{winnerName}</span> wins {trick.points > 0 ? `(+${trick.points}pts)` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {trick.plays.map((play, pi) => {
                      const pName = room.players.find(p => p.seat === play.playerIdx)?.name || `Seat ${play.playerIdx+1}`;
                      return (
                        <div key={pi} style={{ fontSize: '10px', color: MUTED }}>
                          <span style={{ color: TEXT }}>{pName}: </span>
                          {play.cards.map(card => {
                            const isRed = card.suit === '\u2665' || card.suit === '\u2666';
                            const isJoker = card.suit === 'JOKER';
                            return (
                              <span key={card.id} style={{ color: isJoker ? GOLD : isRed ? '#e05252' : '#cccccc', marginRight: '3px', fontWeight: 600 }}>
                                {isJoker ? (card.rank === 'BIG' ? 'BJ' : 'SJ') : `${card.rank}${card.suit}`}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Event log */}
        {game.log && game.log.length > 0 && (
          <div style={{ maxHeight: '80px', overflowY: 'auto' }}>
            {[...game.log].reverse().map((entry, i) => (
              <div key={i} style={{ fontSize: '10px', color: MUTED, padding: '1px 0' }}>{entry}</div>
            ))}
          </div>
        )}
      </div>
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

