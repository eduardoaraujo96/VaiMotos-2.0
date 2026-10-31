import { useCallback, useEffect, useState } from 'react';
import type { User } from '../types';
import {
  clearRideSession,
  sendRideChat,
  subscribeRideChat,
  type RideChatMessage,
} from '../services/rideSession';

export function useRideChat(rideId: string | undefined, user: User | null) {
  const [messages, setMessages] = useState<RideChatMessage[]>([]);

  useEffect(() => {
    if (!rideId) {
      setMessages([]);
      return;
    }
    return subscribeRideChat(rideId, setMessages);
  }, [rideId]);

  const send = useCallback(
    (text: string) => {
      if (!rideId || !user) return null;
      return sendRideChat({
        rideId,
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        text,
      });
    },
    [rideId, user]
  );

  const discard = useCallback(() => {
    if (rideId) clearRideSession(rideId);
  }, [rideId]);

  return { messages, send, discard };
}
