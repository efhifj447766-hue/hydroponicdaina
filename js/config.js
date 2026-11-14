/* ============================================================================
   HydroSense — ไฟล์ตั้งค่า (แก้ที่ไฟล์นี้ไฟล์เดียวเพื่อเชื่อมเซนเซอร์)
   สถาปัตยกรรมตามผัง FigJam:
   ESP32+เซนเซอร์ → MQTT Broker → Ingest Worker → TimescaleDB → REST + Realtime API → เว็บ/PWA นี้
   หน้าเว็บนี้ "ไม่ได้คุย MQTT โดยตรง" แต่คุยกับ REST + WebSocket ของ API ผ่าน Reverse Proxy (HTTPS/WSS)
   ไม่มีข้อมูลจำลองในโค้ด: ถ้ายังไม่ใส่ค่าด้านล่าง หน้าเว็บจะแสดง "—" และข้อความรอข้อมูล
   ========================================================================== */
window.HS_CONFIG = {

  FARM_ID: 'A',               // 🔌 รหัสโรงเรือน ส่งไปกับทุกคำขอเป็น ?farm=A
  FARM_NAME: 'โรงเรือน A',    // ชื่อที่แสดงบนหัวหน้า

  /* ---- 🔌 จุดเชื่อมต่อหลัก (ใส่ 1 หรือ 2 อย่าง) ----------------------------- */
  API_BASE_URL: '',  // 🔌 URL ฐานของ REST API ผ่าน HTTPS เช่น 'https://farm.example.com/api'
                     //    ใช้โหลด: ค่าล่าสุด, ประวัติสำหรับกราฟ, รายการแจ้งเตือน
  WS_URL: '',        // 🔌 URL ของ WebSocket (Realtime) เช่น 'wss://farm.example.com/ws'
                     //    เซิร์ฟเวอร์ส่งค่าใหม่มาทุกครั้งที่ ESP32 publish (ทุก 30 วินาที)
                     //    ถ้าเว้นว่าง แต่ใส่ API_BASE_URL → หน้าเว็บจะดึงค่าล่าสุดซ้ำทุก POLL_MS แทน
  AUTH_TOKEN: '',    // 🔌 (ถ้ามี) โทเคนยืนยันตัวตน ส่งเป็น Authorization: Bearer … (WS ส่งเป็น ?token=…)

  POLL_MS: 30000,    // ความถี่ดึงค่าล่าสุดเมื่อไม่มี WebSocket (ตรงกับรอบ publish 30 วินาที)
  OFFLINE_MIN: 5,    // ไม่ได้รับค่าใหม่เกินกี่นาที ให้ถือว่าเซนเซอร์ออฟไลน์
  TIMEOUT_MS: 10000, // เวลารอคำตอบ API สูงสุด

  /* ---- 🔌 เส้นทาง API (ปรับให้ตรงกับ backend ของคุณ) ------------------------ */
  ENDPOINTS: {
    latest:  '/readings/latest',  // GET ?farm=A                      → ออบเจ็กต์ค่าล่าสุด 1 รายการ
    history: '/readings',         // GET ?farm=A&from=ISO&to=ISO&bucket=30m → อาร์เรย์ค่าย้อนหลัง (เรียงเก่า→ใหม่)
    alerts:  '/alerts',           // GET ?farm=A&limit=50             → อาร์เรย์การแจ้งเตือน/เหตุการณ์
    devices: '/devices',          // GET ?farm=A → [{id:"PH-01",controller:"ESP32-A1",rssi:-61,calibratedAt:"ISO"}] (การ์ด "สถานะเซนเซอร์")
    settings:'/settings',         // GET ?farm=A → การตั้งค่าที่บันทึกไว้ / PUT body=การตั้งค่าทั้งหมด (ปุ่ม "บันทึกการเปลี่ยนแปลง")
    notifyTest:'/notifications/test', // POST {farm} → ส่งข้อความทดสอบ (ปุ่ม "ส่งข้อความทดสอบ")
    calibrate:'/devices/{id}/calibrations' // POST {farm} → บันทึกการสอบเทียบใหม่ (ปุ่ม "บันทึกการสอบเทียบใหม่")
  },

  /* ---- 🔌 รูปแบบข้อมูลที่ API ต้องส่งกลับ (reading) ------------------------
     {
       "ts": "2026-11-08T14:30:00Z",   // เวลาที่วัด: ISO 8601 หรือ epoch มิลลิวินาที/วินาที
       "ph": 6.04,                      // ค่า pH (ไม่มีหน่วย)
       "ec": 1.67,                      // ค่า EC หน่วย mS/cm
       "water_temp": 25.4,              // อุณหภูมิน้ำ °C
       "air_temp": 29.7,                // อุณหภูมิอากาศ °C
       "humidity": 57                   // ความชื้นสัมพัทธ์ %
     }
     /readings/latest ส่งออบเจ็กต์เดียว (หรือ {data:{…}}), /readings ส่งอาร์เรย์ (หรือ {data:[…]})
     WebSocket ส่งออบเจ็กต์ reading แบบเดียวกัน หรือ {type:"reading",data:{…}}
     ส่งการแจ้งเตือนผ่าน WS ได้ด้วย {type:"alert",data:{ts,sensor,level,message}}
     alert: { ts, sensor:"ph|ec|water|air|humidity", level:"warn|crit|info", type:"dose|…", message:"…" }
     ถ้าชื่อฟิลด์ของคุณต่างจากนี้ ให้แก้ค่า field ของแต่ละเซนเซอร์ด้านล่าง ไม่ต้องแก้ backend */
  TS_FIELD: 'ts',    // 🔌 ชื่อฟิลด์เวลาใน payload

  CONTROLLER: 'ESP32-A1',     // 🔌 ชื่อตัวควบคุม (ESP32) ที่แสดงในการ์ด "สถานะเซนเซอร์" (หรือให้ /devices ส่งมา)

  /* ---- 🔌 ช่องทางแจ้งเตือน (ข้อความรองใต้ชื่อช่องทาง) — ใส่ของจริงจากบัญชีผู้ใช้/ระบบของคุณ ---- */
  CHANNELS: [
    { key: 'line',  label: 'LINE',          sub: 'เชื่อมต่อ LINE Official Account แล้ว', icon: 'chat',  color: '#6fa8ff', tint: '#152848' },
    { key: 'email', label: 'อีเมล',         sub: 'kiw@example.com',                       icon: 'mail',  color: '#4fd8f0', tint: '#0e3038' }, // 🔌 อีเมลผู้รับแจ้งเตือน
    { key: 'push',  label: 'Push บนมือถือ', sub: 'iPhone ของฉัน',                         icon: 'phone', color: '#b69cff', tint: '#231c3f' }  // 🔌 ชื่ออุปกรณ์ที่รับ Push
  ],
  /* ค่าเริ่มต้นของหน้า "เงื่อนไขการแจ้งเตือน" (ตามดีไซน์) — ถูกแทนที่ด้วยค่าที่บันทึก/โหลดจาก API */
  SETTINGS_DEFAULTS: {
    alerts: { ph: true, ec: true, water: true, air: true, humidity: true },
    channels: { line: true, email: true, push: false },
    outMin: 10, repeatMin: 30, offlineMin: 5, quiet: { on: false, from: '22:00', to: '06:00' }
  },

  /* ==========================================================================
     🔌 MQTT (โหมดนี้ไม่ต้องมีเซิร์ฟเวอร์ — เบราว์เซอร์ต่อ MQTT Broker ผ่าน WebSocket โดยตรง)
     ค่าในบล็อกนี้ "ฝั่งเว็บ" ต้องตรงกับ firmware/config.h ฝั่ง ESP32 เป๊ะๆ ในจุดที่ระบุว่า << ตรงกับบอร์ด >>
     ========================================================================== */
  MQTT: {
    ENABLED: true,
    HOST: 'n127f200.ala.asia-southeast1.emqxsl.com',
    PORT_WS: 8083,
    PORT_WSS: 8084,
    PATH: '/mqtt',
    USERNAME: 'esp32_hydro',         // ใส่ Username ที่ตั้งไว้ใน EMQX Cloud
    PASSWORD: 'ookdku2489zx',          // ใส่ Password ที่ตั้งไว้ใน EMQX Cloud
    CLIENT_ID_PREFIX: 'hs-web-',
    TOPIC_PREFIX: 'hydrosense/n127f200', // ต้องตรงกับ TOPIC_PREFIX ใน config.h เป๊ะๆ
    TOPICS: {
      readings: '/readings',
      status:   '/status',
      alerts:   '/alerts',
      state:    '/state/',
      cmd:      '/cmd/'
    },
    CONTROLS: [
      { key: 'relay1', label: 'รีเลย์ 1 (ปั๊ม/วาล์ว)' },
      { key: 'led',    label: 'LED ทดสอบ' }
    ],
    KEEP_DAYS: 7
  },

  RANGES: {          // bucket = ความละเอียดที่ขอจาก API, ms = ความยาวช่วงเวลา
    '1h':  { label: '1 ชม.', long: '1 ชั่วโมง',  ms: 3600e3,   bucket: '1m',  bucketMs: 60e3 },
    '6h':  { label: '6 ชม.', long: '6 ชั่วโมง',  ms: 21600e3,  bucket: '5m',  bucketMs: 300e3 },
    '24h': { label: '24 ชม.', long: '24 ชั่วโมง', ms: 86400e3,  bucket: '30m', bucketMs: 1800e3 },
    '7d':  { label: '7 วัน', long: '7 วัน',  ms: 604800e3, bucket: '3h',  bucketMs: 10800e3 }
  },
  DEFAULT_RANGE: '24h',

  /* ---- 🔌 เซนเซอร์ทั้ง 5 ตัว ------------------------------------------------
     field  = ชื่อฟิลด์ใน payload ที่ "ค่าของเซนเซอร์ตัวนี้" ถูกส่งมา ← จุดที่ผูกค่าเซนเซอร์
     target = ช่วงเป้าหมาย [ต่ำ, สูง]  (ในช่วง = "ปกติ", นอกช่วง = "ต่ำ/สูงกว่าเกณฑ์")
     alert  = เกณฑ์เตือน [ต่ำกว่า, สูงกว่า] (เกิน = สถานะแดง "เกินเกณฑ์เตือน")
     ค่า target/alert เริ่มต้นนำมาจากหน้า "ช่วงเป้าหมายและการแจ้งเตือน" ในดีไซน์ Figma
     (การส่ง LINE/อีเมล/Push ทำที่ Alert Engine ฝั่งเซิร์ฟเวอร์ ไม่ใช่ในหน้าเว็บนี้) */
  SENSORS: [
    { key: 'ph', id: 'PH-01', axis: [5.2, 7.0],    label: 'ค่า pH',        unit: '',      dec: 2, field: 'ph',         // 🔌 ค่า pH จากเซนเซอร์ PH-01
      target: [5.8, 6.4], alert: [5.5, 6.8],  color: '#b69cff', tint: '#231c3f', icon: 'flask' },
    { key: 'ec', id: 'EC-01', axis: [1.0, 2.2],    label: 'ค่า EC',        unit: 'mS/cm', dec: 2, field: 'ec',         // 🔌 ค่า EC (mS/cm) จากเซนเซอร์ EC
      target: [1.4, 1.8], alert: [1.2, 2.0],  color: '#ffc857', tint: '#3a2e12', icon: 'zap' },
    { key: 'water', id: 'WT-01', axis: [22, 28], label: 'อุณหภูมิน้ำ',   unit: '°C',    dec: 1, field: 'water_temp', // 🔌 อุณหภูมิน้ำ (°C) เช่น DS18B20
      target: [22, 26],   alert: [20, 28],    color: '#4fd8f0', tint: '#0e3038', icon: 'thermo' },
    { key: 'air', id: 'AT-01', axis: [20, 32],   label: 'อุณหภูมิอากาศ', unit: '°C',    dec: 1, field: 'air_temp',   // 🔌 อุณหภูมิอากาศ (°C) เช่น DHT22/SHT3x
      target: [22, 32],   alert: [18, 34],    color: '#ff8a7a', tint: '#3b1d1a', icon: 'sun' },
    { key: 'humidity', id: 'HU-01', axis: [40, 100], label: 'ความชื้น',   unit: '%',     dec: 0, field: 'humidity',   // 🔌 ความชื้นสัมพัทธ์ (%) จาก DHT22/SHT3x
      target: [60, 80],   alert: [50, 90],    color: '#6fa8ff', tint: '#152848', icon: 'drop' }
  ]
};
