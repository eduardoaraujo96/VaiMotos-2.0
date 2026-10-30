import { useMemo, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { moonOutline, sunnyOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { MapCanvas } from '../../components/shared/MapCanvas';
import { RideRequestCard } from '../../components/passenger/RideRequestCard';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useBidding } from '../../hooks/useBidding';
import { estimateFare } from '../../services/rides';

export function PassengerHome() {
  const { user } = useAuth();
  const { dark, toggle } = useThemeMode();
  const history = useHistory();
  const { requestRide } = useBidding({ viewer: user });
  const [origin, setOrigin] = useState('Minha localizacao atual');
  const [destination, setDestination] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const estimate = useMemo(() => {
    if (!destination.trim()) return undefined;
    return estimateFare(4.2);
  }, [destination]);

  const request = async () => {
    if (!user || !estimate) return;
    setBusy(true);
    try {
      const ride = await requestRide({
        passenger: user,
        origin: {
          lat: -23.5614,
          lng: -46.6558,
          address: origin || 'Minha localizacao atual',
          neighborhood: 'Bela Vista',
        },
        destination: {
          lat: -23.5505,
          lng: -46.6333,
          address: destination,
          neighborhood: 'Centro',
        },
        estimatedPrice: estimate.price,
        estimatedMinutes: estimate.minutes,
        distanceKm: 4.2,
      });
      history.push(`/passenger/offers/${ride.id}`);
    } catch {
      setToast('Nao foi possivel abrir o leilao. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>
            Ola, {user?.name.split(' ')[0]}{' '}
            {user ? <RoleBadge role={user.role} /> : null}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={toggle}>
              <IonIcon icon={dark ? sunnyOutline : moonOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={false}>
        <div className="relative h-full">
          <MapCanvas height="100%" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <RideRequestCard
              origin={origin}
              destination={destination}
              onOriginChange={setOrigin}
              onDestinationChange={setDestination}
              onRequest={() => {
                if (!busy) void request();
              }}
              estimatedPrice={estimate?.price}
              estimatedMinutes={estimate?.minutes}
            />
          </div>
        </div>
        <IonToast isOpen={Boolean(toast)} message={toast} duration={2500} onDidDismiss={() => setToast('')} />
      </IonContent>
    </IonPage>
  );
}
