import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { mockDriver } from '../../data/mock';

export function DriverEarnings() {
  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Ganhos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="rounded-3xl p-5" style={{ background: 'linear-gradient(135deg, #FF6B00, #FF9A3D)', color: '#fff' }}>
          <div className="text-sm font-medium opacity-90">Hoje</div>
          <div className="mt-1 text-4xl font-extrabold">
            R$ {mockDriver.todayEarnings.toFixed(2).replace('.', ',')}
          </div>
          <div className="mt-2 text-sm">{mockDriver.todayRides} corridas concluidas</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
            <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>
              Media / corrida
            </div>
            <div className="text-xl font-bold">R$ 20,72</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
            <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>
              Horas online
            </div>
            <div className="text-xl font-bold">4h 20m</div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
