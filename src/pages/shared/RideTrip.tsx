import { useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { chatbubbleEllipsesOutline, locateOutline, moonOutline, sunnyOutline } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { LocationMap } from '../../components/shared/LocationMap';
import { RideChatPanel } from '../../components/ride/RideChatPanel';
import { RideReviewForm } from '../../components/ride/RideReviewForm';
import { UnreadDot } from '../../components/shared/UnreadDot';
import { useAuth } from '../../contexts/AuthContext';
import { useBidding } from '../../hooks/useBidding';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useRideChat } from '../../hooks/useRideChat';
import { useUnreadRideMessages } from '../../hooks/useUnreadRideMessages';
import { useThemeMode } from '../../hooks/useThemeMode';
import { fetchRideParticipant, updateRideStatus } from '../../services/rides';
import { publishRideLocation, subscribeRideLocation, type RidePeerLocation } from '../../services/rideSession';
import type { Ride, User } from '../../types';
import { formatBRL } from '../../utils/format';
import { formatApproxKm, haversineKm, isValidLatLng } from '../../utils/geo';
import { getRideDisplayStatus, paymentMethodLabel, rideStatusLabel } from '../../utils/rideStatus';

export function RideTrip() {
  const { rideId } = useParams<{ rideId: string }>();
  const history = useHistory();
  const { user } = useAuth();
  const { unreadCount } = useUnreadRideMessages(user);
  const [chatOpen, setChatOpen] = useState(false);
  const { dark, toggle } = useThemeMode();
  const { activeRide, bids, error: rideError, loading: rideLoading, refresh } = useBidding({ viewer: user, rideId });
  const { messages, send, loading: chatLoading, sending, error: chatError } = useRideChat(rideId, user, chatOpen);
  const {
    position,
    error: gpsError,
    errorCode,
    loading: gpsLoading,
    permissionDenied,
    refresh: refreshLocation,
    startWatch,
  } = useGeolocation({ enabled: true, watch: true });
  const [peer, setPeer] = useState<RidePeerLocation | null>(null);
  const [participant, setParticipant] = useState<User | null>(null);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    const participantId = activeRide && user
      ? user.role === 'driver' ? activeRide.passengerId : activeRide.driverId
      : undefined;
    setParticipant(null);
    setParticipantError(null);
    if (!participantId) return () => {
      cancelled = true;
    };
    void fetchRideParticipant(participantId)
      .then((profile) => {
        if (!cancelled) setParticipant(profile);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setParticipantError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados do participante.');
      });
    return () => {
      cancelled = true;
    };
  }, [activeRide?.driverId, activeRide?.passengerId, user]);

  const extraMarkers = useMemo(() => {
    if (!peer || !isValidLatLng(peer.lat, peer.lng)) return [];
    return [{
      id: 'peer',
      lat: peer.lat,
      lng: peer.lng,
      selected: true,
      color: '#15D164',
    }];
  }, [peer, user?.role]);

  const distanceToPickup = useMemo(() => {
    if (!position || !activeRide) return null;
    const distance = haversineKm(position, activeRide.origin);
    return Number.isFinite(distance) ? distance : null;
  }, [activeRide, position]);

  const home = user?.role === 'driver' ? '/driver/radar' : '/passenger/rides';
  const status = activeRide ? getRideDisplayStatus(activeRide, bids) : null;
  const acceptedBid = bids.find((bid) => bid.status === 'accepted');
  const participantName = participant?.name
    ?? (user?.role === 'passenger' ? acceptedBid?.driverName : activeRide?.passengerName)
    ?? (user?.role === 'driver' ? 'Passageiro' : 'Mototaxista');
  const participantPhoto = participant?.avatarUrl ?? (user?.role === 'passenger' ? acceptedBid?.driverPhoto : undefined);

  const nextDriverStatus: 'en_route' | 'in_progress' | 'completed' | null =
    status === 'confirmed' ? 'en_route' : status === 'en_route' ? 'in_progress' : status === 'in_progress' ? 'completed' : null;

  const transition = async (nextStatus: 'en_route' | 'in_progress' | 'completed' | 'cancelled') => {
    if (!activeRide || busy) return;
    setBusy(true);
    try {
      await updateRideStatus(activeRide, nextStatus);
      await refresh();
      if (nextStatus === 'cancelled') setToast('Corrida cancelada.');
      if (nextStatus === 'completed') setToast('Corrida finalizada.');
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Não foi possível atualizar a corrida.');
    } finally {
      setBusy(false);
    }
  };

  const locateMe = async () => {
    const result = await refreshLocation();
    if (!result.ok) {
      setToast(result.message);
      return;
    }
    setTargetCenter({ lat: result.position.lat, lng: result.position.lng });
    await startWatch();
  };

  const showChat = Boolean(activeRide?.driverId);
  const canCancel = user?.role === 'passenger'
    ? Boolean(status && ['searching', 'offered', 'confirmed'].includes(status))
    : user?.role === 'driver' && Boolean(status && ['confirmed', 'en_route', 'in_progress'].includes(status));
  const terminal = status === 'completed' || status === 'cancelled' || status === 'expired';

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Corrida</IonTitle>
          <IonButtons slot="end">
            {showChat && (
              <IonButton aria-label={chatOpen ? 'Fechar chat' : 'Abrir chat'} onClick={() => setChatOpen((open) => !open)}>
                <span className="relative inline-flex">
                  <IonIcon icon={chatbubbleEllipsesOutline} />
                  <UnreadDot visible={unreadCount > 0} />
                </span>
              </IonButton>
            )}
            <IonButton onClick={toggle}>
              <IonIcon icon={dark ? sunnyOutline : moonOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={false}>
        <div className="flex h-full flex-col">
          <div className="relative min-h-[30%] flex-1">
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
              onGpsClick={() => void locateMe()}
            />
          </div>
          <div className="max-h-[70%] overflow-auto p-3" style={{ background: 'var(--ion-background-color)' }}>
            {!activeRide && (
              <div className="rounded-2xl p-4 text-sm" style={{ background: 'var(--ion-card-background)' }}>
                {rideError ? (
                  <>
                    <p role="alert">{rideError}</p>
                    <IonButton fill="clear" onClick={() => void refresh()}>Tentar novamente</IonButton>
                  </>
                ) : rideLoading ? (
                  <div className="flex items-center gap-2"><IonSpinner name="crescent" /> Carregando corrida...</div>
                ) : (
                  <>
                    <p>Esta corrida não foi encontrada ou não está disponível para sua conta.</p>
                    <IonButton fill="clear" onClick={() => history.replace(home)}>Voltar ao início</IonButton>
                  </>
                )}
              </div>
            )}
            {activeRide && (
              <>
                <div className="mb-3 rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
                  <div className="text-sm font-bold">{status ? rideStatusLabel(status) : 'Status da corrida indisponível.'}</div>
                  {rideError && <p className="mt-1 text-xs" role="alert">{rideError}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase" style={{ color: 'var(--ion-color-medium)' }}>Embarque</div>
                      <div>{activeRide.origin.address || 'Local não informado'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase" style={{ color: 'var(--ion-color-medium)' }}>Destino</div>
                      <div>{activeRide.destination.address || 'Destino não informado'}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>Valor</span><div>{formatBRL(activeRide.finalPrice ?? activeRide.estimatedPrice)}</div></div>
                    <div><span className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>Pagamento</span><div>{paymentMethodLabel(activeRide.paymentMethod)}</div></div>
                    <div><span className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>Solicitada em</span><div>{new Date(activeRide.createdAt).toLocaleString('pt-BR')}</div></div>
                    <div><span className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>Distância ao embarque</span><div>{distanceToPickup == null ? 'Indisponível' : formatApproxKm(distanceToPickup)}</div></div>
                  </div>
                  {activeRide.driverId && (
                    <div className="mt-4 flex items-center gap-3 border-t border-[rgba(139,139,154,0.2)] pt-3">
                      {participantPhoto ? (
                        <img src={participantPhoto} alt={participantName} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ion-background-color)] text-xs font-bold">{participantName.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold">{participantName}</div>
                        {user?.role === 'passenger' ? (
                          <>
                            <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>{participant?.vehicleModel || 'Moto não informada'}{participant?.vehicleColor ? ` · ${participant.vehicleColor}` : ''}</div>
                            <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>Placa: {participant?.plate || 'Não informada'}</div>
                          </>
                        ) : null}
                        {participantError && <div className="text-xs text-[var(--ion-color-danger)]">{participantError}</div>}
                      </div>
                      {user?.role === 'passenger' && participant?.phone && (
                        <IonButton fill="outline" href={`tel:${participant.phone}`}>Ligar</IonButton>
                      )}
                    </div>
                  )}
                  {permissionDenied && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                      Permissão de GPS negada. Ative a localização nos Ajustes do Android.
                    </p>
                  )}
                  <IonButton className="mt-3" expand="block" fill="outline" onClick={() => void locateMe()} disabled={gpsLoading}>
                    <IonIcon icon={locateOutline} slot="start" />
                    Atualizar minha localização
                  </IonButton>
                  {user?.role === 'driver' && nextDriverStatus && (
                    <IonButton className="mt-2" expand="block" color="success" disabled={busy} onClick={() => void transition(nextDriverStatus)}>
                      {busy ? 'Atualizando...' : nextDriverStatus === 'en_route' ? 'Estou a caminho' : nextDriverStatus === 'in_progress' ? 'Iniciar viagem' : 'Finalizar corrida'}
                    </IonButton>
                  )}
                  {canCancel && (
                    <IonButton className="mt-2" expand="block" fill="outline" color="medium" disabled={busy} onClick={() => void transition('cancelled')}>
                      Cancelar corrida
                    </IonButton>
                  )}
                  {terminal && (
                    <IonButton className="mt-2" expand="block" onClick={() => history.replace(home)}>
                      Voltar ao início
                    </IonButton>
                  )}
                </div>
                {chatOpen && showChat && user && (
                  <div className="mb-3 h-64 rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
                    <RideChatPanel
                      messages={messages}
                      user={user}
                      otherParticipantName={participantName}
                      otherParticipantPhoto={participantPhoto}
                      loading={chatLoading}
                      sending={sending}
                      error={chatError}
                      onSend={send}
                    />
                  </div>
                )}
                {status === 'completed' && user && participant && (
                  <RideReviewForm rideId={activeRide.id} reviewer={user} reviewedUser={participant} />
                )}
              </>
            )}
          </div>
        </div>
        <IonToast isOpen={Boolean(toast)} message={toast} duration={2800} onDidDismiss={() => setToast('')} />
      </IonContent>
    </IonPage>
  );
}
