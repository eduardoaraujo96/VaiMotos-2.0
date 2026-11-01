import { useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonLoading,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonToast,
} from '@ionic/react';
import { bicycleOutline, personOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { AvatarPicker } from '../components/auth/AvatarPicker';
import { BrandMark } from '../components/shared/BrandMark';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';
import {
  isValidCnh,
  isValidEmail,
  isValidName,
  isValidPhone,
  isValidPlate,
  maskCnh,
  maskPhone,
  maskPlate,
} from '../utils/masks';

export function SignupPage() {
  const { register } = useAuth();
  const history = useHistory();
  const [role, setRole] = useState<UserRole>('passenger');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [cnhNumber, setCnhNumber] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const driverReady =
    role === 'passenger' || (isValidPlate(plate) && vehicleModel.trim().length >= 3 && isValidCnh(cnhNumber));

  const valid = useMemo(
    () =>
      isValidName(name) &&
      isValidEmail(email) &&
      password.length >= 6 &&
      isValidPhone(phone) &&
      driverReady,
    [name, email, password, phone, driverReady]
  );

  const handleSubmit = async () => {
    if (!valid) {
      setError('Preencha os campos obrigatorios corretamente.');
      return;
    }
    setBusy(true);
    try {
      const user = await register({
        email,
        password,
        name,
        phone,
        role,
        avatarFile,
        homeAddress,
        workAddress,
        plate,
        vehicleModel,
        vehicleColor,
        cnhNumber,
      });
      history.replace(user.role === 'driver' ? '/driver' : '/passenger');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel criar a conta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ion-padding">
        <div className="mx-auto max-w-md pb-10 pt-6">
          <BrandMark />
          <h1 className="mt-6 text-2xl font-extrabold">Criar conta</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            Escolha o perfil. Os campos mudam automaticamente.
          </p>

          <div className="mt-5">
            <AvatarPicker name={name} onFileChange={setAvatarFile} />
          </div>

          <div className="mt-2">
            <IonSegment value={role} onIonChange={(e) => setRole((e.detail.value as UserRole) || 'passenger')}>
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

          <div
            className="mt-3 rounded-2xl px-3 py-2 text-xs font-semibold"
            style={{
              background: role === 'driver' ? 'rgba(21,209,100,0.12)' : 'rgba(26,26,46,0.08)',
            }}
          >
            {role === 'driver'
              ? 'Voce vai receber corridas no Radar e enviar ofertas cegas.'
              : 'Voce vai pedir mototaxi e escolher a melhor oferta.'}
          </div>

          <IonItem className="mt-4 rounded-2xl" lines="none">
            <IonInput
              label="Nome completo"
              labelPlacement="stacked"
              value={name}
              onIonInput={(e) => setName(String(e.detail.value ?? ''))}
            />
          </IonItem>
          <IonItem className="mt-3 rounded-2xl" lines="none">
            <IonInput
              type="email"
              label="E-mail"
              labelPlacement="stacked"
              value={email}
              onIonInput={(e) => setEmail(String(e.detail.value ?? ''))}
            />
          </IonItem>
          <IonItem className="mt-3 rounded-2xl" lines="none">
            <IonInput
              type="password"
              label="Senha"
              labelPlacement="stacked"
              value={password}
              onIonInput={(e) => setPassword(String(e.detail.value ?? ''))}
            />
          </IonItem>
          <IonItem className="mt-3 rounded-2xl" lines="none">
            <IonInput
              label="Telefone"
              labelPlacement="stacked"
              placeholder="(11) 98888-1010"
              value={phone}
              onIonInput={(e) => setPhone(maskPhone(String(e.detail.value ?? '')))}
            />
          </IonItem>

          {role === 'passenger' && (
            <>
              <IonItem className="mt-3 rounded-2xl" lines="none">
                <IonInput
                  label="Casa (opcional)"
                  labelPlacement="stacked"
                  placeholder="Endereco salvo"
                  value={homeAddress}
                  onIonInput={(e) => setHomeAddress(String(e.detail.value ?? ''))}
                />
              </IonItem>
              <IonItem className="mt-3 rounded-2xl" lines="none">
                <IonInput
                  label="Trabalho (opcional)"
                  labelPlacement="stacked"
                  value={workAddress}
                  onIonInput={(e) => setWorkAddress(String(e.detail.value ?? ''))}
                />
              </IonItem>
            </>
          )}

          {role === 'driver' && (
            <>
              <IonItem className="mt-3 rounded-2xl" lines="none">
                <IonInput
                  label="Placa"
                  labelPlacement="stacked"
                  placeholder="ABC-1234 ou ABC1D23"
                  value={plate}
                  onIonInput={(e) => setPlate(maskPlate(String(e.detail.value ?? '')))}
                />
              </IonItem>
              <IonItem className="mt-3 rounded-2xl" lines="none">
                <IonInput
                  label="Modelo da moto"
                  labelPlacement="stacked"
                  placeholder="Honda CG 160"
                  value={vehicleModel}
                  onIonInput={(e) => setVehicleModel(String(e.detail.value ?? ''))}
                />
              </IonItem>
              <IonItem className="mt-3 rounded-2xl" lines="none">
                <IonInput
                  label="Cor da moto (opcional)"
                  labelPlacement="stacked"
                  placeholder="Preta"
                  value={vehicleColor}
                  onIonInput={(e) => setVehicleColor(String(e.detail.value ?? ''))}
                />
              </IonItem>
              <IonItem className="mt-3 rounded-2xl" lines="none">
                <IonInput
                  label="CNH"
                  labelPlacement="stacked"
                  placeholder="11 digitos"
                  value={cnhNumber}
                  onIonInput={(e) => setCnhNumber(maskCnh(String(e.detail.value ?? '')))}
                />
              </IonItem>
            </>
          )}

          <IonButton className="mt-6" expand="block" size="large" disabled={busy} onClick={handleSubmit}>
            Cadastrar
          </IonButton>
          <IonButton className="mt-2" expand="block" fill="clear" routerLink="/login">
            Ja tenho conta
          </IonButton>
        </div>
        <IonLoading isOpen={busy} message="Criando conta..." />
        <IonToast isOpen={Boolean(error)} message={error} duration={2800} onDidDismiss={() => setError('')} />
      </IonContent>
    </IonPage>
  );
}
