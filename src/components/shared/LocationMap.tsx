import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode, searchAddress, type GeocodeResult } from '../../services/geocoding';
import type { GpsFix, GpsStatus } from '../../hooks/useGeolocation';
import type { LocationPoint } from '../../types';
import { isValidCoordinate, type Coordinates } from '../../utils/geo';

export type PickTarget = 'origin' | 'destination';

export interface MapPin extends Coordinates {
  id: string;
  label?: string;
  selected?: boolean;
}

export interface LocationMapProps {
  height?: string;
  dark?: boolean;
  /** Posicao GPS do usuario (vem do hook useGeolocation). */
  gpsPosition?: GpsFix | null;
  gpsStatus?: GpsStatus;
  gpsError?: string | null;
  onRequestGps?: () => void;
  origin?: Coordinates | null;
  destination?: Coordinates | null;
  /** Quando definido, tocar no mapa/arrastar o marcador escolhe esse ponto. */
  pickTarget?: PickTarget | null;
  onPick?: (target: PickTarget, point: LocationPoint) => void;
  /** Marcadores extras (ex.: pedidos no radar). */
  pins?: MapPin[];
  onPinClick?: (id: string) => void;
  showSearch?: boolean;
  /** Define o foco inicial/centralizado; usado quando nao ha GPS nem pontos. */
  fallbackCenter?: Coordinates;
  /** Muda este valor para forcar recentralizacao na posicao GPS. */
  recenterSignal?: number;
  onCoordinatesChange?: (target: PickTarget, coords: Coordinates) => void;
  className?: string;
}

// Centro neutro (Brasil) usado apenas para abrir o mapa; nao e tratado como localizacao do usuario.
const DEFAULT_CENTER: Coordinates = { lat: -14.235, lng: -51.9253 };

