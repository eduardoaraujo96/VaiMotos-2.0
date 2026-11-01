import { useEffect, useMemo, useState } from 'react';
import {
  IonBackButton,
  IonBadge,
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
import { star, timeOutline } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBidding } from '../../hooks/useBidding';
import { formatBRL, initials } from '../../utils/format';
import type { Bid } from '../../types';

export function PassengerOffers() {
  const { rideId } = useParams<{ rideId: string }>();
  const { user } = useAuth();
  const history = useHistory();
  const { activeRide, bids, chooseOffer, error } = useBidding({ viewer: user, rideId });
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = useMemo(() => {
    if (!activeRide) return 0;
    return Math.max(0, Math.round((new Date(activeRide.expiresAt).getTime() - now) / 1000));
  }, [activeRide, now]);

  const handleAccept = async (bid: Bid) => {
    if (!activeRide || !user) return;
    setBusyId(bid.id);
    try {
      await chooseOffer(activeRide, bid);
      setToast(`${bid.driverName} aceito por ${formatBRL(bid.amount)}.`);
      window.setTimeout(() => history.replace(`/corrida/${activeRide.id}`), 600);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Nao foi possivel aceitar a oferta.');
    } finally {
      setBusyId(null);
    }
  };

  const awarded = activeRide?.status === 'awarded';

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/passenger/home" />
          </IonButtons>
          <IonTitle>Ofertas ao vivo</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="mb-4 rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ion-color-medium)' }}>
            Sua corrida
          </div>
          <div className="mt-1 font-bold">{activeRide?.destination.address ?? 'Carregando...'}</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            {activeRide?.origin.address}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <IonBadge color={awarded ? 'success' : 'primary'}>
              {awarded ? 'Oferta aceita' : `${bids.length} ofertas`}
            </IonBadge>
            <span className="text-xs font-semibold" style={{ color: 'var(--ion-color-medium)' }}>
              {awarded ? 'Mototaxista a caminho' : remaining > 0 ? `${remaining}s restantes` : 'Aguardando ofertas'}
            </span>
          </div>
        </div>

        {bids.length === 0 && !awarded && (
          <div className="flex flex-col items-center py-10 text-center">
            <IonSpinner name="crescent" color="primary" />
            <p className="mt-3 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
              Mototaxistas proximos estao enviando precos. Voce e o unico que ve todas as ofertas.
            </p>
          </div>
        )}

        {bids.map((bid) => (
          <div
            key={bid.id}
            className="mb-3 rounded-2xl p-4"
            style={{
              background: 'var(--ion-card-background)',
              border: bid.status === 'accepted' ? '1px solid #15D164' : '1px solid rgba(21,209,100,0.12)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
                style={{ background: bid.driverColor }}
              >
                {bid.driverPhoto ? (
                  <img src={bid.driverPhoto} alt={bid.driverName} className="h-12 w-12 object-cover" />
                ) : (
                  initials(bid.driverName)
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold">{bid.driverName}</div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                      <span className="flex items-center gap-1">
                        <IonIcon icon={star} color="warning" />
                        {bid.driverRating.toFixed(1)}
                      </span>
                      <span className="flex items-center gap-1">
                        <IonIcon icon={timeOutline} />
                        {bid.etaMinutes} min
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold" style={{ color: '#00C853' }}>
                      {formatBRL(bid.amount)}
                    </div>
                    <div className="text-[10px] uppercase" style={{ color: 'var(--ion-color-medium)' }}>
                      preco do motorista
                    </div>
                  </div>
                </div>
                {bid.status === 'pending' && !awarded && (
                  <IonButton
                    className="mt-3"
                    expand="block"
                    disabled={busyId === bid.id}
                    onClick={() => handleAccept(bid)}
                  >
                    {busyId === bid.id ? 'Confirmando...' : 'Aceitar oferta'}
                  </IonButton>
                )}
                {bid.status === 'accepted' && (
                  <div className="mt-3 text-sm font-semibold" style={{ color: '#00C853' }}>
                    Oferta aceita
                  </div>
                )}
                {bid.status === 'rejected' && (
                  <div className="mt-3 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                    Nao selecionada
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <IonToast isOpen={Boolean(toast)} message={toast} duration={2200} onDidDismiss={() => setToast('')} />
        <IonToast isOpen={Boolean(error)} message={error ?? ''} duration={2400} />
      </IonContent>
    </IonPage>
  );
}
