import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canUseNativeGps,
  checkLocationPermission,
  getCurrentPosition,
  isSecureGeolocationContext,
  requestLocationPermission,
  watchPosition,
  type GpsErrorCode,
  type GpsPermissionState,
  type GpsPosition,
  type GpsResult,
} from '../services/geolocation';

interface UseGeolocationOptions {
  enabled?: boolean;
  watch?: boolean;
}

export function useGeolocation({ enabled = false, watch = false }: UseGeolocationOptions = {}) {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<GpsErrorCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionState, setPermissionState] = useState<GpsPermissionState>('prompt');
  const [requested, setRequested] = useState(false);
  const stopWatch = useRef<(() => void) | null>(null);
  const watching = useRef(false);

  const applyResult = useCallback((result: GpsResult) => {
    if (result.ok) {
      setPosition(result.position);
      setError(null);
      setErrorCode(null);
      setPermissionDenied(false);
      setPermissionState('granted');
      return;
    }
    setError(result.message);
    setErrorCode(result.code);
    setPermissionDenied(result.code === 'permission_denied');
    if (result.code === 'permission_denied') setPermissionState('denied');
  }, []);

  const refresh = useCallback(async (): Promise<GpsResult> => {
    setRequested(true);
    setLoading(true);
    if (!canUseNativeGps() && !isSecureGeolocationContext()) {
      const result: GpsResult = {
        ok: false,
        code: 'insecure_context',
        message: 'GPS exige HTTPS ou localhost. Neste endereco HTTP, escolha o ponto tocando no mapa.',
      };
      applyResult(result);
      setLoading(false);
      return result;
    }
    const permission = await requestLocationPermission();
    setPermissionState(permission);
    if (permission === 'denied') {
      const result: GpsResult = {
        ok: false,
        code: 'permission_denied',
        message:
          'Permissao de localizacao negada. No Android, abra Ajustes > Apps > VaiMoto > Permissoes > Localizacao e permita. Depois toque em Minha localizacao.',
      };
      applyResult(result);
      setLoading(false);
      return result;
    }
    const result = await getCurrentPosition();
    applyResult(result);
    setLoading(false);
    return result;
  }, [applyResult]);

  const startWatch = useCallback(async () => {
    if (watching.current) return;
    watching.current = true;
    setRequested(true);
    stopWatch.current?.();
    stopWatch.current = await watchPosition((next) => {
      applyResult(next);
      setLoading(false);
    });
  }, [applyResult]);

  const stopWatching = useCallback(() => {
    watching.current = false;
    stopWatch.current?.();
    stopWatch.current = null;
  }, []);

  useEffect(() => {
    void checkLocationPermission().then(setPermissionState);
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopWatching();
      return;
    }

    let cancelled = false;
    setRequested(true);

    if (!canUseNativeGps() && !isSecureGeolocationContext()) {
      setError(null);
      setErrorCode('insecure_context');
      setPermissionDenied(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    void (async () => {
      const result = await getCurrentPosition();
      if (cancelled) return;
      applyResult(result);
      setLoading(false);
      if (watch && result.ok) {
        await startWatch();
      }
    })();

    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [applyResult, enabled, startWatch, stopWatching, watch]);

  return {
    position,
    error,
    errorCode,
    loading,
    permissionDenied,
    permissionState,
    requested,
    refresh,
    startWatch,
    stopWatch: stopWatching,
  };
}
