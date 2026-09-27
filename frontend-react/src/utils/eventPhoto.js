// Deterministic placeholder based on the event's own ID, so the same event
// always gets the same placeholder image instead of a random one on every
// reload. Real photo_url from the database always wins when present.
export function eventPhotoUrl(event) {
  if (event?.photo_url) return event.photo_url;
  const seed = event?.event_id || 'eventia';
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/400`;
}
