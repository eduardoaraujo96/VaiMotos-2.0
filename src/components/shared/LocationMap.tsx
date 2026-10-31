import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { locateOutline, searchOutline, warningOutline } from 'ionicons/icons';
import type { LocationPoint } from '../../types';
import { reverseGeocode, searchAddresses } from '../../services/geocoding';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { isValidLatLng, MAP_CITY_ZOOM, MAP_FALLBACK_CENTER, MAP_FALLBACK_ZOOM } from '../../utils/geo';
import { DEST_COLOR, gpsIcon, ORIGIN_COLOR, pinIcon } from './mapIcons';

export interface ExtraMapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  selected?: boolean;
  color?: string;
}

export interface LocationMapProps {
  height?: string;
  origin?: LocationPoint | null;
  destination?: LocationPoint | null;
  gpsPosition?: { lat: number; lng: number; accuracy?: number } | null;
  extraMarkers?: ExtraMapMarker[];
  selectable?: boolean;
  draggable?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  dark?: boolean;
  zoom?: number;
  gpsError?: string | null;
  gpsLoading?: boolean;
  targetCenter?: { lat: number; lng: number } | null;
  onSelectLocation?: (point: LocationPoint) => void;
  onOriginChange?: (point: LocationPoint) => void;
  onDestinationChange?: (point: LocationPoint) => void;
  onMarkerClick?: (id: string) => void;
  onGpsClick?: () => void;
}

