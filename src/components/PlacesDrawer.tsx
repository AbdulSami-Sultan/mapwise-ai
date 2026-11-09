/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PlaceMarker, TravelMode, DistanceMatrixResult } from '../types.ts';
import {
  MapPin,
  Star,
  ExternalLink,
  MessageSquare,
  X,
  Filter,
  Bookmark,
  Sparkles,
  Trash2,
  Car,
  Footprints,
  Bike,
  Bus,
  Clock,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Navigation,
} from 'lucide-react';

interface PlacesDrawerProps {
  places: PlaceMarker[];
  savedPlaces: PlaceMarker[];
  selectedPlaceId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectPlace: (place: PlaceMarker) => void;
  onAskAboutPlace: (place: PlaceMarker) => void;
  isPlaceSaved: (id: string) => boolean;
  onToggleSavePlace: (place: PlaceMarker) => void;
  onClearSavedPlaces?: () => void;
  onAskAboutSavedPlaces?: () => void;
  onReorderSavedPlaces?: (newOrder: PlaceMarker[]) => void;
  initialTab?: 'discovered' | 'saved';
}

const TRAVEL_MODES: Array<{ id: TravelMode; label: string; icon: React.ElementType }> = [
  { id: 'DRIVE', label: 'Drive', icon: Car },
  { id: 'WALK', label: 'Walk', icon: Footprints },
  { id: 'BICYCLE', label: 'Bike', icon: Bike },
  { id: 'TRANSIT', label: 'Transit', icon: Bus },
];

