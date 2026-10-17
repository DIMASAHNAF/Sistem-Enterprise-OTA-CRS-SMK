/**
 * Travel & Ticketing utility functions
 */

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatMinutesToTime(totalMinutes: number): { time: string; daysAdded: number } {
  const daysAdded = Math.floor(totalMinutes / 1440);
  const remMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(remMinutes / 60);
  const minutes = remMinutes % 60;
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { time, daysAdded };
}

export function addMinutesToTime(baseTime: string, offsetMinutes: number): { time: string; daysAdded: number; display: string } {
  const baseMins = parseTimeToMinutes(baseTime);
  const totalMins = baseMins + offsetMinutes;
  const { time, daysAdded } = formatMinutesToTime(totalMins);
  const display = daysAdded > 0 ? `${time} (+${daysAdded}h)` : time;
  return { time, daysAdded, display };
}

export function formatDurationMinutes(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}j`;
  return `${hours}j ${mins}m`;
}

export function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

/**
 * Segment Overlap Rule:
 * Two segments [A, B] and [C, D] with A < B and C < D on the same line overlap if and only if:
 * A < D AND C < B
 */
export function isSegmentOverlapping(
  existOriginOrder: number,
  existDestOrder: number,
  reqOriginOrder: number,
  reqDestOrder: number
): boolean {
  return existOriginOrder < reqDestOrder && reqOriginOrder < existDestOrder;
}
