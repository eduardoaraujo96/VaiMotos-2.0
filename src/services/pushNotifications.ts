import { Capacitor } from '@capacitor/core';
import { PushNotifications, type ActionPerformed, type PushNotificationSchema } from '@capacitor/push-notifications';
import type { PluginListenerHandle } from '@capacitor/core';
import { getSupabaseClient } from './supabaseClient';

export type PushPermission = 'granted' | 'denied' | 'unsupported';

const isAndroidApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

function getDeviceId(): string {
  const key = 'vaimoto.push_device_id';
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const deviceId = crypto.randomUUID();
  localStorage.setItem(key, deviceId);
  return deviceId;
}

function rideIdFromNotification(notification: PushNotificationSchema): string | null {
  const rideId = notification.data?.ride_id;
  return typeof rideId === 'string' && rideId.length > 0 ? rideId : null;
}

async function savePushToken(driverId: string, token: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase não está configurado para registrar notificações.');

  const { error } = await client.from('driver_push_tokens').upsert(
    { driver_id: driverId, device_id: getDeviceId(), token, platform: 'android' },
    { onConflict: 'driver_id,device_id' }
  );
  if (error) throw error;
}

async function removeDeliveredRideNotification(rideId: string): Promise<void> {
  const { notifications } = await PushNotifications.getDeliveredNotifications();
  const matching = notifications.filter((notification) => notification.tag === `ride-${rideId}`);
  if (matching.length > 0) {
    await PushNotifications.removeDeliveredNotifications({ notifications: matching });
  }
}

export async function requestDriverPushPermission(): Promise<PushPermission> {
  if (!isAndroidApp()) return 'unsupported';

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive !== 'granted') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return 'denied';

  await PushNotifications.createChannel({
    id: 'rides',
    name: 'Solicitações de corrida',
    description: 'Novas solicitações e cancelamentos de corridas',
    importance: 4,
    vibration: true,
  });
  await PushNotifications.register();
  return 'granted';
}

export async function setupDriverPushNotifications(
  driverId: string,
  onNotificationAction: (notification: ActionPerformed) => void
): Promise<() => void> {
  if (!isAndroidApp()) return () => undefined;

  let active = true;
  const handles: PluginListenerHandle[] = [];
  const dispose = () => {
    active = false;
    handles.forEach((handle) => void handle.remove());
  };
  const listenerPromises = [
    PushNotifications.addListener('registration', ({ value }) => {
      if (active) {
        void savePushToken(driverId, value).catch((error: unknown) => {
          console.error('Não foi possível registrar o token de notificações:', error);
        });
      }
    }),
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Falha ao registrar notificações push:', error.error);
    }),
    PushNotifications.addListener('pushNotificationActionPerformed', onNotificationAction),
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const rideId = rideIdFromNotification(notification);
      if (notification.data?.action === 'cancelled' && rideId) {
        void removeDeliveredRideNotification(rideId).catch((error: unknown) => {
          console.error('Não foi possível remover o alerta cancelado:', error);
        });
      }
    }),
  ];

  const resolvedHandles = await Promise.all(listenerPromises);
  handles.push(...resolvedHandles);

  try {
    const permission = await PushNotifications.checkPermissions();
    if (active && permission.receive === 'granted') {
      await PushNotifications.createChannel({
        id: 'rides',
        name: 'Solicitações de corrida',
        description: 'Novas solicitações e cancelamentos de corridas',
        importance: 4,
        vibration: true,
      });
      await PushNotifications.register();
    }
  } catch (error) {
    dispose();
    throw error;
  }

  return dispose;
}

export async function clearDriverPushRegistration(driverId: string): Promise<void> {
  if (!isAndroidApp()) return;

  const client = getSupabaseClient();
  let removalError: Error | null = null;
  if (client) {
    const { error } = await client
      .from('driver_push_tokens')
      .delete()
      .eq('driver_id', driverId)
      .eq('device_id', getDeviceId());
    if (error) removalError = error;
  }
  try {
    await PushNotifications.unregister();
  } catch (error) {
    if (!removalError) {
      removalError = error instanceof Error ? error : new Error('Falha ao cancelar o registro push do dispositivo.');
    }
  }
  if (removalError) throw removalError;
}
