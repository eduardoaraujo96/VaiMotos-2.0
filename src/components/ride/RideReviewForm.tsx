import { useCallback, useEffect, useRef, useState } from 'react';
import { IonButton, IonSpinner, IonTextarea } from '@ionic/react';
import type { RideReview, User } from '../../types';
import { createRideReview, fetchRideReviewList, subscribeToRideReviewList } from '../../services/driver';

interface RideReviewFormProps {
  rideId: string;
  reviewer: User;
  reviewedUser: User;
}

export function RideReviewForm({ rideId, reviewer, reviewedUser }: RideReviewFormProps) {
  const [reviews, setReviews] = useState<RideReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const current = await fetchRideReviewList(rideId);
      if (!active.current) return;
      setReviews(current);
      setError(null);
    } catch (cause) {
      if (!active.current) return;
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as avaliações.');
    } finally {
      if (active.current) setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    active.current = true;
    void refresh();
    const unsubscribe = subscribeToRideReviewList(rideId, () => void refresh());
    return () => {
      active.current = false;
      unsubscribe();
    };
  }, [refresh, rideId]);

  const ownReview = reviews.find((review) => review.reviewerId === reviewer.id);

  const submit = async () => {
    if (sending || ownReview || !Number.isInteger(rating) || rating < 1 || rating > 5) return;
    setSending(true);
    setError(null);
    try {
      const created = await createRideReview({
        rideId,
        reviewerId: reviewer.id,
        reviewedUserId: reviewedUser.id,
        rating,
        comment,
      });
      if (!active.current) return;
      setReviews((current) => current.some((review) => review.id === created.id) ? current : [...current, created]);
      setComment('');
    } catch (cause) {
      if (!active.current) return;
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a avaliação.');
    } finally {
      if (active.current) setSending(false);
    }
  };

  return (
    <section className="mt-3 rounded-2xl p-4" style={{ background: 'var(--ion-card-background)' }}>
      <h3 className="font-bold">Avaliação</h3>
      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-sm"><IonSpinner name="crescent" /> Carregando avaliações...</div>
      ) : ownReview ? (
        <div className="mt-2 text-sm">
          <div aria-label={`${ownReview.rating} de 5 estrelas`} className="text-lg text-[var(--ion-color-primary)]">
            {'★'.repeat(ownReview.rating)}{'☆'.repeat(5 - ownReview.rating)}
          </div>
          <p>{ownReview.comment || 'Você avaliou esta corrida.'}</p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            Como foi sua experiência com {reviewedUser.name}?
          </p>
          <div className="mt-2 flex gap-1" role="group" aria-label="Nota da corrida">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} estrela${value > 1 ? 's' : ''}`}
                aria-pressed={rating === value}
                className="text-2xl text-[var(--ion-color-primary)]"
                onClick={() => setRating(value)}
              >
                {value <= rating ? '★' : '☆'}
              </button>
            ))}
          </div>
          <IonTextarea
            className="mt-2 rounded-xl px-3"
            style={{ background: 'var(--ion-background-color)' }}
            label="Comentário (opcional)"
            labelPlacement="stacked"
            maxlength={1000}
            autoGrow
            value={comment}
            onIonInput={(event) => setComment(event.detail.value ?? '')}
          />
          <IonButton className="mt-2" expand="block" disabled={sending || loading} onClick={() => void submit()}>
            {sending ? <IonSpinner name="crescent" /> : 'Enviar avaliação'}
          </IonButton>
        </>
      )}
      {error && <p className="mt-2 text-sm text-[var(--ion-color-danger)]" role="alert">{error}</p>}
    </section>
  );
}
