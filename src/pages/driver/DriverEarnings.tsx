import { useCallback, useEffect, useRef, useState } from 'react';
import { IonButton, IonContent, IonHeader, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchEarningsSummary, subscribeToDriverHistory } from '../../services/driver';
import type { DriverEarningsSummary } from '../../types/database';
import { formatBRL } from '../../utils/format';

const EMPTY_SUMMARY: DriverEarningsSummary = {
  today_amount: 0,
  week_amount: 0,
  month_amount: 0,
  total_amount: 0,
  today_rides: 0,
  week_rides: 0,
  month_rides: 0,
  total_rides: 0,
  average_amount: 0,
};

export function DriverEarnings() {
  const { user } = useAuth();
  const history = useHistory();
  const [summary, setSummary] = useState<DriverEarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchEarningsSummary();
      if (!active.current) return;
      setSummary(next);
      setError(null);
    } catch (cause) {
      if (!active.current) return;
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar seus ganhos.');
    } finally {
      if (active.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'driver') {
      setLoading(false);
      return;
    }
    active.current = true;
    void refresh();
    const unsubscribe = subscribeToDriverHistory(user.id, () => void refresh());
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active.current = false;
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, user]);

  const data = summary ?? EMPTY_SUMMARY;
  const statCards = [
    { title: 'Esta semana', amount: data.week_amount, rides: data.week_rides },
    { title: 'Este mês', amount: data.month_amount, rides: data.month_rides },
    { title: 'Total recebido', amount: data.total_amount, rides: data.total_rides },
    { title: 'Média por corrida', amount: data.average_amount, rides: null },
  ];

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Ganhos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && !summary ? (
          <div className="flex justify-center p-8"><IonSpinner name="crescent" /></div>
        ) : error && !summary ? (
          <section className="rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
            <p role="alert">{error}</p>
            <IonButton fill="clear" onClick={() => void refresh()}>Tentar novamente</IonButton>
          </section>
        ) : (
          <>
            <section className="rounded-3xl p-5 text-white" style={{ background: 'linear-gradient(135deg, var(--ion-color-primary), #0E9F50)' }}>
              <div className="text-sm font-medium opacity-90">Hoje</div>
              <div className="mt-1 text-4xl font-extrabold">{formatBRL(data.today_amount)}</div>
              <div className="mt-2 text-sm">{data.today_rides} corridas concluídas</div>
            </section>
            {error && <p className="mt-2 text-sm text-[var(--ion-color-danger)]" role="alert">{error}</p>}
            <section className="mt-4 grid grid-cols-2 gap-3">
              {statCards.map((item) => (
                <div key={item.title} className="rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
                  <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>{item.title}</div>
                  <div className="mt-1 text-xl font-bold">{formatBRL(item.amount)}</div>
                  {item.rides !== null && (
                    <div className="mt-1 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                      {item.rides} {item.rides === 1 ? 'corrida' : 'corridas'}
                    </div>
                  )}
                </div>
              ))}
            </section>
            <IonButton className="mt-4" expand="block" fill="outline" onClick={() => history.push('/driver/history')}>
              Ver histórico de corridas
            </IonButton>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
