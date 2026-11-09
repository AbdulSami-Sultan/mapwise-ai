/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlaceMarker } from '../types.ts';
import { MapPin, Star, ExternalLink, MessageSquare, X, Filter } from 'lucide-react';

interface PlacesDrawerProps {
  places: PlaceMarker[];
  selectedPlaceId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectPlace: (place: PlaceMarker) => void;
  onAskAboutPlace: (place: PlaceMarker) => void;
}

export const PlacesDrawer: React.FC<PlacesDrawerProps> = ({
  places,
  selectedPlaceId,
  isOpen,
  onClose,
  onSelectPlace,
  onAskAboutPlace,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = ['all', ...Array.from(new Set(places.map((p) => p.category)))];
  const filteredPlaces =
    filterCategory === 'all' ? places : places.filter((p) => p.category === filterCategory);

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-40 flex flex-col transition-all animate-in slide-in-from-right duration-200">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-sm text-white">Discovered Places</h3>
          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-semibold">
            {places.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
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
          <div className="text-center py-10 text-slate-400 text-xs">
            No places discovered in this category yet.
          </div>
        ) : (
          filteredPlaces.map((place) => {
            const isSelected = place.id === selectedPlaceId;
            return (
              <div
                key={place.id}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 border-sky-500 ring-1 ring-sky-500'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => onSelectPlace(place)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {place.category}
                    </span>
                    <h4 className="font-semibold text-xs text-white mt-1">{place.name}</h4>
                  </div>
                  {place.rating && (
                    <div className="flex items-center gap-0.5 text-xs text-amber-400 font-semibold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40 shrink-0">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{place.rating.toFixed(1)}</span>
                    </div>
                  )}
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
                    Ask about this
                  </button>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      place.name + ' ' + (place.address || '')
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-400 hover:text-slate-200 p-1"
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
    </div>
  );
};
