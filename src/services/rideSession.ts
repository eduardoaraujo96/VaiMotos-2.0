import type { UserRole } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export interface RideChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: number;
}

export interface RidePeerLocation {
  userId: string;
  lat: number;
  lng: number;
  updatedAt: number;
}

type ChatListener = (messages: RideChatMessage[]) => void;
type LocationListener = (location: RidePeerLocation) => void;

interface RideRoom {
  messages: RideChatMessage[];
  peers: Map<string, RidePeerLocation>;
  chatListeners: Set<ChatListener>;
  locationListeners: Set<LocationListener>;
  channel: ReturnType<NonNullable<ReturnType<typeof getSupabaseClient>>['channel']> | null;
  broadcast: BroadcastChannel | null;
}

const CHANNEL_PREFIX = 'vaimoto.ride.volatile.';
const rooms = new Map<string, RideRoom>();

function uid(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureRoom(rideId: string): RideRoom {
  const existing = rooms.get(rideId);
  if (existing) return existing;

  const room: RideRoom = {
    messages: [],
    peers: new Map(),
    chatListeners: new Set(),
    locationListeners: new Set(),
    channel: null,
    broadcast: typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`${CHANNEL_PREFIX}${rideId}`) : null,
  };

  if (room.broadcast) {
    room.broadcast.onmessage = (event: MessageEvent) => {
      applyIncoming(rideId, event.data, false);
    };
  }

  if (isSupabaseConfigured) {
    const client = getSupabaseClient();
    if (client) {
      const channel = client.channel(`ride-live:${rideId}`, {
        config: { broadcast: { self: false } },
      });
      channel
        .on('broadcast', { event: 'chat' }, ({ payload }) => {
          applyIncoming(rideId, { type: 'chat', message: payload as RideChatMessage }, false);
        })
        .on('broadcast', { event: 'location' }, ({ payload }) => {
          applyIncoming(rideId, { type: 'location', location: payload as RidePeerLocation }, false);
        })
        .subscribe();
      room.channel = channel;
    }
  }

  rooms.set(rideId, room);
  return room;
}

function emitChat(room: RideRoom): void {
  const snapshot = room.messages.map((item) => ({ ...item }));
  room.chatListeners.forEach((listener) => listener(snapshot));
}

type Incoming =
  | { type: 'chat'; message: RideChatMessage }
  | { type: 'location'; location: RidePeerLocation };

function applyIncoming(rideId: string, payload: Incoming, outbound: boolean): void {
  const room = ensureRoom(rideId);
  if (payload.type === 'chat') {
    if (room.messages.some((item) => item.id === payload.message.id)) return;
    room.messages = [...room.messages, payload.message].slice(-80);
    emitChat(room);
  } else {
    room.peers.set(payload.location.userId, payload.location);
    room.locationListeners.forEach((listener) => listener(payload.location));
  }
  if (!outbound) return;
  room.broadcast?.postMessage(payload);
  if (payload.type === 'chat') {
    void room.channel?.send({ type: 'broadcast', event: 'chat', payload: payload.message });
  } else {
    void room.channel?.send({ type: 'broadcast', event: 'location', payload: payload.location });
  }
}

export function subscribeRideChat(rideId: string, listener: ChatListener): () => void {
  const room = ensureRoom(rideId);
  room.chatListeners.add(listener);
  listener(room.messages.map((item) => ({ ...item })));
  return () => {
    room.chatListeners.delete(listener);
  };
}

export function subscribeRideLocation(rideId: string, listener: LocationListener): () => void {
  const room = ensureRoom(rideId);
  room.locationListeners.add(listener);
  room.peers.forEach((location) => listener(location));
  return () => {
    room.locationListeners.delete(listener);
  };
}

export function sendRideChat(input: {
  rideId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
}): RideChatMessage | null {
  const text = input.text.trim();
  if (!text) return null;
  const message: RideChatMessage = {
    id: uid(),
    rideId: input.rideId,
    senderId: input.senderId,
    senderName: input.senderName,
    senderRole: input.senderRole,
    text: text.slice(0, 280),
    createdAt: Date.now(),
  };
  applyIncoming(input.rideId, { type: 'chat', message }, true);
  return message;
}

export function publishRideLocation(rideId: string, location: RidePeerLocation): void {
  applyIncoming(rideId, { type: 'location', location }, true);
}

export function clearRideSession(rideId: string): void {
  const room = rooms.get(rideId);
  if (!room) return;
  room.messages = [];
  room.peers.clear();
  emitChat(room);
  room.broadcast?.close();
  if (room.channel) {
    const client = getSupabaseClient();
    if (client) void client.removeChannel(room.channel);
  }
  rooms.delete(rideId);
}
