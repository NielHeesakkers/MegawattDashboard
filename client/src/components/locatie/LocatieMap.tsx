import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker icon paths werken niet goed met Vite; inline oplossen.
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Props {
  lat: number | null;
  lng: number | null;
  address: string;
  /** Tailwind height class, default `h-[200px]`. Use `h-full` om de parent-grid-row te vullen. */
  heightClass?: string;
}

export default function LocatieMap({ lat, lng, address, heightClass = 'h-[200px]' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!ref.current || lat == null || lng == null) return;
    if (!mapRef.current) {
      mapRef.current = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapRef.current);
      markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current);
    } else {
      mapRef.current.setView([lat, lng], 15);
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
    markerRef.current = null;
  }, []);

  if (lat == null || lng == null) {
    return (
      <div className={`${heightClass} rounded-lg bg-[rgba(255,255,255,0.04)] ring-1 ring-[rgba(255,255,255,0.08)] flex items-center justify-center text-[rgba(255,255,255,0.4)] text-sm relative z-0`}>
        Adres niet gevonden — controleer het adres en geocode opnieuw.
      </div>
    );
  }

  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noreferrer"
      title="Open route in Google Maps"
      className={`block ${heightClass} rounded-lg overflow-hidden ring-1 ring-[rgba(255,255,255,0.08)] relative z-0`}
    >
      <div ref={ref} className="w-full h-full" />
    </a>
  );
}
