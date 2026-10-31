import { IonButton, IonIcon, IonItem, IonLabel } from '@ionic/react';
import { locateOutline, navigateOutline, flashOutline, checkmarkOutline } from 'ionicons/icons';

export type RequestStep = 'origin' | 'destination';

interface RideRequestCardProps {
  origin: string;
  destination: string;
  step: RequestStep;
  hasOrigin: boolean;
  hasDestination: boolean;
  busy?: boolean;
  onEditOrigin: () => void;
  onEditDestination: () => void;
  onConfirmOrigin: () => void;
  onRequest: () => void;
  estimatedPrice?: number;
  estimatedMinutes?: number;
  distanceKm?: number | null;
}

export function RideRequestCard({
  origin,
  destination,
  step,
  hasOrigin,
  hasDestination,
  busy,
  onEditOrigin,
  onEditDestination,
  onConfirmOrigin,
  onRequest,
  estimatedPrice,
  estimatedMinutes,
  distanceKm,
}: RideRequestCardProps) {
  const muted = { color: 'var(--ion-color-medium)' };
  return (
    <div
      className="rounded-3xl p-4 safe-bottom"
      style={{ background: 'var(--ion-card-background)', boxShadow: '0 -12px 40px rgba(15,15,20,0.18)' }}
    >
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider" style={muted}>
        {step === 'origin' ? 'Onde voce esta? Toque no mapa ou arraste o marcador' : 'Para onde vamos? Toque no mapa ou pesquise'}
      </div>
      <IonItem lines="none" button detail={false} className="rounded-2xl mb-2" style={{ '--background': 'var(--ion-background-color)' }} onClick={onEditOrigin}>
        <IonIcon icon={locateOutline} slot="start" color="primary" />
        <IonLabel className="ion-text-wrap text-sm">{hasOrigin ? origin : 'Embarque nao definido'}</IonLabel>
      </IonItem>
      <IonItem lines="none" button detail={false} className="rounded-2xl mb-3" style={{ '--background': 'var(--ion-background-color)' }} onClick={onEditDestination} disabled={!hasOrigin || step === 'origin'}>
        <IonIcon icon={navigateOutline} slot="start" color="secondary" />
        <IonLabel className="ion-text-wrap text-sm">{hasDestination ? destination : 'Destino nao definido'}</IonLabel>
      </IonItem>
      {estimatedPrice !== undefined && (
        <div className="mb-3 px-1">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={muted}>{estimatedMinutes} min estimados</span>
            <span className="text-lg font-extrabold">R$ {estimatedPrice.toFixed(2).replace('.', ',')}</span>
          </div>
          {distanceKm != null && (
            <div className="text-[11px]" style={muted}>
              Distancia aproximada em linha reta: {distanceKm.toFixed(1).replace('.', ',')} km. O percurso real pelas ruas pode ser maior.
            </div>
          )}
        </div>
      )}
      {step === 'origin' ? (
        <IonButton expand="block" size="large" onClick={onConfirmOrigin} disabled={!hasOrigin}>
          <IonIcon icon={checkmarkOutline} slot="start" />
          Confirmar embarque
        </IonButton>
      ) : (
        <IonButton expand="block" size="large" onClick={onRequest} disabled={!hasOrigin || !hasDestination || busy}>
          <IonIcon icon={flashOutline} slot="start" />
          Pedir Mototaxi
        </IonButton>
      )}
    </div>
  );
}
