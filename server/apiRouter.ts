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

// Routes API v2 computeRoutes replacement for legacy Directions API
// Docs: https://developers.google.com/maps/documentation/routes/compute_route_directions?utm_campaign=gmp_mcp_codeassist_v1_aistudio
type DirectionMode = 'DRIVE' | 'WALK' | 'TRANSIT';

interface ComputeRoutesStepRaw {
  distanceMeters?: number;
  staticDuration?: string;
  travelMode?: string;
  navigationInstruction?: {
    maneuver?: string;
    instructions?: string;
  };
  transitDetails?: {
    stopDetails?: {
      arrivalStop?: { name?: string };
      departureStop?: { name?: string };
      arrivalTime?: string;
      departureTime?: string;
    };
    localizedValues?: {
      arrivalTime?: { time?: { text?: string } };
      departureTime?: { time?: { text?: string } };
    };
    headsign?: string;
    stopCount?: number;
    transitLine?: {
      name?: string;
      nameShort?: string;
      color?: string;
      textColor?: string;
      vehicle?: {
        type?: string;
        name?: { text?: string };
      };
    };
  };
}

interface ComputeRoutesRouteRaw {
  description?: string;
  duration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline?: string };
  viewport?: {
    low?: { latitude?: number; longitude?: number };
    high?: { latitude?: number; longitude?: number };
  };
  legs?: Array<{
    duration?: string;
    distanceMeters?: number;
    steps?: ComputeRoutesStepRaw[];
  }>;
}

function parseSeconds(durationStr?: string): number {
  if (!durationStr) return 0;
  return parseInt(durationStr.replace('s', ''), 10) || 0;
}

async function fetchComputeRoutesForMode(
  apiKey: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: DirectionMode
) {
  const requestBody: Record<string, unknown> = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    },
    travelMode,
    computeAlternativeRoutes: true,
    languageCode: 'en-US',
    units: 'METRIC',
  };

  if (travelMode === 'DRIVE') {
    requestBody.routingPreference = 'TRAFFIC_AWARE';
  }

  const fieldMask = [
    'routes.description',
    'routes.duration',
    'routes.distanceMeters',
    'routes.polyline.encodedPolyline',
    'routes.viewport',
    'routes.legs.duration',
    'routes.legs.distanceMeters',
    'routes.legs.steps.navigationInstruction',
    'routes.legs.steps.distanceMeters',
    'routes.legs.steps.staticDuration',
    'routes.legs.steps.travelMode',
    'routes.legs.steps.transitDetails',
  ].join(',');

  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
      'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Routes API computeRoutes (${travelMode}) Error:`, response.status, errText);
    const err = new Error(`Routes API (${travelMode}) returned status ${response.status}`) as Error & {
      status?: number;
      quotaExceeded?: boolean;
    };
    err.status = response.status;
    err.quotaExceeded = response.status === 429 || errText.includes('RESOURCE_EXHAUSTED');
    throw err;
  }

  const data: { routes?: ComputeRoutesRouteRaw[] } = await response.json();
  const rawRoutes = data.routes || [];

  const routes = rawRoutes.map((route, idx) => {
    const durationSeconds = parseSeconds(route.duration);
    const distanceMeters = route.distanceMeters || 0;
    const rawSteps = route.legs?.[0]?.steps || [];

    const steps = rawSteps.map((step) => {
      const stepDur = parseSeconds(step.staticDuration);
      const stepDist = step.distanceMeters || 0;
      const td = step.transitDetails;

      const transitDetails = td
        ? {
            lineName: td.transitLine?.name,
            lineShortName: td.transitLine?.nameShort,
            vehicleType: td.transitLine?.vehicle?.name?.text || td.transitLine?.vehicle?.type,
            vehicleColor: td.transitLine?.color,
            textColor: td.transitLine?.textColor,
            departureStop: td.stopDetails?.departureStop?.name,
            arrivalStop: td.stopDetails?.arrivalStop?.name,
            departureTime: td.localizedValues?.departureTime?.time?.text,
            arrivalTime: td.localizedValues?.arrivalTime?.time?.text,
            stopCount: td.stopCount,
            headsign: td.headsign,
          }
        : undefined;

      const fallbackInstruction = transitDetails
        ? `Take ${transitDetails.lineShortName || transitDetails.lineName || 'transit'} toward ${transitDetails.headsign || transitDetails.arrivalStop || 'destination'}`
        : step.travelMode === 'WALK'
          ? 'Walk toward destination'
          : 'Continue along route';

      return {
        instruction: step.navigationInstruction?.instructions || fallbackInstruction,
        maneuver: step.navigationInstruction?.maneuver,
        distanceMeters: stepDist,
        distanceText: formatDistance(stepDist),
        durationSeconds: stepDur,
        durationText: formatDuration(stepDur),
        travelMode: step.travelMode || travelMode,
        ...(transitDetails ? { transitDetails } : {}),
      };
    });

    const viewport =
      route.viewport?.low?.latitude !== undefined &&
      route.viewport?.low?.longitude !== undefined &&
      route.viewport?.high?.latitude !== undefined &&
      route.viewport?.high?.longitude !== undefined
        ? {
            low: { lat: route.viewport.low.latitude, lng: route.viewport.low.longitude },
            high: { lat: route.viewport.high.latitude, lng: route.viewport.high.longitude },
          }
        : undefined;

    return {
      index: idx,
      summary: route.description?.trim() || (idx === 0 ? 'Recommended route' : `Alternative route ${idx + 1}`),
      durationSeconds,
      durationText: formatDuration(durationSeconds),
      distanceMeters,
      distanceText: formatDistance(distanceMeters),
      encodedPolyline: route.polyline?.encodedPolyline || '',
      steps,
      ...(viewport ? { viewport } : {}),
    };
  });

  return {
    travelMode,
    routes,
  };
}

