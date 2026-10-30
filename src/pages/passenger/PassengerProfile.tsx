import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { ProfileEditor } from '../../components/profile/ProfileEditor';

export function PassengerProfile() {
  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <ProfileEditor />
      </IonContent>
    </IonPage>
  );
}
