import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bid, Ride, User } from '../types';
import {
  acceptBid,
  createRideRequest,
  listBidsForDriver,
  listBidsForRide,
  listOpenRides,
  submitBid,
} from '../services/bidding';
import { biddingStore } from '../services/biddingStore';
import { isSupabaseConfigured, supabase } from '../services/supabase';

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
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setRides(listOpenRides());
    if (viewer && rideId) {
      setBids(listBidsForRide(rideId, viewer));
    } else {
      setBids([]);
    }
    setDriverBids(viewer?.role === 'driver' ? listBidsForDriver(viewer.id) : []);
    setTick((value) => value + 1);
  }, [viewer, rideId]);

  useEffect(() => {
    refresh();
    const unsubscribe = biddingStore.subscribe(() => refresh());
    return unsubscribe;
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;
    const client = supabase;
    const bidFilter = rideId
      ? { event: '*' as const, schema: 'public', table: 'bids', filter: `ride_id=eq.${rideId}` }
      : { event: '*' as const, schema: 'public', table: 'bids' };
    const channel = client
      .channel(`bidding:${rideId ?? 'radar'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => refresh())
      .on('postgres_changes', bidFilter, () => refresh())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [refresh, rideId]);

  const activeRide = useMemo(() => {
    const all = biddingStore.snapshot().rides;
    return all.find((ride) => ride.id === rideId);
  }, [rideId, tick]);

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
      if (!viewer) throw new Error('not_authenticated');
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
    requestRide,
    makeOffer,
    chooseOffer,
    refresh,
  };
}
