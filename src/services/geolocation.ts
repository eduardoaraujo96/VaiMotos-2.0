import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type GpsErrorCode = 'permission_denied' | 'unavailable' | 'timeout' | 'offline' | 'unknown';

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

function mapError(error: unknown): Extract<GpsResult, { ok: false }> {
  if (!navigator.onLine) {
    return { ok: false, code: 'offline', message: 'Sem conexao. Voce ainda pode escolher o ponto no mapa.' };
  }
  const code = typeof error === 'object' && error && 'code' in error ? Number((error as GeolocationPositionError).code) : 0;
  if (code === 1) {
    return {
      ok: false,
      code: 'permission_denied',
      message: 'Permissao de localizacao negada. Selecione o ponto manualmente no mapa.',
    };
  }
  if (code === 2) {
    return { ok: false, code: 'unavailable', message: 'GPS indisponivel no momento. Selecione o ponto no mapa.' };
  }
  if (code === 3) {
    return { ok: false, code: 'timeout', message: 'Tempo esgotado ao obter o GPS. Tente de novo ou escolha no mapa.' };
  }
  const message = error instanceof Error ? error.message : 'Nao foi possivel obter a localizacao.';
  if (/denied|permission/i.test(message)) {
    return { ok: false, code: 'permission_denied', message: 'Permissao de localizacao negada. Selecione o ponto manualmente no mapa.' };
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

export async function requestLocationPermission(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const status = await Geolocation.requestPermissions();
      return status.location === 'granted' || status.coarseLocation === 'granted';
    }
    if (!navigator.geolocation) return false;
    if (!navigator.permissions?.query) return true;
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return result.state !== 'denied';
  } catch {
    return false;
  }
}

export async function getCurrentPosition(): Promise<GpsResult> {
  if (!navigator.onLine && !navigator.geolocation) {
    return { ok: false, code: 'offline', message: 'Sem conexao. Voce ainda pode escolher o ponto no mapa.' };
  }
  try {
    const pos = await Geolocation.getCurrentPosition(GPS_OPTIONS);
    return { ok: true, position: toPosition(pos.coords, pos.timestamp) };
  } catch (capacitorError) {
    if (!navigator.geolocation) return mapError(capacitorError);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ ok: true, position: toPosition(pos.coords, pos.timestamp) }),
        (error) => resolve(mapError(error)),
        GPS_OPTIONS
      );
    });
  }
}

export async function watchPosition(onUpdate: (result: GpsResult) => void): Promise<() => void> {
  let cleared = false;
  let watchId: string | number | null = null;

  try {
    watchId = await Geolocation.watchPosition(GPS_OPTIONS, (position, error) => {
      if (cleared) return;
      if (error || !position) {
        onUpdate(mapError(error ?? new Error('gps_unavailable')));
        return;
      }
      onUpdate({ ok: true, position: toPosition(position.coords, position.timestamp) });
    });
  } catch {
    if (!navigator.geolocation) {
      onUpdate(mapError(new Error('gps_unavailable')));
      return () => undefined;
    }
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
