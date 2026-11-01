import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { personOutline, radioOutline, timeOutline, walletOutline } from 'ionicons/icons';
import { Redirect, Route } from 'react-router-dom';
import { DriverRadar } from '../pages/driver/DriverRadar';
import { DriverEarnings } from '../pages/driver/DriverEarnings';
import { DriverProfile } from '../pages/driver/DriverProfile';
import { DriverHistory } from '../pages/driver/DriverHistory';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadRideMessages } from '../hooks/useUnreadRideMessages';
import { UnreadDot } from '../components/shared/UnreadDot';

export function DriverTabs() {
  const { user } = useAuth();
  const { unreadCount } = useUnreadRideMessages(user);
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Redirect exact path="/driver" to="/driver/radar" />
        <Route exact path="/driver/radar" component={DriverRadar} />
        <Route exact path="/driver/earnings" component={DriverEarnings} />
        <Route exact path="/driver/history" component={DriverHistory} />
        <Route exact path="/driver/profile" component={DriverProfile} />
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="radar" href="/driver/radar">
          <span className="relative inline-flex">
            <IonIcon icon={radioOutline} />
            <UnreadDot visible={unreadCount > 0} />
          </span>
          <IonLabel>Radar</IonLabel>
        </IonTabButton>
        <IonTabButton tab="earnings" href="/driver/earnings">
          <IonIcon icon={walletOutline} />
          <IonLabel>Ganhos</IonLabel>
        </IonTabButton>
        <IonTabButton tab="history" href="/driver/history">
          <IonIcon icon={timeOutline} />
          <IonLabel>Histórico</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href="/driver/profile">
          <IonIcon icon={personOutline} />
          <IonLabel>Perfil</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}
