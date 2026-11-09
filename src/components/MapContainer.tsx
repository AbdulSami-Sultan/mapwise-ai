/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Search,
  Navigation,
  Compass,
  Layers,
  MapPin,
  ExternalLink,
  Star,
  MessageSquare,
  Car,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { PlaceMarker, MapCoordinates } from '../types.ts';
import { PRESET_LOCATIONS, PresetLocation } from '../constants/personas.ts';

interface MapContainerProps {
  apiKey: string;
  center: MapCoordinates;
  zoom: number;
  places: PlaceMarker[];
  selectedPlaceId?: string | null;
  userLocation?: MapCoordinates | null;
  onCenterChange: (center: MapCoordinates, zoom: number) => void;
  onSelectPlace: (place: PlaceMarker | null) => void;
  onAskAboutArea: (center: MapCoordinates) => void;
  onAskAboutPlace: (place: PlaceMarker) => void;
  onRequestUserLocation: () => void;
  isLocating?: boolean;
}

// Controller component inside APIProvider to programmatically control camera
const MapCameraController: React.FC<{
  center: MapCoordinates;
  zoom: number;
  selectedPlace?: PlaceMarker | null;
}> = ({ center, zoom, selectedPlace }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat: center.lat, lng: center.lng });
    map.setZoom(zoom);
  }, [map, center.lat, center.lng, zoom]);

  useEffect(() => {
    if (!map || !selectedPlace) return;
    map.panTo({ lat: selectedPlace.lat, lng: selectedPlace.lng });
    if (map.getZoom()! < 15) {
      map.setZoom(15);
    }
  }, [map, selectedPlace]);

  return null;
};

// Traffic layer controller
const TrafficLayerComponent: React.FC<{ showTraffic: boolean }> = ({ showTraffic }) => {
  const map = useMap();
  const [trafficLayer, setTrafficLayer] = useState<google.maps.TrafficLayer | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined') return;

    if (!trafficLayer) {
      const layer = new google.maps.TrafficLayer();
      setTrafficLayer(layer);
    }
  }, [map, trafficLayer]);

  useEffect(() => {
    if (!trafficLayer) return;
    if (showTraffic) {
      trafficLayer.setMap(map);
    } else {
      trafficLayer.setMap(null);
    }
  }, [trafficLayer, showTraffic, map]);

  return null;
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; glyph: string }> = {
  restaurant: { bg: '#ef4444', border: '#b91c1c', glyph: '#ffffff' },
  cafe: { bg: '#f59e0b', border: '#d97706', glyph: '#ffffff' },
  landmark: { bg: '#8b5cf6', border: '#6d28d9', glyph: '#ffffff' },
  park: { bg: '#10b981', border: '#047857', glyph: '#ffffff' },
  museum: { bg: '#6366f1', border: '#4338ca', glyph: '#ffffff' },
  shopping: { bg: '#ec4899', border: '#be185d', glyph: '#ffffff' },
  hotel: { bg: '#0284c7', border: '#0369a1', glyph: '#ffffff' },
  other: { bg: '#64748b', border: '#475569', glyph: '#ffffff' },
};

