import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  loadRideById,
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
  const [rides, setRides] = useState<Ride[]>(() => isSupabaseConfigured ? [] : listOpenRides());
  const [bids, setBids] = useState<Bid[]>(() =>
    viewer && rideId ? listBidsForRide(rideId, viewer) : []
  );
  const [driverBids, setDriverBids] = useState<Bid[]>(() =>
    viewer?.role === 'driver' ? listBidsForDriver(viewer.id) : []
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const refreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const [openResult, currentResult, rideBidsResult, driverBidsResult] = await Promise.allSettled([
      loadOpenRides(),
      rideId ? loadRideById(rideId) : Promise.resolve(null),
      viewer && rideId ? loadBidsForRide(rideId, viewer) : Promise.resolve([]),
      viewer?.role === 'driver' ? loadBidsForDriver(viewer.id) : Promise.resolve([]),
    ]);
    if (!mounted.current || sequence !== refreshSequence.current) return;
    const open = openResult.status === 'fulfilled' ? openResult.value : [];
    const current = currentResult.status === 'fulfilled' ? currentResult.value : null;
    setRides(current ? [current, ...open.filter((ride) => ride.id !== current.id)] : open);
    setBids(rideBidsResult.status === 'fulfilled' ? rideBidsResult.value : []);
    setDriverBids(driverBidsResult.status === 'fulfilled' ? driverBidsResult.value : []);
    const failure = [openResult, currentResult, rideBidsResult, driverBidsResult].find(
      (result) => result.status === 'rejected'
    );
    setError(
      failure?.status === 'rejected'
        ? failure.reason instanceof Error ? failure.reason.message : 'Falha ao atualizar a corrida.'
        : null
    );
    setLoading(false);
  }, [rideId, viewer]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const unsubscribe = biddingStore.subscribe(() => {
      void refresh();
    });
    return () => {
      mounted.current = false;
      refreshSequence.current += 1;
      unsubscribe();
    };
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

  useEffect(() => {
    if (!rideId) return undefined;
    const resume = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    const timer = window.setInterval(resume, 30_000);
    return () => {
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
      window.clearInterval(timer);
    };
  }, [refresh, rideId]);

  const activeRide = useMemo(
    () => rides.find((ride) => ride.id === rideId)
      ?? (!isSupabaseConfigured ? biddingStore.snapshot().rides.find((ride) => ride.id === rideId) : undefined),
    [rideId, rides]
  );

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
    loading,
    error,
    requestRide,
    makeOffer,
    chooseOffer,
    refresh,
  };
}
