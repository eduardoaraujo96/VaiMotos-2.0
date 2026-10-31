import { useEffect, useMemo, useState } from 'react';
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
import { LocationMap } from '../../components/shared/LocationMap';
import { RideRequestCard } from '../../components/passenger/RideRequestCard';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useBidding } from '../../hooks/useBidding';
import { reverseGeocode } from '../../services/geocoding';
import { estimateFare } from '../../services/rides';
import type { LocationPoint } from '../../types';
import { formatApproxKm, haversineKm, isValidLocation } from '../../utils/geo';

export function PassengerHome() {
  const { user } = useAuth();
  const { dark, toggle } = useThemeMode();
  const history = useHistory();
  const { requestRide } = useBidding({ viewer: user });
  const { position, error: gpsError, loading: gpsLoading, refresh } = useGeolocation({ enabled: true });
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [activeField, setActiveField] = useState<'origin' | 'destination'>('origin');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [targetCenter, setTargetCenter] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!position || origin) return;
    let cancelled = false;
    void reverseGeocode(position.lat, position.lng).then((point) => {
      if (cancelled) return;
      setOrigin(point);
      setTargetCenter(point);
    });
    return () => {
      cancelled = true;
    };
  }, [origin, position]);

  const distanceKm = useMemo(() => {
    if (!origin || !destination) return null;
    return haversineKm(origin, destination);
  }, [destination, origin]);

  const estimate = useMemo(() => {
    if (distanceKm == null || distanceKm < 0.05) return undefined;
    return estimateFare(distanceKm);
  }, [distanceKm]);

  const applyPoint = (point: LocationPoint) => {
    if (activeField === 'destination') {
      setDestination(point);
      return;
    }
    setOrigin(point);
  };

  const useGps = async () => {
    setActiveField('origin');
    const next = await refresh();
    if (!next) {
      setToast('GPS indisponivel. Toque no mapa para escolher o embarque.');
      return;
    }
    const point = await reverseGeocode(next.lat, next.lng);
    setOrigin(point);
    setTargetCenter(point);
  };

  const request = async () => {
    if (!user) return;
    if (!isValidLocation(origin)) {
      setToast('Escolha um ponto de embarque valido no mapa.');
      return;
    }
    if (!isValidLocation(destination)) {
      setToast('Escolha um destino valido no mapa.');
      return;
    }
    if (distanceKm == null || distanceKm < 0.05 || !estimate) {
      setToast('Escolha um destino diferente do embarque.');
      return;
    }
    setBusy(true);
    try {
      const ride = await requestRide({
        passenger: user,
        origin,
        destination,
        estimatedPrice: estimate.price,
        estimatedMinutes: estimate.minutes,
        distanceKm: Math.round(distanceKm * 10) / 10,
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
          <LocationMap
            height="100%"
            origin={origin}
            destination={destination}
            gpsPosition={position}
            gpsError={gpsError}
            gpsLoading={gpsLoading}
            selectable
            draggable
            showSearch
            dark={dark}
            targetCenter={targetCenter}
            searchPlaceholder={activeField === 'destination' ? 'Buscar destino' : 'Buscar embarque'}
            onSelectLocation={(point) => {
              applyPoint(point);
              setTargetCenter(point);
            }}
            onOriginChange={(point) => {
              setActiveField('origin');
              setOrigin(point);
            }}
            onDestinationChange={(point) => {
              setActiveField('destination');
              setDestination(point);
            }}
            onGpsClick={() => {
              void useGps();
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <RideRequestCard
              origin={origin?.address ?? ''}
              destination={destination?.address ?? ''}
              activeField={activeField}
              onOriginChange={(value) => {
                setActiveField('origin');
                setOrigin((current) => (current ? { ...current, address: value } : current));
              }}
              onDestinationChange={(value) => {
                setActiveField('destination');
                setDestination((current) => (current ? { ...current, address: value } : current));
              }}
              onOriginFocus={() => setActiveField('origin')}
              onDestinationFocus={() => setActiveField('destination')}
              onUseGps={() => {
                void useGps();
              }}
              onRequest={() => {
                if (!busy) void request();
              }}
              estimatedPrice={estimate?.price}
              estimatedMinutes={estimate?.minutes}
              approximateDistance={distanceKm != null ? formatApproxKm(distanceKm) : undefined}
              canRequest={isValidLocation(origin) && isValidLocation(destination) && Boolean(estimate)}
              busy={busy}
              gpsLoading={gpsLoading}
            />
          </div>
        </div>
        <IonToast isOpen={Boolean(toast)} message={toast} duration={2500} onDidDismiss={() => setToast('')} />
      </IonContent>
    </IonPage>
  );
}
