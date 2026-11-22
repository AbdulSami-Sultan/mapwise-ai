/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlaceMarker,
  MapCoordinates,
  DirectionTravelMode,
  MultiModeDirectionsResponse,
  ActiveDirectionsDisplay,
  DirectionStep,
} from '../types.ts';
import {
  ArrowLeft,
  Car,
  Bus,
  Footprints,
  LocateFixed,
  MapPin,
  Clock,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  Flag,
  Crosshair,
  X,
} from 'lucide-react';

interface DirectionsPanelProps {
  destination: PlaceMarker;
  userLocation: MapCoordinates | null;
  mapCenter: MapCoordinates;
  isLocating: boolean;
  locationError: string | null;
  onRequestUserLocation: () => void;
  onBack: () => void;
  onSelectActiveRoute: (display: ActiveDirectionsDisplay | null) => void;
}

const DIRECTION_MODES: Array<{
  id: DirectionTravelMode;
  label: string;
  gmapsParam: string;
  icon: React.ElementType;
  activeClass: string;
  badgeClass: string;
}> = [
  {
    id: 'DRIVE',
    label: 'Driving',
    gmapsParam: 'driving',
    icon: Car,
    activeClass: 'bg-sky-500/20 border-sky-400 text-sky-200',
    badgeClass: 'text-sky-300',
  },
  {
    id: 'TRANSIT',
    label: 'Transit',
    gmapsParam: 'transit',
    icon: Bus,
    activeClass: 'bg-purple-500/20 border-purple-400 text-purple-200',
    badgeClass: 'text-purple-300',
  },
  {
    id: 'WALK',
    label: 'Walking',
    gmapsParam: 'walking',
    icon: Footprints,
    activeClass: 'bg-emerald-500/20 border-emerald-400 text-emerald-200',
    badgeClass: 'text-emerald-300',
  },
];

