/* ============================================================================
   HydroSense — ชั้นรับข้อมูลเซนเซอร์ (ไม่มีข้อมูลจำลอง)
   ค่าจริงเข้าแอปได้ 3 ทางเท่านั้น:
     1) WebSocket  → connectWS()      ค่าใหม่ทุกครั้งที่ ESP32 ส่ง
     2) REST       → loadLatest() / loadHistory() / loadAlerts()
     3) เรียกเอง   → HS.push({...})   ป้อนค่าจากแหล่งอื่น เช่น MQTT.js, Firebase (ดูตัวอย่างใน README)
   ทั้งหมดผ่าน HS.normalize() ที่ใช้ SENSORS[].field ใน config.js แปลงชื่อฟิลด์ให้
   ========================================================================== */
(function () {
  const C = window.HS_CONFIG;
  const H = window.HS = { readings: [], latest: null, alerts: [], range: C.DEFAULT_RANGE, conn: 'idle', err: null, _l: {} };

  H.on = (e, f) => (H._l[e] = H._l[e] || []).push(f);
  const emit = (e, d) => (H._l[e] || []).forEach(f => f(d));
  H.configured = () => !!((C.MQTT && C.MQTT.ENABLED) || C.API_BASE_URL || C.WS_URL);

  const num = v => { const n = (v === null || v === '' || v === undefined) ? NaN : Number(v); return Number.isFinite(n) ? n : null; };
  const toMs = t => { const n = Number(t); const d = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : Date.parse(t); return Number.isFinite(d) ? d : NaN; };

  /* 🔌 จุดผูกค่าเซนเซอร์: แปลง payload ดิบ → {ts, ph, ec, water, air, humidity}
     ค่าที่ได้ null = ไม่มีค่า/เซนเซอร์ขัดข้อง (หน้าเว็บแสดง "—" ไม่เดาค่าให้) */
  H.normalize = raw => {
    if (!raw || typeof raw !== 'object') return null;
    const ts = toMs(raw[C.TS_FIELD]);
    if (!Number.isFinite(ts)) return null;
    const r = { ts };
    C.SENSORS.forEach(s => { r[s.key] = num(raw[s.field]); });   // ← ใส่ค่าของเซนเซอร์แต่ละตัวตรงนี้
    return r;
  };

  async function api(path, params) {
    if (!C.API_BASE_URL) throw new Error('NO_API');
    const q = new URLSearchParams({ farm: C.FARM_ID, ...params });
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), C.TIMEOUT_MS);
    try {
      const res = await fetch(C.API_BASE_URL.replace(/\/$/, '') + path + '?' + q, {
        signal: ctl.signal,
        headers: { Accept: 'application/json', ...(C.AUTH_TOKEN ? { Authorization: 'Bearer ' + C.AUTH_TOKEN } : {}) }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      return j && j.data !== undefined ? j.data : j;
    } finally { clearTimeout(t); }
  }
  const fail = e => { H.err = e.message === 'NO_API' ? null : 'เชื่อมต่อ API ไม่สำเร็จ (' + e.message + ')'; emit('error', H.err); };
  const windowMs = () => C.RANGES[H.range].ms;

  function add(r) {
    if (!r) return;
    if (!H.latest || r.ts >= H.latest.ts) H.latest = r;
    if (mqttMode()) { if (storePush(r)) rebuild(); emit('reading', r); return; }   // โหมด MQTT: เก็บลงที่เก็บในเครื่องแล้วสร้างข้อมูลกราฟใหม่
    const a = H.readings, last = a.length ? a[a.length - 1].ts : 0;
    if (r.ts > last) a.push(r);
    const cut = (H.latest ? H.latest.ts : Date.now()) - windowMs();
    while (a.length && a[0].ts < cut) a.shift();
    emit('reading', r);
  }

  /* 🔌 จุดรับค่าเรียลไทม์จากภายนอก — ส่งออบเจ็กต์รูปแบบเดียวกับ payload ใน config.js */
  H.push = raw => add(H.normalize(raw));

  H.loadLatest = async () => {                                   // GET /readings/latest
    try { H.push(await api(C.ENDPOINTS.latest, {})); H.err = null; } catch (e) { fail(e); }
  };
  H.loadHistory = async () => {                                  // GET /readings → ข้อมูลกราฟทั้งหมด
    if (mqttMode()) { rebuild(); emit('history'); return; }      // โหมด MQTT: ใช้ประวัติที่สะสมในเบราว์เซอร์
    const R = C.RANGES[H.range], to = Date.now();
    try {
      const rows = await api(C.ENDPOINTS.history, { from: new Date(to - R.ms).toISOString(), to: new Date(to).toISOString(), bucket: R.bucket });
      H.readings = (Array.isArray(rows) ? rows : []).map(H.normalize).filter(Boolean).sort((a, b) => a.ts - b.ts);
      if (H.readings.length && (!H.latest || H.readings[H.readings.length - 1].ts > H.latest.ts)) H.latest = H.readings[H.readings.length - 1];
      H.err = null;
    } catch (e) { fail(e); }
    emit('history');
  };
  H.loadAlerts = async () => {                                   // GET /alerts → การ์ด "การแจ้งเตือนล่าสุด"
    try {
      const rows = await api(C.ENDPOINTS.alerts, { limit: 50 });
      H.alerts = (Array.isArray(rows) ? rows : []).map(a => ({ ...a, ts: toMs(a.ts) })).filter(a => Number.isFinite(a.ts)).sort((a, b) => b.ts - a.ts);
    } catch (e) { fail(e); }
    emit('alerts');
  };
  H.devices = [];
  H.loadDevices = async () => {                                  // GET /devices → การ์ด "สถานะเซนเซอร์" / หน้าอุปกรณ์
    try { const r = await api(C.ENDPOINTS.devices, {}); H.devices = (Array.isArray(r) ? r : []); } catch (e) { fail(e); }
    emit('alerts');
  };

  /* ---- ตั้งค่า (ช่วงเป้าหมาย/เกณฑ์เตือน/ช่องทาง/เงื่อนไข) ---- */
  const KEY = 'hs_settings_' + C.FARM_ID;
  H.settings = JSON.parse(JSON.stringify(C.SETTINGS_DEFAULTS));
  H.applySettings = st => {
    C.SENSORS.forEach(s => { const x = st.sensors && st.sensors[s.key]; if (x) { s.target = x.target; s.alert = x.alert; } });
    ['alerts', 'channels', 'quiet'].forEach(k => { if (st[k]) Object.assign(H.settings[k], st[k]); });
    ['outMin', 'repeatMin', 'offlineMin'].forEach(k => { if (st[k] != null) H.settings[k] = st[k]; });
    C.OFFLINE_MIN = H.settings.offlineMin;
  };
  H.collectSettings = () => ({ sensors: Object.fromEntries(C.SENSORS.map(s => [s.key, { target: s.target, alert: s.alert }])), ...JSON.parse(JSON.stringify(H.settings)) });
  H.loadSettings = async () => {
    try { const l = localStorage.getItem(KEY); if (l) H.applySettings(JSON.parse(l)); } catch (e) {}
    try { const r = await api(C.ENDPOINTS.settings, {}); if (r && typeof r === 'object') H.applySettings(r); } catch (e) {}   // 🔌 โหลดค่าที่บันทึกบนเซิร์ฟเวอร์
    emit('history');
  };
  H.saveSettings = async st => {                                 // 🔌 PUT /settings → บันทึกเกณฑ์ลงเซิร์ฟเวอร์ (Alert Engine ใช้ตัดสินส่ง LINE/อีเมล/Push)
    H.applySettings(st);
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    if (C.API_BASE_URL) await send('PUT', C.ENDPOINTS.settings, st);
  };
  async function send(method, path, body) {
    const res = await fetch(C.API_BASE_URL.replace(/\/$/, '') + path + '?farm=' + encodeURIComponent(C.FARM_ID), { method, headers: { 'Content-Type': 'application/json', ...(C.AUTH_TOKEN ? { Authorization: 'Bearer ' + C.AUTH_TOKEN } : {}) }, body: JSON.stringify({ farm: C.FARM_ID, ...body }) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  }
  H.testNotify = () => { if (mqttMode()) return pub('cmd/test', '1'); if (!C.API_BASE_URL) throw new Error('NO_API'); return send('POST', C.ENDPOINTS.notifyTest, {}); };   // MQTT: ส่ง cmd/test ให้บอร์ดกระพริบ LED
  H.calibrate = id => { if (mqttMode()) return pub('cmd/calibrate', id).then(() => { try { localStorage.setItem('hs_cal_' + id, String(Date.now())); } catch (e) {} }); if (!C.API_BASE_URL) throw new Error('NO_API'); return send('POST', C.ENDPOINTS.calibrate.replace('{id}', id), {}); };
  H.calAt = id => { try { return Number(localStorage.getItem('hs_cal_' + id)) || null; } catch (e) { return null; } };

  function connectWS() {                                         // 🔌 WebSocket Realtime จาก Reverse Proxy
    if (!C.WS_URL) return;
    let tries = 0;
    const open = () => {
      const url = C.WS_URL + (C.AUTH_TOKEN ? (C.WS_URL.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(C.AUTH_TOKEN) : '');
      const ws = new WebSocket(url);
      ws.onopen = () => { tries = 0; H.conn = 'live'; ws.send(JSON.stringify({ type: 'subscribe', farm: C.FARM_ID })); emit('conn'); };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === 'alert') { const a = m.data || m; H.alerts.unshift({ ...a, ts: toMs(a.ts) }); emit('alerts'); return; }
        H.push(m.data || m.reading || m);                        // ← ค่าเซนเซอร์ใหม่เข้าตรงนี้
      };
      ws.onclose = () => { H.conn = 'down'; emit('conn'); setTimeout(open, Math.min(30000, 1000 * 2 ** tries++)); };
      ws.onerror = () => ws.close();
    };
    open();
  }

  /* ======================= MQTT ผ่าน WebSocket (ไลบรารี mqtt.min.js) ======================= */
  const MQ = C.MQTT || {};
  function mqttMode() { return !!(C.MQTT && C.MQTT.ENABLED); }
  const P = () => String(MQ.TOPIC_PREFIX || '').replace(/\/$/, '');
  H.ctl = {}; H.pendingCtl = {}; H.deviceOnline = null; H.rssi = null; H.mqttUp = false; H.mqttClient = null; H.store = [];

  // ---- ที่เก็บประวัติในเบราว์เซอร์ (ข้อมูลจริงที่รับได้เท่านั้น ไม่มีการจำลอง) ----
  const SKEY = () => 'hs_store_' + P().replace(/[^\w-]/g, '_');
  const FIELDS = () => C.SENSORS.map(s => s.key);
  let dirty = false;
  function storeLoad() {
    try { H.store = JSON.parse(localStorage.getItem(SKEY()) || '[]').map(x => { const r = { ts: x[0] }; FIELDS().forEach((k, i) => { r[k] = x[i + 1]; }); return r; }); } catch (e) { H.store = []; }
  }
  function storeSave() {
    if (!dirty) return;
    try { localStorage.setItem(SKEY(), JSON.stringify(H.store.map(r => [r.ts, ...FIELDS().map(k => r[k])]))); dirty = false; } catch (e) {}
  }
  function storePush(r) {
    const a = H.store; if (a.length && r.ts <= a[a.length - 1].ts) return false;   // ข้ามค่าซ้ำ/เก่ากว่า (เช่นค่า retained เดิม)
    a.push(r); const cut = r.ts - (MQ.KEEP_DAYS || 7) * 864e5; while (a.length && a[0].ts < cut) a.shift();
    dirty = true; return true;
  }
  function rebuild() {                                           // เฉลี่ยค่าเป็นช่วง (bucket) ตามช่วงเวลาที่เลือก เหมือนที่ API เคยทำ
    const a = H.store; if (!a.length) { H.readings = []; return; }
    const R = C.RANGES[H.range], cut = a[a.length - 1].ts - R.ms, b = R.bucketMs, map = new Map();
    for (let i = a.length - 1; i >= 0 && a[i].ts >= cut; i--) {
      const r = a[i], k = Math.floor(r.ts / b) * b; let g = map.get(k);
      if (!g) { g = { s: {}, n: {} }; map.set(k, g); }
      FIELDS().forEach(f => { if (r[f] != null) { g.s[f] = (g.s[f] || 0) + r[f]; g.n[f] = (g.n[f] || 0) + 1; } });
    }
    H.readings = [...map.entries()].sort((x, y) => x[0] - y[0]).map(([ts, g]) => { const r = { ts }; FIELDS().forEach(f => { r[f] = g.n[f] ? g.s[f] / g.n[f] : null; }); return r; });
  }

  function pub(sub, txt) {                                       // ส่งข้อความไป ${TOPIC_PREFIX}/${sub}
    if (!H.mqttUp) return Promise.reject(new Error('ยังไม่ได้เชื่อมต่อ MQTT'));
    return new Promise((res, rej) => H.mqttClient.publish(P() + '/' + sub, txt, { qos: 1 }, e => e ? rej(e) : res()));
  }
  /* 🔌 ส่งคำสั่งควบคุมไปที่บอร์ด: topic = TOPIC_PREFIX + TOPICS.cmd + key (เช่น hydrosense/k7f3q9x2/cmd/relay1) payload = "ON" หรือ "OFF" */
  H.command = (key, on) => {
    if (!H.mqttUp) return Promise.reject(new Error('ยังไม่ได้เชื่อมต่อ MQTT'));
    clearTimeout(H.pendingCtl[key]);
    H.pendingCtl[key] = setTimeout(() => { delete H.pendingCtl[key]; emit('ctl'); emit('cmdtimeout', key); }, 6000);   // บอร์ดไม่ตอบใน 6 วินาที
    emit('ctl');
    return pub(MQ.TOPICS.cmd.slice(1) + key, on ? 'ON' : 'OFF');
  };

  function connectMQTT() {
    if (typeof mqtt === 'undefined') { H.err = 'โหลดไลบรารี mqtt.min.js ไม่สำเร็จ (ตรวจอินเทอร์เน็ต)'; emit('error', H.err); return; }
    if (!MQ.TOPIC_PREFIX || /CHANGE-ME/i.test(MQ.TOPIC_PREFIX)) { H.err = 'ตั้ง MQTT.TOPIC_PREFIX ใน js/config.js ก่อน (ห้ามใช้ค่า CHANGE-ME และต้องตรงกับบอร์ด)'; emit('error', H.err); return; }
    const secure = location.protocol === 'https:';
    const url = (secure ? 'wss://' : 'ws://') + MQ.HOST + ':' + (secure ? MQ.PORT_WSS : MQ.PORT_WS) + MQ.PATH;   // 🔌 URL WebSocket ของ Broker
    const opts = { clientId: (MQ.CLIENT_ID_PREFIX || 'hs-web-') + Math.random().toString(16).slice(2, 10), reconnectPeriod: 3000, connectTimeout: 10000, clean: true };
    if (MQ.USERNAME) { opts.username = MQ.USERNAME; opts.password = MQ.PASSWORD; }
    const c = H.mqttClient = mqtt.connect(url, opts);              // เชื่อมต่อใหม่อัตโนมัติทุก 3 วินาทีเมื่อหลุด
    c.on('connect', () => { H.mqttUp = true; H.err = null; H.conn = 'live'; c.subscribe(P() + '/#', { qos: 1 }); emit('conn'); emit('error', null); });
    c.on('close', () => { H.mqttUp = false; H.conn = 'down'; emit('conn'); emit('ctl'); });
    c.on('error', e => { H.err = 'เชื่อมต่อ MQTT ไม่สำเร็จ (' + e.message + ')'; emit('error', H.err); });
    c.on('message', (topic, buf) => {
      if (!topic.startsWith(P() + '/')) return;
      const sub = topic.slice(P().length), txt = buf.toString();
      if (sub === MQ.TOPICS.readings) {                            // 🔌 ค่าเซนเซอร์จากบอร์ด (JSON) → การ์ด/กราฟ
        let o; try { o = JSON.parse(txt); } catch (e) { return; }
        if (!o || typeof o !== 'object') return;
        if (o[C.TS_FIELD] == null) o[C.TS_FIELD] = Date.now();     // ถ้าบอร์ดไม่ส่งเวลา ใช้เวลาที่เว็บรับ
        if (o.rssi != null && Number.isFinite(Number(o.rssi))) H.rssi = Number(o.rssi);
        H.push(o);
      } else if (sub === MQ.TOPICS.status) { H.deviceOnline = (txt === 'online'); emit('conn'); emit('reading'); }
      else if (sub === MQ.TOPICS.alerts) { try { const a = JSON.parse(txt); H.alerts.unshift({ ...a, ts: toMs(a.ts == null ? Date.now() : a.ts) }); H.alerts = H.alerts.slice(0, 50); emit('alerts'); } catch (e) {} }
      else if (sub.startsWith(MQ.TOPICS.state)) {                  // 🔌 สถานะอุปกรณ์จากบอร์ด (ON/OFF)
        const k = sub.slice(MQ.TOPICS.state.length); H.ctl[k] = (txt === 'ON');
        clearTimeout(H.pendingCtl[k]); delete H.pendingCtl[k]; emit('ctl');
      }
    });
  }

  H.setRange = async r => { H.range = r; emit('history'); await H.loadHistory(); };

  H.init = async () => {
    await H.loadSettings();
    if (!H.configured()) return;
    H.conn = 'connecting';
    if (mqttMode()) {                                            // โหมด MQTT: ไม่เรียก REST เลย
      storeLoad(); rebuild(); if (H.store.length) H.latest = H.store[H.store.length - 1];
      connectMQTT();
      setInterval(storeSave, 60000); addEventListener('pagehide', storeSave);
      document.addEventListener('visibilitychange', () => { if (document.hidden) storeSave(); });
      emit('history'); return;
    }
    await Promise.all([H.loadLatest(), H.loadHistory(), H.loadAlerts(), H.loadDevices()]);
    connectWS();
    if (!C.WS_URL) setInterval(() => { H.loadLatest(); H.loadAlerts(); }, C.POLL_MS);
  };

  /* ---- ฟังก์ชันคำนวณจากข้อมูลจริงที่โหลดมา ---- */
  H.sensor = k => C.SENSORS.find(s => s.key === k);
  H.offline = () => !H.latest || H.deviceOnline === false || Date.now() - H.latest.ts > C.OFFLINE_MIN * 60000;
  H.status = (s, v) => {
    if (v == null || H.offline()) return { cls: 'none', text: H.latest && v != null ? 'ออฟไลน์' : 'ไม่มีข้อมูล' };
    const [t0, t1] = s.target, [a0, a1] = s.alert;
    if (v < a0) return { cls: 'crit', text: 'ต่ำเกินเกณฑ์เตือน' };
    if (v > a1) return { cls: 'crit', text: 'สูงเกินเกณฑ์เตือน' };
    if (v < t0) return { cls: 'warn', text: 'ต่ำกว่าเกณฑ์' };
    if (v > t1) return { cls: 'warn', text: 'สูงกว่าเกณฑ์' };
    return { cls: 'ok', text: 'ปกติ' };
  };
  H.series = k => H.readings.filter(r => r[k] != null).map(r => [r.ts, r[k]]);
  H.stats = k => {
    const s = H.sensor(k), d = H.series(k);
    if (!d.length) return null;
    let mn = d[0], mx = d[0], sum = 0, inT = 0;
    d.forEach(p => { if (p[1] < mn[1]) mn = p; if (p[1] > mx[1]) mx = p; sum += p[1]; if (p[1] >= s.target[0] && p[1] <= s.target[1]) inT++; });
    return { min: mn[1], tmin: mn[0], max: mx[1], tmax: mx[0], avg: sum / d.length, last: d[d.length - 1][1], inTarget: inT / d.length * 100, n: d.length };
  };
  H.delta1h = k => {                                             // เปลี่ยนแปลงเทียบ 1 ชม.ก่อน (ถ้ามีข้อมูลครอบคลุม)
    const d = H.series(k); if (d.length < 2) return null;
    const last = d[d.length - 1], target = last[0] - 3600e3;
    let best = null; d.forEach(p => { if (!best || Math.abs(p[0] - target) < Math.abs(best[0] - target)) best = p; });
    return Math.abs(best[0] - target) > 45 * 60e3 ? null : last[1] - best[1];
  };
})();
