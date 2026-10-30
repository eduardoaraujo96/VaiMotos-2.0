import type { Bid, Ride } from '../types';
import { mockPendingRides } from '../data/mock';

const CHANNEL = 'vaimoto.bidding.v1';
const STORAGE_KEY = 'vaimoto.bidding.state';

export type BiddingEvent =
  | { type: 'ride.created'; ride: Ride }
  | { type: 'ride.updated'; ride: Ride }
  | { type: 'bid.created'; bid: Bid }
  | { type: 'bid.updated'; bid: Bid };

interface BiddingState {
  rides: Ride[];
  bids: Bid[];
}

type Listener = (event: BiddingEvent, state: BiddingState) => void;

function seed(): BiddingState {
  return {
    rides: mockPendingRides.map((ride) => ({ ...ride })),
    bids: [],
  };
}

function load(): BiddingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as BiddingState;
    if (!Array.isArray(parsed.rides) || !Array.isArray(parsed.bids)) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

function persist(state: BiddingState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

class BiddingStore {
  private state: BiddingState = load();
  private listeners = new Set<Listener>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (message: MessageEvent<BiddingEvent>) => {
        this.apply(message.data, false);
      };
    }
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          this.state = JSON.parse(event.newValue) as BiddingState;
          this.listeners.forEach((listener) =>
            listener({ type: 'ride.updated', ride: this.state.rides[0] }, this.state)
          );
        } catch {
          return;
        }
      }
    });
  }

  snapshot(): BiddingState {
    return {
      rides: this.state.rides.map((ride) => ({ ...ride })),
      bids: this.state.bids.map((bid) => ({ ...bid })),
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: BiddingEvent): void {
    this.apply(event, true);
  }

  reset(): void {
    this.state = seed();
    persist(this.state);
  }

  private apply(event: BiddingEvent, broadcast: boolean): void {
    if (event.type === 'ride.created') {
      const exists = this.state.rides.some((ride) => ride.id === event.ride.id);
      this.state.rides = exists
        ? this.state.rides.map((ride) => (ride.id === event.ride.id ? event.ride : ride))
        : [event.ride, ...this.state.rides];
    }
    if (event.type === 'ride.updated') {
      this.state.rides = this.state.rides.map((ride) =>
        ride.id === event.ride.id ? event.ride : ride
      );
    }
    if (event.type === 'bid.created') {
      const exists = this.state.bids.some((bid) => bid.id === event.bid.id);
      this.state.bids = exists
        ? this.state.bids.map((bid) => (bid.id === event.bid.id ? event.bid : bid))
        : [event.bid, ...this.state.bids];
    }
    if (event.type === 'bid.updated') {
      this.state.bids = this.state.bids.map((bid) => (bid.id === event.bid.id ? event.bid : bid));
    }
    persist(this.state);
    this.listeners.forEach((listener) => listener(event, this.snapshot()));
    if (broadcast) {
      this.channel?.postMessage(event);
    }
  }
}

export const biddingStore = new BiddingStore();