function MapEvents({
  selectable,
  onPick,
}: {
  selectable: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (!selectable) return;
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapViewManager({
  center,
  zoom,
  followToken,
}: {
  center: LatLngExpression;
  zoom: number;
  followToken: number;
}) {
  const map = useMap();
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  centerRef.current = center;
  zoomRef.current = zoom;

  useEffect(() => {
    if (followToken === 0) return;
    map.setView(centerRef.current, zoomRef.current, { animate: true });
  }, [followToken, map]);

  useEffect(() => {
    const resize = () => map.invalidateSize();
    const timer = window.setTimeout(resize, 220);
    window.addEventListener('resize', resize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', resize);
    };
  }, [map]);

  return null;
}

function coordsKey(point?: { lat: number; lng: number } | null): string {
  if (!point || !isValidLatLng(point.lat, point.lng)) return '';
  return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
}

export function LocationMap({
  height = '100%',
  origin,
  destination,
  gpsPosition,
  extraMarkers = [],
  selectable = false,
  draggable = false,
  showSearch = false,
  searchPlaceholder = 'Buscar endereco',
  dark = false,
  zoom,
  gpsError,
  gpsLoading = false,
  targetCenter = null,
  onSelectLocation,
  onOriginChange,
  onDestinationChange,
  onMarkerClick,
  onGpsClick,
}: LocationMapProps) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationPoint[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [followToken, setFollowToken] = useState(0);
  const pickSeq = useRef(0);
  const lastTarget = useRef('');
  const didLockGps = useRef(false);
  const debouncedQuery = useDebouncedValue(query, 450);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    const key = coordsKey(targetCenter);
    if (!key || key === lastTarget.current) return;
    lastTarget.current = key;
    setFollowToken((value) => value + 1);
  }, [targetCenter]);

  useEffect(() => {
    if (!gpsPosition || didLockGps.current) return;
    didLockGps.current = true;
    setFollowToken((value) => value + 1);
  }, [gpsPosition]);

  useEffect(() => {
    if (!showSearch) return;
    const term = debouncedQuery.trim();
    if (term.length < 3) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    void searchAddresses(term)
      .then((points) => {
        if (!cancelled) setResults(points);
      })
      .catch((err) => {
        if (!cancelled) {
          setResults([]);
          setSearchError(err instanceof Error ? err.message : 'Falha ao buscar enderecos.');
        }
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, showSearch]);

  const pickPoint = useCallback(
    async (lat: number, lng: number, apply?: (point: LocationPoint) => void) => {
      if (!isValidLatLng(lat, lng)) return;
      const seq = ++pickSeq.current;
      const provisional: LocationPoint = {
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
      if (apply) apply(provisional);
      else onSelectLocation?.(provisional);
      const resolved = await reverseGeocode(lat, lng);
      if (seq !== pickSeq.current) return;
      if (apply) apply(resolved);
      else onSelectLocation?.(resolved);
    },
    [onSelectLocation]
  );

  const mapCenter = useMemo<LatLngExpression>(() => {
    if (targetCenter && isValidLatLng(targetCenter.lat, targetCenter.lng)) {
      return [targetCenter.lat, targetCenter.lng];
    }
    if (gpsPosition && isValidLatLng(gpsPosition.lat, gpsPosition.lng)) {
      return [gpsPosition.lat, gpsPosition.lng];
    }
    if (origin && isValidLatLng(origin.lat, origin.lng)) return [origin.lat, origin.lng];
    if (destination && isValidLatLng(destination.lat, destination.lng)) {
      return [destination.lat, destination.lng];
    }
    const first = extraMarkers.find((marker) => isValidLatLng(marker.lat, marker.lng));
    if (first) return [first.lat, first.lng];
    return [MAP_FALLBACK_CENTER.lat, MAP_FALLBACK_CENTER.lng];
  }, [destination, extraMarkers, gpsPosition, origin, targetCenter]);

  const hasLocalFocus = Boolean(gpsPosition || origin || targetCenter);
  const mapZoom = zoom ?? (hasLocalFocus ? MAP_CITY_ZOOM : MAP_FALLBACK_ZOOM);

  const tiles = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = dark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  const centerOnGps = () => {
    if (gpsPosition) setFollowToken((value) => value + 1);
    onGpsClick?.();
  };

  return (
    <div className="vaimoto-map-shell relative w-full overflow-hidden" style={{ height, minHeight: 220 }}>
      {mounted && (
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full"
        zoomControl={false}
        attributionControl
      >
        <TileLayer key={dark ? 'dark' : 'light'} attribution={attribution} url={tiles} />
        <ZoomControl position="topright" />
        <MapViewManager center={mapCenter} zoom={mapZoom} followToken={followToken} />
        <MapEvents selectable={selectable} onPick={(lat, lng) => void pickPoint(lat, lng)} />

        {gpsPosition && isValidLatLng(gpsPosition.lat, gpsPosition.lng) && (
          <>
            <Circle
              center={[gpsPosition.lat, gpsPosition.lng]}
              radius={Math.min(gpsPosition.accuracy ?? 40, 120)}
              pathOptions={{ color: '#00C853', fillColor: '#00C853', fillOpacity: 0.12, weight: 1 }}
            />
            <Marker position={[gpsPosition.lat, gpsPosition.lng]} icon={gpsIcon()} zIndexOffset={300} />
          </>
        )}

        {origin && isValidLatLng(origin.lat, origin.lng) && (
          <Marker
            position={[origin.lat, origin.lng]}
            icon={pinIcon(ORIGIN_COLOR, true)}
            draggable={draggable}
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = (event.target as L.Marker).getLatLng();
                void pickPoint(lat, lng, onOriginChange);
              },
            }}
            zIndexOffset={400}
          />
        )}

        {destination && isValidLatLng(destination.lat, destination.lng) && (
          <Marker
            position={[destination.lat, destination.lng]}
            icon={pinIcon(DEST_COLOR)}
            draggable={draggable}
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = (event.target as L.Marker).getLatLng();
                void pickPoint(lat, lng, onDestinationChange);
              },
            }}
            zIndexOffset={350}
          />
        )}

        {extraMarkers
          .filter((marker) => isValidLatLng(marker.lat, marker.lng))
          .map((marker) => (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={pinIcon(marker.color ?? ORIGIN_COLOR, marker.selected)}
              eventHandlers={{
                click: () => onMarkerClick?.(marker.id),
              }}
              zIndexOffset={marker.selected ? 500 : 200}
            />
          ))}
      </MapContainer>
      )}

      {showSearch && (
        <div className="vaimoto-map-search absolute left-3 right-14 top-3 z-[1100]">
          <div
            className="flex items-center gap-2 rounded-2xl px-3 py-2"
            style={{ background: 'var(--ion-card-background)', boxShadow: '0 8px 24px rgba(15,15,20,0.16)' }}
          >
            <IonIcon icon={searchOutline} color="medium" />
            <input
              className="vaimoto-map-input flex-1 bg-transparent text-sm outline-none"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {searching && <IonSpinner name="crescent" style={{ width: 18, height: 18 }} />}
          </div>
          {results.length > 0 && (
            <div
              className="mt-2 max-h-52 overflow-auto rounded-2xl"
              style={{ background: 'var(--ion-card-background)', boxShadow: '0 10px 28px rgba(15,15,20,0.16)' }}
            >
              {results.map((item, index) => (
                <button
                  key={`${item.lat}-${item.lng}-${index}`}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm"
                  style={{ borderBottom: '1px solid rgba(139,139,154,0.16)' }}
                  onClick={() => {
                    onSelectLocation?.(item);
                    setQuery(item.address);
                    setResults([]);
                  }}
                >
                  <div className="font-semibold">{item.address}</div>
                  {item.neighborhood && (
                    <div className="text-xs" style={{ color: 'var(--ion-color-medium)' }}>
                      {item.neighborhood}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {searchError && (
            <div className="mt-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--ion-card-background)' }}>
              {searchError}
            </div>
          )}
        </div>
      )}

      <div className="absolute right-3 top-3 z-[1100] flex flex-col gap-2">
        <IonButton className="vaimoto-map-fab" fill="solid" color="light" onClick={centerOnGps}>
          {gpsLoading ? <IonSpinner name="crescent" /> : <IonIcon icon={locateOutline} color="primary" />}
        </IonButton>
      </div>

      {(gpsError || offline) && (
        <div
          className={`absolute left-3 right-3 z-[1100] flex items-start gap-2 rounded-2xl px-3 py-2 text-xs ${showSearch ? 'top-16' : 'top-14'}`}
          style={{ background: 'var(--ion-card-background)', boxShadow: '0 8px 20px rgba(15,15,20,0.14)' }}
        >
          <IonIcon icon={warningOutline} color="warning" className="mt-0.5" />
          <span>
            {offline
              ? 'Sem internet. O mapa pode nao carregar, mas voce ainda pode escolher o ponto se o mapa ja estiver visivel.'
              : gpsError}
          </span>
        </div>
      )}
    </div>
  );
}