export const PlacesDrawer: React.FC<PlacesDrawerProps> = ({
  places,
  savedPlaces,
  selectedPlaceId,
  isOpen,
  onClose,
  onSelectPlace,
  onAskAboutPlace,
  isPlaceSaved,
  onToggleSavePlace,
  onClearSavedPlaces,
  onAskAboutSavedPlaces,
  onReorderSavedPlaces,
  initialTab = 'discovered',
}) => {
  const [activeTab, setActiveTab] = useState<'discovered' | 'saved'>(initialTab);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVE');

  // Travel time calculation state (Distance Matrix)
  const [matrixResult, setMatrixResult] = useState<DistanceMatrixResult | null>(null);
  const [isCalculatingTimes, setIsCalculatingTimes] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  // Sync initial tab when changed externally
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Fetch estimated travel times via server Distance Matrix endpoint
  const calculateTravelTimes = useCallback(
    async (placesList: PlaceMarker[], mode: TravelMode) => {
      if (placesList.length < 2) {
        setMatrixResult(null);
        setMatrixError(null);
        return;
      }

      setIsCalculatingTimes(true);
      setMatrixError(null);

      try {
        const res = await fetch('/api/routes/distance-matrix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            places: placesList.map((p) => ({
              id: p.id,
              name: p.name,
              lat: p.lat,
              lng: p.lng,
            })),
            travelMode: mode,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${res.status}`);
        }

        const data: DistanceMatrixResult = await res.json();
        setMatrixResult(data);
      } catch (err: unknown) {
        console.warn('Distance Matrix calculation failed:', err);
        setMatrixError('Unable to calculate travel times. Please try again.');
        setMatrixResult(null);
      } finally {
        setIsCalculatingTimes(false);
      }
    },
    []
  );

  // Automatically recalculate travel times when saved places or travel mode change
  useEffect(() => {
    if (activeTab === 'saved' && savedPlaces.length >= 2) {
      calculateTravelTimes(savedPlaces, travelMode);
    } else {
      setMatrixResult(null);
      setMatrixError(null);
    }
  }, [savedPlaces, travelMode, activeTab, calculateTravelTimes]);

  if (!isOpen) return null;

  const activePlacesList = activeTab === 'discovered' ? places : savedPlaces;
  const categories = ['all', ...Array.from(new Set(activePlacesList.map((p) => p.category)))];
  const filteredPlaces =
    filterCategory === 'all'
      ? activePlacesList
      : activePlacesList.filter((p) => p.category === filterCategory);

  // Reordering helpers
  const handleMovePlace = (index: number, direction: 'up' | 'down') => {
    if (!onReorderSavedPlaces) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= savedPlaces.length) return;

    const newOrder = [...savedPlaces];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);
    onReorderSavedPlaces(newOrder);
  };

  // Google Maps multi-stop route directions URL generator
  const getGoogleMapsRouteUrl = () => {
    if (savedPlaces.length < 2) return '#';
    const origin = `${savedPlaces[0].lat},${savedPlaces[0].lng}`;
    const destination = `${savedPlaces[savedPlaces.length - 1].lat},${savedPlaces[savedPlaces.length - 1].lng}`;
    const waypoints = savedPlaces
      .slice(1, savedPlaces.length - 1)
      .map((p) => `${p.lat},${p.lng}`)
      .join('|');
    const modeParam = travelMode.toLowerCase();
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(destination)}${
      waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''
    }&travelmode=${modeParam}`;
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-88 max-w-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-40 flex flex-col transition-all animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeTab === 'saved' ? (
            <Bookmark className="w-4 h-4 text-amber-400 fill-amber-400" />
          ) : (
            <MapPin className="w-4 h-4 text-emerald-400" />
          )}
          <h3 className="font-bold text-sm text-white">
            {activeTab === 'saved' ? 'Saved Places' : 'Discovered Places'}
          </h3>
          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold">
            {activePlacesList.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Switcher: Discovered vs Saved */}
      <div className="p-2 border-b border-slate-800 grid grid-cols-2 gap-1 bg-slate-950/60">
        <button
          type="button"
          onClick={() => {
            setActiveTab('discovered');
            setFilterCategory('all');
          }}
          className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'discovered'
              ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>Discovered ({places.length})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('saved');
            setFilterCategory('all');
          }}
          className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'saved'
              ? 'bg-amber-950/50 text-amber-300 shadow-sm border border-amber-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Bookmark
            className={`w-3.5 h-3.5 ${
              savedPlaces.length > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-400'
            }`}
          />
          <span>Saved ({savedPlaces.length})</span>
        </button>
      </div>

      {/* Distance Matrix Travel Mode Bar (Visible on Saved tab with >= 2 places) */}
      {activeTab === 'saved' && savedPlaces.length >= 2 && (
        <div className="p-2 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Travel Time Mode:</span>
            </span>
            {isCalculatingTimes && (
              <span className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                Calculating...
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1">
            {TRAVEL_MODES.map((mode) => {
              const Icon = mode.icon;
              const isSelected = travelMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setTravelMode(mode.id)}
                  disabled={isCalculatingTimes}
                  className={`py-1 px-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={`Calculate ${mode.label} times`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="text-[11px]">{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Travel Summary Card */}
          {matrixResult && (
            <div className="mt-2 p-2 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-amber-400 font-bold tracking-wider block">
                    Total Estimated Trip Time:
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-bold text-amber-200 text-sm">
                      {matrixResult.totalDurationText}
                    </span>
                    <span className="text-amber-400/60">•</span>
                    <span className="text-slate-300 text-[11px]">
                      {matrixResult.totalDistanceText}
                    </span>
                  </div>
                </div>

                <a
                  href={getGoogleMapsRouteUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] text-amber-300 font-medium flex items-center gap-1 transition"
                  title="Open complete multi-stop itinerary in Google Maps"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Map Route</span>
                </a>
              </div>
            </div>
          )}

          {matrixError && (
            <div className="mt-1.5 text-[11px] text-rose-400 flex items-center justify-between">
              <span>{matrixError}</span>
              <button
                type="button"
                onClick={() => calculateTravelTimes(savedPlaces, travelMode)}
                className="underline hover:text-rose-300 ml-1"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Category filter pills (if more than 2 categories exist) */}
      {categories.length > 2 && (
        <div className="p-2 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <Filter className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize whitespace-nowrap transition ${
                filterCategory === cat
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Places List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredPlaces.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400">
            {activeTab === 'saved' ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400 mb-3">
                  <Bookmark className="w-6 h-6" />
                </div>
                <h4 className="font-semibold text-sm text-slate-200 mb-1">No saved places yet</h4>
                <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed">
                  Click the bookmark icon on any marker or place card to save your favorite locations and calculate travel times between them.
                </p>
              </div>
            ) : (
              <div className="text-xs">No places discovered in this category yet.</div>
            )}
          </div>
        ) : (
          filteredPlaces.map((place, index) => {
            const isSelected = place.id === selectedPlaceId;
            const isSaved = isPlaceSaved(place.id);
            const segmentToNext =
              activeTab === 'saved' && matrixResult?.segments && index < matrixResult.segments.length
                ? matrixResult.segments[index]
                : null;

            return (
              <React.Fragment key={place.id}>
                <div
                  className={`p-3 rounded-xl border transition cursor-pointer group ${
                    isSelected
                      ? 'bg-slate-800 border-sky-500 ring-1 ring-sky-500'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                  onClick={() => onSelectPlace(place)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {activeTab === 'saved' && (
                          <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-md">
                            Stop {index + 1}
                          </span>
                        )}
                        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {place.category}
                        </span>
                      </div>
                      <h4 className="font-semibold text-xs text-white mt-1 group-hover:text-sky-300 transition truncate">
                        {place.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Reorder arrows for saved itinerary */}
                      {activeTab === 'saved' && onReorderSavedPlaces && savedPlaces.length > 1 && (
                        <div className="flex items-center gap-0.5 mr-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMovePlace(index, 'up')}
                            className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition"
                            title="Move up in route order"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={index === savedPlaces.length - 1}
                            onClick={() => handleMovePlace(index, 'down')}
                            className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition"
                            title="Move down in route order"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {place.rating && (
                        <div className="flex items-center gap-0.5 text-xs text-amber-400 font-semibold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{place.rating.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Bookmark Toggle Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSavePlace(place);
                        }}
                        className={`p-1 rounded-lg transition ${
                          isSaved
                            ? 'text-amber-400 bg-amber-950/40 hover:bg-amber-950/70 border border-amber-800/50'
                            : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                        }`}
                        title={isSaved ? 'Remove from saved' : 'Save place'}
                        aria-label={isSaved ? 'Remove from saved' : 'Save place'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {place.address && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0 text-slate-500" />
                      <span>{place.address}</span>
                    </p>
                  )}

                  <p className="text-xs text-slate-300 mt-1.5 line-clamp-2 leading-relaxed">
                    {place.description}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAskAboutPlace(place);
                      }}
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Ask AI about this
                    </button>

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        place.name + ' ' + (place.address || '')
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
                      title="View on Google Maps"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Distance Matrix Estimated Travel Time Connector to Next Stop */}
                {activeTab === 'saved' && segmentToNext && (
                  <div className="flex flex-col items-center my-1">
                    <div className="w-[2px] h-2 bg-amber-500/40" />
                    <div className="py-1 px-3 rounded-full bg-amber-950/70 border border-amber-800/70 text-[11px] text-amber-300 font-medium flex items-center gap-1.5 shadow-sm">
                      <ArrowDown className="w-3 h-3 text-amber-400 animate-bounce" />
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span className="font-bold">{segmentToNext.durationText}</span>
                      <span className="text-amber-500/60">•</span>
                      <span className="text-slate-400 text-[10px]">{segmentToNext.distanceText}</span>
                    </div>
                    <div className="w-[2px] h-2 bg-amber-500/40" />
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Saved Places Action Footer */}
      {activeTab === 'saved' && savedPlaces.length > 0 && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
          {savedPlaces.length === 1 && (
            <p className="text-[11px] text-slate-400 text-center">
              💡 Save at least 2 places to calculate travel times between them.
            </p>
          )}

          {onAskAboutSavedPlaces && (
            <button
              type="button"
              onClick={onAskAboutSavedPlaces}
              className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Plan tour with my saved places</span>
            </button>
          )}

          {onClearSavedPlaces && (
            <button
              type="button"
              onClick={onClearSavedPlaces}
              className="w-full py-1 text-center text-[11px] text-slate-400 hover:text-rose-400 transition flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear all saved places</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
