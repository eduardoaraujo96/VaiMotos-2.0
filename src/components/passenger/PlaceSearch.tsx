import { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { locationOutline, searchOutline } from 'ionicons/icons';
import type { LocationPoint } from '../../types';
import { LOCAL_PLACES, findLocalPlaces, normalizePlaceText } from '../../data/localPlaces';
import { searchAddresses } from '../../services/geocoding';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatApproxKm, haversineKm } from '../../utils/geo';

interface PlaceSearchProps {
  currentLocation?: { lat: number; lng: number } | null;
  onSelect: (point: LocationPoint) => void;
}

interface SearchResult {
  point: LocationPoint;
  source: 'local' | 'openstreetmap';
}

function titleFor(point: LocationPoint): string {
  return point.name?.trim() || point.street?.trim() || point.address.split(' — ')[0];
}

function subtitleFor(point: LocationPoint): string {
  const title = normalizePlaceText(titleFor(point));
  const values = [point.street, point.neighborhood, point.municipality]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value) => normalizePlaceText(value) !== title);
  const unique = values.filter((value, index, all) =>
    all.findIndex((candidate) => normalizePlaceText(candidate) === normalizePlaceText(value)) === index
  );
  if (unique.length > 0) return unique.join(' · ');
  return point.address
    .split(' — ')
    .filter((value, index, all) =>
      normalizePlaceText(value) !== title
      && all.findIndex((candidate) => normalizePlaceText(candidate) === normalizePlaceText(value)) === index
    )
    .join(' · ');
}

export function PlaceSearch({ currentLocation, onSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState(false);
  const sequence = useRef(0);
  const selectedQuery = useRef('');
  const debouncedQuery = useDebouncedValue(query, 450);
  const localMatches = useMemo(() => findLocalPlaces(debouncedQuery), [debouncedQuery]);

  useEffect(() => {
    const term = debouncedQuery.trim();
    const request = ++sequence.current;
    if (selectedQuery.current && normalizePlaceText(term) === normalizePlaceText(selectedQuery.current)) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setResults([]);
    setLoading(true);
    setError(null);
    void searchAddresses(term, controller.signal)
      .then((points) => {
        if (cancelled || request !== sequence.current) return;
        const local: SearchResult[] = localMatches.map((place) => ({ point: place.location, source: 'local' }));
        const remote: SearchResult[] = points.map((point) => ({ point, source: 'openstreetmap' }));
        const seen = new Set(local.map(({ point }) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`));
        setResults([
          ...local,
          ...remote.filter(({ point }) => {
            const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        ]);
      })
      .catch((cause: unknown) => {
        if (cancelled || request !== sequence.current || controller.signal.aborted) return;
        setResults(localMatches.map((place) => ({ point: place.location, source: 'local' })));
        setError(cause instanceof Error ? cause.message : 'Não foi possível buscar locais agora.');
      })
      .finally(() => {
        if (!cancelled && request === sequence.current) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedQuery, localMatches]);

  const choose = (point: LocationPoint) => {
    const title = titleFor(point);
    selectedQuery.current = title;
    setSelectedResult(true);
    setQuery(title);
    setResults([]);
    setError(null);
    onSelect(point);
  };

  return (
    <section className="vaimoto-place-search" aria-label="Buscar local">
      <label className="vaimoto-place-search__field">
        <IonIcon icon={searchOutline} aria-hidden="true" />
        <input
          aria-label="Buscar destino ou ponto de embarque"
          autoComplete="off"
          placeholder="Nome do local, rua ou referência"
          value={query}
          onChange={(event) => {
            selectedQuery.current = '';
            setSelectedResult(false);
            setQuery(event.target.value);
          }}
        />
        {loading && <IonSpinner name="crescent" />}
        {query && !loading && (
          <button type="button" aria-label="Limpar busca" onClick={() => {
            selectedQuery.current = '';
            setSelectedResult(false);
            setQuery('');
          }}>
            Limpar
          </button>
        )}
      </label>

      {query.trim().length < 2 && (
        <div className="vaimoto-place-search__recent">
          <div className="vaimoto-place-search__caption">Referência local</div>
          {LOCAL_PLACES.map((place) => (
            <button key={place.id} type="button" className="vaimoto-place-search__row" onClick={() => choose(place.location)}>
              <IonIcon icon={locationOutline} />
              <span>
                <strong>{place.name}</strong>
                <small>{place.reference}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="vaimoto-place-search__results" role="listbox" aria-label="Resultados da busca">
          {results.map(({ point, source }, index) => {
            const distance = currentLocation ? haversineKm(currentLocation, point) : null;
            return (
              <button
                key={`${source}-${point.lat}-${point.lng}-${index}`}
                type="button"
                role="option"
                aria-selected="false"
                className="vaimoto-place-search__row"
                onClick={() => choose(point)}
              >
                <IonIcon icon={locationOutline} />
                <span>
                  <strong>{titleFor(point)}</strong>
                  <small>{subtitleFor(point)}</small>
                  <small>
                    {source === 'local' ? 'Referência local' : 'OpenStreetMap'}
                    {distance != null ? ` · ${formatApproxKm(distance)}` : ''}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="vaimoto-place-search__message" role="alert">{error}</p>}
      {!loading && !error && !selectedResult && query.trim().length >= 2 && results.length === 0 && (
        <p className="vaimoto-place-search__message">Nenhum local encontrado perto de Matões. Tente outro nome ou escolha o ponto no mapa.</p>
      )}
    </section>
  );
}
