import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonToast,
} from '@ionic/react';
import { personOutline, bicycleOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { BrandMark } from '../components/shared/BrandMark';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

export function LoginPage() {
  const { login } = useAuth();
  const history = useHistory();
  const [role, setRole] = useState<UserRole>('passenger');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setBusy(true);
    try {
      await login(role, name || undefined);
      history.replace(role === 'driver' ? '/driver' : '/passenger');
    } catch {
      setError('Nao foi possivel entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ion-padding">
        <div className="mx-auto flex min-h-full max-w-md flex-col justify-center py-8">
          <BrandMark />
          <h1 className="mt-8 text-3xl font-extrabold leading-tight">
            Chegue mais rapido.
            <br />
            <span style={{ color: '#FF6B00' }}>Va de moto.</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            Um app so. O perfil define sua experiencia.
          </p>

          <div className="mt-8">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ion-color-medium)' }}>
              Entrar como
            </div>
            <IonSegment
              value={role}
              onIonChange={(e) => setRole((e.detail.value as UserRole) || 'passenger')}
            >
              <IonSegmentButton value="passenger">
                <IonIcon icon={personOutline} />
                <IonLabel>Passageiro</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="driver">
                <IonIcon icon={bicycleOutline} />
                <IonLabel>Mototaxista</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </div>

          <IonItem className="mt-6 rounded-2xl" lines="none">
            <IonInput
              label="Nome (opcional)"
              labelPlacement="stacked"
              placeholder={role === 'driver' ? 'Carlos Mendes' : 'Ana Ribeiro'}
              value={name}
              onIonInput={(e) => setName(String(e.detail.value ?? ''))}
            />
          </IonItem>

          <IonButton className="mt-6" expand="block" size="large" onClick={handleLogin} disabled={busy}>
            {busy ? 'Entrando...' : 'Continuar'}
          </IonButton>
          <p className="mt-4 text-center text-xs" style={{ color: 'var(--ion-color-medium)' }}>
            Demo: abra outra aba como Mototaxista para enviar uma oferta cega.
          </p>
        </div>
        <IonToast isOpen={Boolean(error)} message={error} duration={2200} onDidDismiss={() => setError('')} />
      </IonContent>
    </IonPage>
  );
}
