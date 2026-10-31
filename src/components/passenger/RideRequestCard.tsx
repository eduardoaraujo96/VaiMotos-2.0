import { IonButton, IonIcon, IonInput, IonItem, IonSpinner } from '@ionic/react';
import { checkmarkCircleOutline, flashOutline, locateOutline, navigateOutline } from 'ionicons/icons';

interface RideRequestCardProps {
  origin: string;
  destination: string;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onOriginFocus?: () => void;
  onDestinationFocus?: () => void;
  onUseGps?: () => void;
  onConfirmPickup?: () => void;
  onRequest: () => void;
  estimatedPrice?: number;
  estimatedMinutes?: number;
  approximateDistance?: string;
  canRequest?: boolean;
  busy?: boolean;
  gpsLoading?: boolean;
  pickupConfirmed?: boolean;
  activeField?: 'origin' | 'destination';
}

export function RideRequestCard({
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  onOriginFocus,
  onDestinationFocus,
  onUseGps,
  onConfirmPickup,
  onRequest,
  estimatedPrice,
  estimatedMinutes,
  approximateDistance,
  canRequest,
  busy = false,
  gpsLoading = false,
  pickupConfirmed = false,
  activeField = 'origin',
}: RideRequestCardProps) {
  const requestEnabled = (canRequest ?? Boolean(destination.trim())) && !busy;

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
      <IonItem
        lines="none"
        className="rounded-2xl mb-2"
        style={{
          '--background': 'var(--ion-background-color)',
          boxShadow: activeField === 'origin' ? 'inset 0 0 0 1px var(--ion-color-primary)' : undefined,
        }}
      >
        <IonIcon icon={locateOutline} slot="start" color="primary" />
        <IonInput
          value={origin}
          placeholder="Ponto de embarque"
          onIonFocus={() => onOriginFocus?.()}
          onIonInput={(e) => onOriginChange(String(e.detail.value ?? ''))}
        />
        {onUseGps && (
          <IonButton slot="end" fill="clear" onClick={onUseGps} disabled={gpsLoading}>
            {gpsLoading ? <IonSpinner name="crescent" /> : <IonIcon icon={locateOutline} color="primary" />}
          </IonButton>
        )}
      </IonItem>
      <IonItem
        lines="none"
        className="rounded-2xl mb-3"
        style={{
          '--background': 'var(--ion-background-color)',
          boxShadow: activeField === 'destination' ? 'inset 0 0 0 1px var(--ion-color-secondary)' : undefined,
        }}
      >
        <IonIcon icon={navigateOutline} slot="start" color="secondary" />
        <IonInput
          value={destination}
          placeholder="Destino"
          onIonFocus={() => onDestinationFocus?.()}
          onIonInput={(e) => onDestinationChange(String(e.detail.value ?? ''))}
        />
      </IonItem>
      <p className="mb-3 px-1 text-[11px]" style={{ color: 'var(--ion-color-medium)' }}>
        Mapa inicia em Matões, MA. Use Minha localização, busque um endereço ou toque no mapa. Sem GPS, a escolha manual continua liberada.
      </p>
      {estimatedPrice !== undefined && (
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            {estimatedMinutes} min estimados
            {approximateDistance ? ` · ${approximateDistance}` : ''}
          </span>
          <span className="text-lg font-extrabold">R$ {estimatedPrice.toFixed(2).replace('.', ',')}</span>
        </div>
      )}
      {approximateDistance && estimatedPrice === undefined && (
        <div className="mb-3 px-1 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
          {approximateDistance}
        </div>
      )}
      {onConfirmPickup && !pickupConfirmed && (
        <IonButton expand="block" fill="outline" className="mb-2" onClick={onConfirmPickup} disabled={!origin.trim()}>
          <IonIcon icon={checkmarkCircleOutline} slot="start" />
          Confirmar embarque
        </IonButton>
      )}
      {pickupConfirmed && (
        <div className="mb-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'rgba(0,200,83,0.12)', color: '#00C853' }}>
          Embarque confirmado
        </div>
      )}
      <IonButton expand="block" size="large" onClick={onRequest} disabled={!requestEnabled}>
        <IonIcon icon={flashOutline} slot="start" />
        {busy ? 'Solicitando...' : 'Pedir Mototaxi'}
      </IonButton>
    </div>
  );
}
