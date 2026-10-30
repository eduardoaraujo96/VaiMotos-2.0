import type { ReactNode } from 'react';
import { Redirect, Route } from 'react-router-dom';
import type { RouteProps } from 'react-router-dom';
import { IonSpinner } from '@ionic/react';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';

interface ProtectedRouteProps extends RouteProps {
  role?: UserRole;
}

export function ProtectedRoute({ role, children, ...rest }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <IonSpinner name="crescent" color="primary" />
      </div>
    );
  }

  return (
    <Route
      {...rest}
      render={({ location }) => {
        if (!isAuthenticated) {
          return <Redirect to={{ pathname: '/login', state: { from: location } }} />;
        }
        if (role && user?.role !== role) {
          const fallback = user?.role === 'driver' ? '/driver' : '/passenger';
          return <Redirect to={fallback} />;
        }
        return children as ReactNode;
      }}
    />
  );
}
