import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon, IonInput } from '@ionic/react';
import { sendOutline } from 'ionicons/icons';
import type { User } from '../../types';
import type { RideChatMessage } from '../../services/rideSession';

interface RideChatPanelProps {
  messages: RideChatMessage[];
  user: User;
  onSend: (text: string) => void;
}

export function RideChatPanel({ messages, user, onSend }: RideChatPanelProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ion-color-medium)' }}>
        Chat da corrida
      </div>
      <p className="mb-2 text-[11px]" style={{ color: 'var(--ion-color-medium)' }}>
        Use para pontos de referencia e orientacao de embarque. As mensagens existem so nesta sessao e somem ao finalizar.
      </p>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {messages.length === 0 && (
          <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--ion-background-color)' }}>
            Nenhuma mensagem ainda. Ex.: "Estou na praca, perto da igreja."
          </div>
        )}
        {messages.map((item) => {
          const mine = item.senderId === user.id;
          return (
            <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                style={{
                  background: mine ? 'rgba(255,107,0,0.16)' : 'var(--ion-background-color)',
                }}
              >
                <div className="text-[10px] font-bold" style={{ color: 'var(--ion-color-medium)' }}>
                  {mine ? 'Voce' : item.senderName}
                </div>
                <div>{item.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <IonInput
          className="rounded-2xl px-3"
          style={{ '--background': 'var(--ion-background-color)' }}
          placeholder="Ponto de referencia..."
          value={draft}
          maxlength={280}
          onIonInput={(event) => setDraft(String(event.detail.value ?? ''))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
        />
        <IonButton onClick={submit} disabled={!draft.trim()}>
          <IonIcon icon={sendOutline} />
        </IonButton>
      </div>
    </div>
  );
}
