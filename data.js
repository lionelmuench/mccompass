// Load CSV and provide nearest() search
import { haversineMeters } from './geo.js';

let STORES = []; // {name, city, state, lat, lon}

export async function loadStores(){
  const res = await fetch('mcdonalds.csv', { cache:'no-cache' });
  if (!res.ok) throw new Error('Failed to load mcdonalds.csv');
  const text = await res.text();

  // PapaParse is loaded globally
  const parsed = Papa.parse(text, { header:true, dynamicTyping:true, skipEmptyLines:true });
  const out = [];
  for (const row of parsed.data){
    const lat = +row.latitude;
    const lon = +row.longitude;
    if (!isFinite(lat) || !isFinite(lon)) continue;
    out.push({
      name: row.name || "McDonald's",
      city: row.city || '',
      state: row.state || '',
      lat, lon
    });
  }
  STORES = out;
  return STORES.length;
}

export function nearest(lat, lon){
  // Simple brute force — fast enough for ~13k rows
  let best = null, bestD = Infinity, idx = -1;
  for (let i=0;i<STORES.length;i++){
    const s = STORES[i];
    const d = haversineMeters(lat, lon, s.lat, s.lon);
    if (d < bestD){ bestD = d; best = s; idx = i; }
  }
  return { store: best, meters: bestD, index: idx };
}
