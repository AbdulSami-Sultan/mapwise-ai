/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RolePersonaId = 'guide' | 'foodie' | 'transit' | 'curator';

export interface RolePersona {
  id: RolePersonaId;
  name: string;
  tagline: string;
  icon: string;
  avatarColor: string;
  systemSummary: string;
  suggestedPrompts: string[];
}

export type GroundingMode = 'auto' | 'maps' | 'search';

export interface GroundingSource {
  title?: string;
  uri?: string;
  sourceType: 'maps' | 'web';
  snippet?: string;
}

export interface PlaceMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: 'restaurant' | 'cafe' | 'landmark' | 'park' | 'museum' | 'shopping' | 'hotel' | 'other';
  description: string;
  address?: string;
  rating?: number;
  uri?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  places?: PlaceMarker[];
  groundingSources?: GroundingSource[];
  webSearchQueries?: string[];
  groundingModeUsed?: 'maps' | 'search' | 'none';
  activeModel?: string;
}

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface MapState {
  center: MapCoordinates;
  zoom: number;
  selectedPlaceId?: string | null;
  userLocation?: MapCoordinates | null;
  cityName?: string;
  mapTypeId?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  showTraffic?: boolean;
}
