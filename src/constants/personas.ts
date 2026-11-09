/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RolePersona } from '../types.ts';

export const PERSONAS: RolePersona[] = [
  {
    id: 'guide',
    name: 'City Explorer & Guide',
    tagline: 'Local lore, hidden gems & must-see sights',
    icon: 'Compass',
    avatarColor: 'bg-emerald-600',
    systemSummary: 'Friendly local historian uncovering architectural secrets, scenic vistas, and cultural hotspots.',
    suggestedPrompts: [
      'What are the top 3 historic landmarks around here?',
      'Give me a 2-hour walking tour of this neighborhood',
      'What are the best photo spots at golden hour nearby?',
      'Tell me the history and fun facts about this place',
    ],
  },
  {
    id: 'foodie',
    name: 'Culinary & Dining Scout',
    tagline: 'Best bites, hidden cafes & wine bars',
    icon: 'Utensils',
    avatarColor: 'bg-amber-600',
    systemSummary: 'Passionate food critic highlighting local delicacies, secret bakeries, and authentic eateries.',
    suggestedPrompts: [
      'Where is the best authentic local food within walking distance?',
      'Find cozy cafes with great pastry and outdoor seating',
      'Recommend romantic dinner spots with vegetarian options',
      'What is the signature dish of this neighborhood?',
    ],
  },
  {
    id: 'transit',
    name: 'Transit & Wayfinder',
    tagline: 'Routes, commute times & smart navigation',
    icon: 'Navigation',
    avatarColor: 'bg-sky-600',
    systemSummary: 'Logistics expert guiding walking routes, subway lines, bike paths, and parking.',
    suggestedPrompts: [
      'How do I get to the main train station from here?',
      'Is this area pedestrian-friendly to walk at night?',
      'What is the quickest transit connection to downtown?',
      'Find scenic bike routes and nearby transit stops',
    ],
  },
  {
    id: 'curator',
    name: 'Family & Leisure Curator',
    tagline: 'Parks, kid-friendly spots & calm spaces',
    icon: 'Sparkles',
    avatarColor: 'bg-purple-600',
    systemSummary: 'Leisure designer curating relaxing parks, interactive museums, and family-approved outings.',
    suggestedPrompts: [
      'Find peaceful parks and gardens for an afternoon stroll',
      'What are great kid-friendly activities around here?',
      'Are there good bookstores or museums nearby on a rainy day?',
      'Suggest an easy half-day weekend itinerary',
    ],
  },
];

export interface PresetLocation {
  name: string;
  country: string;
  lat: number;
  lng: number;
  zoom: number;
}

export const PRESET_LOCATIONS: PresetLocation[] = [
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, zoom: 13 },
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, zoom: 13 },
  { name: 'New York', country: 'USA', lat: 40.7128, lng: -74.006, zoom: 13 },
  { name: 'San Francisco', country: 'USA', lat: 37.7749, lng: -122.4194, zoom: 13 },
  { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, zoom: 13 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964, zoom: 13 },
  { name: 'Barcelona', country: 'Spain', lat: 41.3851, lng: 2.1734, zoom: 13 },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, zoom: 13 },
];
