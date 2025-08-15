import { bearingDegrees } from './geo.js';
import { requestOrientationPermissionIfNeeded, startHeadingStream, startGeolocation, isiOS } from './sensors.js';
import { loadStores, nearest } from './data.js';

const $ = (s)=>document.querySelector(s);
const enableBtn = $('#enableBtn');
const gate = $('#gate');
const gateError = $('#gateError');
const compass = $('#compass');
const arrowEl = $('#arrow');
const distanceEl = $('#distance');
const storeEl = $('#store');
const mapsLink = $('#mapsLink');
const unitsBtn = $('#unitsBtn');
const accuracyEl = $('#accuracy');
const statusEl = $('#status');

let unit = 'mi'; // 'mi' | 'km'
let userPos = null; // {lat, lon, acc}
let target = null;  // {lat, lon, name, city, state}
let deviceHeading = null; // degrees
let stopHeading = null, stopWatch = null;
let smoothRotation = 0; // for easing

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
  // Prefer Apple Maps on iOS, Google Maps otherwise
  const dest = `${target.lat.toFixed(6)},${target.lon.toFixed(6)}`;
  const url = isiOS()
    ? `https://maps.apple.com/?daddr=${dest}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
  mapsLink.href = url;
}

function setStatus(msg){ statusEl.textContent = msg || ''; }

function animateArrow(toDeg){
  // Ease toward target to avoid jitter
  // Normalize shortest-arc rotation
  let delta = ((toDeg - smoothRotation + 540) % 360) - 180;
  smoothRotation = (smoothRotation + delta * 0.25 + 360) % 360;
  arrowEl.style.transform = `rotate(${smoothRotation}deg)`;
}

async function init(){
  // Load data early
  try{
    const count = await loadStores();
    setStatus(`Loaded ${count} stores`);
  }catch(e){
    gateError.hidden = false; gateError.textContent = e.message || String(e);
  }
}
init();

enableBtn.addEventListener('click', async () => {
  gateError.hidden = true; gateError.textContent = '';
  try{
    // Request orientation permission first (must be inside a user gesture on iOS)
    await requestOrientationPermissionIfNeeded();

    compass.hidden = false;
    gate.hidden = true;

    // Start heading + location
    stopHeading = startHeadingStream(h => { deviceHeading = h; tick(); });

    stopWatch = startGeolocation(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        userPos = { lat: latitude, lon: longitude, acc: accuracy };
        accuracyEl.textContent = accuracy ? `GPS ±${Math.round(accuracy)} m` : '';
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
  if (!target){
    const n = nearest(userPos.lat, userPos.lon);
    target = n.store;
    storeEl.textContent = `${target.name} — ${target.city}, ${target.state}`;
    distanceEl.textContent = fmtDistance(n.meters);
    updateMapsLink();
  }else{
    // Update distance as you move
    const d = nearest(userPos.lat, userPos.lon); // still cheap; also re-evaluates nearest as you walk/drive
    target = d.store;
    storeEl.textContent = `${target.name} — ${target.city}, ${target.state}`;
    distanceEl.textContent = fmtDistance(d.meters);
    updateMapsLink();
  }

  if (deviceHeading != null && target){
    const brg = bearingDegrees(userPos.lat, userPos.lon, target.lat, target.lon);
    let rotation = (brg - deviceHeading + 360) % 360;
    animateArrow(rotation);
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

// Keep arrow aligned if the screen orientation changes
window.addEventListener('orientationchange', ()=>{ if (userPos && target && deviceHeading!=null) tick(); });

// “Arrived” hint
setInterval(()=>{
  if (!userPos || !target) return;
  const brgDistMeters = (()=>{
    return (window.___tmp = 0), 0; // placeholder to keep bundle simple
  })();
  // We already update distance in tick(); arrival message comes from there if you want to add it later.
}, 3000);

// Clean up when page hidden
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden){
    if (stopHeading) stopHeading();
  }else{
    // Restart heading stream to ensure fresh permissions on iOS
    stopHeading = startHeadingStream(h => { deviceHeading = h; tick(); });
  }
});
