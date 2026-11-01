import { useCallback, useEffect, useRef, useState } from 'react';
import { IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { refreshOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchRideBids, fetchRideHistory, subscribeToPassengerRideUpdates } from '../../services/rides';
import type { Bid, Ride } from '../../types';
import { formatBRL } from '../../utils/format';
import { getRideDisplayStatus, isRideActive, paymentMethodLabel, rideStatusLabel } from '../../utils/rideStatus';

export function PassengerRides() {
  const { user } = useAuth();
  const history = useHistory();
  const [rides, setRides] = useState<Ride[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!user || user.role !== 'passenger') {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const request = ++requestId.current;
    setRefreshing(true);
    const ridesResult = await fetchRideHistory(user.id).then(
      (data) => ({ status: 'fulfilled' as const, data }),
      (cause: unknown) => ({ status: 'rejected' as const, cause })
    );
    if (request !== requestId.current) return;
    if (ridesResult.status === 'rejected') {
      setError(ridesResult.cause instanceof Error ? ridesResult.cause.message : 'Não foi possível carregar suas corridas.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const currentRides = ridesResult.data;
    const bidsResult = await fetchRideBids(
      currentRides.filter((ride) => ride.status === 'bidding').map((ride) => ride.id)
    ).then(
      (data) => ({ status: 'fulfilled' as const, data }),
      (cause: unknown) => ({ status: 'rejected' as const, cause })
    );
    if (request !== requestId.current) return;
    setRides(currentRides);
    if (bidsResult.status === 'fulfilled') {
      setBids(bidsResult.data);
      setError(null);
    } else {
      setBids([]);
      setError(bidsResult.cause instanceof Error ? bidsResult.cause.message : 'Não foi possível carregar as propostas.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'passenger') return;
    void refresh();
    const unsubscribe = subscribeToPassengerRideUpdates(user.id, () => void refresh());
    const onResume = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', onResume);
    document.addEventListener('visibilitychange', onResume);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    return () => {
      requestId.current += 1;
      unsubscribe();
      window.removeEventListener('online', onResume);
      document.removeEventListener('visibilitychange', onResume);
      window.clearInterval(timer);
    };
  }, [refresh, user]);

  const currentRides = rides
    .map((ride) => ({ ride, status: getRideDisplayStatus(ride, bids.filter((bid) => bid.rideId === ride.id)) }))
    .filter(({ status }) => isRideActive(status));
  const pastRides = rides
    .map((ride) => ({ ride, status: getRideDisplayStatus(ride, bids.filter((bid) => bid.rideId === ride.id)) }))
    .filter(({ status }) => !isRideActive(status));

  const renderRide = (ride: Ride, status: ReturnType<typeof getRideDisplayStatus>) => (
    <IonItem key={ride.id} lines="full" className="mb-2 rounded-2xl" style={{ '--background': 'var(--ion-card-background)' }}>
      <IonLabel className="ion-text-wrap">
        <h2 className="font-bold">{rideStatusLabel(status)}</h2>
        <p>{ride.origin.address} → {ride.destination.address}</p>
        <p>
          {new Date(ride.createdAt).toLocaleString('pt-BR')} · {paymentMethodLabel(ride.paymentMethod)}
        </p>
        <p>{formatBRL(ride.finalPrice ?? ride.estimatedPrice)}</p>
      </IonLabel>
      <IonButton slot="end" fill="outline" onClick={() => history.push(`/corrida/${ride.id}`)}>
        Acompanhar
      </IonButton>
    </IonItem>
  );

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Corrida</IonTitle>
          <IonButton slot="end" fill="clear" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? <IonSpinner name="crescent" /> : <IonIcon icon={refreshOutline} />}
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && <div className="flex justify-center py-8"><IonSpinner name="crescent" /></div>}
        {error && (
          <div className="mb-4 rounded-xl p-3 text-sm" role="alert" style={{ background: 'var(--ion-card-background)' }}>
            {error}
            <IonButton fill="clear" size="small" onClick={() => void refresh()}>Tentar novamente</IonButton>
          </div>
        )}
        {!loading && (
          <>
            <h2 className="mb-3 text-lg font-bold">Corrida atual</h2>
            <IonList>
              {currentRides.map(({ ride, status }) => renderRide(ride, status))}
              {currentRides.length === 0 && <p className="px-2 pb-5 text-sm" style={{ color: 'var(--ion-color-medium)' }}>Nenhuma corrida em andamento.</p>}
            </IonList>
            <h2 className="mb-3 mt-4 text-lg font-bold">Histórico</h2>
            <IonList>
              {pastRides.map(({ ride, status }) => renderRide(ride, status))}
              {rides.length === 0 && <p className="px-2 text-sm" style={{ color: 'var(--ion-color-medium)' }}>Suas solicitações aparecerão aqui.</p>}
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
