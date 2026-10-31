import { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { closeOutline, lockClosedOutline } from 'ionicons/icons';
import type { Ride } from '../../types';
import { formatBRL } from '../../utils/format';

interface BidPriceModalProps {
  ride: Ride | null;
  isOpen: boolean;
  submitting?: boolean;
  onDismiss: () => void;
  onSubmit: (amount: number, etaMinutes: number) => void;
}

export function BidPriceModal({ ride, isOpen, submitting = false, onDismiss, onSubmit }: BidPriceModalProps) {
  const [amount, setAmount] = useState('');
  const [eta, setEta] = useState('');

  useEffect(() => {
    if (ride && isOpen) {
      setAmount(ride.estimatedPrice.toFixed(2).replace('.', ','));
      setEta(String(Math.max(4, Math.round(ride.estimatedMinutes * 0.35))));
    }
  }, [ride, isOpen]);

  const parsedAmount = Number(amount.replace(',', '.'));
  const parsedEta = Number(eta);
  const valid = parsedAmount > 0 && parsedEta > 0;

  if (!ride) return null;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonTitle>Sua oferta</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="mb-4 rounded-2xl p-4" style={{ background: 'var(--ion-background-color)' }}>
          <div className="text-sm font-bold">{ride.passengerName}</div>
          <div className="mt-2 text-sm">
            {ride.origin.address} para {ride.destination.address}
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
            {ride.distanceKm.toFixed(1)} km (aprox., linha reta) · {ride.estimatedMinutes} min estimados
          </div>
        </div>

        <div
          className="mb-4 flex items-start gap-2 rounded-2xl p-3 text-xs"
          style={{ background: 'rgba(255,107,0,0.08)', color: 'var(--ion-text-color)' }}
        >
          <IonIcon icon={lockClosedOutline} color="primary" className="mt-0.5" />
          <span>
            Leilao cego. Voce nao ve as ofertas dos outros mototaxistas. So o passageiro compara os precos.
          </span>
        </div>

        <IonItem className="rounded-2xl mb-3" lines="none">
          <IonInput
            type="text"
            inputMode="decimal"
            label="Seu preco (R$)"
            labelPlacement="stacked"
            value={amount}
            onIonInput={(e) => setAmount(String(e.detail.value ?? ''))}
          />
        </IonItem>
        <IonItem className="rounded-2xl mb-4" lines="none">
          <IonInput
            type="number"
            inputMode="numeric"
            label="Minutos ate o passageiro"
            labelPlacement="stacked"
            value={eta}
            onIonInput={(e) => setEta(String(e.detail.value ?? ''))}
          />
        </IonItem>

        <IonButton
          expand="block"
          size="large"
          disabled={!valid || submitting}
          onClick={() => onSubmit(parsedAmount, parsedEta)}
        >
          {submitting ? 'Enviando...' : `Enviar oferta ${valid ? formatBRL(parsedAmount) : ''}`}
        </IonButton>
      </IonContent>
    </IonModal>
  );
}
