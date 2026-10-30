import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLoading,
  IonPage,
  IonToast,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { BrandMark } from '../components/shared/BrandMark';
import { useAuth } from '../contexts/AuthContext';
import { isValidEmail } from '../utils/masks';

export function LoginPage() {
  const { login } = useAuth();
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const valid = isValidEmail(email) && password.length >= 6;

  const handleLogin = async () => {
    if (!valid) {
      setError('Informe um e-mail valido e senha com 6+ caracteres.');
      return;
    }
    setBusy(true);
    try {
      const user = await login(email, password);
      history.replace(user.role === 'driver' ? '/driver' : '/passenger');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel entrar.');
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
            Entre com sua conta. O app muda sozinho para Passageiro ou Mototaxista.
          </p>

          <IonItem className="mt-8 rounded-2xl" lines="none">
            <IonInput
              type="email"
              label="E-mail"
              labelPlacement="stacked"
              placeholder="voce@email.com"
              value={email}
              onIonInput={(e) => setEmail(String(e.detail.value ?? ''))}
            />
          </IonItem>
          <IonItem className="mt-3 rounded-2xl" lines="none">
            <IonInput
              type="password"
              label="Senha"
              labelPlacement="stacked"
              placeholder="Minimo 6 caracteres"
              value={password}
              onIonInput={(e) => setPassword(String(e.detail.value ?? ''))}
            />
          </IonItem>

          <IonButton className="mt-6" expand="block" size="large" onClick={handleLogin} disabled={busy}>
            Entrar
          </IonButton>
          <IonButton className="mt-2" expand="block" fill="outline" routerLink="/signup">
            Criar conta
          </IonButton>
        </div>
        <IonLoading isOpen={busy} message="Entrando..." />
        <IonToast isOpen={Boolean(error)} message={error} duration={2600} onDidDismiss={() => setError('')} />
      </IonContent>
    </IonPage>
  );
}
