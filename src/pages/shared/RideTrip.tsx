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
import { chatbubbleEllipsesOutline, locateOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { LocationMap } from '../../components/shared/LocationMap';
import { RideChatPanel } from '../../components/ride/RideChatPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useBidding } from '../../hooks/useBidding';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useRideChat } from '../../hooks/useRideChat';
import { useThemeMode } from '../../hooks/useThemeMode';
import { biddingStore } from '../../services/biddingStore';
import { publishRideLocation, subscribeRideLocation, type RidePeerLocation } from '../../services/rideSession';
import { formatBRL } from '../../utils/format';
import { formatApproxKm, haversineKm, isValidLatLng } from '../../utils/geo';

export function RideTrip() {
  const { rideId } = useParams<{ rideId: string }>();
  const history = useHistory();
  const { user } = useAuth();
  const { dark, toggle } = useThemeMode();
  const { activeRide } = useBidding({ viewer: user, rideId });
  const { messages, send, discard } = useRideChat(rideId, user);
  const {
    position,
    error: gpsError,
    errorCode,
    loading: gpsLoading,
    permissionDenied,
    refresh,
    startWatch,
  } = useGeolocation({ enabled: true, watch: true });
  const [peer, setPeer] = useState<RidePeerLocation | null>(null);
  const [toast, setToast] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const [targetCenter, setTargetCenter] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!rideId) return;
    return subscribeRideLocation(rideId, (location) => {
      if (location.userId === user?.id) return;
      setPeer(location);
    });
  }, [rideId, user?.id]);

  useEffect(() => {
    if (!rideId || !user || !position) return;
    publishRideLocation(rideId, {
      userId: user.id,
      lat: position.lat,
      lng: position.lng,
      updatedAt: position.timestamp,
    });
  }, [position, rideId, user]);

  useEffect(() => {
    if (!activeRide) return;
    if (isValidLatLng(activeRide.origin.lat, activeRide.origin.lng)) {
      setTargetCenter({ lat: activeRide.origin.lat, lng: activeRide.origin.lng });
    }
  }, [activeRide]);

  const extraMarkers = useMemo(() => {
    if (!peer || !isValidLatLng(peer.lat, peer.lng)) return [];
    return [
      {
        id: 'peer',
        lat: peer.lat,
        lng: peer.lng,
        selected: true,
        color: user?.role === 'passenger' ? '#00C853' : '#FF6B00',
      },
    ];
  }, [peer, user?.role]);

  const distanceToPickup = useMemo(() => {
    if (!position || !activeRide) return null;
    return haversineKm(position, activeRide.origin);
  }, [activeRide, position]);

  const home = user?.role === 'driver' ? '/driver/radar' : '/passenger/home';

  const finish = (status: 'completed' | 'cancelled') => {
    if (activeRide) {
      biddingStore.publish({ type: 'ride.updated', ride: { ...activeRide, status } });
    }
    discard();
    history.replace(home);
  };

  const locateMe = async () => {
    const result = await refresh();
    if (!result.ok) {
      setToast(result.message);
      return;
    }
    setTargetCenter({ lat: result.position.lat, lng: result.position.lng });
    await startWatch();
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Corrida</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setChatOpen((open) => !open)}>
              <IonIcon icon={chatbubbleEllipsesOutline} />
            </IonButton>
            <IonButton onClick={toggle}>
              <IonIcon icon={dark ? sunnyOutline : moonOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={false}>
        <div className="flex h-full flex-col">
          <div className="relative min-h-[42%] flex-1">
            <LocationMap
              height="100%"
              origin={activeRide?.origin}
              destination={activeRide?.destination}
              gpsPosition={position}
              gpsError={errorCode === 'insecure_context' ? null : gpsError}
              gpsLoading={gpsLoading}
              gpsAvailable={Boolean(position)}
              extraMarkers={extraMarkers}
              dark={dark}
              targetCenter={targetCenter}
              onGpsClick={() => {
                void locateMe();
              }}
            />
          </div>
          <div className="max-h-[58%] overflow-auto p-3" style={{ background: 'var(--ion-background-color)' }}>
            <div className="mb-3 rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ion-color-medium)' }}>
                {user?.role === 'driver' ? 'Embarque do passageiro' : 'Seu mototaxista'}
              </div>
              <div className="mt-1 font-bold">{activeRide?.origin.address ?? 'Carregando corrida...'}</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
                Destino: {activeRide?.destination.address}
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>
                  {activeRide?.finalPrice != null ? formatBRL(activeRide.finalPrice) : activeRide ? formatBRL(activeRide.estimatedPrice) : ''}
                </span>
                <span style={{ color: 'var(--ion-color-medium)' }}>
                  {distanceToPickup == null ? 'Distancia indisponivel' : `Ate o embarque: ${formatApproxKm(distanceToPickup)}`}
                </span>
              </div>
              {permissionDenied && (
                <p className="mt-2 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                  Permissao de GPS negada. Toque em Minha localizacao para solicitar de novo ou ative em Ajustes do Android.
                </p>
              )}
              <IonButton className="mt-3" expand="block" fill="outline" onClick={() => void locateMe()}>
                <IonIcon icon={locateOutline} slot="start" />
                Atualizar minha localizacao
              </IonButton>
            </div>

            {chatOpen && user && (
              <div className="mb-3 h-56 rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
                <RideChatPanel messages={messages} user={user} onSend={(text) => send(text)} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <IonButton color="medium" onClick={() => finish('cancelled')}>
                Cancelar
              </IonButton>
              <IonButton color="success" onClick={() => finish('completed')}>
                Finalizar
              </IonButton>
            </div>
          </div>
        </div>
        <IonToast isOpen={Boolean(toast)} message={toast} duration={2800} onDidDismiss={() => setToast('')} />
      </IonContent>
    </IonPage>
  );
}
