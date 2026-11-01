import { useEffect, useState } from 'react';
import { IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchRideHistory } from '../../services/rides';
import type { Ride } from '../../types';

export function PassengerHistory() {
  const { user } = useAuth();
  const history = useHistory();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (user) {
      void fetchRideHistory(user.id)
        .then((result) => {
          if (!cancelled) setRides(result);
        })
        .catch((cause: unknown) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Historico</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList>
          {rides.map((ride) => (
            <IonItem key={ride.id} lines="full" button onClick={() => history.push(`/corrida/${ride.id}`)}>
              <IonLabel>
                <h2>{ride.destination.address}</h2>
                <p>
                  {ride.origin.neighborhood} para {ride.destination.neighborhood}
                </p>
              </IonLabel>
              <span slot="end" className="font-bold">
                R$ {ride.estimatedPrice.toFixed(2).replace('.', ',')}
              </span>
            </IonItem>
          ))}
          {loading && <div className="flex justify-center p-4"><IonSpinner name="crescent" /></div>}
          {error && <p className="px-2 text-sm" role="alert">{error}</p>}
          {!loading && !error && rides.length === 0 && (
            <p className="px-2 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
              Nenhuma corrida ainda.
            </p>
          )}
        </IonList>
      </IonContent>
    </IonPage>
  );
}
