import { Capacitor } from '@capacitor/core';
import { Geolocation, type PermissionStatus } from '@capacitor/geolocation';

export type GpsErrorCode =
  | 'permission_denied'
  | 'unavailable'
  | 'timeout'
  | 'offline'
  | 'insecure_context'
  | 'unknown';

export type GpsPermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unavailable';

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

export type GpsResult =
  | { ok: true; position: GpsPosition }
  | { ok: false; code: GpsErrorCode; message: string };

const FINE_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 8_000,
};

const COARSE_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 25000,
  maximumAge: 15_000,
};

const INSECURE_MESSAGE =
  'GPS exige HTTPS ou localhost. Neste endereco HTTP, escolha o ponto tocando no mapa.';
const DENIED_MESSAGE =
  'Permissao de localizacao negada. No Android, abra Ajustes > Apps > VaiMoto > Permissoes > Localizacao e permita. Depois toque em Minha localizacao.';
const GPS_OFF_MESSAGE =
  'O GPS do aparelho parece desligado. Ative a localizacao nas configuracoes do Android e tente de novo.';

export function isSecureGeolocationContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function errorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message ?? '');
  }
  return String(error);
}

function errorCode(error: unknown): number {
  if (typeof error === 'object' && error && 'code' in error) {
    return Number((error as { code?: number }).code);
  }
  return 0;
}

function isPluginMissing(error: unknown): boolean {
  const message = errorMessage(error);
  return /not implemented|plugin is not implemented|unimplemented|has not been implemented/i.test(message);
}

function isLocationDisabled(error: unknown): boolean {
  const message = errorMessage(error);
  return /location services are not enabled|location disabled|gps.*off|provider.*disabled|settings|kCLErrorDomain/i.test(
    message
  );
}

function mapError(error: unknown): Extract<GpsResult, { ok: false }> {
  if (!Capacitor.isNativePlatform() && !isSecureGeolocationContext()) {
    return { ok: false, code: 'insecure_context', message: INSECURE_MESSAGE };
  }
  const message = errorMessage(error);
  const code = errorCode(error);
  if (code === 1 || /permission was denied|permission denied|user denied|not authorized|acesso.*negad/i.test(message)) {
    return { ok: false, code: 'permission_denied', message: DENIED_MESSAGE };
  }
  if (
    code === 2 ||
    /location services are not enabled|location disabled|gps.*off|provider.*disabled|settings/i.test(message)
  ) {
    return { ok: false, code: 'unavailable', message: GPS_OFF_MESSAGE };
  }
  if (code === 3 || /timeout|timed out|tempo/i.test(message)) {
    return {
      ok: false,
      code: 'timeout',
      message: 'Tempo esgotado ao obter o GPS. Ative a localizacao de alta precisao e tente de novo.',
    };
  }
  if (!navigator.onLine && !Capacitor.isNativePlatform()) {
    return { ok: false, code: 'offline', message: 'Sem conexao. Voce ainda pode escolher o ponto no mapa.' };
  }
  return {
    ok: false,
    code: 'unknown',
    message: message || 'Nao foi possivel obter a localizacao. Tente de novo ou escolha no mapa.',
  };
}

function toPosition(coords: { latitude: number; longitude: number; accuracy?: number }, timestamp: number): GpsPosition {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    timestamp,
  };
}

function isGranted(status: PermissionStatus): boolean {
  return status.location === 'granted' || status.coarseLocation === 'granted';
}

function hasFine(status: PermissionStatus): boolean {
  return status.location === 'granted';
}

export function permissionFromStatus(status: PermissionStatus): GpsPermissionState {
  if (isGranted(status)) return 'granted';
  if (status.location === 'prompt-with-rationale' || status.coarseLocation === 'prompt-with-rationale') {
    return 'prompt-with-rationale';
  }
  if (status.location === 'prompt' || status.coarseLocation === 'prompt') return 'prompt';
  return 'denied';
}

export async function checkLocationPermission(): Promise<GpsPermissionState> {
  try {
    if (Capacitor.isNativePlatform()) {
      const status = await Geolocation.checkPermissions();
      return permissionFromStatus(status);
    }
    if (!isSecureGeolocationContext()) return 'unavailable';
    if (!navigator.geolocation) return 'unavailable';
    if (!navigator.permissions?.query) return 'prompt';
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    if (result.state === 'granted') return 'granted';
    if (result.state === 'denied') return 'denied';
    return 'prompt';
  } catch (error) {
    if (isLocationDisabled(error)) return 'unavailable';
    return 'prompt';
  }
}

