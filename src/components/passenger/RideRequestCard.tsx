import { IonButton, IonIcon, IonInput, IonItem, IonLabel, IonSelect, IonSelectOption, IonSpinner } from '@ionic/react';
import { checkmarkCircleOutline, chevronDownOutline, chevronUpOutline, flashOutline, locateOutline, navigateOutline } from 'ionicons/icons';
import type { LocationPoint, RidePaymentMethod } from '../../types';
import { PlaceSearch } from './PlaceSearch';

interface RideRequestCardProps {
  origin: string;
  destination: string;
  onOriginFocus?: () => void;
  onDestinationFocus?: () => void;
  onUseGps?: () => void;
  onConfirmPickup?: () => void;
  onRequest: () => void;
  estimatedPrice?: number;
  estimatedMinutes?: number;
  approximateDistance?: string;
  canRequest?: boolean;
  busy?: boolean;
  gpsLoading?: boolean;
  pickupConfirmed?: boolean;
  activeField?: 'origin' | 'destination';
  paymentMethod: RidePaymentMethod;
  onPaymentMethodChange: (method: RidePaymentMethod) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  currentLocation?: { lat: number; lng: number } | null;
  onPlaceSelect: (point: LocationPoint) => void;
}

export function RideRequestCard({
  origin,
  destination,
  onOriginFocus,
  onDestinationFocus,
  onUseGps,
  onConfirmPickup,
  onRequest,
  estimatedPrice,
  estimatedMinutes,
  approximateDistance,
  canRequest,
  busy = false,
  gpsLoading = false,
  pickupConfirmed = false,
  activeField = 'origin',
  paymentMethod,
  onPaymentMethodChange,
  expanded,
  onExpandedChange,
  currentLocation,
  onPlaceSelect,
}: RideRequestCardProps) {
  const requestEnabled = (canRequest ?? Boolean(destination.trim())) && !busy;

  return (
    <div
      className={`vaimoto-ride-sheet rounded-3xl safe-bottom ${expanded ? 'vaimoto-ride-sheet--expanded' : 'vaimoto-ride-sheet--compact'}`}
      style={{
        background: 'var(--ion-card-background)',
        boxShadow: '0 -12px 40px rgba(15,15,20,0.18)',
      }}
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
          aria-label={expanded ? 'Painel de destino aberto' : 'Painel de destino fechado'}
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="text-sm font-bold">Pra onde vamos?</div>
          <div className="truncate text-xs" style={{ color: 'var(--ion-color-medium)' }}>
            {destination || 'Escolha o embarque e o destino'}
          </div>
        </button>
        <IonButton
          fill={expanded ? 'clear' : 'solid'}
          size="small"
          aria-label={expanded ? 'Fechar painel' : 'Abrir painel'}
          onClick={() => onExpandedChange(!expanded)}
        >
          <IonIcon slot="start" icon={expanded ? chevronDownOutline : chevronUpOutline} />
          {expanded ? 'Fechar' : 'Abrir'}
        </IonButton>
      </div>

      {expanded && (
      <div className="vaimoto-ride-sheet__body">
      <PlaceSearch currentLocation={currentLocation} onSelect={onPlaceSelect} />
      <IonItem
        lines="none"
        className="rounded-2xl mb-2"
        style={{
          '--background': 'var(--ion-background-color)',
          boxShadow: activeField === 'origin' ? 'inset 0 0 0 1px var(--ion-color-primary)' : undefined,
        }}
      >
        <IonIcon icon={locateOutline} slot="start" color="primary" />
        <IonInput
          value={origin}
          placeholder="Ponto de embarque"
          readonly
          onIonFocus={() => {
            onExpandedChange(true);
            onOriginFocus?.();
          }}
        />
        {onUseGps && (
          <IonButton slot="end" fill="clear" onClick={onUseGps} disabled={gpsLoading}>
            {gpsLoading ? <IonSpinner name="crescent" /> : <IonIcon icon={locateOutline} color="primary" />}
          </IonButton>
        )}
      </IonItem>
      <IonItem
        lines="none"
        className="rounded-2xl mb-3"
        style={{
          '--background': 'var(--ion-background-color)',
          boxShadow: activeField === 'destination' ? 'inset 0 0 0 1px var(--ion-color-secondary)' : undefined,
        }}
      >
        <IonIcon icon={navigateOutline} slot="start" color="secondary" />
        <IonInput
          value={destination}
          placeholder="Destino"
          readonly
          onIonFocus={() => {
            onExpandedChange(true);
            onDestinationFocus?.();
          }}
        />
      </IonItem>
      <p className="mb-3 px-1 text-[11px]" style={{ color: 'var(--ion-color-medium)' }}>
        Busque pelo nome ou escolha o local diretamente no mapa. A área inicial é Matões — MA.
      </p>
      {estimatedPrice !== undefined && (
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-sm" style={{ color: 'var(--ion-color-medium)' }}>
            {estimatedMinutes} min estimados
            {approximateDistance ? ` · ${approximateDistance}` : ''}
          </span>
          <span className="text-lg font-extrabold">R$ {estimatedPrice.toFixed(2).replace('.', ',')}</span>
        </div>
      )}
      {approximateDistance && estimatedPrice === undefined && (
        <div className="mb-3 px-1 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
          {approximateDistance}
        </div>
      )}
      <IonItem lines="none" className="mb-2 rounded-2xl" style={{ '--background': 'var(--ion-background-color)' }}>
        <IonLabel>Pagamento</IonLabel>
        <IonSelect
          value={paymentMethod}
          aria-label="Forma de pagamento"
          onIonChange={(event) => onPaymentMethodChange(event.detail.value as RidePaymentMethod)}
        >
          <IonSelectOption value="to_agree">A combinar</IonSelectOption>
          <IonSelectOption value="cash">Dinheiro</IonSelectOption>
          <IonSelectOption value="pix">Pix</IonSelectOption>
        </IonSelect>
      </IonItem>
      {onConfirmPickup && !pickupConfirmed && (
        <IonButton expand="block" fill="outline" className="mb-2" onClick={onConfirmPickup} disabled={!origin.trim()}>
          <IonIcon icon={checkmarkCircleOutline} slot="start" />
          Confirmar embarque
        </IonButton>
      )}
      {pickupConfirmed && (
        <div className="mb-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'rgba(var(--vaimoto-primary-rgb),0.12)', color: 'var(--vaimoto-primary)' }}>
          Embarque confirmado
        </div>
      )}
      <IonButton expand="block" size="large" onClick={onRequest} disabled={!requestEnabled}>
        <IonIcon icon={flashOutline} slot="start" />
        {busy ? 'Solicitando...' : 'Pedir Mototaxi'}
      </IonButton>
      </div>
      )}
    </div>
  );
}
