/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { handleChatMessage } from './geminiService.ts';

export const apiRouter = Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, locationContext, rolePersona, groundingMode, model } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'Messages array is required.' });
    }

    const result = await handleChatMessage({
      messages,
      locationContext,
      rolePersona,
      groundingMode,
      model,
    });

    return res.json(result);
  } catch (err: unknown) {
    console.error('API /api/chat failure:', err);
    const msg = err instanceof Error ? err.message : 'Unknown server error';
    
    // Check for quota or rate limiting errors
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
      return res.status(429).json({
        error: 'RESOURCE_EXHAUSTED',
        message: 'Gemini API quota reached. Please try again shortly.',
      });
    }

    if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
      return res.status(403).json({
        error: 'AUTH_ERROR',
        message: 'Gemini API authentication failed. Please check the API key.',
      });
    }

    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: msg,
    });
  }
});

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 min';
  if (seconds < 60) return '< 1 min';
  if (seconds < 3600) {
    const mins = Math.round(seconds / 60);
    return `${mins} min${mins === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(seconds / 3600);
  const remainingMins = Math.round((seconds % 3600) / 60);
  if (remainingMins === 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours} hr ${remainingMins} min${remainingMins === 1 ? '' : 's'}`;
}

function formatDistance(meters: number): string {
  if (meters <= 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = (meters / 1000).toFixed(1);
  const miles = (meters / 1609.34).toFixed(1);
  return `${km} km (${miles} mi)`;
}

apiRouter.post('/routes/distance-matrix', async (req: Request, res: Response) => {
  try {
    const { places, travelMode = 'DRIVE' } = req.body || {};

    if (!places || !Array.isArray(places) || places.length < 2) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'At least 2 places with coordinates are required.',
      });
    }

    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      'AIzaSyC7OnZ42KcgDlXbyAHcx5QD1sQ5JZESV1I';

    const validTravelModes = ['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'];
    const chosenMode = validTravelModes.includes(travelMode) ? travelMode : 'DRIVE';

    // Build consecutive route pairs: 0 -> 1, 1 -> 2, ..., N-2 -> N-1
    const origins = places.slice(0, places.length - 1).map((p: { lat: number; lng: number }) => ({
      waypoint: {
        location: {
          latLng: {
            latitude: p.lat,
            longitude: p.lng,
          },
        },
      },
    }));

    const destinations = places.slice(1).map((p: { lat: number; lng: number }) => ({
      waypoint: {
        location: {
          latLng: {
            latitude: p.lat,
            longitude: p.lng,
          },
        },
      },
    }));

    const requestBody: Record<string, unknown> = {
      origins,
      destinations,
      travelMode: chosenMode,
    };

    if (chosenMode === 'DRIVE') {
      requestBody.routingPreference = 'TRAFFIC_AWARE';
    }

    const response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Routes API Error:', response.status, errText);
      return res.status(response.status).json({
        error: 'ROUTES_API_ERROR',
        message: `Routes API returned status ${response.status}`,
      });
    }

    const data: Array<{
      originIndex?: number;
      destinationIndex?: number;
      duration?: string;
      distanceMeters?: number;
      condition?: string;
    }> = await response.json();

    const segments = [];
    let totalDurationSeconds = 0;
    let totalDistanceMeters = 0;

    for (let i = 0; i < places.length - 1; i++) {
      const match = data.find((d) => d.originIndex === i && d.destinationIndex === i);
      let durationSec = 0;
      if (match?.duration) {
        durationSec = parseInt(match.duration.replace('s', ''), 10) || 0;
      }
      const distMeters = match?.distanceMeters || 0;

      totalDurationSeconds += durationSec;
      totalDistanceMeters += distMeters;

      segments.push({
        fromPlaceId: places[i].id,
        toPlaceId: places[i + 1].id,
        fromName: places[i].name,
        toName: places[i + 1].name,
        durationSeconds: durationSec,
        durationText: formatDuration(durationSec),
        distanceMeters: distMeters,
        distanceText: formatDistance(distMeters),
        condition: match?.condition || 'ROUTE_EXISTS',
      });
    }

    return res.json({
      travelMode: chosenMode,
      segments,
      totalDurationSeconds,
      totalDurationText: formatDuration(totalDurationSeconds),
      totalDistanceMeters,
      totalDistanceText: formatDistance(totalDistanceMeters),
      count: places.length,
    });
  } catch (err: unknown) {
    console.error('API /routes/distance-matrix error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err instanceof Error ? err.message : 'Unknown server error',
    });
  }
});
