import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bid, Ride, User } from '../types';
import {
  acceptBid,
  createRideRequest,
  listBidsForDriver,
  listBidsForRide,
  listOpenRides,
  loadBidsForDriver,
  loadBidsForRide,
  loadOpenRides,
  submitBid,
} from '../services/bidding';
import { biddingStore } from '../services/biddingStore';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { subscribeToRadar, subscribeToRideBids } from '../services/supabaseService';

interface UseBiddingOptions {
  viewer: User | null;
  rideId?: string;
}

export function useBidding({ viewer, rideId }: UseBiddingOptions) {
  const [rides, setRides] = useState<Ride[]>(() => listOpenRides());
  const [bids, setBids] = useState<Bid[]>(() =>
    viewer && rideId ? listBidsForRide(rideId, viewer) : []
  );
  const [driverBids, setDriverBids] = useState<Bid[]>(() =>
    viewer?.role === 'driver' ? listBidsForDriver(viewer.id) : []
  );
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const open = await loadOpenRides();
      setRides(open);
      if (viewer && rideId) {
        setBids(await loadBidsForRide(rideId, viewer));
      } else {
        setBids([]);
      }
      if (viewer?.role === 'driver') {
        setDriverBids(await loadBidsForDriver(viewer.id));
      } else {
        setDriverBids([]);
      }
      setError(null);
      setTick((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar o leilao.');
    }
  }, [viewer, rideId]);

  useEffect(() => {
    void refresh();
    const unsubscribe = biddingStore.subscribe(() => {
      void refresh();
    });
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    if (rideId) {
      return subscribeToRideBids(rideId, () => {
        void refresh();
      });
    }
    return subscribeToRadar(() => {
      void refresh();
    });
  }, [refresh, rideId]);

  const activeRide = useMemo(() => {
    const all = biddingStore.snapshot().rides;
    return rides.find((ride) => ride.id === rideId) ?? all.find((ride) => ride.id === rideId);
  }, [rideId, rides, tick]);

  const visibleBids = useMemo(() => {
    if (!viewer) return [];
    const source = rideId ? bids : [];
    const filtered =
      viewer.role === 'driver' ? source.filter((bid) => bid.driverId === viewer.id) : source;
    return [...filtered].sort((a, b) => a.amount - b.amount);
  }, [bids, rideId, viewer]);

  const ownBid = useMemo(() => {
    if (!viewer || viewer.role !== 'driver') return undefined;
    return visibleBids.find((bid) => bid.driverId === viewer.id);
  }, [visibleBids, viewer]);

  const requestRide = useCallback(
    async (payload: Parameters<typeof createRideRequest>[0]) => createRideRequest(payload),
    []
  );

  const makeOffer = useCallback(
    async (ride: Ride, amount: number, etaMinutes: number) => {
      if (!viewer) throw new Error('Entre para enviar uma oferta.');
      return submitBid({ ride, driver: viewer, amount, etaMinutes });
    },
    [viewer]
  );

  const chooseOffer = useCallback(async (ride: Ride, bid: Bid) => acceptBid(ride, bid), []);

  return {
    rides,
    activeRide,
    bids: visibleBids,
    ownBid,
    driverBids,
    error,
    requestRide,
    makeOffer,
    chooseOffer,
    refresh,
  };
}
