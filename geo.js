// Great-circle helpers
export function toRad(d){ return d * Math.PI / 180; }
export function toDeg(r){ return r * 180 / Math.PI; }

export function haversineMeters(lat1, lon1, lat2, lon2){
  const R = 6371000; // m
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Initial bearing (0..360, degrees from true north)
export function bearingDegrees(lat1, lon1, lat2, lon2){
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const λ1 = toRad(lon1), λ2 = toRad(lon2);
  const y = Math.sin(λ2-λ1) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  let θ = Math.atan2(y, x);
  θ = (toDeg(θ)+360)%360;
  return θ;
}