export async function requestLocationPermission(): Promise<GpsPermissionState> {
  try {
    if (!Capacitor.isNativePlatform() && !isSecureGeolocationContext()) {
      return 'unavailable';
    }
    if (Capacitor.isNativePlatform()) {
      let status = await Geolocation.checkPermissions();
      if (isGranted(status)) return permissionFromStatus(status);
      status = await Geolocation.requestPermissions({
        permissions: ['location', 'coarseLocation'],
      });
      return permissionFromStatus(status);
    }
    if (!navigator.geolocation) return 'unavailable';
    const current = await checkLocationPermission();
    if (current === 'denied') return 'denied';
    return current;
  } catch (error) {
    if (isPluginMissing(error)) return 'prompt';
    if (isLocationDisabled(error)) return 'unavailable';
    return 'denied';
  }
}

function browserPosition(highAccuracy: boolean): Promise<GpsResult> {
  if (!navigator.geolocation) {
    return Promise.resolve({ ok: false, code: 'unavailable', message: 'Este navegador nao oferece GPS.' });
  }
  const options = highAccuracy ? FINE_OPTIONS : COARSE_OPTIONS;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, position: toPosition(pos.coords, pos.timestamp) }),
      (error) => resolve(mapError(error)),
      options
    );
  });
}

async function nativePosition(): Promise<GpsResult> {
  const permission = await requestLocationPermission();
  if (permission === 'denied') {
    return { ok: false, code: 'permission_denied', message: DENIED_MESSAGE };
  }
  if (permission === 'unavailable') {
    return { ok: false, code: 'unavailable', message: GPS_OFF_MESSAGE };
  }

  let status: PermissionStatus | null = null;
  try {
    status = await Geolocation.checkPermissions();
  } catch {
    status = null;
  }
  const fine = status ? hasFine(status) : true;

  try {
    const pos = await Geolocation.getCurrentPosition(fine ? FINE_OPTIONS : COARSE_OPTIONS);
    return { ok: true, position: toPosition(pos.coords, pos.timestamp) };
  } catch (error) {
    if (isPluginMissing(error)) {
      return browserPosition(false);
    }
    if (fine) {
      try {
        const fallback = await Geolocation.getCurrentPosition(COARSE_OPTIONS);
        return { ok: true, position: toPosition(fallback.coords, fallback.timestamp) };
      } catch (retryError) {
        return mapError(retryError);
      }
    }
    return mapError(error);
  }
}

export async function getCurrentPosition(): Promise<GpsResult> {
  if (!Capacitor.isNativePlatform() && !isSecureGeolocationContext()) {
    return { ok: false, code: 'insecure_context', message: INSECURE_MESSAGE };
  }
  if (Capacitor.isNativePlatform()) {
    return nativePosition();
  }
  const permission = await requestLocationPermission();
  if (permission === 'denied') {
    return { ok: false, code: 'permission_denied', message: DENIED_MESSAGE };
  }
  const first = await browserPosition(true);
  if (first.ok || first.code === 'permission_denied') return first;
  return browserPosition(false);
}

export async function watchPosition(onUpdate: (result: GpsResult) => void): Promise<() => void> {
  let cleared = false;
  let watchId: string | number | null = null;

  if (!Capacitor.isNativePlatform() && !isSecureGeolocationContext()) {
    onUpdate({ ok: false, code: 'insecure_context', message: INSECURE_MESSAGE });
    return () => undefined;
  }

  const permission = await requestLocationPermission();
  if (cleared) return () => undefined;
  if (permission === 'denied') {
    onUpdate({ ok: false, code: 'permission_denied', message: DENIED_MESSAGE });
    return () => undefined;
  }

  let fine = true;
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      fine = hasFine(status);
    } catch {
      fine = true;
    }
  }

  const options = fine ? FINE_OPTIONS : COARSE_OPTIONS;

  if (Capacitor.isNativePlatform()) {
    try {
      watchId = await Geolocation.watchPosition(options, (position, error) => {
        if (cleared) return;
        if (error || !position) {
          onUpdate(mapError(error ?? new Error('gps_unavailable')));
          return;
        }
        onUpdate({ ok: true, position: toPosition(position.coords, position.timestamp) });
      });
    } catch (error) {
      if (isPluginMissing(error) && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (!cleared) onUpdate({ ok: true, position: toPosition(pos.coords, pos.timestamp) });
          },
          (watchError) => {
            if (!cleared) onUpdate(mapError(watchError));
          },
          options
        );
      } else {
        onUpdate(mapError(error));
        return () => undefined;
      }
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
      options
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
