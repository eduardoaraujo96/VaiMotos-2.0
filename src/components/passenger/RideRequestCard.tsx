import { IonButton, IonIcon, IonInput, IonItem } from '@ionic/react';
import { locateOutline, navigateOutline, flashOutline } from 'ionicons/icons';

interface RideRequestCardProps {
  origin: string;
  destination: string;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onRequest: () => void;
  estimatedPrice?: number;
  estimatedMinutes?: number;
}

export function RideRequestCard({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  onRequest,
  estimatedPrice,
  estimatedMinutes,
}: RideRequestCardProps) {
  return (
    <div
      className="rounded-3xl p-4 safe-bottom"
      style={{
        background: 'var(--ion-card-background)',
        boxShadow: '0 -12px 40px rgba(15,15,20,0.18)',
      }}
    >
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ion-color-medium)' }}>
        Para onde vamos?
      </div>
      <IonItem lines="none" className="rounded-2xl mb-2" style={{ '--background': 'var(--ion-background-color)' }}>
        <IonIcon icon={locateOutline} slot="start" color="primary" />
        <IonInput
          value={origin}
          placeholder="Ponto de partida"
          onIonInput={(e) => onOriginChange(String(e.detail.value ?? ''))}
        />
      </IonItem>
      <IonItem lines="none" className="rounded-2xl mb-4" style={{ '--background': 'var(--ion-background-color)' }}>
        <IonIcon icon={navigateOutline} slot="start" color="secondary" />
        <IonInput
          value={destination}
          placeholder="Destino"
          onIonInput={(e) => onDestinationChange(String(e.detail.value ?? ''))}
        />
      </IonItem>
      {estimatedPrice !== undefined && (
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            {estimatedMinutes} min estimados
          </span>
          <span className="text-lg font-extrabold">R$ {estimatedPrice.toFixed(2).replace('.', ',')}</span>
        </div>
      )}
      <IonButton expand="block" size="large" onClick={onRequest} disabled={!destination.trim()}>
        <IonIcon icon={flashOutline} slot="start" />
        Pedir Mototaxi
      </IonButton>
    </div>
  );
}
