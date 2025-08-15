// Orientation + location permissions and streams
export function isiOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export async function requestOrientationPermissionIfNeeded(){
  const DOP = window.DeviceOrientationEvent;
  const DMP = window.DeviceMotionEvent;
  try{
    if (isiOS() && DOP && typeof DOP.requestPermission === 'function') {
      const s1 = await DOP.requestPermission(); // 'granted' or 'denied'
      if (DMP && typeof DMP.requestPermission === 'function') { try{ await DMP.requestPermission(); }catch{} }
      if (s1 !== 'granted') throw new Error('Compass permission denied.');
    }
  }catch(err){
    throw err;
  }
}

export function startHeadingStream(onHeading){
  // Returns a stop function
  const handler = (ev) => {
    let heading = null;

    // Best: Safari exposes webkitCompassHeading (degrees from north)
    if (typeof ev.webkitCompassHeading === 'number' && !isNaN(ev.webkitCompassHeading)) {
      heading = ev.webkitCompassHeading; // already 0..360 from true/magnetic north (Safari decides)
    } else if (ev.absolute === true && typeof ev.alpha === 'number') {
      // Absolute orientation: alpha is rotation around Z vs earth frame (0 = facing north)
      heading = 360 - ev.alpha;
    } else if (typeof ev.alpha === 'number') {
      // Fallback: not perfectly reliable but works on many Android devices
      heading = 360 - ev.alpha;
    }

    if (heading == null || isNaN(heading)) return;

    // Adjust for screen orientation (portrait/landscape)
    const orientation = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    heading = (heading + orientation) % 360;
    if (heading < 0) heading += 360;

    onHeading(heading);
  };

  window.addEventListener('deviceorientation', handler, { passive:true });
  // Some browsers fire 'deviceorientationabsolute'
  window.addEventListener('deviceorientationabsolute', handler, { passive:true });

  return () => {
    window.removeEventListener('deviceorientation', handler);
    window.removeEventListener('deviceorientationabsolute', handler);
  };
}

export function startGeolocation(onPosition, onError, options = {}){
  if (!('geolocation' in navigator)) { onError(new Error('Geolocation not supported')); return () => {}; }
  const watchId = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 10000,
    ...options
  });
  return () => navigator.geolocation.clearWatch(watchId);
}
