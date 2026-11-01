import { useCallback, useEffect, useRef, useState } from 'react';
import { IonButton, IonContent, IonHeader, IonPage, IonSegment, IonSegmentButton, IonLabel, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchDriverHistoryPage, subscribeToDriverHistory, type DriverRideRecord } from '../../services/driver';
import { formatBRL } from '../../utils/format';
import { getRideDisplayStatus, paymentMethodLabel, rideStatusLabel } from '../../utils/rideStatus';

type HistoryFilter = 'all' | 'completed' | 'cancelled';
const PAGE_SIZE = 20;

export function DriverHistory() {
  const { user } = useAuth();
  const history = useHistory();
  const [records, setRecords] = useState<DriverRideRecord[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recordsRef = useRef(records);
  const requestId = useRef(0);
  recordsRef.current = records;

  const loadPage = useCallback(async (reset: boolean) => {
    if (!user || user.role !== 'driver') {
      setLoading(false);
      return;
    }
    const currentRequest = ++requestId.current;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const offset = reset ? 0 : recordsRef.current.length;
      const page = await fetchDriverHistoryPage(user.id, offset, PAGE_SIZE);
      if (currentRequest !== requestId.current) return;
      const next = reset ? page : [...recordsRef.current, ...page];
      recordsRef.current = next;
      setRecords(next);
      setHasMore(page.length === PAGE_SIZE);
      setError(null);
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico.');
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [user]);

  useEffect(() => {
    void loadPage(true);
    if (!user || user.role !== 'driver') return;
    const unsubscribe = subscribeToDriverHistory(user.id, () => void loadPage(true));
    const onFocus = () => void loadPage(true);
    window.addEventListener('focus', onFocus);
    return () => {
      requestId.current++;
      unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [loadPage, user]);

  const visibleRecords = records.filter(({ ride }) => {
    if (filter === 'all') return true;
    return ride.status === filter;
  });

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Histórico de corridas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonSegment value={filter} onIonChange={(event) => setFilter((event.detail.value as HistoryFilter) ?? 'all')}>
          <IonSegmentButton value="all"><IonLabel>Todas</IonLabel></IonSegmentButton>
          <IonSegmentButton value="completed"><IonLabel>Concluídas</IonLabel></IonSegmentButton>
          <IonSegmentButton value="cancelled"><IonLabel>Canceladas</IonLabel></IonSegmentButton>
        </IonSegment>

        {loading && records.length === 0 && <div className="flex justify-center p-8"><IonSpinner name="crescent" /></div>}
        {error && <div className="my-3 text-sm text-[var(--ion-color-danger)]" role="alert">{error}</div>}
        {!loading && !error && visibleRecords.length === 0 && (
          <p className="mt-4 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            {records.length === 0 ? 'Nenhuma corrida no histórico.' : 'Nenhuma corrida nesta categoria.'}
          </p>
        )}

        <div className="mt-3 space-y-3">
          {visibleRecords.map(({ ride, passengerAvatar, reviews }) => {
            const review = reviews.find((item) => item.reviewedUserId === user?.id);
            const status = getRideDisplayStatus(ride);
            return (
              <button
                key={ride.id}
                type="button"
                className="block w-full rounded-2xl p-4 text-left"
                style={{ background: 'var(--ion-card-background)' }}
                onClick={() => history.push(`/corrida/${ride.id}`)}
              >
                <div className="flex items-center gap-3">
                  {passengerAvatar ? (
                    <img src={passengerAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ion-background-color)] text-sm font-bold">
                      {ride.passengerName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{ride.passengerName || 'Passageiro'}</div>
                    <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                      {new Date(ride.createdAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {ride.finalPrice != null ? formatBRL(ride.finalPrice) : 'Valor indisponível'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>{rideStatusLabel(status)}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <div><span className="font-medium">Embarque:</span> {ride.origin.address || 'Não informado'}</div>
                  <div><span className="font-medium">Destino:</span> {ride.destination.address || 'Não informado'}</div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                  <span>{paymentMethodLabel(ride.paymentMethod)}</span>
                  {review ? <span>Avaliação recebida: {'★'.repeat(review.rating)} ({review.rating}/5)</span> : <span>Sem avaliação</span>}
                </div>
              </button>
            );
          })}
        </div>

        {hasMore && !loading && records.length > 0 && (
          <IonButton className="mt-3" expand="block" fill="outline" disabled={loadingMore} onClick={() => void loadPage(false)}>
            {loadingMore ? <IonSpinner name="crescent" /> : 'Carregar mais'}
          </IonButton>
        )}
        {error && records.length === 0 && (
          <IonButton fill="clear" onClick={() => void loadPage(true)}>Tentar novamente</IonButton>
        )}
      </IonContent>
    </IonPage>
  );
}
