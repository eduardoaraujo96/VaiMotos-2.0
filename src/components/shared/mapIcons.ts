import L from 'leaflet';

function pinHtml(color: string, selected: boolean, glyph = ''): string {
  const ring = selected ? 'is-selected' : '';
  return `<div class="vaimoto-pin ${ring}" style="--pin-color:${color}">${glyph}</div>`;
}

export function pinIcon(color: string, selected = false): L.DivIcon {
  return L.divIcon({
    className: 'vaimoto-pin-wrap',
    html: pinHtml(color, selected),
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -28],
  });
}

export function gpsIcon(): L.DivIcon {
  return L.divIcon({
    className: 'vaimoto-pin-wrap',
    html: '<div class="vaimoto-gps"><span></span></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export const ORIGIN_COLOR = '#FF6B00';
export const DEST_COLOR = '#1A1A2E';
export const RIDE_COLOR = '#FF6B00';
export const DRIVER_COLOR = '#00C853';
