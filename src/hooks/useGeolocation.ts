import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  getCurrentPosition,
  isSecureGeolocationContext,
  requestLocationPermission,
  watchPosition,
  type GpsErrorCode,
  type GpsPosition,
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
  const [requested, setRequested] = useState(false);
  const stopWatch = useRef<(() => void) | null>(null);

  const applyResult = useCallback((result: Awaited<ReturnType<typeof getCurrentPosition>>) => {
    if (result.ok) {
      setPosition(result.position);
      setError(null);
      setErrorCode(null);
      setPermissionDenied(false);
      return;
    }
    setError(result.message);
    setErrorCode(result.code);
    setPermissionDenied(result.code === 'permission_denied');
  }, []);

  const refresh = useCallback(async () => {
    setRequested(true);
    setLoading(true);
    if (!Capacitor.isNativePlatform() && !isSecureGeolocationContext()) {
      applyResult({
        ok: false,
        code: 'insecure_context',
        message: 'GPS exige HTTPS ou localhost. Neste endereco HTTP, escolha o ponto tocando no mapa.',
      });
      setLoading(false);
      return null;
    }
    await requestLocationPermission();
    const result = await getCurrentPosition();
    applyResult(result);
    setLoading(false);
    return result.ok ? result.position : null;
  }, [applyResult]);

  useEffect(() => {
    if (!enabled) {
      stopWatch.current?.();
      stopWatch.current = null;
      return;
    }

    let cancelled = false;
    setRequested(true);

    if (!Capacitor.isNativePlatform() && !isSecureGeolocationContext()) {
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
        stopWatch.current = await watchPosition((next) => {
          if (!cancelled) applyResult(next);
        });
      }
    })();

    return () => {
      cancelled = true;
      stopWatch.current?.();
      stopWatch.current = null;
    };
  }, [applyResult, enabled, watch]);

  return {
    position,
    error,
    errorCode,
    loading,
    permissionDenied,
    requested,
    refresh,
  };
}