function dot(color: string, size = 18, ring?: string) {
  return L.divIcon({
    className: 'vm-pin',
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)${ring ? `,0 0 0 6px ${ring}` : ''}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function teardrop(color: string, text: string, selected = false) {
  const s = selected ? 38 : 30;
  return L.divIcon({
    className: 'vm-pin',
    html: `<div style="width:${s}px;height:${s}px;background:${color};border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,.4)${selected ? ',0 0 0 5px rgba(255,107,0,.35)' : ''};display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:12px">${text}</span></div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s],
  });
}

const ICON_ORIGIN = teardrop('#FF6B00', 'A');
const ICON_DEST = teardrop('#1A1A2E', 'B');
const ICON_ME = dot('#2979FF', 16, 'rgba(41,121,255,.25)');

function Clicks({ enabled, onPoint }: { enabled: boolean; onPoint: (c: Coordinates) => void }) {
  useMapEvents({
    click(e) {
      if (enabled) onPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface FocusProps {
  focus: Coordinates | null;
  focusKey: string;
}

function Focus({ focus, focusKey }: FocusProps) {
  const map = useMap();
  const last = useRef('');
  useEffect(() => {
    if (!focus || last.current === focusKey) return;
    last.current = focusKey;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [focus, focusKey, map]);
  return null;
}

function Fit({ points, signal }: { points: Coordinates[]; signal: string }) {
  const map = useMap();
  const last = useRef('');
  useEffect(() => {
    if (points.length < 2 || last.current === signal) return;
    last.current = signal;
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [60, 60], maxZoom: 16 });
  }, [points, signal, map]);
  return null;
}

function Resize() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 250);
    const el = map.getContainer();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null;
    ro?.observe(el);
    return () => {
      window.clearTimeout(t);
      ro?.disconnect();
    };
  }, [map]);
  return null;
}

function Zoom() {
  const map = useMap();
  const btn = 'vm-map-btn';
  return (
    <div className="vm-map-controls">
      <button type="button" className={btn} aria-label="Aproximar" onClick={() => map.zoomIn()}>+</button>
      <button type="button" className={btn} aria-label="Afastar" onClick={() => map.zoomOut()}>−</button>
    </div>
  );
}

export function LocationMap({
  height = '100%',
  dark,
  gpsPosition,
  gpsStatus = 'idle',
  gpsError,
  onRequestGps,
  origin,
  destination,
  pickTarget = null,
  onPick,
  pins = [],
  onPinClick,
  showSearch = false,
  fallbackCenter,
  recenterSignal = 0,
  onCoordinatesChange,
  className,
}: LocationMapProps) {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [focus, setFocus] = useState<Coordinates | null>(null);
  const pickSeq = useRef(0);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Pesquisa com debounce; resultados tambem ficam em cache no servico.
  useEffect(() => {
    if (!showSearch) return undefined;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearchError(null);
      return undefined;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const found = await searchAddress(q, ctrl.signal);
        setResults(found);
        if (found.length === 0) setSearchError('Nenhum endereco encontrado.');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSearchError(err instanceof Error ? err.message : 'Falha na pesquisa.');
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 600);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, showSearch]);

  const commit = useCallback(
    async (target: PickTarget, coords: Coordinates, known?: GeocodeResult) => {
      if (!isValidCoordinate(coords)) return;
      onCoordinatesChange?.(target, coords);
      const seq = ++pickSeq.current;
      setResolving(true);
      let point: LocationPoint = { lat: coords.lat, lng: coords.lng, address: known?.address ?? '', neighborhood: known?.neighborhood };
      if (!known) {
        try {
          const r = await reverseGeocode(coords.lat, coords.lng);
          point = { lat: coords.lat, lng: coords.lng, address: r.address, neighborhood: r.neighborhood };
        } catch {
          point.address = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
        }
      }
      if (seq === pickSeq.current) {
        setResolving(false);
        onPick?.(target, point);
      }
    },
    [onPick, onCoordinatesChange]
  );

  const chooseResult = (r: GeocodeResult) => {
    setResults([]);
    setQuery('');
    setFocus({ lat: r.lat, lng: r.lng });
    if (pickTarget) void commit(pickTarget, { lat: r.lat, lng: r.lng }, r);
  };

  const validOrigin = isValidCoordinate(origin) ? origin : null;
  const validDest = isValidCoordinate(destination) ? destination : null;
  const gps = gpsPosition && isValidCoordinate(gpsPosition) ? gpsPosition : null;

  const initialCenter = validOrigin ?? gps ?? fallbackCenter ?? DEFAULT_CENTER;
  const initialZoom = validOrigin || gps || fallbackCenter ? 15 : 4;

  const fitPoints = useMemo(() => {
    const list: Coordinates[] = [];
    if (validOrigin) list.push(validOrigin);
    if (validDest) list.push(validDest);
    return list;
  }, [validOrigin, validDest]);
  const fitKey = fitPoints.length === 2 ? `${validOrigin?.lat},${validOrigin?.lng}|${validDest?.lat},${validDest?.lng}` : '';

  // Centraliza no GPS quando a primeira posicao chega ou quando o botao e acionado.
  const gpsFocusKey = gps ? `gps-${recenterSignal}-${recenterSignal === 0 ? 'first' : ''}` : '';

  const pinFocus = pins.find((p) => p.selected);

  return (
    <div className={`vm-location-map relative w-full ${dark ? 'vm-map-dark' : ''} ${className ?? ''}`} style={{ height, minHeight: 220 }}>
      <MapContainer center={[initialCenter.lat, initialCenter.lng]} zoom={initialZoom} zoomControl={false} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Resize />
        <Zoom />
        <Clicks enabled={Boolean(pickTarget)} onPoint={(c) => pickTarget && void commit(pickTarget, c)} />
        <Focus focus={gps} focusKey={gpsFocusKey} />
        <Focus focus={focus} focusKey={focus ? `s-${focus.lat}-${focus.lng}` : ''} />
        <Focus focus={pinFocus ?? null} focusKey={pinFocus ? `p-${pinFocus.id}` : ''} />
        <Fit points={fitPoints} signal={fitKey} />

        {gps && (
          <>
            {gps.accuracy !== undefined && gps.accuracy < 500 && (
              <Circle center={[gps.lat, gps.lng]} radius={gps.accuracy} pathOptions={{ color: '#2979FF', weight: 1, fillOpacity: 0.08 }} />
            )}
            <Marker position={[gps.lat, gps.lng]} icon={ICON_ME} interactive={false} zIndexOffset={500} />
          </>
        )}
        {validOrigin && (
          <Marker
            position={[validOrigin.lat, validOrigin.lng]}
            icon={ICON_ORIGIN}
            draggable={pickTarget === 'origin'}
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                void commit('origin', { lat: p.lat, lng: p.lng });
              },
            }}
          />
        )}
        {validDest && (
          <Marker
            position={[validDest.lat, validDest.lng]}
            icon={ICON_DEST}
            draggable={pickTarget === 'destination'}
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                void commit('destination', { lat: p.lat, lng: p.lng });
              },
            }}
          />
        )}
        {pins.filter((p) => isValidCoordinate(p)).map((p, i) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={teardrop(p.selected ? '#00C853' : '#FF6B00', p.label ?? String(i + 1), p.selected)}
            zIndexOffset={p.selected ? 1000 : 0}
            eventHandlers={{ click: () => onPinClick?.(p.id) }}
          />
        ))}
      </MapContainer>

      {showSearch && (
        <div className="vm-map-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={pickTarget === 'destination' ? 'Pesquisar destino' : 'Pesquisar endereco'}
            aria-label="Pesquisar endereco"
          />
          {(searching || searchError || results.length > 0) && (
            <ul>
              {searching && <li className="vm-muted">Buscando...</li>}
              {!searching && searchError && <li className="vm-muted">{searchError}</li>}
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button type="button" onClick={() => chooseResult(r)}>{r.address}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="vm-map-locate">
        <button type="button" className="vm-map-btn" aria-label="Centralizar na minha localizacao" onClick={() => onRequestGps?.()} disabled={gpsStatus === 'loading'}>
          {gpsStatus === 'loading' ? '…' : '◎'}
        </button>
      </div>

      {(!online || gpsError || resolving) && (
        <div className="vm-map-status" role="status">
          {!online ? 'Sem internet: o mapa e a pesquisa podem nao carregar.' : gpsError ?? 'Buscando endereco...'}
        </div>
      )}
    </div>
  );
}
