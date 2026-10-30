import { useState } from 'react';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonLoading,
  IonToast,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { AvatarPicker } from '../auth/AvatarPicker';
import { RoleBadge } from '../auth/RoleBadge';
import { useAuth } from '../../contexts/AuthContext';
import {
  isValidCnh,
  isValidName,
  isValidPhone,
  isValidPlate,
  maskCnh,
  maskPhone,
  maskPlate,
} from '../../utils/masks';

export function ProfileEditor() {
  const { user, updateProfile, logout } = useAuth();
  const history = useHistory();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [homeAddress, setHomeAddress] = useState(user?.homeAddress ?? '');
  const [workAddress, setWorkAddress] = useState(user?.workAddress ?? '');
  const [plate, setPlate] = useState(user?.plate ?? '');
  const [vehicleModel, setVehicleModel] = useState(user?.vehicleModel ?? '');
  const [cnhNumber, setCnhNumber] = useState(user?.cnhNumber ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  if (!user) return null;

  const driverOk =
    user.role === 'passenger' || (isValidPlate(plate) && vehicleModel.trim().length >= 3 && isValidCnh(cnhNumber));
  const valid = isValidName(name) && isValidPhone(phone) && driverOk;

  const handleSave = async () => {
    if (!valid) {
      setError('Revise nome, telefone e dados do veiculo.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({
        name,
        phone,
        homeAddress,
        workAddress,
        plate,
        vehicleModel,
        cnhNumber,
        avatarFile,
      });
      setToast('Perfil atualizado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    history.replace('/login');
  };

  return (
    <div>
      <div className="mb-5 flex flex-col items-center">
        <AvatarPicker name={name} currentUrl={user.avatarUrl} onFileChange={setAvatarFile} />
        <div className="mt-1 text-2xl font-extrabold">{name || user.name}</div>
        <div className="mt-1">
          <RoleBadge role={user.role} />
        </div>
        <div className="mt-1 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
          {user.email} · {user.rating.toFixed(1)}
        </div>
      </div>

      <IonList>
        <IonItem className="rounded-2xl mb-2" lines="none">
          <IonInput
            label="Nome"
            labelPlacement="stacked"
            value={name}
            onIonInput={(e) => setName(String(e.detail.value ?? ''))}
          />
        </IonItem>
        <IonItem className="rounded-2xl mb-2" lines="none">
          <IonInput
            label="Telefone"
            labelPlacement="stacked"
            value={phone}
            onIonInput={(e) => setPhone(maskPhone(String(e.detail.value ?? '')))}
          />
        </IonItem>

        {user.role === 'passenger' && (
          <>
            <IonItem className="rounded-2xl mb-2" lines="none">
              <IonInput
                label="Casa"
                labelPlacement="stacked"
                value={homeAddress}
                onIonInput={(e) => setHomeAddress(String(e.detail.value ?? ''))}
              />
            </IonItem>
            <IonItem className="rounded-2xl mb-2" lines="none">
              <IonInput
                label="Trabalho"
                labelPlacement="stacked"
                value={workAddress}
                onIonInput={(e) => setWorkAddress(String(e.detail.value ?? ''))}
              />
            </IonItem>
          </>
        )}

        {user.role === 'driver' && (
          <>
            <IonItem className="rounded-2xl mb-2" lines="none">
              <IonInput
                label="Placa"
                labelPlacement="stacked"
                value={plate}
                onIonInput={(e) => setPlate(maskPlate(String(e.detail.value ?? '')))}
              />
            </IonItem>
            <IonItem className="rounded-2xl mb-2" lines="none">
              <IonInput
                label="Modelo"
                labelPlacement="stacked"
                value={vehicleModel}
                onIonInput={(e) => setVehicleModel(String(e.detail.value ?? ''))}
              />
            </IonItem>
            <IonItem className="rounded-2xl mb-2" lines="none">
              <IonInput
                label="CNH"
                labelPlacement="stacked"
                value={cnhNumber}
                onIonInput={(e) => setCnhNumber(maskCnh(String(e.detail.value ?? '')))}
              />
            </IonItem>
            <IonItem lines="none">
              <IonLabel>Status do veiculo</IonLabel>
              <span className="text-sm font-semibold">
                {user.vehicleStatus === 'active' ? 'Ativo' : 'Pendente'}
              </span>
            </IonItem>
            <IonItem lines="none">
              <IonLabel>CNH</IonLabel>
              <span className="text-sm font-semibold">
                {user.cnhStatus === 'valid' ? 'Valida' : 'Em analise'}
              </span>
            </IonItem>
          </>
        )}
      </IonList>

      <IonButton className="mt-6" expand="block" disabled={busy} onClick={handleSave}>
        Salvar perfil
      </IonButton>
      <IonButton className="mt-3" expand="block" fill="outline" color="danger" onClick={handleLogout}>
        Sair
      </IonButton>
      <IonLoading isOpen={busy} message="Salvando..." />
      <IonToast isOpen={Boolean(toast)} message={toast} color="success" duration={1800} onDidDismiss={() => setToast('')} />
      <IonToast isOpen={Boolean(error)} message={error} duration={2400} onDidDismiss={() => setError('')} />
    </div>
  );
}
