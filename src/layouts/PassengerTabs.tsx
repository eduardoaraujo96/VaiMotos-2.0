import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { homeOutline, navigateOutline, personOutline, timeOutline } from 'ionicons/icons';
import { Redirect, Route } from 'react-router-dom';
import { PassengerHome } from '../pages/passenger/PassengerHome';
import { PassengerHistory } from '../pages/passenger/PassengerHistory';
import { PassengerProfile } from '../pages/passenger/PassengerProfile';
import { PassengerOffers } from '../pages/passenger/PassengerOffers';
import { PassengerRides } from '../pages/passenger/PassengerRides';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadRideMessages } from '../hooks/useUnreadRideMessages';
import { UnreadDot } from '../components/shared/UnreadDot';

export function PassengerTabs() {
  const { user } = useAuth();
  const { unreadCount } = useUnreadRideMessages(user);
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Redirect exact path="/passenger" to="/passenger/home" />
        <Route exact path="/passenger/home" component={PassengerHome} />
        <Route exact path="/passenger/offers/:rideId" component={PassengerOffers} />
        <Route exact path="/passenger/rides" component={PassengerRides} />
        <Route exact path="/passenger/history" component={PassengerHistory} />
        <Route exact path="/passenger/profile" component={PassengerProfile} />
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="home" href="/passenger/home">
          <IonIcon icon={homeOutline} />
          <IonLabel>Inicio</IonLabel>
        </IonTabButton>
        <IonTabButton tab="history" href="/passenger/history">
          <IonIcon icon={timeOutline} />
          <IonLabel>Historico</IonLabel>
        </IonTabButton>
        <IonTabButton tab="rides" href="/passenger/rides">
          <span className="relative inline-flex">
            <IonIcon icon={navigateOutline} />
            <UnreadDot visible={unreadCount > 0} />
          </span>
          <IonLabel>Corrida</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href="/passenger/profile">
          <IonIcon icon={personOutline} />
          <IonLabel>Perfil</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}
