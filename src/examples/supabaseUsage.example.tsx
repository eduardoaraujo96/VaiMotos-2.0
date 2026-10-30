import { useEffect, useState } from 'react';
import { IonButton, IonToast } from '@ionic/react';
import type { Bid, Ride, User } from '../types';
import {
  acceptDriverBid,
  fetchOpenRides,
  submitBlindBid,
  subscribeToRideBids,
} from '../services/supabaseService';

export function DriverSubmitBidExample({ ride, driver }: { ride: Ride; driver: User }) {
  const [toast, setToast] = useState('');

  const sendOffer = async () => {
    const result = await submitBlindBid({
      rideId: ride.id,
      driver,
      amount: 18.9,
      etaMinutes: 6,
    });
    setToast(result.ok ? 'Oferta enviada.' : result.error.message);
  };

  return (
    <>
      <IonButton onClick={sendOffer}>Enviar oferta cega</IonButton>
      <IonToast isOpen={Boolean(toast)} message={toast} duration={2000} onDidDismiss={() => setToast('')} />
    </>
  );
}

export function PassengerLiveBidsExample({ rideId, ride }: { rideId: string; ride: Ride }) {
  const [bids, setBids] = useState<Bid[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    return subscribeToRideBids(rideId, async () => {
      const result = await fetchOpenRides();
      if (!result.ok) setToast(result.error.message);
    });
  }, [rideId]);

  const accept = async (bid: Bid) => {
    const result = await acceptDriverBid(bid.id, ride, bid);
    setToast(result.ok ? 'Oferta aceita.' : result.error.message);
  };

  return (
    <>
      {bids.map((bid) => (
        <IonButton key={bid.id} onClick={() => accept(bid)}>
          Aceitar {bid.driverName}
        </IonButton>
      ))}
      <IonToast isOpen={Boolean(toast)} message={toast} duration={2000} onDidDismiss={() => setToast('')} />
    </>
  );
}
