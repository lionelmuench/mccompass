// Tiny on-screen console + error catcher
export function createDebugPanel() {
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed', left: '8px', right: '8px', bottom: '8px',
    height: '40vh', background: 'rgba(0,0,0,.8)', color: '#0f0',
    font: '12px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
    border: '1px solid #333', borderRadius: '8px', padding: '8px',
    overflow: 'auto', zIndex: 99999, whiteSpace: 'pre-wrap'
  });
  box.id = 'dbg_panel';
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;color:#ff0;';
  header.innerHTML = `<strong>McCompass Debug</strong>
  <span>
    <button id="dbg_clear" style="margin-right:6px">clear</button>
    <button id="dbg_hide">hide</button>
  </span>`;
  const pre = document.createElement('div'); pre.id = 'dbg_log';
  box.appendChild(header); box.appendChild(pre);
  document.body.appendChild(box);
  document.getElementById('dbg_clear').onclick = ()=>{ pre.textContent=''; };
  document.getElementById('dbg_hide').onclick = ()=>{ box.remove(); };

  function write(kind, args){
    const line = document.createElement('div');
    const t = new Date().toISOString().split('T')[1].replace('Z','');
    line.textContent = `[${t}] ${kind}: ` + args.map(a=>{
      try { return typeof a==='string'? a : JSON.stringify(a); } catch{ return String(a); }
    }).join(' ');
    pre.appendChild(line);
    pre.scrollTop = pre.scrollHeight;
  }
  const orig = {
    log: console.log, warn: console.warn, error: console.error, info: console.info
  };
  console.log = (...a)=>{ write('log', a); orig.log(...a); };
  console.warn = (...a)=>{ write('warn', a); orig.warn(...a); };
  console.error = (...a)=>{ write('error', a); orig.error(...a); };
  console.info = (...a)=>{ write('info', a); orig.info(...a); };
  window.addEventListener('error', e => write('window.onerror', [e.message, e.filename+':'+e.lineno]));
  window.addEventListener('unhandledrejection', e => write('unhandledrejection', [String(e.reason)]));

  console.info('UA', navigator.userAgent);
  console.info('iOS guess', /iPad|iPhone|iPod/.test(navigator.userAgent));
  console.info('Motion & Orientation Access toggle exists?', typeof DeviceMotionEvent !== 'undefined');
  console.info('Has DeviceOrientationEvent?', !!window.DeviceOrientationEvent);
  console.info('Can request orientation permission?', !!(window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission));
  console.info('Has geolocation?', 'geolocation' in navigator);
}
