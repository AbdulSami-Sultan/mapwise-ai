/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface LocationContext {
  lat: number;
  lng: number;
  address?: string;
  cityName?: string;
  zoom?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface GroundingChunkSource {
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

export interface ChatResponsePayload {
  reply: string;
  places: PlaceMarker[];
  groundingSources: GroundingChunkSource[];
  webSearchQueries?: string[];
  activeModel: string;
  groundingModeUsed: 'maps' | 'search' | 'none';
}

const PERSONA_SYSTEM_INSTRUCTIONS: Record<string, string> = {
  guide: `You are MapSphere's Local City Explorer & Tour Guide. You know the history, architecture, hidden alleys, scenic viewpoints, and local secrets of any city or neighborhood. Be vivid, enthusiastic, welcoming, and culturally authentic. Provide practical tips (best time to visit, ticket tips, walking advice).`,
  foodie: `You are MapSphere's Culinary & Dining Scout. You specialize in street food gems, Michelin-starred bistros, artisan bakeries, trendy coffee roasters, and regional delicacies. For every dining recommendation, detail the signature dish, the ambiance, dietary friendliness, and booking advice.`,
  transit: `You are MapSphere's Transit & Navigation Specialist. You help users navigate cities effortlessly—providing optimal walking routes, metro/subway lines, cycling options, travel times, transfers, and pedestrian shortcuts. Focus on logistical precision, safety, and efficiency.`,
  curator: `You are MapSphere's Family & Leisure Curator. You curate balanced itineraries for families, solo travelers, and groups—spotlighting lush parks, interactive museums, calm plazas, waterfront walks, and accessible facilities.`,
};

export async function handleChatMessage({
  messages,
  locationContext,
  rolePersona = 'guide',
  groundingMode = 'auto',
  model = 'gemini-3.8-flash',
}: {
  messages: ChatMessage[];
  locationContext?: LocationContext;
  rolePersona?: string;
  groundingMode?: 'maps' | 'search' | 'auto';
  model?: string;
}): Promise<ChatResponsePayload> {
  const chosenModel = model || 'gemini-3.8-flash';
  const latestMessage = messages[messages.length - 1]?.text || '';

  // Determine grounding mode if auto
  let effectiveMode: 'maps' | 'search' = 'maps';
  if (groundingMode === 'search') {
    effectiveMode = 'search';
  } else if (groundingMode === 'maps') {
    effectiveMode = 'maps';
  } else {
    // Auto-detect based on query nature
    const searchKeywords = ['event', 'festival', 'concert', 'news', 'weather', 'today', 'tonight', 'weekend', 'ticket price', 'schedule', 'review'];
    const lower = latestMessage.toLowerCase();
    const isSearchOriented = searchKeywords.some((kw) => lower.includes(kw));
    effectiveMode = isSearchOriented ? 'search' : 'maps';
  }

  const basePersonaInstruction = PERSONA_SYSTEM_INSTRUCTIONS[rolePersona] || PERSONA_SYSTEM_INSTRUCTIONS.guide;

  const locationContextNote = locationContext
    ? `\nCURRENT MAP / USER LOCATION CONTEXT:
Latitude: ${locationContext.lat.toFixed(5)}, Longitude: ${locationContext.lng.toFixed(5)}
${locationContext.cityName ? `Location / City: ${locationContext.cityName}` : ''}
${locationContext.address ? `Visible Area Address: ${locationContext.address}` : ''}
Prioritize recommendations near these coordinates when relevant to the user query.`
    : '';

  const systemInstruction = `${basePersonaInstruction}

${locationContextNote}

IMPORTANT MAP INTEGRATION INSTRUCTIONS:
1. Always format your textual reply using clean, readable Markdown (bullet points, bold place names, short paragraphs).
2. Whenever you recommend or discuss specific physical points of interest, restaurants, landmarks, or spots with geographic locations, append a structured JSON block at the very end of your response so the interactive Google Map can automatically plot them with interactive pins.
Format the JSON block EXACTLY inside a code fence labeled "json:places" like this:
\`\`\`json:places
[
  {
    "id": "unique-id-1",
    "name": "Exact Name of Place",
    "lat": 37.7749,
    "lng": -122.4194,
    "category": "restaurant" | "cafe" | "landmark" | "park" | "museum" | "shopping" | "hotel" | "other",
    "description": "Short 1-2 sentence description highlighting key feature or dish.",
    "address": "Approximate street address or neighborhood",
    "rating": 4.7
  }
]
\`\`\`
Ensure valid JSON coordinates within the actual region discussed.
3. If no physical places need to be plotted (e.g. general conversational greeting), do not include the json:places block.`;

  // Build tools configuration
  // Note: per @google/genai docs, googleMaps cannot be combined with googleSearch in the same call.
  // Neither googleMaps nor googleSearch allows responseSchema/responseMimeType.
  const tools: Array<{ googleMaps?: Record<string, unknown>; googleSearch?: Record<string, unknown> }> = [];
  let toolConfig: Record<string, unknown> | undefined = undefined;

  if (effectiveMode === 'maps') {
    tools.push({ googleMaps: {} });
    if (locationContext && typeof locationContext.lat === 'number' && typeof locationContext.lng === 'number') {
      toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: locationContext.lat,
            longitude: locationContext.lng,
          },
        },
      };
    }
  } else {
    tools.push({ googleSearch: {} });
  }

  // Format contents for multi-turn conversation
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  try {
    const response = await ai.models.generateContent({
      model: chosenModel,
      contents,
      config: {
        systemInstruction,
        tools,
        ...(toolConfig ? { toolConfig } : {}),
      },
    });

    const rawText = response.text || 'I apologize, I could not generate a response for this location.';

    // Extract places JSON block if present
    const placesRegex = /```json:places\s*([\s\S]*?)\s*```/;
    const match = rawText.match(placesRegex);
    let places: PlaceMarker[] = [];
    let cleanedText = rawText;

    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          places = parsed.filter(
            (p) => p && typeof p.name === 'string' && typeof p.lat === 'number' && typeof p.lng === 'number'
          ).map((p, idx) => ({
            id: p.id || `place-${Date.now()}-${idx}`,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            category: p.category || 'landmark',
            description: p.description || '',
            address: p.address,
            rating: typeof p.rating === 'number' ? p.rating : undefined,
            uri: p.uri,
          }));
        }
      } catch (err) {
        console.warn('Failed to parse places JSON block:', err);
      }
      cleanedText = rawText.replace(placesRegex, '').trim();
    }

    // Extract grounding sources
    const groundingSources: GroundingChunkSource[] = [];
    const webSearchQueries: string[] = [];

    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    if (groundingMetadata) {
      if (groundingMetadata.webSearchQueries && Array.isArray(groundingMetadata.webSearchQueries)) {
        webSearchQueries.push(...(groundingMetadata.webSearchQueries as string[]));
      }

      if (groundingMetadata.groundingChunks && Array.isArray(groundingMetadata.groundingChunks)) {
        for (const chunk of groundingMetadata.groundingChunks as Array<{
          web?: { uri?: string; title?: string };
          maps?: { uri?: string; title?: string; placeAnswerSources?: { reviewSnippets?: Array<{ text?: string; author?: string }> } };
        }>) {
          if (chunk.maps?.uri) {
            let snippet = '';
            const snippets = chunk.maps.placeAnswerSources?.reviewSnippets;
            if (snippets && snippets.length > 0 && snippets[0].text) {
              snippet = snippets[0].text;
            }
            groundingSources.push({
              sourceType: 'maps',
              title: chunk.maps.title || 'Google Maps Location',
              uri: chunk.maps.uri,
              snippet,
            });
          } else if (chunk.web?.uri) {
            groundingSources.push({
              sourceType: 'web',
              title: chunk.web.title || chunk.web.uri,
              uri: chunk.web.uri,
            });
          }
        }
      }
    }

    return {
      reply: cleanedText,
      places,
      groundingSources,
      webSearchQueries,
      activeModel: chosenModel,
      groundingModeUsed: effectiveMode,
    };
  } catch (error: unknown) {
    console.error('Error calling Gemini model:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown Gemini error';
    throw new Error(errorMessage);
  }
}
