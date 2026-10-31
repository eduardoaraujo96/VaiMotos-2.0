import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type GpsErrorCode =
  | 'permission_denied'
  | 'unavailable'
  | 'timeout'
  | 'offline'
  | 'insecure_context'
  | 'unknown';

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

export type GpsResult =
  | { ok: true; position: GpsPosition }
  | { ok: false; code: GpsErrorCode; message: string };

const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 10_000,
};

export function isSecureGeolocationContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

const INSECURE_MESSAGE =
  'GPS exige HTTPS ou localhost. Neste endereco HTTP, escolha o ponto tocando no mapa.';
const DENIED_MESSAGE = 'Permissao de localizacao negada. Selecione o ponto manualmente no mapa.';

function mapError(error: unknown): Extract<GpsResult, { ok: false }> {
  if (!isSecureGeolocationContext()) {
    return { ok: false, code: 'insecure_context', message: INSECURE_MESSAGE };
  }
  if (!navigator.onLine) {
    return { ok: false, code: 'offline', message: 'Sem conexao. Voce ainda pode escolher o ponto no mapa.' };
  }
  const code = typeof error === 'object' && error && 'code' in error ? Number((error as GeolocationPositionError).code) : 0;
  if (code === 1) {
    return { ok: false, code: 'permission_denied', message: DENIED_MESSAGE };
  }
  if (code === 2) {
    return { ok: false, code: 'unavailable', message: 'GPS indisponivel no momento. Selecione o ponto no mapa.' };
  }
  if (code === 3) {
    return { ok: false, code: 'timeout', message: 'Tempo esgotado ao obter o GPS. Tente de novo ou escolha no mapa.' };
  }
  const message = error instanceof Error ? error.message : 'Nao foi possivel obter a localizacao.';
  if (/denied|permission|secure|https|insecure/i.test(message)) {
    if (!isSecureGeolocationContext() || /secure|https|insecure/i.test(message)) {
      return { ok: false, code: 'insecure_context', message: INSECURE_MESSAGE };
    }
    return { ok: false, code: 'permission_denied', message: DENIED_MESSAGE };
  }
  return { ok: false, code: 'unknown', message };
}

function toPosition(coords: { latitude: number; longitude: number; accuracy?: number }, timestamp: number): GpsPosition {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    timestamp,
  };
}

function browserPosition(): Promise<GpsResult> {
  if (!navigator.geolocation) {
    return Promise.resolve({ ok: false, code: 'unavailable', message: 'Este navegador nao oferece GPS.' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, position: toPosition(pos.coords, pos.timestamp) }),
      (error) => resolve(mapError(error)),
      GPS_OPTIONS
    );
  });
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    if (!isSecureGeolocationContext() && !Capacitor.isNativePlatform()) {
      return false;
    }
    if (Capacitor.isNativePlatform()) {
      const status = await Geolocation.requestPermissions();
      return status.location === 'granted' || status.coarseLocation === 'granted';
    }
    if (!navigator.geolocation) return false;
    if (!navigator.permissions?.query) return true;
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return result.state !== 'denied';
  } catch {
    return true;
  }
}

export async function getCurrentPosition(): Promise<GpsResult> {
  if (!Capacitor.isNativePlatform() && !isSecureGeolocationContext()) {
    return { ok: false, code: 'insecure_context', message: INSECURE_MESSAGE };
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const pos = await Geolocation.getCurrentPosition(GPS_OPTIONS);
      return { ok: true, position: toPosition(pos.coords, pos.timestamp) };
    } catch (error) {
      return mapError(error);
    }
  }

  return browserPosition();
}

export async function watchPosition(onUpdate: (result: GpsResult) => void): Promise<() => void> {
  let cleared = false;
  let watchId: string | number | null = null;

  if (!Capacitor.isNativePlatform() && !isSecureGeolocationContext()) {
    onUpdate({ ok: false, code: 'insecure_context', message: INSECURE_MESSAGE });
    return () => undefined;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      watchId = await Geolocation.watchPosition(GPS_OPTIONS, (position, error) => {
        if (cleared) return;
        if (error || !position) {
          onUpdate(mapError(error ?? new Error('gps_unavailable')));
          return;
        }
        onUpdate({ ok: true, position: toPosition(position.coords, position.timestamp) });
      });
    } catch (error) {
      onUpdate(mapError(error));
      return () => undefined;
    }
  } else if (!navigator.geolocation) {
    onUpdate({ ok: false, code: 'unavailable', message: 'Este navegador nao oferece GPS.' });
    return () => undefined;
  } else {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!cleared) onUpdate({ ok: true, position: toPosition(pos.coords, pos.timestamp) });
      },
      (error) => {
        if (!cleared) onUpdate(mapError(error));
      },
      GPS_OPTIONS
    );
  }

  return () => {
    cleared = true;
    if (watchId === null) return;
    if (typeof watchId === 'string') {
      void Geolocation.clearWatch({ id: watchId });
      return;
    }
    navigator.geolocation.clearWatch(watchId);
  };
}
