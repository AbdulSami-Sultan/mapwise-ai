/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { DistanceMatrixResult, PlaceMarker, TravelMode } from '../types.ts';

const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  DRIVE: 'Driving',
  WALK: 'Walking',
  BICYCLE: 'Bicycling',
  TRANSIT: 'Public Transit',
};

/**
 * Format a Date object as an RFC 5545 UTC timestamp: YYYYMMDDTHHMMSSZ
 */
function formatIcsUtcDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Escape special characters per RFC 5545 Section 3.3.11
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Fold lines longer than 75 characters per RFC 5545 Section 3.1
 */
function foldIcsLine(line: string): string {
  const maxLen = 74;
  if (line.length <= maxLen) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, maxLen));
  remaining = remaining.slice(maxLen);
  while (remaining.length > 0) {
    parts.push(' ' + remaining.slice(0, maxLen - 1));
    remaining = remaining.slice(maxLen - 1);
  }
  return parts.join('\r\n');
}

/**
 * Trigger a client-side file download for a Blob
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generate a safe date suffix for downloaded filenames (YYYY-MM-DD)
 */
function getDateSlug(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generate and download an RFC 5545 iCalendar (.ics) file for the saved places itinerary.
 * Schedules stops sequentially starting tomorrow at 09:00 AM local time, spacing
 * stops using calculated Distance Matrix travel times when available.
 */
export function exportItineraryToCalendar(
  places: PlaceMarker[],
  travelMode: TravelMode,
  matrixResult: DistanceMatrixResult | null
): void {
  if (places.length === 0) return;

  const now = new Date();
  const dtStamp = formatIcsUtcDate(now);

  // Start itinerary tomorrow at 09:00 AM local time
  const cursorTime = new Date(now);
  cursorTime.setDate(cursorTime.getDate() + 1);
  cursorTime.setHours(9, 0, 0, 0);

  const DEFAULT_VISIT_MINUTES = 60;
  const DEFAULT_TRANSIT_MINUTES = 15;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MapSphere AI//Itinerary Exporter//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcsLine('X-WR-CALNAME:MapSphere AI Travel Itinerary'),
    foldIcsLine(
      `X-WR-CALDESC:${escapeIcsText(
        `Saved places itinerary (${places.length} stops, ${TRAVEL_MODE_LABELS[travelMode]})`
      )}`
    ),
  ];

  places.forEach((place, index) => {
    const startDate = new Date(cursorTime);
    const endDate = new Date(startDate.getTime() + DEFAULT_VISIT_MINUTES * 60 * 1000);

    const mapsUrl =
      place.uri ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${place.lat},${place.lng}`
      )}`;

    const segmentToNext =
      matrixResult?.segments && index < matrixResult.segments.length
        ? matrixResult.segments[index]
        : null;

    const descParts: string[] = [
      `Stop ${index + 1} of ${places.length} (${place.category.toUpperCase()})`,
    ];
    if (place.rating) {
      descParts.push(`Rating: ${place.rating.toFixed(1)} / 5.0`);
    }
    if (place.description) {
      descParts.push('', place.description);
    }
    if (segmentToNext) {
      descParts.push(
        '',
        `Next stop (${segmentToNext.toName}): ${segmentToNext.durationText} (${segmentToNext.distanceText}) via ${TRAVEL_MODE_LABELS[travelMode]}`
      );
    }
    descParts.push('', `Google Maps: ${mapsUrl}`);

    const uid = `mapsphere-${place.id.replace(/[^a-zA-Z0-9_-]/g, '')}-${index}-${now.getTime()}@mapsphere.ai`;
    const locationText = place.address || `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;

    lines.push('BEGIN:VEVENT');
    lines.push(foldIcsLine(`UID:${uid}`));
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${formatIcsUtcDate(startDate)}`);
    lines.push(`DTEND:${formatIcsUtcDate(endDate)}`);
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(`Stop ${index + 1}: ${place.name}`)}`));
    lines.push(foldIcsLine(`LOCATION:${escapeIcsText(locationText)}`));
    lines.push(`GEO:${place.lat};${place.lng}`);
    lines.push(foldIcsLine(`URL:${mapsUrl}`));
    lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`));
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');

    // Advance cursor for next stop: visit duration + travel buffer (rounded up to 5 mins)
    const travelSeconds = segmentToNext?.durationSeconds ?? DEFAULT_TRANSIT_MINUTES * 60;
    const travelMs = Math.max(5 * 60 * 1000, Math.ceil(travelSeconds / 300) * 300 * 1000);
    cursorTime.setTime(endDate.getTime() + travelMs);
  });

  lines.push('END:VCALENDAR');

  const icsContent = lines.join('\r\n') + '\r\n';
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  triggerDownload(blob, `mapsphere-itinerary-${getDateSlug()}.ics`);
}

