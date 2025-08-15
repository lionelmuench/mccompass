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
const accuracyEl = $('#accuracy');
const statusEl = $('#status');

let unit = 'mi'; // 'mi' | 'km'
let userPos = null; // {lat, lon, acc}
let target = null; // {lat, lon, name, city, state}
let deviceHeading = null; // degrees
let stopHeading = null, stopWatch = null;
let smoothRotation = 0; // for easing

console.log('[boot] app.js loaded');

function fmtDistance(meters) {
  if (unit === 'km') {
    const km = meters / 1000;
    return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(km < 10 ? 2 : 1)} km`;
  } else {
    const miles = meters / 1609.344;
    if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`;
    return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
  }
}

function updateMapsLink() {
  if (!target) return;
  const dest = `${target.lat.toFixed(6)},${target.lon.toFixed(6)}`;
  const url = isiOS()
    ? `https://maps.apple.com/?daddr=${dest}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
  mapsLink.href = url;
  console.log('[mapsLink]', url);
}

function setStatus(msg) {
  statusEl.textContent = msg || '';
  console.log('[status]', msg);
}

function animateArrow(toDeg) {
  let delta = ((toDeg - smoothRotation + 540) % 360) - 180;
  smoothRotation = (smoothRotation + delta * 0.25 + 360) % 360;
  arrowEl.style.transform = `rotate(${smoothRotation}deg)`;
}

async function init() {
  console.log('[init] loading store data…');
  try {
    const count = await loadStores();
    console.log('[init] store data loaded', count);
    setStatus(`Loaded ${count} stores`);
  } catch (e) {
    console.error('[init] data load error', e);
    gateError.hidden = false;
    gateError.textContent = e.message || String(e);
  }
}
init();

enableBtn.addEventListener('click', async () => {
  console.log('[enableBtn] clicked');
  gateError.hidden = true;
  gateError.textContent = '';
  try {
    console.log('[enableBtn] requesting orientation permission…', {
      hasDOP: !!window.DeviceOrientationEvent,
      canRequest:
        !!(window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission),
    });
    await requestOrientationPermissionIfNeeded();
    console.log('[enableBtn] orientation permission granted/resolved');

    compass.hidden = false;
    gate.hidden = true;

    console.log('[enableBtn] starting heading stream…');
    stopHeading = startHeadingStream((h) => {
      console.log('[heading event]', h);
      deviceHeading = h;
      tick();
    });

    console.log('[enableBtn] starting geolocation watch…');
    stopWatch = startGeolocation(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        console.log('[geo event]', { latitude, longitude, accuracy });
        userPos = { lat: latitude, lon: longitude, acc: accuracy };
        accuracyEl.textContent = accuracy ? `GPS ±${Math.round(accuracy)} m` : '';
        tick();
      },
      (err) => {
        console.error('[geo error]', err);
        gate.hidden = false;
        compass.hidden = true;
        gateError.hidden = false;
        gateError.textContent = err.message || 'Location error';
      }
    );
  } catch (err) {
    console.error('[enableBtn] ERROR', err);
    gateError.hidden = false;
    gateError.textContent = err && err.message ? err.message : 'Permission error';
  }
});

function tick() {
  if (!userPos) return;
  console.log('[tick] running', { userPos, deviceHeading });

  const n = nearest(userPos.lat, userPos.lon);
  target = n.store;
  console.log('[tick] nearest store', target, 'distance (m)', n.meters);
  storeEl.textContent = `${target.name} — ${target.city}, ${target.state}`;
  distanceEl.textContent = fmtDistance(n.meters);
  updateMapsLink();

  if (deviceHeading != null && target) {
    const brg = bearingDegrees(userPos.lat, userPos.lon, target.lat, target.lon);
    let rotation = (brg - deviceHeading + 360) % 360;
    console.log('[tick] bearing', brg, 'rotation', rotation);
    animateArrow(rotation);
  }
}

unitsBtn.addEventListener('click', () => {
  unit = unit === 'mi' ? 'km' : 'mi';
  console.log('[units] toggled to', unit);
  unitsBtn.textContent = unit;
  if (userPos && target) {
    const d = nearest(userPos.lat, userPos.lon);
    distanceEl.textContent = fmtDistance(d.meters);
  }
});

window.addEventListener('orientationchange', () => {
  console.log('[orientationchange]');
  if (userPos && target && deviceHeading != null) tick();
});

setInterval(() => {
  if (!userPos || !target) return;
}, 3000);

document.addEventListener('visibilitychange', () => {
  console.log('[visibilitychange]', document.hidden);
  if (document.hidden) {
    if (stopHeading) stopHeading();
  } else {
    stopHeading = startHeadingStream((h) => {
      console.log('[heading event - resumed]', h);
      deviceHeading = h;
      tick();
    });
  }
});
