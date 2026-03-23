import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vrovsnztaedjlvgngrbf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eq-0-C0qW9q7VXxxWsPulw_xw8TxnY1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Room helpers ──────────────────────────────────────────────────────────────

export async function createRoom(playerName) {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  const playerId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      code,
      state: 'lobby',
      game: null,
      players: [{ id: playerId, name: playerName, seat: 0 }],
      host_id: playerId,
    })
    .select()
    .single();

  if (error) throw error;
  return { room: data, playerId };
}

export async function joinRoom(code, playerName) {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !room) throw new Error('Room not found');
  if (room.state !== 'lobby') throw new Error('Game already started');
  if (room.players.length >= 4) throw new Error('Room is full');

  const playerId = crypto.randomUUID();
  // Find lowest available seat
  const takenSeats = new Set(room.players.map(p => p.seat));
  const seat = [0, 1, 2, 3].find(s => !takenSeats.has(s)) ?? room.players.length;
  const updatedPlayers = [...room.players, { id: playerId, name: playerName, seat }];

  const { error: updateError } = await supabase
    .from('rooms')
    .update({ players: updatedPlayers })
    .eq('id', room.id);

  if (updateError) throw updateError;
  return { room: { ...room, players: updatedPlayers }, playerId };
}

export async function updateRoom(roomId, updates) {
  const { error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', roomId);
  if (error) throw error;
}

export function subscribeToRoom(roomId, callback) {
  return supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`,
    }, payload => callback(payload.new))
    .subscribe();
}
