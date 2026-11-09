/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlaceMarker } from '../types.ts';
import { MapPin, Star, ExternalLink, MessageSquare, X, Filter, Bookmark, Sparkles, Trash2 } from 'lucide-react';

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
  initialTab?: 'discovered' | 'saved';
}

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
  initialTab = 'discovered',
}) => {
  const [activeTab, setActiveTab] = useState<'discovered' | 'saved'>(initialTab);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  if (!isOpen) return null;

  const activePlacesList = activeTab === 'discovered' ? places : savedPlaces;
  const categories = ['all', ...Array.from(new Set(activePlacesList.map((p) => p.category)))];
  const filteredPlaces =
    filterCategory === 'all'
      ? activePlacesList
      : activePlacesList.filter((p) => p.category === filterCategory);

  return (
    <div className="absolute right-0 top-0 bottom-0 w-84 max-w-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-40 flex flex-col transition-all animate-in slide-in-from-right duration-200">
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
          onClick={() => setActiveTab('discovered')}
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
          onClick={() => setActiveTab('saved')}
          className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            activeTab === 'saved'
              ? 'bg-amber-950/50 text-amber-300 shadow-sm border border-amber-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Bookmark className={`w-3.5 h-3.5 ${savedPlaces.length > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
          <span>Saved ({savedPlaces.length})</span>
        </button>
      </div>

      {/* Category filter pills */}
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
                  Click the bookmark icon on any marker or place card to save your favorite locations for later.
                </p>
              </div>
            ) : (
              <div className="text-xs">No places discovered in this category yet.</div>
            )}
          </div>
        ) : (
          filteredPlaces.map((place) => {
            const isSelected = place.id === selectedPlaceId;
            const isSaved = isPlaceSaved(place.id);

            return (
              <div
                key={place.id}
                className={`p-3 rounded-xl border transition cursor-pointer group ${
                  isSelected
                    ? 'bg-slate-800 border-sky-500 ring-1 ring-sky-500'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => onSelectPlace(place)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {place.category}
                    </span>
                    <h4 className="font-semibold text-xs text-white mt-1 group-hover:text-sky-300 transition truncate">
                      {place.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
            );
          })
        )}
      </div>

      {/* Saved Places Action Footer */}
      {activeTab === 'saved' && savedPlaces.length > 0 && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
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
              className="w-full py-1.5 text-center text-[11px] text-slate-400 hover:text-rose-400 transition flex items-center justify-center gap-1"
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
