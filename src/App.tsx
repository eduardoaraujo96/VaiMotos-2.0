import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { PassengerTabs } from './layouts/PassengerTabs';
import { DriverTabs } from './layouts/DriverTabs';
import { RideTrip } from './pages/shared/RideTrip';
import { DriverApprovals } from './pages/admin/DriverApprovals';

setupIonicReact({ mode: 'md' });

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const home = user?.role === 'driver' ? '/driver' : '/passenger';

  return (
    <IonReactRouter>
      <IonRouterOutlet>
        <Route exact path="/login">
          {isAuthenticated ? <Redirect to={home} /> : <LoginPage />}
        </Route>
        <Route exact path="/signup">
          {isAuthenticated ? <Redirect to={home} /> : <SignupPage />}
        </Route>
        <ProtectedRoute exact path="/corrida/:rideId">
          <RideTrip />
        </ProtectedRoute>
        <ProtectedRoute exact path="/admin/drivers">
          <DriverApprovals />
        </ProtectedRoute>
        <ProtectedRoute path="/passenger" role="passenger">
          <PassengerTabs />
        </ProtectedRoute>
        <ProtectedRoute path="/driver" role="driver">
          <DriverTabs />
        </ProtectedRoute>
        <Route exact path="/">
          <Redirect to={isAuthenticated ? home : '/login'} />
        </Route>
      </IonRouterOutlet>
    </IonReactRouter>
  );
}

export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </IonApp>
  );
}
