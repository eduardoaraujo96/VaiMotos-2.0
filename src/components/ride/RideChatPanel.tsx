import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon, IonInput, IonSpinner } from '@ionic/react';
import { sendOutline } from 'ionicons/icons';
import type { User } from '../../types';
import type { RideChatMessage } from '../../services/rideSession';
import { initials } from '../../utils/format';

interface RideChatPanelProps {
  messages: RideChatMessage[];
  user: User;
  otherParticipantName: string;
  otherParticipantPhoto?: string;
  loading: boolean;
  sending: boolean;
  error: string | null;
  onSend: (text: string) => Promise<boolean>;
}

export function RideChatPanel({
  messages,
  user,
  otherParticipantName,
  otherParticipantPhoto,
  loading,
  sending,
  error,
  onSend,
}: RideChatPanelProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    void onSend(text).then((sent) => {
      if (sent) setDraft((current) => current === text ? '' : current);
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--ion-background-color)] text-xs font-bold">
          {otherParticipantPhoto ? (
            <img src={otherParticipantPhoto} alt={otherParticipantName} className="h-full w-full object-cover" />
          ) : (
            initials(otherParticipantName)
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{otherParticipantName}</div>
          <div className="text-[10px]" style={{ color: 'var(--ion-color-medium)' }}>Chat da corrida</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {loading && messages.length === 0 && (
          <div className="flex items-center gap-2 py-2 text-xs" style={{ color: 'var(--ion-color-medium)' }}>
            <IonSpinner name="crescent" /> Carregando mensagens...
          </div>
        )}
        {messages.length === 0 && (
          <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--ion-background-color)' }}>
            Nenhuma mensagem nesta conversa ainda.
          </div>
        )}
        {messages.map((item) => {
          const mine = item.senderId === user.id;
          const createdAt = new Date(item.createdAt);
          const time = Number.isNaN(createdAt.getTime())
            ? ''
            : createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
                style={{
                  background: mine ? 'rgba(21,209,100,0.16)' : 'var(--ion-background-color)',
                }}
              >
                <div className="text-[10px] font-bold" style={{ color: 'var(--ion-color-medium)' }}>
                  {mine ? 'Você' : otherParticipantName}
                </div>
                <div className="break-words">{item.text}</div>
                <div className="mt-1 text-right text-[9px]" style={{ color: 'var(--ion-color-medium)' }}>
                  {time}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {error && <div className="mt-1 text-xs text-[var(--ion-color-danger)]">{error}</div>}
      <div className="mt-2 flex items-center gap-2">
        <IonInput
          className="rounded-2xl px-3"
          style={{ '--background': 'var(--ion-background-color)' }}
          placeholder="Ponto de referencia..."
          value={draft}
          maxlength={280}
          onIonInput={(event) => setDraft(String(event.detail.value ?? ''))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !sending) submit();
          }}
        />
        <IonButton aria-label="Enviar mensagem" onClick={submit} disabled={!draft.trim() || sending || loading}>
          {sending ? <IonSpinner name="crescent" /> : <IonIcon icon={sendOutline} />}
        </IonButton>
      </div>
    </div>
  );
}