export const MapContainer: React.FC<MapContainerProps> = ({
  apiKey,
  center,
  zoom,
  places,
  selectedPlaceId,
  userLocation,
  onCenterChange,
  onSelectPlace,
  onAskAboutArea,
  onAskAboutPlace,
  onRequestUserLocation,
  isLocating,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [showTraffic, setShowTraffic] = useState(false);
  const [currentCenter, setCurrentCenter] = useState<MapCoordinates>(center);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);

  const selectedPlace = places.find((p) => p.id === selectedPlaceId) || null;

  // Handle camera idle
  const handleCameraChange = useCallback(
    (ev: { detail: { center: google.maps.LatLngLiteral; zoom: number } }) => {
      const newCenter = { lat: ev.detail.center.lat, lng: ev.detail.center.lng };
      setCurrentCenter(newCenter);
      setCurrentZoom(ev.detail.zoom);
      onCenterChange(newCenter, ev.detail.zoom);
    },
    [onCenterChange]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    // Check if input matches one of our presets first
    const matchedPreset = PRESET_LOCATIONS.find(
      (p) =>
        p.name.toLowerCase() === searchInput.trim().toLowerCase() ||
        p.country.toLowerCase() === searchInput.trim().toLowerCase()
    );

    if (matchedPreset) {
      onCenterChange({ lat: matchedPreset.lat, lng: matchedPreset.lng }, matchedPreset.zoom);
      return;
    }

    // Geocoding via Google Maps Geocoder if loaded
    if (typeof window !== 'undefined' && (window as unknown as { google?: typeof google }).google?.maps?.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: searchInput }, (results: google.maps.GeocoderResult[] | null, status: string) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          onCenterChange({ lat: loc.lat(), lng: loc.lng() }, 14);
        } else {
          // If geocoding fails, ask the chatbot to navigate there
          onAskAboutArea(currentCenter);
        }
      });
    } else {
      onAskAboutArea(currentCenter);
    }
  };

  const handleSelectPreset = (preset: PresetLocation) => {
    onCenterChange({ lat: preset.lat, lng: preset.lng }, preset.zoom);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900">
      {/* Top Map Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        {/* Search bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="pointer-events-auto flex items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 flex-1 min-w-[200px] max-w-md transition-all focus-within:ring-2 focus-within:ring-sky-500"
        >
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search city, address or landmark..."
            className="w-full text-xs md:text-sm bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
            >
              ✕
            </button>
          )}
        </form>

        {/* Quick Map Controls Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg border border-slate-200/80 dark:border-slate-800 rounded-xl p-1">
          <button
            type="button"
            onClick={onRequestUserLocation}
            disabled={isLocating}
            title="Locate my position"
            className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 text-xs"
          >
            <Navigation className={`w-4 h-4 text-sky-500 ${isLocating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">My Location</span>
          </button>

          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700" />

          {/* Map Layer Switcher */}
          <button
            type="button"
            onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
            title="Toggle Satellite Imagery"
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
              mapType === 'satellite'
                ? 'bg-sky-500 text-white font-medium'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">{mapType === 'satellite' ? 'Satellite' : 'Map'}</span>
          </button>

          {/* Traffic Toggle */}
          <button
            type="button"
            onClick={() => setShowTraffic(!showTraffic)}
            title="Toggle Live Traffic"
            className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
              showTraffic
                ? 'bg-emerald-500 text-white font-medium'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            <span className="hidden md:inline">Traffic</span>
          </button>
        </div>
      </div>

      {/* Preset Destinations Bar */}
      <div className="absolute top-16 left-3 right-3 z-10 flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-none pb-1">
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-800/80 shadow-md">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1">
            <Compass className="w-3 h-3 text-sky-400" /> Jump to:
          </span>
          {PRESET_LOCATIONS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition whitespace-nowrap"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Google Maps Viewport with APIProvider */}
      <div className="w-full h-full flex-1">
        <APIProvider apiKey={apiKey} language="en">
          <Map
            defaultCenter={{ lat: center.lat, lng: center.lng }}
            defaultZoom={zoom}
            mapId="DEMO_MAP_ID"
            mapTypeId={mapType}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            onCameraChanged={handleCameraChange}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={true}
            streetViewControl={true}
            fullscreenControl={false}
          >
            {/* Camera Sync Controller */}
            <MapCameraController center={center} zoom={zoom} selectedPlace={selectedPlace} />

            {/* Live Traffic Layer */}
            <TrafficLayerComponent showTraffic={showTraffic} />

            {/* User Location Pulse Marker */}
            {userLocation && (
              <AdvancedMarker position={{ lat: userLocation.lat, lng: userLocation.lng }}>
                <div className="relative flex items-center justify-center">
                  <div className="w-5 h-5 bg-sky-500 rounded-full border-2 border-white shadow-lg z-10" />
                  <div className="absolute w-10 h-10 bg-sky-400/30 rounded-full animate-ping" />
                </div>
              </AdvancedMarker>
            )}

            {/* AI Discovered Place Pins */}
            {places.map((place) => {
              const isSelected = place.id === selectedPlaceId;
              const catConfig = CATEGORY_COLORS[place.category] || CATEGORY_COLORS.other;

              return (
                <AdvancedMarker
                  key={place.id}
                  position={{ lat: place.lat, lng: place.lng }}
                  onClick={() => onSelectPlace(place)}
                  title={place.name}
                  zIndex={isSelected ? 100 : 10}
                >
                  <Pin
                    background={isSelected ? '#2563eb' : catConfig.bg}
                    borderColor={isSelected ? '#ffffff' : catConfig.border}
                    glyphColor={catConfig.glyph}
                    scale={isSelected ? 1.3 : 1.0}
                  />
                </AdvancedMarker>
              );
            })}

            {/* Place InfoWindow */}
            {selectedPlace && (
              <InfoWindow
                position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                onCloseClick={() => onSelectPlace(null)}
                pixelOffset={[0, -35]}
              >
                <div className="p-1 max-w-[260px] text-slate-900">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {selectedPlace.category}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 mt-1 leading-tight">
                        {selectedPlace.name}
                      </h4>
                    </div>
                    {selectedPlace.rating && (
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-amber-700 text-xs font-semibold shrink-0">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{selectedPlace.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {selectedPlace.address && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                      <span className="truncate">{selectedPlace.address}</span>
                    </p>
                  )}

                  <p className="text-xs text-slate-600 mt-1.5 leading-snug line-clamp-3">
                    {selectedPlace.description}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => onAskAboutPlace(selectedPlace)}
                      className="text-xs font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1 px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 transition"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Ask AI about this
                    </button>

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        selectedPlace.name + ' ' + (selectedPlace.address || '')
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition"
                      title="Open in Google Maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>

      {/* Floating Action Button: "Ask AI about this area" */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 pointer-events-none">
        <button
          type="button"
          onClick={() => onAskAboutArea(currentCenter)}
          className="pointer-events-auto bg-slate-900/90 hover:bg-slate-900 text-white dark:bg-sky-600 dark:hover:bg-sky-500 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl border border-white/20 dark:border-sky-400/30 flex items-center gap-2 text-xs md:text-sm font-semibold transition-all transform hover:scale-105 active:scale-95"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Explore this map view with AI</span>
        </button>
      </div>

      {/* Discovered places count badge */}
      {places.length > 0 && (
        <div className="absolute bottom-5 right-3 z-10 pointer-events-auto">
          <div className="bg-slate-900/90 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-slate-700 shadow-lg flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{places.length} places pinned</span>
          </div>
        </div>
      )}
    </div>
  );
};
