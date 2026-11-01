import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../types';
import { fetchUnreadRideMessageCount, subscribeToUnreadRideMessages } from '../services/supabaseService';
import { isSupabaseConfigured } from '../services/supabaseClient';

export function useUnreadRideMessages(user: User | null) {
  const [unreadCount, setUnreadCount] = useState(0);
  const requestId = useRef(0);
  const activeUserId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setUnreadCount(0);
      return;
    }
    const request = ++requestId.current;
    const result = await fetchUnreadRideMessageCount();
    if (request !== requestId.current) return;
    if (!result.ok) {
      console.error('Unable to refresh unread ride messages:', result.error.message);
      return;
    }
    setUnreadCount(result.data);
  }, [user]);

  useEffect(() => {
    if (!user) {
      activeUserId.current = null;
      setUnreadCount(0);
      return;
    }
    if (activeUserId.current !== user.id) {
      activeUserId.current = user.id;
      setUnreadCount(0);
    }
    void refresh();
    const unsubscribe = subscribeToUnreadRideMessages(() => void refresh());
    const onResume = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', onResume);
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);
    const timer = window.setInterval(onResume, 30_000);
    return () => {
      requestId.current++;
      unsubscribe();
      window.removeEventListener('online', onResume);
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
      window.clearInterval(timer);
    };
  }, [refresh, user]);

  return { unreadCount, refresh };
}
