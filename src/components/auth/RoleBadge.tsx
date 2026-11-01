import { IonIcon } from '@ionic/react';
import { bicycleOutline, personOutline } from 'ionicons/icons';
import type { UserRole } from '../../types';

interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const isDriver = role === 'driver';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
      style={{
        background: isDriver ? 'rgba(21,209,100,0.14)' : 'rgba(26,26,46,0.1)',
        color: isDriver ? '#118642' : '#1A1A2E',
      }}
    >
      <IonIcon icon={isDriver ? bicycleOutline : personOutline} />
      {isDriver ? 'Mototaxista' : 'Passageiro'}
    </span>
  );
}
