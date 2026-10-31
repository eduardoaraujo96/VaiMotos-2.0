import { useCallback, useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import type { Coordinates } from '../utils/geo';

export type GpsStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable' | 'error';

export interface GpsFix extends Coordinates {
  accuracy?: number;
  timestamp: number;
}

function classify(err: unknown): { status: GpsStatus; message: string } {
  const text = String((err as { message?: string })?.message ?? err).toLowerCase();
  const code = (err as { code?: number | string })?.code;
  if (code === 1 || text.includes('denied') || text.includes('permission')) {
    return { status: 'denied', message: 'Permissao de localizacao negada. Voce pode escolher o ponto manualmente no mapa.' };
  }
  if (code === 2 || text.includes('unavailable') || text.includes('disabled')) {
    return { status: 'unavailable', message: 'GPS indisponivel ou desligado. Ative a localizacao ou escolha manualmente.' };
  }
  if (code === 3 || text.includes('timeout')) {
    return { status: 'error', message: 'Sinal de GPS fraco. Tentando novamente...' };
  }
  return { status: 'error', message: 'Nao foi possivel obter a localizacao.' };
}

const OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 };

/**
 * GPS em primeiro plano. `locate()` pega uma posicao; `start()`/`stop()` controlam o acompanhamento.
 * O acompanhamento e encerrado ao desmontar. Nao ha rastreamento em segundo plano.
 */
export function useGeolocation() {
  const [position, setPosition] = useState<GpsFix | null>(null);
  const [status, setStatus] = useState<GpsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const apply = useCallback((pos: { coords: { latitude: number; longitude: number; accuracy?: number }; timestamp: number }) => {
    if (!alive.current) return;
    setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp });
    setStatus('ready');
    setError(null);
  }, []);

  const fail = useCallback((err: unknown) => {
    if (!alive.current) return;
    const info = classify(err);
    setStatus(info.status);
    setError(info.message);
  }, []);

  const ensurePermission = useCallback(async () => {
    try {
      const current = await Geolocation.checkPermissions();
      if (current.location === 'granted' || current.coarseLocation === 'granted') return true;
      const asked = await Geolocation.requestPermissions({ permissions: ['location'] });
      return asked.location === 'granted' || asked.coarseLocation === 'granted';
    } catch {
      // Navegador sem API de permissoes: a propria getCurrentPosition pede.
      return true;
    }
  }, []);

  const locate = useCallback(async (): Promise<GpsFix | null> => {
    setStatus('loading');
    setError(null);
    try {
      if (!(await ensurePermission())) {
        fail({ code: 1 });
        return null;
      }
      const pos = await Geolocation.getCurrentPosition(OPTIONS);
      apply(pos);
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp };
    } catch (err) {
      fail(err);
      return null;
    }
  }, [apply, ensurePermission, fail]);

  const stop = useCallback(() => {
    const id = watchId.current;
    watchId.current = null;
    if (id !== null) void Geolocation.clearWatch({ id });
  }, []);

  const start = useCallback(async () => {
    if (watchId.current !== null) return;
    setStatus('loading');
    setError(null);
    if (!(await ensurePermission())) {
      fail({ code: 1 });
      return;
    }
    try {
      const id = await Geolocation.watchPosition(OPTIONS, (pos, err) => {
        if (err || !pos) {
          fail(err ?? new Error('unavailable'));
          return;
        }
        apply(pos);
      });
      if (!alive.current) {
        void Geolocation.clearWatch({ id });
        return;
      }
      watchId.current = id;
    } catch (err) {
      fail(err);
    }
  }, [apply, ensurePermission, fail]);

  useEffect(() => stop, [stop]);

  const reset = useCallback(() => {
    stop();
    setPosition(null);
    setStatus('idle');
    setError(null);
  }, [stop]);

  return { position, status, error, locate, start, stop, reset };
}
