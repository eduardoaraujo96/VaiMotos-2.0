import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../types';
import {
  fetchRideMessages,
  insertRideMessage,
  markRideMessagesRead,
  subscribeToRideMessages,
} from '../services/supabaseService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import {
  sendRideChat,
  subscribeRideChat,
  type RideChatMessage,
} from '../services/rideSession';

function fromDatabaseRow(row: {
  id: string;
  ride_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}): RideChatMessage {
  return {
    id: row.id,
    rideId: row.ride_id,
    senderId: row.sender_id,
    senderName: '',
    senderRole: 'passenger',
    text: row.message,
    createdAt: row.created_at,
  };
}

export function useRideChat(rideId: string | undefined, user: User | null, isOpen = true) {
  const [messages, setMessages] = useState<RideChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mergeMessages = useCallback((incoming: RideChatMessage[]) => {
    setMessages((current) => {
      const byId = new Map(current.map((message) => [message.id, message]));
      incoming.forEach((message) => byId.set(message.id, message));
      return [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    });
  }, []);

  const addMessage = useCallback((message: RideChatMessage) => {
    mergeMessages([message]);
  }, [mergeMessages]);

  useEffect(() => {
    if (!rideId || !user) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!isOpen) return;

    let cancelled = false;
    setMessages([]);
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      const unsubscribe = subscribeRideChat(rideId, (next) => {
        if (!cancelled) mergeMessages(next);
      });
      setLoading(false);
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }

    const refresh = async () => {
      const result = await fetchRideMessages(rideId);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error.message);
        setLoading(false);
        return;
      }
      mergeMessages(result.data.map(fromDatabaseRow));
      setLoading(false);
      setError(null);
      if (document.visibilityState === 'visible') {
        const readResult = await markRideMessagesRead(rideId, user.id);
        if (cancelled) return;
        if (!readResult.ok) setError(readResult.error.message);
      }
    };

    const unsubscribe = subscribeToRideMessages(
      rideId,
      (row) => {
        if (cancelled) return;
        addMessage(fromDatabaseRow(row));
        if (document.visibilityState === 'visible') {
          void markRideMessagesRead(rideId, user.id).then((result) => {
            if (cancelled || result.ok) return;
            setError(result.error.message);
          });
        }
      },
      () => {
        void refresh();
      },
      (message) => {
        if (!cancelled) setError(message);
      }
    );
    const onResume = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', onResume);
    document.addEventListener('visibilitychange', onResume);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    void refresh();

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('online', onResume);
      document.removeEventListener('visibilitychange', onResume);
      window.clearInterval(timer);
    };
  }, [addMessage, isOpen, mergeMessages, rideId, user]);

  const send = useCallback(async (text: string): Promise<boolean> => {
    const message = text.trim();
    if (!rideId || !user || !message || sendingRef.current) return false;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    let sent = false;
    try {
      if (isSupabaseConfigured) {
        const result = await insertRideMessage(rideId, user.id, message);
        if (!result.ok) {
          if (mounted.current) setError(result.error.message);
          return false;
        }
        if (mounted.current) addMessage(fromDatabaseRow(result.data));
        sent = true;
      } else {
        const result = sendRideChat({
          rideId,
          senderId: user.id,
          senderName: user.name,
          senderRole: user.role,
          text: message,
        });
        if (result) {
          addMessage(result);
          sent = true;
        }
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a mensagem.');
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
    return sent;
  }, [addMessage, rideId, user]);

  return { messages, send, loading, sending, error };
}
