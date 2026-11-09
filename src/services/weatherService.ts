/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WeatherCondition {
  temperatureC: number;
  temperatureF: number;
  weatherCode: number;
  label: string;
  emoji: string;
  isDay: boolean;
  timestamp: number;
}

// WMO Weather Interpretation Codes
export function interpretWmoCode(code: number, isDay: boolean = true): { label: string; emoji: string } {
  switch (code) {
    case 0:
      return { label: isDay ? 'Clear Sky' : 'Clear Night', emoji: isDay ? '☀️' : '🌙' };
    case 1:
      return { label: 'Mainly Clear', emoji: isDay ? '🌤️' : '🌤️' };
    case 2:
      return { label: 'Partly Cloudy', emoji: '⛅' };
    case 3:
      return { label: 'Overcast', emoji: '☁️' };
    case 45:
    case 48:
      return { label: 'Foggy', emoji: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { label: 'Drizzle', emoji: '🌦️' };
    case 56:
    case 57:
      return { label: 'Freezing Drizzle', emoji: '🌨️' };
    case 61:
    case 63:
    case 65:
      return { label: 'Rain', emoji: '🌧️' };
    case 66:
    case 67:
      return { label: 'Freezing Rain', emoji: '🌧️' };
    case 71:
    case 73:
    case 75:
    case 77:
      return { label: 'Snow', emoji: '🌨️' };
    case 80:
    case 81:
    case 82:
      return { label: 'Showers', emoji: '🌦️' };
    case 85:
    case 86:
      return { label: 'Snow Showers', emoji: '🌨️' };
    case 95:
      return { label: 'Thunderstorm', emoji: '⛈️' };
    case 96:
    case 99:
      return { label: 'Thunderstorm & Hail', emoji: '⛈️' };
    default:
      return { label: 'Fair', emoji: '⛅' };
  }
}

// In-memory cache with 15-minute expiration
const weatherCache = new Map<string, WeatherCondition>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCacheKey(lat: number, lng: number): string {
  // Round to 2 decimal places (~1.1 km precision) to group nearby locations
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export async function fetchWeatherForCoordinates(
  lat: number,
  lng: number
): Promise<WeatherCondition | null> {
  const cacheKey = getCacheKey(lat, lng);
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(
      4
    )}&current=temperature_2m,weather_code,is_day`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const current = data.current;
    if (!current) return null;

    const tempC = Math.round(current.temperature_2m * 10) / 10;
    const tempF = Math.round(((tempC * 9) / 5 + 32) * 10) / 10;
    const isDay = current.is_day === 1;
    const interpretation = interpretWmoCode(current.weather_code, isDay);

    const condition: WeatherCondition = {
      temperatureC: tempC,
      temperatureF: tempF,
      weatherCode: current.weather_code,
      label: interpretation.label,
      emoji: interpretation.emoji,
      isDay,
      timestamp: Date.now(),
    };

    weatherCache.set(cacheKey, condition);
    return condition;
  } catch (err) {
    console.warn('Weather fetch failed for', lat, lng, err);
    return null;
  }
}

export async function fetchWeatherForPlaces(
  places: Array<{ id: string; lat: number; lng: number }>
): Promise<Record<string, WeatherCondition>> {
  if (places.length === 0) return {};

  const results: Record<string, WeatherCondition> = {};
  const uncachedPlaces: Array<{ id: string; lat: number; lng: number }> = [];

  // Check cache first
  for (const place of places) {
    const key = getCacheKey(place.lat, place.lng);
    const cached = weatherCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      results[place.id] = cached;
    } else {
      uncachedPlaces.push(place);
    }
  }

  if (uncachedPlaces.length === 0) {
    return results;
  }

  // Batch query up to 20 places at once with Open-Meteo
  const batches: Array<Array<{ id: string; lat: number; lng: number }>> = [];
  const BATCH_SIZE = 20;
  for (let i = 0; i < uncachedPlaces.length; i += BATCH_SIZE) {
    batches.push(uncachedPlaces.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    try {
      const lats = batch.map((p) => p.lat.toFixed(4)).join(',');
      const lngs = batch.map((p) => p.lng.toFixed(4)).join(',');

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,weather_code,is_day`;

      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const items = Array.isArray(data) ? data : [data];

      items.forEach((item, idx) => {
        const place = batch[idx];
        if (!place || !item.current) return;

        const current = item.current;
        const tempC = Math.round(current.temperature_2m * 10) / 10;
        const tempF = Math.round(((tempC * 9) / 5 + 32) * 10) / 10;
        const isDay = current.is_day === 1;
        const interpretation = interpretWmoCode(current.weather_code, isDay);

        const condition: WeatherCondition = {
          temperatureC: tempC,
          temperatureF: tempF,
          weatherCode: current.weather_code,
          label: interpretation.label,
          emoji: interpretation.emoji,
          isDay,
          timestamp: Date.now(),
        };

        const key = getCacheKey(place.lat, place.lng);
        weatherCache.set(key, condition);
        results[place.id] = condition;
      });
    } catch (e) {
      console.warn('Batch weather fetch failed:', e);
    }
  }

  return results;
}
