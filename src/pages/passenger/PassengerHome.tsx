import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { LocationMap, type PickTarget } from '../../components/shared/LocationMap';
import { RideRequestCard, type RequestStep } from '../../components/passenger/RideRequestCard';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useBidding } from '../../hooks/useBidding';
import { useGeolocation } from '../../hooks/useGeolocation';
import { estimateFare } from '../../services/rides';
import { haversineKm, isValidCoordinate } from '../../utils/geo';
import type { LocationPoint } from '../../types';

export function PassengerHome() {
  const { user } = useAuth();
  const { dark, toggle } = useThemeMode();
  const history = useHistory();
  const { requestRide } = useBidding({ viewer: user });
  const gps = useGeolocation();
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [step, setStep] = useState<RequestStep>('origin');
  const [recenter, setRecenter] = useState(0);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const pickTarget: PickTarget = step === 'origin' ? 'origin' : 'destination';

  // Pede o GPS ao abrir. Negar a permissao nao bloqueia: o passageiro escolhe no mapa.
  const locate = useCallback(async () => {
    const fix = await gps.locate();
    setRecenter((n) => n + 1);
    return fix;
  }, [gps]);

  useEffect(() => {
    void locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preenche o embarque com o GPS apenas se o usuario ainda nao escolheu um ponto.
  const gpsLat = gps.position?.lat;
  const gpsLng = gps.position?.lng;
  useEffect(() => {
    if (origin || gpsLat === undefined || gpsLng === undefined) return;
    setOrigin({ lat: gpsLat, lng: gpsLng, address: 'Minha localizacao atual' });
    void import('../../services/geocoding')
      .then((m) => m.reverseGeocode(gpsLat, gpsLng))
      .then((r) =>
        setOrigin((current) =>
          current && current.address === 'Minha localizacao atual' && current.lat === gpsLat
            ? { lat: gpsLat, lng: gpsLng, address: r.address, neighborhood: r.neighborhood }
            : current
        )
      )
      .catch(() => undefined);
  }, [gpsLat, gpsLng, origin]);

  const distanceKm = useMemo(() => haversineKm(origin, destination), [origin, destination]);
  const estimate = useMemo(() => (distanceKm === null ? undefined : estimateFare(distanceKm)), [distanceKm]);

  const handlePick = useCallback((target: PickTarget, point: LocationPoint) => {
    if (target === 'origin') setOrigin(point);
    else setDestination(point);
  }, []);

  const request = async () => {
    if (!user || !isValidCoordinate(origin) || !isValidCoordinate(destination) || distanceKm === null || !estimate) {
      setToast('Defina um embarque valido no mapa antes de pedir.');
      return;
    }
    setBusy(true);
    try {
      const ride = await requestRide({
        passenger: user,
        origin: { ...origin, address: origin.address || 'Local selecionado no mapa' },
        destination: { ...destination, address: destination.address || 'Local selecionado no mapa' },
        estimatedPrice: estimate.price,
        estimatedMinutes: estimate.minutes,
        distanceKm: Math.round(distanceKm * 100) / 100,
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
            dark={dark}
            showSearch
            gpsPosition={gps.position}
            gpsStatus={gps.status}
            gpsError={gps.error}
            onRequestGps={() => void locate()}
            recenterSignal={recenter}
            origin={origin}
            destination={destination}
            pickTarget={pickTarget}
            onPick={handlePick}
          />
          <div className="absolute bottom-0 left-0 right-0 p-3" style={{ zIndex: 1000 }}>
            <RideRequestCard
              origin={origin?.address ?? ''}
              destination={destination?.address ?? ''}
              step={step}
              hasOrigin={isValidCoordinate(origin)}
              hasDestination={isValidCoordinate(destination)}
              busy={busy}
              onEditOrigin={() => setStep('origin')}
              onEditDestination={() => setStep('destination')}
              onConfirmOrigin={() => setStep('destination')}
              onRequest={() => {
                if (!busy) void request();
              }}
              estimatedPrice={estimate?.price}
              estimatedMinutes={estimate?.minutes}
              distanceKm={distanceKm}
            />
          </div>
        </div>
        <IonToast isOpen={Boolean(toast)} message={toast} duration={2500} onDidDismiss={() => setToast('')} />
      </IonContent>
    </IonPage>
  );
}
