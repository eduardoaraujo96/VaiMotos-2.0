import { useEffect, useMemo, useState } from 'react';
import {
  IonBadge,
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
import { moonOutline, radioOutline, sunnyOutline } from 'ionicons/icons';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { BidPriceModal } from '../../components/driver/BidPriceModal';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useBidding } from '../../hooks/useBidding';
import { formatBRL } from '../../utils/format';
import { LocationMap, type MapPin } from '../../components/shared/LocationMap';
import { useGeolocation } from '../../hooks/useGeolocation';
import { approxMinutes, formatApproxDistance, haversineKm, isValidCoordinate } from '../../utils/geo';
import type { Ride } from '../../types';

export function DriverRadar() {
  const { user } = useAuth();
  const { dark, toggle } = useThemeMode();
  const { rides, makeOffer, driverBids, error } = useBidding({ viewer: user });
  const [online, setOnline] = useState(true);
  const [selected, setSelected] = useState<Ride | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [recenter, setRecenter] = useState(0);
  const gps = useGeolocation();
  const { start: startGps, stop: stopGps, reset: resetGps } = gps;

  // GPS apenas em primeiro plano e apenas enquanto online.
  useEffect(() => {
    if (online) void startGps();
    else resetGps();
    return () => stopGps();
  }, [online, startGps, stopGps, resetGps]);

  const distances = useMemo(() => {
    const map = new Map<string, number | null>();
    rides.forEach((r) => map.set(r.id, haversineKm(gps.position, r.origin)));
    return map;
  }, [rides, gps.position]);

  const pins: MapPin[] = useMemo(
    () =>
      online
        ? rides
            .filter((r) => isValidCoordinate(r.origin))
            .map((r, i) => ({ id: r.id, lat: r.origin.lat, lng: r.origin.lng, label: String(i + 1), selected: r.id === focusedId }))
        : [],
    [online, rides, focusedId]
  );
  const focusedRide = online ? rides.find((r) => r.id === focusedId) ?? null : null;
  const focusedKm = focusedRide ? distances.get(focusedRide.id) ?? null : null;
  const focusedMin = approxMinutes(focusedKm);

  const myBids = driverBids;

  const handleSubmit = async (amount: number, etaMinutes: number) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await makeOffer(selected, amount, etaMinutes);
      setToast(`Oferta ${formatBRL(amount)} enviada. O passageiro compara em privado.`);
      setSelected(null);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Nao foi possivel enviar a oferta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>
            Radar {user ? <RoleBadge role={user.role} /> : null}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={toggle}>
              <IonIcon icon={dark ? sunnyOutline : moonOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="mb-4 overflow-hidden rounded-2xl">
          <LocationMap
            height="320px"
            dark={dark}
            gpsPosition={online ? gps.position : null}
            gpsStatus={gps.status}
            gpsError={online ? gps.error : null}
            onRequestGps={() => {
              setRecenter((n) => n + 1);
              if (online && !gps.position) void startGps();
            }}
            recenterSignal={recenter}
            pins={pins}
            onPinClick={setFocusedId}
          />
        </div>
        {focusedRide && (
          <div className="mb-4 rounded-2xl p-4" style={{ background: 'var(--ion-card-background)', border: '2px solid #00C853' }}>
            <div className="text-base font-bold">{focusedRide.passengerName}</div>
            <div className="text-sm">Origem: {focusedRide.origin.neighborhood ?? 'Bairro nao informado'}</div>
            <div className="text-sm">Destino: {focusedRide.destination.neighborhood ?? 'Bairro nao informado'}</div>
            <div className="text-sm">Embarque: {focusedRide.origin.address}</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
              Ate o embarque: {formatApproxDistance(focusedKm)}
              {focusedMin !== null ? ` · ~${focusedMin} min` : ''}. Distancia aproximada, nao e o percurso real pelas ruas.
            </div>
            {!myBids.find((b) => b.rideId === focusedRide.id) && (
              <IonButton expand="block" color="success" className="mt-2" onClick={() => setSelected(focusedRide)}>
                Fazer oferta
              </IonButton>
            )}
          </div>
        )}
        <div
          className="mb-4 flex items-center justify-between rounded-2xl p-4"
          style={{ background: 'var(--ion-card-background)' }}
        >
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--ion-color-medium)' }}>
              Status
            </div>
            <div className="flex items-center gap-2 text-lg font-extrabold">
              <IonIcon icon={radioOutline} color={online ? 'success' : 'medium'} />
              {online ? 'Online no radar' : 'Offline'}
            </div>
          </div>
          <IonButton color={online ? 'medium' : 'success'} onClick={() => setOnline((value) => !value)}>
            {online ? 'Pausar' : 'Ficar online'}
          </IonButton>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Pedidos abertos</h2>
          <IonBadge color="primary">{online ? rides.length : 0}</IonBadge>
        </div>

        {online ? (
          rides.map((ride) => {
            const own = myBids.find((bid) => bid.rideId === ride.id);
            return (
              <div
                key={ride.id}
                className="mb-3 rounded-2xl p-4"
                onClick={() => setFocusedId(ride.id)}
                style={{
                  background: 'var(--ion-card-background)',
                  border: ride.id === focusedId ? '2px solid #00C853' : '1px solid rgba(255,107,0,0.12)',
                }}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <div className="text-base font-bold">{ride.passengerName}</div>
                    <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                      {ride.origin.neighborhood} para {ride.destination.neighborhood}
                    </div>
                  </div>
                  <div className="text-right text-xs font-semibold" style={{ color: 'var(--ion-color-medium)' }}>
                    {ride.distanceKm.toFixed(1)} km
                    <div>{ride.estimatedMinutes} min</div>
                    <div className="font-medium">Ate o embarque: {formatApproxDistance(distances.get(ride.id) ?? null)}</div>
                  </div>
                </div>
                <div className="mb-3 space-y-1 text-sm">
                  <div>{ride.origin.address}</div>
                  <div>{ride.destination.address}</div>
                </div>
                {own ? (
                  <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: 'rgba(0,200,83,0.12)' }}>
                    Sua oferta: {formatBRL(own.amount)} · {own.status === 'accepted' ? 'aceita' : 'enviada'}
                    <div className="text-[11px] font-medium" style={{ color: 'var(--ion-color-medium)' }}>
                      Outras ofertas permanecem ocultas.
                    </div>
                  </div>
                ) : (
                  <IonButton expand="block" color="success" onClick={(e) => {
                      e.stopPropagation();
                      setSelected(ride);
                    }}>
                    Fazer oferta
                  </IonButton>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            Fique online para receber pedidos.
          </p>
        )}
        {online && rides.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            Nenhum pedido em leilao no momento.
          </p>
        )}
        <BidPriceModal
          ride={selected}
          isOpen={Boolean(selected)}
          submitting={submitting}
          onDismiss={() => setSelected(null)}
          onSubmit={handleSubmit}
        />
        <IonToast isOpen={Boolean(toast)} message={toast} duration={2600} onDidDismiss={() => setToast('')} />
        <IonToast isOpen={Boolean(error)} message={error ?? ''} duration={2400} />
      </IonContent>
    </IonPage>
  );
}
