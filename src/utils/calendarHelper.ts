import {
  WeddingEvent,
  GodparentRole,
} from '../data/weddingData';

export function buildGoogleCalendarUrlForEvent(
  event: WeddingEvent,
  assignedTable: number | null = null
): string {
  const tableText =
    assignedTable !== null ? ` (Mesa #${assignedTable})` : '';
  const title = `${event.title} - Boda Jessica & Jorge Luis${tableText}`;
  const formatTime = (iso: string) =>
    iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const start = formatTime(event.icsStart);
  const end = formatTime(event.icsEnd);
  const details = `${event.icsDescription}${tableText}`;
  const location = `${event.venue}, ${event.address}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${start}/${end}&details=${encodeURIComponent(
    details
  )}&location=${encodeURIComponent(location)}`;
}