/**
 * Generate and download a formatted PDF travel itinerary document for the saved places.
 */
export function exportItineraryToPdf(
  places: PlaceMarker[],
  travelMode: TravelMode,
  matrixResult: DistanceMatrixResult | null
): void {
  if (places.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensurePageSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'F');

  doc.setTextColor(248, 250, 252); // slate-50
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MapSphere AI — Saved Itinerary', margin + 6, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184); // slate-400
  const generatedStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.text(
    `Generated ${generatedStr}  •  ${places.length} ${places.length === 1 ? 'Stop' : 'Stops'}  •  Mode: ${TRAVEL_MODE_LABELS[travelMode]}`,
    margin + 6,
    y + 18
  );

  y += 32;

  // Trip Summary Strip (when Distance Matrix data exists)
  if (matrixResult) {
    ensurePageSpace(16);
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(245, 158, 11); // amber-500
    doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text(
      `Total Estimated Travel (${TRAVEL_MODE_LABELS[travelMode]}): ${matrixResult.totalDurationText}  (${matrixResult.totalDistanceText})`,
      margin + 4,
      y + 7.5
    );
    y += 18;
  }

  // Stops
  places.forEach((place, index) => {
    const descLines = place.description
      ? (doc.splitTextToSize(place.description, contentWidth - 10) as string[])
      : [];
    const addressLines = place.address
      ? (doc.splitTextToSize(`Address: ${place.address}`, contentWidth - 10) as string[])
      : [];

    const cardHeight =
      18 +
      addressLines.length * 4.2 +
      descLines.length * 4.2 +
      (place.address ? 2 : 0) +
      (place.description ? 2 : 0) +
      6;

    ensurePageSpace(cardHeight + 14);

    // Card Background & Border
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(margin, y, contentWidth, cardHeight, 2.5, 2.5, 'FD');

    let cardY = y + 6.5;

    // Stop Number Badge
    doc.setFillColor(245, 158, 11); // amber-500
    doc.roundedRect(margin + 4, cardY - 4.2, 16, 5.5, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`STOP ${index + 1}`, margin + 6, cardY - 0.3);

    // Category Tag
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(place.category.toUpperCase(), margin + 23, cardY - 0.3);

    // Rating on the right
    if (place.rating) {
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text(`Rating: ${place.rating.toFixed(1)} / 5`, pageWidth - margin - 4, cardY - 0.3, {
        align: 'right',
      });
    }

    cardY += 5.5;

    // Place Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(place.name, contentWidth - 10) as string[];
    doc.text(titleLines[0] || place.name, margin + 4, cardY);
    cardY += 5;

    // Address
    if (addressLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(addressLines, margin + 4, cardY);
      cardY += addressLines.length * 4.2 + 1.5;
    }

    // Description
    if (descLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text(descLines, margin + 4, cardY);
      cardY += descLines.length * 4.2 + 1.5;
    }

    // Coordinates & Maps Link
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(2, 132, 199); // sky-600
    const mapsUrl =
      place.uri ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${place.lat},${place.lng}`
      )}`;
    doc.textWithLink(
      `Open in Google Maps (${place.lat.toFixed(4)}, ${place.lng.toFixed(4)})`,
      margin + 4,
      y + cardHeight - 3.5,
      { url: mapsUrl }
    );

    y += cardHeight + 3;

    // Leg Connector to Next Stop
    const segmentToNext =
      matrixResult?.segments && index < matrixResult.segments.length
        ? matrixResult.segments[index]
        : null;

    if (segmentToNext) {
      ensurePageSpace(10);
      doc.setDrawColor(245, 158, 11);
      doc.line(margin + 12, y - 2, margin + 12, y + 6);

      doc.setFillColor(255, 251, 235); // amber-50
      doc.setDrawColor(253, 230, 138); // amber-200
      doc.roundedRect(margin + 16, y - 0.5, contentWidth - 16, 6.5, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14);
      doc.text(
        `Next leg (${TRAVEL_MODE_LABELS[travelMode]}): ${segmentToNext.durationText}  •  ${segmentToNext.distanceText}`,
        margin + 20,
        y + 3.8
      );
      y += 9;
    } else if (index < places.length - 1) {
      y += 3;
    }
  });

  // Footer page numbering
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MapSphere AI Itinerary  •  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  doc.save(`mapsphere-itinerary-${getDateSlug()}.pdf`);
}
