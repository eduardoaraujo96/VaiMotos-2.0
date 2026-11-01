import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { setupDriverPushNotifications } from '../../services/pushNotifications';

export function PushNotificationManager() {
  const { user } = useAuth();
  const history = useHistory();

  useEffect(() => {
    if (user?.role !== 'driver') return undefined;
    let active = true;
    let cleanup: (() => void) | undefined;

    void setupDriverPushNotifications(user.id, ({ notification }) => {
      const rideId = notification.data?.ride_id;
      if (active && typeof rideId === 'string' && rideId.length > 0) {
        history.push(`/driver/radar?ride_id=${encodeURIComponent(rideId)}`);
      }
    })
      .then((dispose) => {
        if (active) cleanup = dispose;
        else dispose();
      })
      .catch((error: unknown) => {
        console.error('Não foi possível inicializar as notificações push:', error);
      });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [history, user?.id, user?.role]);

  return null;
}
