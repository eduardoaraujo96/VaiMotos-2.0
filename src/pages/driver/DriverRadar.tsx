import { useState } from 'react';
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
import type { Ride } from '../../types';

export function DriverRadar() {
  const { user } = useAuth();
  const { dark, toggle } = useThemeMode();
  const { rides, makeOffer, driverBids, error } = useBidding({ viewer: user });
  const [online, setOnline] = useState(true);
  const [selected, setSelected] = useState<Ride | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

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
                style={{
                  background: 'var(--ion-card-background)',
                  border: '1px solid rgba(255,107,0,0.12)',
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
                  <IonButton expand="block" color="success" onClick={() => setSelected(ride)}>
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
