// Where clock-ins and clock-outs are allowed. The coordinates are the
// midpoint of two public geocoders' results for the address (they agreed to
// within ~80 m); the radius is generous because a yard is big and phone GPS
// drifts. Adjust RADIUS_METERS here if drivers at the gate get rejected, or
// people just outside it get through.
export const YARD = {
  address: "4220 Whitaker Ave, Philadelphia, PA 19124",
  lat: 40.0137,
  lng: -75.1192,
};
export const RADIUS_METERS = 300;
// A reading fuzzier than this (desktop browsers, indoor GPS) can't be trusted
// to say where someone is, so it's refused rather than guessed at.
export const MAX_ACCURACY_METERS = 150;

export interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

// Great-circle distance between two points, in meters.
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function checkAtYard(pos: Position | null): { ok: true } | { ok: false; reason: string } {
  const where = `You can only clock in and out at the yard (${YARD.address}).`;
  if (
    !pos ||
    !Number.isFinite(pos.lat) ||
    !Number.isFinite(pos.lng) ||
    !Number.isFinite(pos.accuracy) ||
    Math.abs(pos.lat) > 90 ||
    Math.abs(pos.lng) > 180
  ) {
    return { ok: false, reason: `We couldn't get your location. Allow location access and try again. ${where}` };
  }
  if (pos.accuracy > MAX_ACCURACY_METERS) {
    return {
      ok: false,
      reason: `Your location isn't precise enough (about ${Math.round(pos.accuracy)} m). Turn on GPS / precise location and try again outside.`,
    };
  }
  const d = distanceMeters(pos.lat, pos.lng, YARD.lat, YARD.lng);
  if (d > RADIUS_METERS) {
    return { ok: false, reason: `You're not at the yard. ${where}` };
  }
  return { ok: true };
}
