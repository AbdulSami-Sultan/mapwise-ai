/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer } from './components/MapContainer.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { PlacesDrawer } from './components/PlacesDrawer.tsx';
import { QuotaBanner } from './components/QuotaBanner.tsx';
import {
  Message,
  PlaceMarker,
  RolePersonaId,
  GroundingMode,
  MapCoordinates,
} from './types.ts';
import { MessageSquare, Map as MapIcon, Bookmark, MapPin } from 'lucide-react';

// Default initial location: San Francisco, CA
const INITIAL_CENTER: MapCoordinates = {
  lat: 37.7749,
  lng: -122.4194,
};

export default function App() {
  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    'AIzaSyC7OnZ42KcgDlXbyAHcx5QD1sQ5JZESV1I';

  // Map state
  const [mapCenter, setMapCenter] = useState<MapCoordinates>(INITIAL_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [userLocation, setUserLocation] = useState<MapCoordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // Chat & AI state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePersonaId, setActivePersonaId] = useState<RolePersonaId>('guide');
  const [groundingMode, setGroundingMode] = useState<GroundingMode>('maps');
  const [activeModel, setActiveModel] = useState<string>('gemini-3.8-flash');

  // Discovered places pool from current chat
  const [allPlaces, setAllPlaces] = useState<PlaceMarker[]>([]);
  
  // Persisted saved favorite places from localStorage
  const [savedPlaces, setSavedPlaces] = useState<PlaceMarker[]>(() => {
    try {
      const stored = localStorage.getItem('mapsphere_saved_places');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to parse saved places from localStorage:', e);
      return [];
    }
  });

  const [isPlacesDrawerOpen, setIsPlacesDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState<'discovered' | 'saved'>('discovered');

  // Mobile layout switcher ('chat' | 'map')
  const [mobileActiveTab, setMobileActiveTab] = useState<'chat' | 'map'>('chat');

  // Save to localStorage whenever savedPlaces changes
  useEffect(() => {
    try {
      localStorage.setItem('mapsphere_saved_places', JSON.stringify(savedPlaces));
    } catch (e) {
      console.warn('Failed to store saved places in localStorage:', e);
    }
  }, [savedPlaces]);

  // Combined places for pins on the interactive map
  const mapPlaces = React.useMemo(() => {
    const map = new Map<string, PlaceMarker>();
    savedPlaces.forEach((p) => map.set(p.name.toLowerCase(), p));
    allPlaces.forEach((p) => map.set(p.name.toLowerCase(), p));
    return Array.from(map.values());
  }, [allPlaces, savedPlaces]);

  const isPlaceSaved = useCallback(
    (placeId: string) => {
      return savedPlaces.some(
        (p) => p.id === placeId || p.name.toLowerCase() === placeId.toLowerCase()
      );
    },
    [savedPlaces]
  );

  const handleToggleSavePlace = useCallback(
    (place: PlaceMarker) => {
      setSavedPlaces((prev) => {
        const alreadySaved = prev.some(
          (p) => p.id === place.id || p.name.toLowerCase() === place.name.toLowerCase()
        );
        if (alreadySaved) {
          return prev.filter(
            (p) => p.id !== place.id && p.name.toLowerCase() !== place.name.toLowerCase()
          );
        } else {
          return [...prev, { ...place, savedAt: new Date().toISOString() }];
        }
      });
    },
    []
  );

  const handleClearSavedPlaces = useCallback(() => {
    if (window.confirm('Are you sure you want to remove all saved favorite places?')) {
      setSavedPlaces([]);
    }
  }, []);

  // Request browser geolocation
  const handleRequestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(coords);
        setMapCenter(coords);
        setMapZoom(14);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation access denied or failed:', err);
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  // Send message to server-side Gemini endpoint
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const payload = {
        messages: newMessages.map((m) => ({
          role: m.role,
          text: m.text,
        })),
        locationContext: {
          lat: mapCenter.lat,
          lng: mapCenter.lng,
          zoom: mapZoom,
        },
        rolePersona: activePersonaId,
        groundingMode: groundingMode,
        model: activeModel,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 429) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Request failed with status ${res.status}`);
      }

      const data = await res.json();

      const modelMessage: Message = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply || 'No response text received.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        places: data.places || [],
        groundingSources: data.groundingSources || [],
        webSearchQueries: data.webSearchQueries || [],
        groundingModeUsed: data.groundingModeUsed || groundingMode,
        activeModel: data.activeModel || activeModel,
      };

      setMessages((prev) => [...prev, modelMessage]);

      // Merge new places into the places pool
      if (data.places && data.places.length > 0) {
        setAllPlaces((prev) => {
          const map = new Map<string, PlaceMarker>();
          prev.forEach((p) => map.set(p.name.toLowerCase(), p));
          data.places.forEach((p: PlaceMarker) => map.set(p.name.toLowerCase(), p));
          return Array.from(map.values());
        });

        // Pan map smoothly to the first discovered place
        const firstPlace = data.places[0];
        setMapCenter({ lat: firstPlace.lat, lng: firstPlace.lng });
        setSelectedPlaceId(firstPlace.id);
      }
    } catch (err: unknown) {
      console.error('Failed to communicate with chat API:', err);
      const errorText =
        err instanceof Error
          ? err.message
          : 'Unable to connect to location services. Please try again.';

      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ **Error:** ${errorText}\n\nPlease check your internet connection or try re-submitting your question.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlace = (place: PlaceMarker | null) => {
    if (!place) {
      setSelectedPlaceId(null);
      return;
    }
    setSelectedPlaceId(place.id);
    setMapCenter({ lat: place.lat, lng: place.lng });
    setMapZoom(15);
    setMobileActiveTab('map');
  };

  const handleAskAboutArea = (center: MapCoordinates) => {
    setMobileActiveTab('chat');
    handleSendMessage(
      `What are the best highlights, scenic spots, authentic food, and insider tips around these coordinates (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})?`
    );
  };

  const handleAskAboutPlace = (place: PlaceMarker) => {
    setMobileActiveTab('chat');
    handleSendMessage(
      `Tell me in-depth details about ${place.name} (${place.address || ''}). What makes it unique, what is the best time to visit, and what tips should a visitor know?`
    );
  };

  const handleAskAboutSavedPlaces = () => {
    if (savedPlaces.length === 0) return;
    const names = savedPlaces.map((p) => p.name).join(', ');
    setMobileActiveTab('chat');
    setIsPlacesDrawerOpen(false);
    handleSendMessage(
      `I have saved these favorite locations: ${names}. Could you create a personalized walking tour or day itinerary connecting them with estimated times, transit/walking advice, and highlights?`
    );
  };

  const handleClearChat = () => {
    setMessages([]);
    setAllPlaces([]);
    setSelectedPlaceId(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Required In-App Quota Defense Banner */}
      <QuotaBanner />

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative">
        {/* Left Column: Multi-turn Chat Panel */}
        <div
          className={`w-full md:w-[460px] lg:w-[500px] xl:w-[540px] h-full flex-shrink-0 z-20 ${
            mobileActiveTab === 'chat' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            activePersonaId={activePersonaId}
            groundingMode={groundingMode}
            activeModel={activeModel}
            currentMapCenter={mapCenter}
            currentMapZoom={mapZoom}
            places={mapPlaces}
            onSendMessage={handleSendMessage}
            onSelectPersona={setActivePersonaId}
            onSelectGroundingMode={setGroundingMode}
            onSelectModel={setActiveModel}
            onClearChat={handleClearChat}
            onSelectPlace={handleSelectPlace}
            onRequestUserLocation={handleRequestUserLocation}
            isPlaceSaved={isPlaceSaved}
            onToggleSavePlace={handleToggleSavePlace}
          />
        </div>

        {/* Right Column: Google Maps Viewport */}
        <div
          className={`flex-1 h-full relative ${
            mobileActiveTab === 'map' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <MapContainer
            apiKey={apiKey}
            center={mapCenter}
            zoom={mapZoom}
            places={mapPlaces}
            selectedPlaceId={selectedPlaceId}
            userLocation={userLocation}
            onCenterChange={(newCenter, newZoom) => {
              setMapCenter(newCenter);
              setMapZoom(newZoom);
            }}
            onSelectPlace={handleSelectPlace}
            onAskAboutArea={handleAskAboutArea}
            onAskAboutPlace={handleAskAboutPlace}
            onRequestUserLocation={handleRequestUserLocation}
            isLocating={isLocating}
            isPlaceSaved={isPlaceSaved}
            onToggleSavePlace={handleToggleSavePlace}
            savedPlacesCount={savedPlaces.length}
            onOpenSavedPlaces={() => {
              setDrawerInitialTab('saved');
              setIsPlacesDrawerOpen(true);
            }}
          />

          {/* Floating Discovered / Saved Places Buttons */}
          {(allPlaces.length > 0 || savedPlaces.length > 0) && (
            <div className="absolute top-16 right-3 z-20 flex items-center gap-1.5">
              {allPlaces.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerInitialTab('discovered');
                    setIsPlacesDrawerOpen(true);
                  }}
                  className="bg-slate-900/90 hover:bg-slate-800 text-white backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 shadow-xl flex items-center gap-1.5 text-xs font-semibold transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Places ({allPlaces.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setDrawerInitialTab('saved');
                  setIsPlacesDrawerOpen(true);
                }}
                className={`backdrop-blur-md px-3 py-1.5 rounded-xl border shadow-xl flex items-center gap-1.5 text-xs font-semibold transition ${
                  savedPlaces.length > 0
                    ? 'bg-amber-950/70 text-amber-300 border-amber-800/70 hover:bg-amber-900/80'
                    : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Bookmark
                  className={`w-3.5 h-3.5 ${
                    savedPlaces.length > 0 ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                  }`}
                />
                <span>Saved ({savedPlaces.length})</span>
              </button>
            </div>
          )}

          {/* Places & Saved Drawer */}
          <PlacesDrawer
            places={allPlaces}
            savedPlaces={savedPlaces}
            selectedPlaceId={selectedPlaceId}
            isOpen={isPlacesDrawerOpen}
            onClose={() => setIsPlacesDrawerOpen(false)}
            onSelectPlace={handleSelectPlace}
            onAskAboutPlace={handleAskAboutPlace}
            isPlaceSaved={isPlaceSaved}
            onToggleSavePlace={handleToggleSavePlace}
            onClearSavedPlaces={handleClearSavedPlaces}
            onAskAboutSavedPlaces={handleAskAboutSavedPlaces}
            initialTab={drawerInitialTab}
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (visible only on small screens) */}
      <div className="md:hidden flex items-center justify-around bg-slate-900 border-t border-slate-800 p-2 z-50">
        <button
          type="button"
          onClick={() => setMobileActiveTab('chat')}
          className={`flex items-center gap-2 py-1.5 px-4 rounded-xl text-xs font-semibold transition ${
            mobileActiveTab === 'chat'
              ? 'bg-sky-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chatbot</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileActiveTab('map')}
          className={`flex items-center gap-2 py-1.5 px-4 rounded-xl text-xs font-semibold transition ${
            mobileActiveTab === 'map'
              ? 'bg-sky-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>Interactive Map</span>
          {allPlaces.length > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {allPlaces.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
