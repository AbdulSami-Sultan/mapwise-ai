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

export interface WeatherCondition {
  temperatureC: number;
  temperatureF: number;
  weatherCode: number;
  label: string;
  emoji: string;
  isDay: boolean;
  timestamp: number;
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
  savedAt?: string;
  weather?: WeatherCondition;
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

export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT';

export interface RouteSegment {
  fromPlaceId: string;
  toPlaceId: string;
  fromName: string;
  toName: string;
  durationSeconds: number;
  durationText: string;
  distanceMeters: number;
  distanceText: string;
  condition?: string;
}

export interface DistanceMatrixResult {
  travelMode: TravelMode;
  segments: RouteSegment[];
  totalDurationSeconds: number;
  totalDurationText: string;
  totalDistanceMeters: number;
  totalDistanceText: string;
  count: number;
}

export type DirectionTravelMode = 'DRIVE' | 'WALK' | 'TRANSIT';

export interface TransitStepDetails {
  lineName?: string;
  lineShortName?: string;
  vehicleType?: string;
  vehicleColor?: string;
  textColor?: string;
  departureStop?: string;
  arrivalStop?: string;
  departureTime?: string;
  arrivalTime?: string;
  stopCount?: number;
  headsign?: string;
}

export interface DirectionStep {
  instruction: string;
  maneuver?: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  travelMode?: string;
  transitDetails?: TransitStepDetails;
}

export interface DirectionRouteOption {
  index: number;
  summary: string;
  durationSeconds: number;
  durationText: string;
  distanceMeters: number;
  distanceText: string;
  encodedPolyline: string;
  steps: DirectionStep[];
  viewport?: {
    low: MapCoordinates;
    high: MapCoordinates;
  };
}

export interface DirectionsModeResult {
  travelMode: DirectionTravelMode;
  routes: DirectionRouteOption[];
  error?: string;
}

export interface MultiModeDirectionsResponse {
  origin: MapCoordinates;
  destination: MapCoordinates;
  modes: Record<DirectionTravelMode, DirectionsModeResult>;
}

export interface ActiveDirectionsDisplay {
  origin: MapCoordinates;
  originLabel: string;
  destination: PlaceMarker;
  travelMode: DirectionTravelMode;
  route: DirectionRouteOption;
}