function getStepIcon(step: DirectionStep) {
  if (step.transitDetails || step.travelMode === 'TRANSIT') {
    return <Bus className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
  }
  if (step.travelMode === 'WALK') {
    return <Footprints className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  }
  const m = (step.maneuver || '').toUpperCase();
  if (m.includes('LEFT')) {
    return <CornerUpLeft className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  }
  if (m.includes('RIGHT')) {
    return <CornerUpRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  }
  if (m.includes('ARRIVE') || m.includes('DESTINATION')) {
    return <Flag className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  return <ArrowUp className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
}

export const DirectionsPanel: React.FC<DirectionsPanelProps> = ({
  destination,
  userLocation,
  mapCenter,
  isLocating,
  locationError,
  onRequestUserLocation,
  onBack,
  onSelectActiveRoute,
}) => {
  const [originSource, setOriginSource] = useState<'gps' | 'mapCenter'>('gps');
  const [mapCenterSnapshot, setMapCenterSnapshot] = useState<MapCoordinates>(mapCenter);
  const [selectedMode, setSelectedMode] = useState<DirectionTravelMode>('DRIVE');
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  const [directionsData, setDirectionsData] = useState<MultiModeDirectionsResponse | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const autoRequestedGpsRef = useRef(false);
  const cacheRef = useRef<Record<string, MultiModeDirectionsResponse>>({});

  // Capture map center snapshot only when switching to mapCenter origin
  const handleSwitchToMapCenter = () => {
    setMapCenterSnapshot(mapCenter);
    setOriginSource('mapCenter');
  };

  const handleSwitchToGps = () => {
    setOriginSource('gps');
    if (!userLocation && !isLocating) {
      onRequestUserLocation();
    }
  };

  // Automatically ask for browser geolocation once when opening directions if not yet known
  useEffect(() => {
    if (originSource === 'gps' && !userLocation && !isLocating && !locationError && !autoRequestedGpsRef.current) {
      autoRequestedGpsRef.current = true;
      onRequestUserLocation();
    }
  }, [originSource, userLocation, isLocating, locationError, onRequestUserLocation]);

  const activeOrigin: MapCoordinates | null =
    originSource === 'gps' ? userLocation : mapCenterSnapshot;

  const activeOriginLabel =
    originSource === 'gps' ? 'Your Current Location' : 'Current Map Center';

  const fetchDirections = useCallback(
    async (origin: MapCoordinates, dest: PlaceMarker, bypassCache = false) => {
      const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${dest.id}`;
      if (!bypassCache && cacheRef.current[cacheKey]) {
        setDirectionsData(cacheRef.current[cacheKey]);
        setRouteError(null);
        return;
      }

      setIsLoadingRoutes(true);
      setRouteError(null);

      try {
        const res = await fetch('/api/routes/directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { lat: origin.lat, lng: origin.lng },
            destination: { lat: dest.lat, lng: dest.lng },
            travelModes: ['DRIVE', 'TRANSIT', 'WALK'],
          }),
        });

        if (!res.ok) {
          if (res.status === 429) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || `Directions request failed (HTTP ${res.status})`);
        }

        const data: MultiModeDirectionsResponse = await res.json();
        cacheRef.current[cacheKey] = data;
        setDirectionsData(data);

        // If currently chosen mode has no routes, pick first mode with routes
        const modePriority: DirectionTravelMode[] = ['DRIVE', 'TRANSIT', 'WALK'];
        setSelectedMode((currentMode) => {
          if (data.modes[currentMode]?.routes?.length > 0) return currentMode;
          const fallback = modePriority.find((m) => (data.modes[m]?.routes?.length || 0) > 0);
          return fallback || currentMode;
        });
        setSelectedRouteIndex(0);
      } catch (err: unknown) {
        console.error('Failed to fetch directions:', err);
        setRouteError(
          err instanceof Error
            ? err.message
            : 'Unable to calculate directions. Please try again.'
        );
        setDirectionsData(null);
      } finally {
        setIsLoadingRoutes(false);
      }
    },
    []
  );

  // Trigger directions fetch whenever origin or destination changes
  useEffect(() => {
    if (!activeOrigin) return;
    fetchDirections(activeOrigin, destination);
  }, [activeOrigin?.lat, activeOrigin?.lng, destination.id, fetchDirections, activeOrigin, destination]);

  // Keep map route polyline synced with currently selected mode & route option
  const currentModeResult = directionsData?.modes[selectedMode] || null;
  const currentRoutes = currentModeResult?.routes || [];
  const activeRoute = currentRoutes[selectedRouteIndex] || currentRoutes[0] || null;

  useEffect(() => {
    if (activeOrigin && activeRoute) {
      onSelectActiveRoute({
        origin: activeOrigin,
        originLabel: activeOriginLabel,
        destination,
        travelMode: selectedMode,
        route: activeRoute,
      });
    } else if (!isLoadingRoutes && activeOrigin && directionsData) {
      onSelectActiveRoute(null);
    }
  }, [
    activeOrigin,
    activeOriginLabel,
    activeRoute,
    destination,
    selectedMode,
    isLoadingRoutes,
    directionsData,
    onSelectActiveRoute,
  ]);

  const activeModeConfig =
    DIRECTION_MODES.find((m) => m.id === selectedMode) || DIRECTION_MODES[0];

  const googleMapsDirUrl = activeOrigin
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        `${activeOrigin.lat},${activeOrigin.lng}`
      )}&destination=${encodeURIComponent(
        `${destination.lat},${destination.lng}`
      )}&travelmode=${activeModeConfig.gmapsParam}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${destination.lat},${destination.lng}`
      )}&travelmode=${activeModeConfig.gmapsParam}`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sub-header with Back button */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 py-1 px-2 -ml-1 rounded-lg hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Saved</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onSelectActiveRoute(null);
            onBack();
          }}
          className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800 transition"
          title="Clear route overlay and exit directions"
        >
          <X className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* Origin -> Destination Summary Card */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/40 space-y-2">
        <div className="flex items-start gap-2.5">
          {/* Vertical connector dots */}
          <div className="flex flex-col items-center pt-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-sky-400/30" />
            <div className="w-[1.5px] h-5 bg-slate-700 my-0.5" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Origin Row */}
            <div className="flex items-center justify-between gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <div className="min-w-0 flex items-center gap-1.5">
                {originSource === 'gps' ? (
                  <LocateFixed className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="text-xs text-slate-200 font-medium truncate">
                  {activeOriginLabel}
                </span>
              </div>

              {originSource === 'gps' ? (
                <button
                  type="button"
                  onClick={handleSwitchToMapCenter}
                  className="text-[10px] font-semibold text-slate-400 hover:text-sky-300 whitespace-nowrap transition"
                  title="Route from the current map center instead"
                >
                  Use Map
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSwitchToGps}
                  className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 whitespace-nowrap transition"
                  title="Switch to your live GPS location"
                >
                  Use GPS
                </button>
              )}
            </div>

            {/* Destination Row */}
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs text-white font-semibold truncate">
                  {destination.name}
                </span>
              </div>
              {destination.address && (
                <p className="text-[10px] text-slate-400 truncate pl-5 mt-0.5">
                  {destination.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mode Comparison Tabs: Driving | Transit | Walking */}
      <div className="p-2 border-b border-slate-800 bg-slate-950/60 grid grid-cols-3 gap-1.5">
        {DIRECTION_MODES.map((mode) => {
          const Icon = mode.icon;
          const modeRoutes = directionsData?.modes[mode.id]?.routes || [];
          const primaryRoute = modeRoutes[0];
          const isSelected = selectedMode === mode.id;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                setSelectedMode(mode.id);
                setSelectedRouteIndex(0);
              }}
              className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-0.5 ${
                isSelected
                  ? mode.activeClass
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[11px] font-semibold">{mode.label}</span>
              <span
                className={`text-[10px] font-bold ${
                  primaryRoute
                    ? isSelected
                      ? mode.badgeClass
                      : 'text-slate-300'
                    : 'text-slate-500'
                }`}
              >
                {isLoadingRoutes
                  ? '...'
                  : primaryRoute
                    ? primaryRoute.durationText
                    : activeOrigin && directionsData
                      ? 'N/A'
                      : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Waiting for / Missing User Location */}
        {originSource === 'gps' && !userLocation && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-3">
            {isLocating ? (
              <>
                <div className="w-10 h-10 rounded-full bg-sky-500/15 border border-sky-500/40 flex items-center justify-center mx-auto">
                  <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Detecting your current location...
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Allow browser location access to calculate directions from where you are.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSwitchToMapCenter}
                  className="text-[11px] font-medium text-sky-400 hover:text-sky-300 underline"
                >
                  Or start from current map center instead
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto">
                  <LocateFixed className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Current Location Needed
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {locationError ||
                      'Share your location to get walking, transit, and driving routes to this saved place.'}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={onRequestUserLocation}
                    className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>Use My Current Location</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchToMapCenter}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-[11px] flex items-center justify-center gap-1.5 transition"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Use Current Map Center Instead</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Loading Routes Skeleton */}
        {activeOrigin && isLoadingRoutes && (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
            <RefreshCw className="w-5 h-5 text-sky-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-300 font-medium">
              Calculating driving, transit, and walking routes...
            </p>
          </div>
        )}

        {/* Error State */}
        {activeOrigin && !isLoadingRoutes && routeError && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Unable to load route options</p>
                <p className="text-[11px] text-rose-300/90 mt-0.5">{routeError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fetchDirections(activeOrigin, destination, true)}
              className="w-full py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-100 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* No Routes Available for Selected Mode */}
        {activeOrigin && !isLoadingRoutes && !routeError && directionsData && currentRoutes.length === 0 && (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-1.5">
            <p className="text-xs font-semibold text-slate-200">
              No {activeModeConfig.label.toLowerCase()} route available
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {selectedMode === 'TRANSIT'
                ? 'Public transit schedules or routes may not cover this origin and destination pair. Try Driving or Walking, or switch to the map center nearby.'
                : 'These locations may be too far apart or separated by water for this travel mode.'}
            </p>
          </div>
        )}

        {/* Route Options Selector (Primary + Alternatives) */}
        {activeOrigin && !isLoadingRoutes && currentRoutes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Route Options ({currentRoutes.length})
              </span>
              <button
                type="button"
                onClick={() => fetchDirections(activeOrigin, destination, true)}
                className="text-[10px] text-slate-400 hover:text-sky-300 flex items-center gap-1 transition"
                title="Refresh routes"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {currentRoutes.map((route, idx) => {
                const isSelected = idx === selectedRouteIndex;
                return (
                  <button
                    key={`${selectedMode}-${idx}`}
                    type="button"
                    onClick={() => setSelectedRouteIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-xl border transition ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-500 ring-1 ring-sky-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="font-bold text-sm text-white">
                          {route.durationText}
                        </span>
                        <span className="text-slate-500 text-xs">•</span>
                        <span className="text-xs text-slate-300 truncate">
                          {route.distanceText}
                        </span>
                      </div>
                      {idx === 0 && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                          Best
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      {route.summary}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Turn-by-Turn Steps */}
        {activeOrigin && !isLoadingRoutes && activeRoute && activeRoute.steps.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-0.5 block">
              Step-by-Step Directions ({activeRoute.steps.length})
            </span>

            <div className="space-y-1.5">
              {activeRoute.steps.map((step, sIdx) => (
                <div
                  key={sIdx}
                  className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 flex items-start gap-2.5"
                >
                  <div className="mt-0.5 w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    {getStepIcon(step)}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Transit Line Badge if transit step */}
                    {step.transitDetails && (
                      <div className="flex items-center flex-wrap gap-1.5 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-600 text-white border border-purple-400/40">
                          {step.transitDetails.lineShortName ||
                            step.transitDetails.lineName ||
                            step.transitDetails.vehicleType ||
                            'Transit'}
                        </span>
                        {step.transitDetails.vehicleType && (
                          <span className="text-[10px] text-purple-300 font-medium">
                            {step.transitDetails.vehicleType}
                          </span>
                        )}
                        {step.transitDetails.stopCount !== undefined && (
                          <span className="text-[10px] text-slate-400">
                            • {step.transitDetails.stopCount} stop
                            {step.transitDetails.stopCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-slate-200 leading-snug">
                      {step.instruction}
                    </p>

                    {step.transitDetails &&
                      (step.transitDetails.departureStop || step.transitDetails.arrivalStop) && (
                        <div className="mt-1 text-[10px] text-slate-400 space-y-0.5 bg-slate-900/80 rounded-lg px-2 py-1 border border-slate-800">
                          {step.transitDetails.departureStop && (
                            <div className="truncate">
                              <span className="text-slate-500">From:</span>{' '}
                              <span className="text-slate-300">
                                {step.transitDetails.departureStop}
                              </span>
                              {step.transitDetails.departureTime && (
                                <span className="text-sky-300 ml-1">
                                  ({step.transitDetails.departureTime})
                                </span>
                              )}
                            </div>
                          )}
                          {step.transitDetails.arrivalStop && (
                            <div className="truncate">
                              <span className="text-slate-500">To:</span>{' '}
                              <span className="text-slate-300">
                                {step.transitDetails.arrivalStop}
                              </span>
                              {step.transitDetails.arrivalTime && (
                                <span className="text-sky-300 ml-1">
                                  ({step.transitDetails.arrivalTime})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{step.distanceText}</span>
                      <span>•</span>
                      <span>{step.durationText}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80">
        <a
          href={googleMapsDirUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-md"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Start Navigation in Google Maps</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>
      </div>
    </div>
  );
};
