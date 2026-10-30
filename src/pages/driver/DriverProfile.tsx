import { IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { mockDriver } from '../../data/mock';

export function DriverProfile() {
  const { user, logout } = useAuth();
  const history = useHistory();

  const handleLogout = async () => {
    await logout();
    history.replace('/login');
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="mb-6">
          <div className="text-2xl font-extrabold">{user?.name}</div>
          <div className="text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            Mototaxista · {user?.rating.toFixed(1)}
          </div>
        </div>
        <IonList>
          <IonItem>
            <IonLabel>Placa</IonLabel>
            <span>{mockDriver.plate}</span>
          </IonItem>
          <IonItem>
            <IonLabel>Veiculo</IonLabel>
            <span>{mockDriver.vehicleModel}</span>
          </IonItem>
          <IonItem>
            <IonLabel>Telefone</IonLabel>
            <span>{user?.phone}</span>
          </IonItem>
        </IonList>
        <IonButton className="mt-8" expand="block" fill="outline" color="danger" onClick={handleLogout}>
          Sair
        </IonButton>
      </IonContent>
    </IonPage>
  );
}
