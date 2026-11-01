import { useCallback, useEffect, useState } from 'react';
import { IonButton, IonContent, IonHeader, IonPage, IonSpinner, IonTitle, IonToast, IonToolbar } from '@ionic/react';
import { fetchPendingDrivers, isDriverApprovalAdmin, reviewDriverApproval } from '../../services/driver';
import type { PendingDriverApprovalRow } from '../../types/database';

export function DriverApprovals() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [drivers, setDrivers] = useState<PendingDriverApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyDriver, setBusyDriver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const canReview = await isDriverApprovalAdmin();
      setAuthorized(canReview);
      if (!canReview) {
        setDrivers([]);
        return;
      }
      setDrivers(await fetchPendingDrivers());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as aprovações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (driver: PendingDriverApprovalRow, status: 'approved' | 'rejected') => {
    if (busyDriver) return;
    setBusyDriver(driver.id);
    setError(null);
    try {
      await reviewDriverApproval(driver.id, status);
      setDrivers((current) => current.filter((item) => item.id !== driver.id));
      setToast(status === 'approved' ? `${driver.full_name} aprovado.` : `${driver.full_name} rejeitado.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o cadastro.');
    } finally {
      setBusyDriver(null);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Aprovação de mototaxistas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading ? (
          <div className="flex justify-center p-8"><IonSpinner name="crescent" /></div>
        ) : authorized === false ? (
          <div className="rounded-2xl p-4 text-sm" style={{ background: 'var(--ion-card-background)' }}>
            Esta conta não está autorizada como Desenvolvedor para aprovar cadastros.
          </div>
        ) : (
          <>
            <p className="text-sm" style={{ color: 'var(--ion-color-medium)' }}>
              Analise os dados do veículo e decida quais motoristas podem acessar o radar.
            </p>
            {drivers.length === 0 && !error && (
              <p className="mt-4 text-sm" style={{ color: 'var(--ion-color-medium)' }}>Nenhum cadastro pendente.</p>
            )}
            <div className="mt-3 space-y-3">
              {drivers.map((driver) => (
                <article key={driver.id} className="rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
                  <div className="flex items-center gap-3">
                    {driver.avatar_url ? (
                      <img src={driver.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ion-background-color)] font-bold">
                        {driver.full_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate font-bold">{driver.full_name}</h2>
                      <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                        Cadastro em {new Date(driver.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div>Telefone: {driver.phone || 'Não informado'}</div>
                    <div>Moto: {driver.vehicle_model || 'Não informada'}{driver.vehicle_color ? ` · ${driver.vehicle_color}` : ''}</div>
                    <div>Placa: {driver.plate || 'Não informada'}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <IonButton
                      color="success"
                      disabled={Boolean(busyDriver)}
                      onClick={() => void decide(driver, 'approved')}
                    >
                      {busyDriver === driver.id ? <IonSpinner name="crescent" /> : 'Aprovar'}
                    </IonButton>
                    <IonButton
                      color="medium"
                      fill="outline"
                      disabled={Boolean(busyDriver)}
                      onClick={() => void decide(driver, 'rejected')}
                    >
                      Rejeitar
                    </IonButton>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {error && <p className="mt-3 text-sm text-[var(--ion-color-danger)]" role="alert">{error}</p>}
        {!loading && authorized && (
          <IonButton className="mt-3" expand="block" fill="outline" onClick={() => void load()}>Atualizar lista</IonButton>
        )}
        <IonToast isOpen={Boolean(toast)} message={toast} duration={2400} onDidDismiss={() => setToast('')} />
      </IonContent>
    </IonPage>
  );
}