apiRouter.post('/routes/directions', async (req: Request, res: Response) => {
  try {
    const { origin, destination, travelModes } = req.body || {};

    if (
      !origin ||
      !destination ||
      typeof origin.lat !== 'number' ||
      typeof origin.lng !== 'number' ||
      typeof destination.lat !== 'number' ||
      typeof destination.lng !== 'number' ||
      !Number.isFinite(origin.lat) ||
      !Number.isFinite(origin.lng) ||
      !Number.isFinite(destination.lat) ||
      !Number.isFinite(destination.lng)
    ) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Valid numeric origin and destination coordinates (lat, lng) are required.',
      });
    }

    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      'AIzaSyC7OnZ42KcgDlXbyAHcx5QD1sQ5JZESV1I';

    const allowedModes: DirectionMode[] = ['DRIVE', 'WALK', 'TRANSIT'];
    const requestedModes: DirectionMode[] = Array.isArray(travelModes) && travelModes.length > 0
      ? travelModes.filter((m: unknown): m is DirectionMode =>
          typeof m === 'string' && allowedModes.includes(m as DirectionMode)
        )
      : ['DRIVE', 'TRANSIT', 'WALK'];

    const modesToFetch: DirectionMode[] = requestedModes.length > 0 ? requestedModes : ['DRIVE', 'TRANSIT', 'WALK'];

    let quotaHit = false;
    const settled = await Promise.all(
      modesToFetch.map(async (mode) => {
        try {
          const result = await fetchComputeRoutesForMode(apiKey, origin, destination, mode);
          return result;
        } catch (err: unknown) {
          const typedErr = err as Error & { quotaExceeded?: boolean };
          if (typedErr.quotaExceeded) {
            quotaHit = true;
          }
          return {
            travelMode: mode,
            routes: [],
            error: typedErr.message || `Unable to fetch ${mode.toLowerCase()} directions.`,
          };
        }
      })
    );

    if (quotaHit && settled.every((r) => r.routes.length === 0)) {
      return res.status(429).json({
        error: 'RESOURCE_EXHAUSTED',
        message: 'Google Maps Platform quota reached while calculating directions.',
      });
    }

    const modesRecord: Record<DirectionMode, { travelMode: DirectionMode; routes: unknown[]; error?: string }> = {
      DRIVE: { travelMode: 'DRIVE', routes: [] },
      WALK: { travelMode: 'WALK', routes: [] },
      TRANSIT: { travelMode: 'TRANSIT', routes: [] },
    };

    for (const item of settled) {
      modesRecord[item.travelMode] = item;
    }

    return res.json({
      origin,
      destination,
      modes: modesRecord,
    });
  } catch (err: unknown) {
    console.error('API /routes/directions error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err instanceof Error ? err.message : 'Unknown server error',
    });
  }
});

