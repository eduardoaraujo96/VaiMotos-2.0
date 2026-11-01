import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
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
import { LocationMap } from '../../components/shared/LocationMap';
import { useAuth } from '../../contexts/AuthContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useBidding } from '../../hooks/useBidding';
import { loadRideById } from '../../services/bidding';
import {
  playRideNotificationSound,
  stopRideNotificationSound,
  unlockRideNotificationAudio,
} from '../../services/rideNotifications';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { requestDriverPushPermission } from '../../services/pushNotifications';
import { formatBRL } from '../../utils/format';
import { formatApproxKm, haversineKm, isValidLatLng } from '../../utils/geo';
import type { Ride } from '../../types';

export function DriverRadar() {
  const { user, setDriverOnline } = useAuth();
  const history = useHistory();
  const location = useLocation();
  const { dark, toggle } = useThemeMode();
  const { rides, makeOffer, driverBids, error } = useBidding({ viewer: user });
  const online = Boolean(user?.isOnline);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [selected, setSelected] = useState<Ride | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [targetCenter, setTargetCenter] = useState<{ lat: number; lng: number } | null>(null);

  const {
    position,
    error: gpsError,
    errorCode,
    loading: gpsLoading,
    refresh,
  } = useGeolocation({ enabled: false });

  const myBids = driverBids;
  const openedRide = useRef<string | null>(null);
  const activeRef = useRef(true);
  const visibleRides = online ? rides : [];
  const knownRideIds = useRef<Set<string> | null>(null);
  const notifiedRideIds = useRef(new Set<string>());
  const pendingAlerts = useRef<string[]>([]);
  const driverApproved = user?.role === 'driver' && user.driverApprovalStatus === 'approved';
  const availableRides = useMemo(
    () => rides.filter((ride) =>
      ride.status === 'bidding'
      && Date.parse(ride.expiresAt) > Date.now()
      && !driverBids.some((bid) => bid.rideId === ride.id)
    ),
    [driverBids, rides]
  );
  pendingAlerts.current = availableRides
    .map((ride) => ride.id)
    .filter((rideId) => notifiedRideIds.current.has(rideId));
  const availableRidesKey = availableRides.map((ride) => ride.id).join('|');

  useEffect(() => {
    const rideId = new URLSearchParams(location.search).get('ride_id');
    const ride = rideId ? availableRides.find((item) => item.id === rideId) : undefined;
    if (ride) {
      setHighlightedId(ride.id);
      if (isValidLatLng(ride.origin.lat, ride.origin.lng)) {
        setTargetCenter({ lat: ride.origin.lat, lng: ride.origin.lng });
      }
    }
  }, [availableRides, location.search]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || error || !driverApproved || !online || availabilityBusy) return;
    if (knownRideIds.current === null) {
      knownRideIds.current = new Set(rides.map((ride) => ride.id));
      return;
    }

    const known = knownRideIds.current;
    const newlyAvailable = availableRides.filter((ride) => !known.has(ride.id));
    rides.forEach((ride) => known.add(ride.id));
    newlyAvailable.forEach((ride) => notifiedRideIds.current.add(ride.id));
    pendingAlerts.current = availableRides
      .map((ride) => ride.id)
      .filter((rideId) => notifiedRideIds.current.has(rideId));
    if (newlyAvailable.length > 0 && document.visibilityState === 'visible') {
      void playRideNotificationSound();
    }
  }, [availabilityBusy, availableRides, driverApproved, error, online, rides]);

  useEffect(() => {
    if (!online || !driverApproved || availabilityBusy || !availableRidesKey) stopRideNotificationSound();
  }, [availabilityBusy, availableRidesKey, driverApproved, online]);

  useEffect(() => {
    if (!isSupabaseConfigured || !online || !driverApproved || availabilityBusy) return undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const currentIds = pendingAlerts.current;
      if (currentIds.length > 0) void playRideNotificationSound();
    }, 30_000);
    const stopWhenHidden = () => {
      if (document.visibilityState !== 'visible') stopRideNotificationSound();
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, [availabilityBusy, driverApproved, online]);

  useEffect(() => {
    const accepted = myBids.find((bid) => bid.status === 'accepted');
    if (!accepted || openedRide.current === accepted.rideId) return;
    openedRide.current = accepted.rideId;
    void loadRideById(accepted.rideId)
      .then((ride) => {
        if (activeRef.current && ride && ['awarded', 'en_route', 'in_progress'].includes(ride.status)) {
          history.push(`/corrida/${accepted.rideId}`);
        }
      })
      .catch((cause: unknown) => {
        if (activeRef.current) {
          setToast(cause instanceof Error ? cause.message : 'Não foi possível abrir a corrida confirmada.');
        }
      });
  }, [history, myBids]);
  const highlighted = visibleRides.find((ride) => ride.id === highlightedId) ?? null;

  const extraMarkers = useMemo(
    () =>
      visibleRides
        .filter((ride) => isValidLatLng(ride.origin.lat, ride.origin.lng))
        .map((ride) => ({
          id: ride.id,
          lat: ride.origin.lat,
          lng: ride.origin.lng,
          label: ride.origin.neighborhood ?? ride.origin.address,
          selected: ride.id === highlightedId,
        })),
    [highlightedId, visibleRides]
  );

  const pickupDistance = (ride: Ride): number | null => {
    if (!position) return null;
    return haversineKm(position, ride.origin);
  };

  const selectRide = (ride: Ride) => {
    setHighlightedId(ride.id);
    if (isValidLatLng(ride.origin.lat, ride.origin.lng)) {
      setTargetCenter({ lat: ride.origin.lat, lng: ride.origin.lng });
    }
  };

  const handleSubmit = async (amount: number, etaMinutes: number) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await makeOffer(selected, amount, etaMinutes);
      stopRideNotificationSound();
      setToast(`Oferta ${formatBRL(amount)} enviada. O passageiro compara em privado.`);
      setSelected(null);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Nao foi possivel enviar a oferta.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOnline = async () => {
    if (availabilityBusy) return;
    unlockRideNotificationAudio();
    setAvailabilityBusy(true);
    try {
      if (!online) {
        const permission = await requestDriverPushPermission();
        if (permission === 'denied') {
          setToast('Permita notificações nas configurações do Android para receber corridas com o app fechado.');
          return;
        }
        if (permission === 'unavailable') {
          setToast('Notificações push não configuradas neste aplicativo. Contate o suporte.');
          return;
        }
      }
      if (online) {
        stopRideNotificationSound();
        setHighlightedId(null);
        setTargetCenter(null);
      }
      await setDriverOnline(!online);
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Não foi possível atualizar sua disponibilidade.');
    } finally {
      setAvailabilityBusy(false);
    }
  };

  if (user?.role === 'driver' && user.driverApprovalStatus !== 'approved') {
    const rejected = user.driverApprovalStatus === 'rejected';
    return (
      <IonPage>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>Cadastro do mototaxista</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <section className="rounded-2xl p-5" style={{ background: 'var(--ion-card-background)' }}>
            <h2 className="text-lg font-bold">{rejected ? 'Cadastro não aprovado' : 'Cadastro em análise'}</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
              {rejected
                ? 'Seu cadastro foi rejeitado. Atualize os dados do veículo e fale com o suporte para solicitar uma nova análise.'
                : 'O acesso ao radar será liberado depois que o Desenvolvedor aprovar seu cadastro.'}
            </p>
            <IonButton className="mt-3" expand="block" onClick={() => history.push('/driver/profile')}>
              Ver meu perfil
            </IonButton>
          </section>
        </IonContent>
      </IonPage>
    );
  }

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
      <IonContent scrollY={false}>
        <div className="flex h-full flex-col">
          <div
            className="mx-3 mt-3 flex items-center justify-between rounded-2xl p-4"
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
            <IonButton color={online ? 'medium' : 'success'} disabled={availabilityBusy} onClick={() => void toggleOnline()}>
              {online ? 'Pausar' : 'Ficar online'}
            </IonButton>
          </div>

          <div className="relative mx-3 mt-3 h-[42%] min-h-[220px] overflow-hidden rounded-2xl">
            <LocationMap
              height="100%"
              gpsPosition={online ? position : null}
              gpsError={online && errorCode !== 'insecure_context' ? gpsError : null}
              gpsLoading={gpsLoading}
              gpsAvailable={Boolean(position)}
              extraMarkers={extraMarkers}
              destination={highlighted?.destination}
              dark={dark}
              targetCenter={targetCenter}
              onMarkerClick={(id) => {
                const ride = visibleRides.find((item) => item.id === id);
                if (ride) selectRide(ride);
              }}
              onGpsClick={() => {
                void (async () => {
                  const next = await refresh();
                  if (next.ok) setTargetCenter({ lat: next.position.lat, lng: next.position.lng });
                  else setToast(next.message);
                })();
              }}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Pedidos abertos</h2>
              <IonBadge color="primary">{visibleRides.length}</IonBadge>
            </div>

            {online ? (
              visibleRides.map((ride) => {
                const own = myBids.find((bid) => bid.rideId === ride.id);
                const toPickup = pickupDistance(ride);
                const active = ride.id === highlightedId;
                return (
                  <div
                    key={ride.id}
                    className="mb-3 rounded-2xl p-4"
                    style={{
                      background: 'var(--ion-card-background)',
                      border: active ? '1px solid #15D164' : '1px solid rgba(21,209,100,0.12)',
                    }}
                    onClick={() => selectRide(ride)}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <div className="text-base font-bold">{ride.passengerName}</div>
                        <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                          {ride.origin.neighborhood ?? 'Origem'} para {ride.destination.neighborhood ?? 'destino'}
                        </div>
                      </div>
                      <div className="text-right text-xs font-semibold" style={{ color: 'var(--ion-color-medium)' }}>
                        {ride.distanceKm.toFixed(1)} km
                        <div>{ride.estimatedMinutes} min</div>
                      </div>
                    </div>
                    <div className="mb-3 space-y-1 text-sm">
                      <div>{ride.origin.address}</div>
                      <div>{ride.destination.address}</div>
                    </div>
                    <div className="mb-3 text-[11px]" style={{ color: 'var(--ion-color-medium)' }}>
                      {toPickup == null
                        ? 'Distancia ate o embarque indisponivel sem GPS ou coordenadas.'
                        : `Ate o embarque: ${formatApproxKm(toPickup)} em linha reta, nao e o percurso das ruas.`}
                    </div>
                    {own ? (
                      <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: 'rgba(0,200,83,0.12)' }}>
                        Sua oferta: {formatBRL(own.amount)} · {own.status === 'accepted' ? 'aceita' : 'enviada'}
                        <div className="text-[11px] font-medium" style={{ color: 'var(--ion-color-medium)' }}>
                          Outras ofertas permanecem ocultas.
                        </div>
                        {own.status === 'accepted' && (
                          <IonButton className="mt-2" expand="block" onClick={() => history.push(`/corrida/${ride.id}`)}>
                            Abrir corrida
                          </IonButton>
                        )}
                      </div>
                    ) : (
                      <IonButton
                        expand="block"
                        color="success"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectRide(ride);
                          setSelected(ride);
                        }}
                      >
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
            {online && visibleRides.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--ion-color-medium)' }}>
                Nenhum pedido em leilao no momento.
              </p>
            )}
          </div>
        </div>
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
