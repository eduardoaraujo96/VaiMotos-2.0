import { useEffect, useState } from 'react';
import { IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchRideHistory } from '../../services/rides';
import type { Ride } from '../../types';

export function PassengerHistory() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    if (user) {
      fetchRideHistory(user.id).then(setRides);
    }
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
            <IonItem key={ride.id} lines="full">
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
          {rides.length === 0 && (
            <p className="px-2 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
              Nenhuma corrida ainda.
            </p>
          )}
        </IonList>
      </IonContent>
    </IonPage>
  );
}
