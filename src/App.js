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
  const color = isRed ? '#cc2200' : '#1a1a1a';
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
    flexShrink: 0, overflow: 'visible', userSelect: 'none', zIndex: selected ? 10 : 'auto',
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
  const [playerId, setPlayerId] = useState(null);
  const [restoring, setRestoring] = useState(true);
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
  const game = room?.game;
  const mySeat = room?.players?.find(p => p.id === playerId)?.seat ?? -1;
  const myHand = (mySeat >= 0 && game?.hands?.[mySeat]) ? game.hands[mySeat] : [];
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
      setRoom(r); setPlayerId(pid); setScreen('lobby');
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
  };

  // ── Game Actions ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);
  const dealTimerRef = useRef(null);

  // ── Auto-deal animation ──────────────────────────────────────────────────
  // ── Trick end delay — host waits 2s then resolves ──────────────────────────
  useEffect(() => {
    if (!game || game.phase !== 'trick_end' || mySeat !== 0) return;
    const timer = setTimeout(async () => {
      const winner = game.trickEndWinner;
      const log = game.trickEndLog || game.log;
      const newHands = game.hands;
      const newTricks = game.tricks || [];
      const newScores = game.scores;
      const totalCards = newHands.reduce((s, h) => s + h.length, 0);

      if (totalCards === 0) {
        const kittyPts = countPoints(game.kitty || []);
        const lastWinnerTeam = winner % 2;
        const mult = kittyMultiplier(
          (newTricks[newTricks.length - 1]?.plays || []).flatMap(p => p.cards),
          game.trumpSuit, game.trumpNumber
        );
        const finalScores = [...newScores];
        finalScores[lastWinnerTeam] += kittyPts * mult;
        const defScore = finalScores[1 - game.attackingTeam];
        const atkGain = attackerLevelGain(defScore);
        const defGain = defenderLevelGain(defScore);
        await updateRoom(room.id, { game: { ...game, currentTrick: [], scores: finalScores,
          phase: 'round_end',
          roundResult: { defScore, atkGain, defGain, kittyPts, kittyMult: mult },
          log: [...log, `Round over! Defenders scored ${defScore} pts.`] } });
      } else {
        await updateRoom(room.id, { game: { ...game, currentTrick: [], currentTurn: winner, phase: 'playing', log } });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [game?.phase, game?.trickEndWinner]);

    useEffect(() => {
    if (!game || game.phase !== 'dealing' || game.dealComplete) return;

    // Check if all players confirmed pass mid-deal — resolve immediately
    if (!game.trumpSuit) {
      const midConfirmed = game.trumpConfirmed || [];
      if (midConfirmed.length >= 4) {
        if (mySeat === 0) {
          const trumpNum = game.trumpNumber;
          let resolvedSuit = null;
          for (const card of (game.kitty || [])) {
            if (card.rank === trumpNum && card.suit !== 'JOKER') { resolvedSuit = card.suit; break; }
          }
          if (!resolvedSuit) resolvedSuit = game.firstCardSuit || '♠';
          const kittyHolder = game.firstCardSeat ?? 0;
          updateRoom(room.id, { game: { ...game, trumpSuit: resolvedSuit, kittyHolder, currentTurn: kittyHolder, dealComplete: true,
            log: [...(game.log||[]), `All players passed — trump auto-set to ${resolvedSuit}. ${room.players.find(p => p.seat === kittyHolder)?.name} holds the kitty.`] } });
        }
        return;
      }
    }

    if (game.dealIndex >= (game.dealSequence?.length || 0)) {
      // All cards dealt
      if (game.trumpSuit) {
        // Trump already declared — just finalize
        if (mySeat === 0) {
          const kittyHolder = game.roundNum === 1
            ? (game.trumpDeclaration?.playerIdx ?? game.firstCardSeat ?? 0)
            : (game.firstCardSeat ?? 0);
          updateRoom(room.id, { game: { ...game, kittyHolder, currentTurn: kittyHolder, dealComplete: true } });
        }
      } else {
        // No trump declared yet — wait for all 4 players to confirm they pass
        const confirmed = game.trumpConfirmed || [];
        if (confirmed.length >= 4) {
          // All confirmed — stop dealing and auto-resolve from kitty/first card
          if (mySeat === 0) {
            const trumpNum = game.trumpNumber;
            let resolvedSuit = null;
            for (const card of (game.kitty || [])) {
              if (card.rank === trumpNum && card.suit !== 'JOKER') { resolvedSuit = card.suit; break; }
            }
            if (!resolvedSuit) resolvedSuit = game.firstCardSuit || '♠';
            const kittyHolder = game.firstCardSeat ?? 0;
            updateRoom(room.id, { game: { ...game, trumpSuit: resolvedSuit, kittyHolder, currentTurn: kittyHolder, dealComplete: true,
              log: [...(game.log||[]), `All players passed — trump auto-set to ${resolvedSuit}. ${room.players.find(p => p.seat === kittyHolder)?.name} holds the kitty.`] } });
          }
          return; // stop the deal timer
        }
        // else: waiting for players to confirm — UI handles this
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
    if (!game || selectedCards.length === 0) return;

    const allJokers = selectedCards.every(c => c.suit === 'JOKER');
    const existingDecl = game.trumpDeclaration;
    const newSuit = getTrumpSuitFromDeclaration(selectedCards);
    const declName = room.players.find(p => p.seat === mySeat)?.name || `Seat ${mySeat+1}`;
    const currentCount = existingDecl ? (existingDecl.declarationCount || existingDecl.cards.length) : 0;
    const iAmDeclarer = existingDecl?.playerIdx === mySeat;

    // Validate cards: must be all trump number of same suit, or all same joker type
    if (!allJokers) {
      if (!selectedCards.every(c => c.rank === game.trumpNumber)) {
        return setError(`Must select ${game.trumpNumber}s (the trump number) to declare trump`);
      }
      if (!selectedCards.every(c => c.suit === selectedCards[0].suit)) {
        return setError('All selected cards must be the same suit');
      }
    } else {
      const allBig = selectedCards.every(c => c.rank === 'BIG');
      const allSmall = selectedCards.every(c => c.rank === 'SMALL');
      if (!allBig && !allSmall) return setError('Joker declaration must be all Big or all Small jokers');
      if (selectedCards.length < 2) return setError('Need at least 2 jokers to declare');
    }

    // ── CASE 1: No existing declaration — fresh call (1+ cards ok) ──────────
    if (!existingDecl) {
      const isLocked = !allJokers && selectedCards.length >= 3;
      await updateRoom(room.id, { game: {
        ...game,
        trumpDeclaration: { cards: selectedCards, playerIdx: mySeat, declarationCount: selectedCards.length, locked: isLocked },
        trumpSuit: newSuit,
        log: [...(game.log || []), `${declName} declares trump${newSuit ? ` (${newSuit})` : ' (jokers — no suit)'} with ${selectedCards.length} card${selectedCards.length>1?'s':''}.`],
      }});
      setSelectedIds([]);
      return;
    }

    // ── CASE 2: Locked — nobody can do anything ──────────────────────────────
    if (existingDecl.locked) return setError('Trump is locked — cannot be changed');

    // ── CASE 3: I am the declarer — REINFORCEMENT only (same suit, more cards) ─
    if (iAmDeclarer) {
      // Same player can only reinforce same suit — cannot switch suits
      if (newSuit !== game.trumpSuit) return setError('You already declared — you can only reinforce the same suit, not switch');
      if (allJokers) return setError('You already declared a suit — cannot switch to jokers');
      const newCount = currentCount + selectedCards.length;
      if (newCount < currentCount + 1) return setError('Must add at least 1 more card to reinforce');
      const isLocked = newCount >= 3;
      await updateRoom(room.id, { game: {
        ...game,
        trumpDeclaration: { ...existingDecl, declarationCount: newCount, locked: isLocked },
        log: [...(game.log || []), isLocked
          ? `${declName} reinforces and locks in ${newSuit} as trump (${newCount} ${game.trumpNumber}s — locked!)`
          : `${declName} reinforces ${newSuit} trump (${newCount} cards — needs ${newCount + 1} to override).`],
      }});
      setSelectedIds([]);
      return;
    }

    // ── CASE 4: Opponent override — must strictly beat current count ─────────
    if (selectedCards.length <= currentCount) {
      return setError(`Need more than ${currentCount} card${currentCount>1?'s':''} to override current declaration`);
    }
    const isLocked = !allJokers && selectedCards.length >= 3;
    // Reset confirmed passes so overridden player gets their pass button back
    const resetConfirmed = (game.trumpConfirmed || []).filter(s => s === mySeat);
    await updateRoom(room.id, { game: {
      ...game,
      trumpDeclaration: { cards: selectedCards, playerIdx: mySeat, declarationCount: selectedCards.length, locked: isLocked },
      trumpSuit: newSuit,
      trumpConfirmed: resetConfirmed,
      log: [...(game.log || []), isLocked
        ? `${declName} overrides and locks in ${newSuit} as trump with ${selectedCards.length} ${game.trumpNumber}s!`
        : `${declName} overrides trump${newSuit ? ` → ${newSuit}` : ' → jokers'} with ${selectedCards.length} cards.`],
    }});
    setSelectedIds([]);
  };


  const handleConfirmPass = async () => {
    if (!game) return;
    const confirmed = game.trumpConfirmed || [];
    if (confirmed.includes(mySeat)) return; // already confirmed
    await updateRoom(room.id, { game: { ...game, trumpConfirmed: [...confirmed, mySeat] } });
  };

  const handleTakeKitty = async () => {
    // Derive kittyHolder in case it hasn't been written yet by host timer
    const effectiveKittyHolder = game.kittyHolder ??
      (game.roundNum === 1
        ? (game.trumpDeclaration?.playerIdx ?? game.firstCardSeat ?? 0)
        : (game.firstCardSeat ?? 0));
    if (mySeat !== effectiveKittyHolder) return;
    const newHand = [...myHand, ...game.kitty];
    const newHands = game.hands.map((h, i) => i === mySeat ? newHand : h);
    await updateRoom(room.id, { game: { ...game, phase: 'kitty', kittyHolder: effectiveKittyHolder, hands: newHands, kitty: [], dealComplete: true } });
  };

  const handleDiscardKitty = async () => {
    if (mySeat !== game.kittyHolder) return;
    if (selectedCards.length !== 6) return setError('Select exactly 6 cards to discard');
    const newHand = myHand.filter(c => !selectedIds.includes(c.id));
    const newHands = game.hands.map((h, i) => i === mySeat ? newHand : h);
    await updateRoom(room.id, {
      game: { ...game, phase: 'playing', hands: newHands, kitty: selectedCards, currentTurn: game.kittyHolder, log: [...(game.log || []), `${room.players.find(p => p.seat === mySeat).name} discarded kitty and set trump.`] }
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
      const newHands = (game.hands || [[],[],[],[]]).map((h, i) => i === mySeat ? newHand : h);
      console.log('[Challenge] mySeat:', mySeat, 'played:', selectedCards.map(c=>c.rank+c.suit));
      console.log('[Challenge] newHands sizes:', newHands.map((h,i) => `seat${i}:${h.length}`));
      const challengeResult = findChallenger(mySeat, newHands, selectedCards, game.trumpSuit, game.trumpNumber);
      console.log('[Challenge] result:', challengeResult ? `seat ${challengeResult.challengerSeat}` : 'none');
      if (challengeResult) {
        const { challengerSeat, components } = challengeResult;
        await updateRoom(room.id, {
          game: {
            ...game,
            hands: newHands,
            phase: 'challenge',
            challenge: {
              leaderSeat: mySeat,
              leaderName: room.players.find(p => p.seat === mySeat)?.name || `Seat ${mySeat+1}`,
              playedCards: selectedCards,
              components,
              challengerSeat,
            },
            log: [...(game.log || []), `${room.players.find(p => p.seat === mySeat).name} leads ${selectedCards.length} cards — ${room.players.find(p => p.seat === challengerSeat)?.name} must challenge!`],
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
        currentTrick: [{ playerIdx: leaderSeat, cards: keptCombo, playerName: room.players.find(p => p.seat === leaderSeat).name }],
        currentTurn: (leaderSeat + 1) % 4,
        log: [...(game.log || []), `${room.players.find(p => p.seat === mySeat).name} challenges! ${room.players.find(p => p.seat === leaderSeat).name} must play ${keptCombo.length} cards.`],
      }
    });
    setSelectedIds([]);
  };

  const handlePassChallenge = async () => {}; // kept for compatibility, not used

  const commitPlay = async (cards, isLeading) => {
    const newHand = myHand.filter(c => !cards.map(c=>c.id).includes(c.id));
    const newHands = game.hands.map((h, i) => i === mySeat ? newHand : h);
    const newTrick = [...(game.currentTrick || []), { playerIdx: mySeat, cards, playerName: room.players.find(p => p.seat === mySeat).name }];

    let newGame = { ...game, hands: newHands, currentTrick: newTrick };

    if (newTrick.length === 4) {
      const winner = trickWinner(newTrick, game.trumpSuit, game.trumpNumber);
      const trickPoints = newTrick.flatMap(p => p.cards).reduce((s, c) => s + cardPoints(c), 0);
      const winnerTeam = winner % 2;
      const newScores = [...game.scores];
      newScores[winnerTeam] += trickPoints;
      const newTricks = [...(game.tricks || []), { plays: newTrick, winner, points: trickPoints }];
      const log = [...(game.log || []), `${room.players.find(p => p.seat === winner)?.name || `Seat ${winner+1}`} wins trick (+${trickPoints} pts)`];
      // Show completed trick for 2 seconds before clearing (host drives timer)
      newGame = { ...newGame, hands: newHands, currentTrick: newTrick, tricks: newTricks,
        scores: newScores, phase: 'trick_end', trickEndWinner: winner, trickEndLog: log, log };
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
        trumpConfirmed: [],
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
        log: [`Round ${game.roundNum + 1} starts. ${room.players.find(p => p.seat === newKittyHolder).name} holds kitty.`],
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
        />
      )}
    </div>
    </ErrorBoundary>
  );
}

// ── Game Screen ───────────────────────────────────────────────────────────────
function GameScreen({ game, room, mySeat, myTeam, sortedHand, selectedIds, toggleCard, selectedCards, error, setError, onDeclareTrump, onTakeKitty, onDiscardKitty, onPlayCards, onNextRound, playerId, onChallenge, onConfirmPass, onLeave }) {
  const [selectedCompIdx, setSelectedCompIdx] = useState(null);
  const phase = game?.phase;
  const isMyTurn = game.currentTurn === mySeat && phase !== 'trick_end';
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

      {/* Scores & Info */}
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
          {(game.dealComplete || game.dealIndex >= (game.dealSequence?.length || 156)) && game.trumpDeclaration && (() => {
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

          {(game.dealComplete || game.dealIndex >= (game.dealSequence?.length || 156)) && game.trumpSuit && (() => {
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
          <div style={{ color: MUTED, fontSize: '13px', marginBottom: '12px' }}>Select exactly 6 cards to discard (they score for whoever wins the last trick)</div>
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

      {(phase === 'playing' || phase === 'trick_end') && (
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
          const groups = [];
          const nonTrump = sortedHand.filter(card => !isTrump(card, game.trumpSuit, game.trumpNumber));
          const trumpCards = sortedHand.filter(card => isTrump(card, game.trumpSuit, game.trumpNumber));
          const suits = ['\u2660','\u2665','\u2666','\u2663'].filter(s => s !== game.trumpSuit);
          suits.forEach(suit => {
            const cards = nonTrump.filter(c => c.suit === suit);
            if (cards.length) groups.push({ label: suit, cards, color: (suit==='\u2665'||suit==='\u2666') ? '#cc2200' : '#1a1a1a' });
          });
          if (trumpCards.length) groups.push({ label: `Trump${game.trumpSuit ? ' '+game.trumpSuit : ''}`, cards: trumpCards, color: GOLD });
          return groups.map(({ label, cards, color }) => (
            <div key={label} style={{ marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', color, fontWeight: 700, letterSpacing: '0.1em', marginBottom: '4px', paddingLeft: '4px' }}>{label} ({cards.length})</div>
              <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'visible', padding: '28px 16px 12px 16px', gap: '4px', WebkitOverflowScrolling: 'touch' }}>
                {cards.map(card => (
                  <PlayingCard key={card.id} card={card}
                    selected={selectedIds.includes(card.id)}
                    onClick={() => toggleCard(card.id)} />
                ))}
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
                              <span key={card.id} style={{ color: isJoker ? GOLD : isRed ? '#cc2200' : TEXT, marginRight: '3px', fontWeight: 600 }}>
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

