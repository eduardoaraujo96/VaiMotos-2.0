import { IonButton, IonIcon } from '@ionic/react';
import { navigateOutline, timeOutline, walkOutline } from 'ionicons/icons';
import type { Ride } from '../../types';
import { PriceTag } from '../shared/PriceTag';

interface RideRadarCardProps {
  ride: Ride;
  onAccept: (rideId: string) => void;
}

export function RideRadarCard({ ride, onAccept }: RideRadarCardProps) {
  return (
    <div
      className="mb-3 rounded-2xl p-4"
      style={{
        background: 'var(--ion-card-background)',
        border: '1px solid rgba(21,209,100,0.12)',
      }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-base font-bold">{ride.passengerName}</div>
          <div className="text-xs font-medium" style={{ color: 'var(--ion-color-medium)' }}>
            {ride.origin.neighborhood} para {ride.destination.neighborhood}
          </div>
        </div>
        <PriceTag value={ride.estimatedPrice} emphasize />
      </div>
      <div className="mb-3 space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="mt-1 h-2 w-2 rounded-full" style={{ background: '#15D164' }} />
          <span>{ride.origin.address}</span>
        </div>
        <div className="flex gap-2">
          <span className="mt-1 h-2 w-2 rounded-full" style={{ background: '#1A1A2E' }} />
          <span>{ride.destination.address}</span>
        </div>
      </div>
      <div className="mb-3 flex gap-4 text-xs font-semibold" style={{ color: 'var(--ion-color-medium)' }}>
        <span className="flex items-center gap-1">
          <IonIcon icon={walkOutline} />
          {ride.distanceKm.toFixed(1)} km
        </span>
        <span className="flex items-center gap-1">
          <IonIcon icon={timeOutline} />
          {ride.estimatedMinutes} min
        </span>
        <span className="flex items-center gap-1">
          <IonIcon icon={navigateOutline} />
          2 min de voce
        </span>
      </div>
      <IonButton expand="block" color="success" onClick={() => onAccept(ride.id)}>
        Fazer oferta
      </IonButton>
    </div>
  );
}
