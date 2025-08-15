import { bearingDegrees } from './geo.js';
import { requestOrientationPermissionIfNeeded, startHeadingStream, startGeolocation, isiOS } from './sensors.js';
import { loadStores, nearest } from './data.js';

const $ = (s) => document.querySelector(s);
const enableBtn = $('#enableBtn');
const gate = $('#gate');
const gateError = $('#gateError');
const compass = $('#compass');
const arrowEl = $('#arrow');
const distanceEl = $('#distance');
const storeEl = $('#store');
const mapsLink = $('#mapsLink');
const unitsBtn = $('#unitsBtn');

let unit = 'mi'; // 'mi' | 'km'
let userPos = null; // {lat, lon, acc}
let target = null;  // {lat, lon, name, city, state}
let deviceHeading = null; // degrees
let stopHeading = null, stopWatch = null;

/* ---------------- Angle unwrapping + smoothing ---------------- */

// Tracks a continuous angle from 0..360° samples.
class AngleTracker {
  constructor() { this.prevRaw = null; this.value = 0; }
  reset() { this.prevRaw = null; /* keep value for continuity */ }
  update(rawDeg) {
    // Handle NaN/undefined quietly
    if (rawDeg == null || !isFinite(rawDeg)) return this.value;
    // Normalize incoming to [0,360)
    const raw = ((rawDeg % 360) + 360) % 360;
    if (this.prevRaw == null) { this.prevRaw = raw; this.value = raw; return this.value; }
    // Shortest-arc step [-180, +180]
    let step = raw - this.prevRaw;
    if (step > 180) step -= 360;
    else if (step < -180) step += 360;
    this.value += step;
    this.prevRaw = raw;
    return this.value;
  }
  get() { return this.value; } // continuous degrees (-inf..+inf)
}

const headingTrack = new AngleTracker();
const bearingTrack = new AngleTracker();

let renderRot = 0;             // continuous rendered rotation (deg)
const SMOOTH_FACTOR = 0.25;    // 0..1 (higher = snappier)
const DEADBAND_DEG  = 1.0;     // snap when within this range

function fmtDistance(meters){
  if (unit === 'km'){
    const km = meters/1000;
    return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(km<10?2:1)} km`;
  }else{
    const miles = meters / 1609.344;
    if (miles < 0.1) return `${Math.round(meters*3.28084)} ft`;
    return `${miles.toFixed(miles<10?2:1)} mi`;
  }
}

function updateMapsLink(){
  if (!target) return;
  const dest = `${target.lat.toFixed(6)},${target.lon.toFixed(6)}`;
  const url = isiOS()
    ? `https://maps.apple.com/?daddr=${dest}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
  mapsLink.href = url;
}

function renderArrow(toContinuousDeg){
  // Smooth towards target
  let delta = toContinuousDeg - renderRot;
  if (Math.abs(delta) <= DEADBAND_DEG) renderRot = toContinuousDeg;
  else renderRot += delta * SMOOTH_FACTOR;

  // Render modulo 360 (no CSS transitions so no long-way spins)
  const deg = ((renderRot % 360) + 360) % 360;
  arrowEl.style.transform = `rotate(${deg}deg)`;
}

async function init(){
  try{
    await loadStores(); // minimal UI
  }catch(e){
    gateError.hidden = false; gateError.textContent = e.message || String(e);
  }
}
init();

enableBtn.addEventListener('click', async () => {
  gateError.hidden = true; gateError.textContent = '';
  try{
    await requestOrientationPermissionIfNeeded();

    compass.hidden = false;
    gate.hidden = true;

    stopHeading = startHeadingStream(h => { deviceHeading = h; tick(); });

    stopWatch = startGeolocation(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        userPos = { lat: latitude, lon: longitude, acc: accuracy };
        tick();
      },
      (err) => {
        gate.hidden = false; compass.hidden = true;
        gateError.hidden = false;
        gateError.textContent = err.message || 'Location error';
      }
    );

  }catch(err){
    gateError.hidden = false;
    gateError.textContent = (err && err.message) ? err.message : 'Permission error';
  }
});

function tick(){
  if (!userPos) return;

  // 1) Find nearest + update UI
  const n = nearest(userPos.lat, userPos.lon);
  target = n.store;

  storeEl.textContent = `${target.name} — ${target.city}, ${target.state}`;
  distanceEl.textContent = fmtDistance(n.meters);
  updateMapsLink();

  // 2) Compute continuous rotation: (continuous bearing) - (continuous heading)
  if (deviceHeading != null && target){
    const bearingRaw = bearingDegrees(userPos.lat, userPos.lon, target.lat, target.lon); // 0..360
    const bearingCont = bearingTrack.update(bearingRaw);    // continuous
    const headingCont = headingTrack.update(deviceHeading); // continuous
    const desiredRot  = bearingCont - headingCont;          // continuous
    renderArrow(desiredRot);
  }
}

unitsBtn.addEventListener('click', ()=>{
  unit = (unit === 'mi') ? 'km' : 'mi';
  unitsBtn.textContent = unit;
  if (userPos && target){
    const d = nearest(userPos.lat, userPos.lon);
    distanceEl.textContent = fmtDistance(d.meters);
  }
});

// If device orientation changes 90°/180°, headings can shift abruptly.
// Reset trackers' "prevRaw" so the next sample re-seeds cleanly.
window.addEventListener('orientationchange', ()=>{
  headingTrack.reset();
  bearingTrack.reset();
  if (userPos && target && deviceHeading!=null) tick();
});

// Pause/resume sensor listener when tab visibility changes
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden){
    if (stopHeading) stopHeading();
  }else{
    headingTrack.reset();
    bearingTrack.reset();
    stopHeading = startHeadingStream(h => { deviceHeading = h; tick(); });
  }
});
