import { IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function PassengerProfile() {
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
            {user?.email} · {user?.rating.toFixed(1)}
          </div>
        </div>
        <IonList>
          <IonItem>
            <IonLabel>Telefone</IonLabel>
            <span>{user?.phone}</span>
          </IonItem>
          <IonItem>
            <IonLabel>Perfil</IonLabel>
            <span>Passageiro</span>
          </IonItem>
        </IonList>
        <IonButton className="mt-8" expand="block" fill="outline" color="danger" onClick={handleLogout}>
          Sair
        </IonButton>
      </IonContent>
    </IonPage>
  );
}
