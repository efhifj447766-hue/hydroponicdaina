/* HydroSense — หน้าจอ/กราฟ (ตามดีไซน์ Figma: ภาพรวม · รายละเอียดเซนเซอร์ · ตั้งค่า · อุปกรณ์)
   ค่าทุกตัวมาจาก HS (data-source.js) — ค้นหา 🔌 เพื่อดูจุดที่ผูกค่าเซนเซอร์ */
(function () {
  const C = window.HS_CONFIG, H = window.HS, S = window.HS_SAMPLE || null;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ST = { view: 'home', sel: 'ph' };
  const sample = () => !H.configured() && !!S;                  // true = ยังไม่ตั้งค่า API → ใช้ค่าตัวอย่างจากดีไซน์
  const p2 = n => String(n).padStart(2, '0');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v, s) => v == null ? '—' : Number(v).toFixed(s.dec);
  const sgn = (v, s) => v == null ? '' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(s.dec);
  const hm = t => { const d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const age = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? s + ' วินาที' : s < 3600 ? Math.floor(s / 60) + ' นาที' : s < 86400 ? Math.floor(s / 3600) + ' ชม.' : Math.floor(s / 86400) + ' วัน'; };
  const ico = (n, c = '') => `<svg class="ic ${c}"><use href="#i-${n}"/></svg>`;
  const R = () => C.RANGES[H.range];
  const sn = k => H.sensor(k);
  const chip = s => `<span class="chip" style="background:${s.tint};color:${s.color}">${ico(s.icon)}</span>`;
  const stc = (x, sm) => `<span class="st ${x[0]}${sm ? ' sm' : ''}">${x[1]}</span>`;
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500); };
  const noApi = e => toast(e && e.message === 'NO_API' ? 'ยังไม่ได้ตั้งค่า API ในไฟล์ js/config.js' : 'ทำรายการไม่สำเร็จ (' + (e && e.message) + ')');

  /* ---------- ข้อมูลที่ใช้วาด (ค่าจริง หรือค่าตัวอย่างจากดีไซน์ถ้ายังไม่ตั้งค่า API) ---------- */
  const sampleNow = () => { const d = new Date(); d.setHours(14, 30, 0, 0); return d.getTime(); };   // ค่าตัวอย่างตามดีไซน์: ล่าสุด 14:30 น. บันทึกทุก 30 นาที
  function ser(k) {                                              // [[เวลา(ms), ค่า], ...] เรียงเก่า→ใหม่
    if (sample()) {
      const s = sn(k), raw = S.series[k], h = S.h[k], [lo, hi] = s.axis, t1 = sampleNow(), n = raw.length;
      return raw.map((y, i) => [t1 - (n - 1 - i) * 1800e3, hi - Math.max(0, Math.min(1, (y * h / 1000 - 7) / (h - 14))) * (hi - lo)]);
    }
    return H.series(k);                                          // 🔌 ข้อมูลกราฟจริง = H.readings จาก GET /readings + ค่าเรียลไทม์
  }
  const lastNum = k => sample() ? S.num[k] : (H.latest ? H.latest[k] : null);
  function status(s, v) {
    if (!sample()) { const x = H.status(s, v); return [x.cls, x.text]; }
    const [t0, t1] = s.target, [a0, a1] = s.alert;
    return v < a0 ? ['crit', 'ต่ำเกินเกณฑ์เตือน'] : v > a1 ? ['crit', 'สูงเกินเกณฑ์เตือน'] : v < t0 ? ['warn', 'ต่ำกว่าเกณฑ์'] : v > t1 ? ['warn', 'สูงกว่าเกณฑ์'] : ['ok', 'ปกติ'];
  }
  function M(k) {                                                // โมเดลตัวเลขของเซนเซอร์ที่ใช้แสดงบนการ์ด/สถิติ
    const s = sn(k);
    if (sample()) return S.model[k];
    const x = H.stats(k), v = lastNum(k), d = H.delta1h(k);
    return { v: fmt(v, s),                                       // 🔌 ค่าปัจจุบันของเซนเซอร์ (ตัวเลขใหญ่) ← reading[s.field]
      st: status(s, v), delta: d == null ? '' : sgn(d, s) + ' ใน 1 ชม.',
      min: fmt(x && x.min, s), avg: fmt(x && x.avg, s), max: fmt(x && x.max, s), last: fmt(v, s),
      tmax: x ? hm(x.tmax) + ' น.' : '—', tmin: x ? hm(x.tmin) + ' น.' : '—', inT: x ? Math.round(x.inTarget) + '%' : '—' };
  }
  const online = () => sample() || (H.latest && !H.offline());
  const upd = () => sample() ? S.upd : H.latest ? age(Date.now() - H.latest.ts) + 'ที่แล้ว' : '—';
  function dev(s) {                                              // การ์ด "สถานะเซนเซอร์"
    if (sample()) return S.device;
    const d = H.devices.find(x => x.id === s.id) || {}, r = d.rssi != null ? d.rssi : H.rssi, c = d.controller || C.CONTROLLER;
    return { ctrl: c + ' · ' + C.FARM_NAME, ctrlShort: c,        // 🔌 ชื่อตัวควบคุม ← /devices[].controller
      wifi: r == null ? '—' : '−' + Math.abs(r) + ' dBm · ' + (r >= -67 ? 'ดี' : r >= -80 ? 'พอใช้' : 'อ่อน'),   // 🔌 ความแรงสัญญาณ ← /devices[].rssi (dBm)
      last: upd(),
      cal: (d.calibratedAt || H.calAt(s.id)) ? Math.floor((Date.now() - (d.calibratedAt ? Date.parse(d.calibratedAt) : H.calAt(s.id))) / 864e5) + ' วันก่อน' : '—' };   // 🔌 วันสอบเทียบล่าสุด ← /devices[].calibratedAt
  }
  function rows(k) {                                             // ตาราง "บันทึกล่าสุด"
    const s = sn(k);
    if (sample() && k === 'ph') return S.rows.map(r => [...r, ['ok', 'ปกติ']]);
    const d = ser(k).slice(-7), out = [];
    for (let i = d.length - 1; i >= 1 && out.length < 6; i--) out.push([hm(d[i][0]) + ' น.', fmt(d[i][1], s), sgn(d[i][1] - d[i - 1][1], s), status(s, d[i][1])]);
    return out;   // 🔌 เวลา/ค่า/ผลต่างจากครั้งก่อน มาจาก H.readings (ค่าจริงที่ API ส่งมา)
  }
  function alertItems() {                                        // การ์ด "การแจ้งเตือนล่าสุด"
    if (sample()) return S.alerts;
    return H.alerts.slice(0, 3).map(a => ({ k: a.sensor, msg: a.message || 'เหตุการณ์', when: age(Date.now() - a.ts) + 'ที่แล้ว' }));   // 🔌 ← GET /alerts
  }
  function insights() {
    if (sample()) return S.insights;
    let inT = '—', n = 0, ok = 0;
    H.readings.forEach(r => { if (r.ph != null && r.ec != null) { n++; const p = sn('ph').target, e = sn('ec').target; if (r.ph >= p[0] && r.ph <= p[1] && r.ec >= e[0] && r.ec <= e[1]) ok++; } });
    if (n) inT = Math.round(ok / n * 100) + '%';
    const doses = H.alerts.filter(x => x.type === 'dose' && x.ts >= Date.now() - R().ms).length;
    const gap = Math.max(C.OFFLINE_MIN * 60e3, R().bucketMs * 2.5); let off = 0;
    for (let i = 1; i < H.readings.length; i++) { const d = H.readings[i].ts - H.readings[i - 1].ts; if (d > gap) off += d; }
    return { inT, dose: H.alerts.length ? doses + ' ครั้ง' : '—', doseSub: 'จากบันทึกเหตุการณ์ของระบบ',   // 🔌 จำนวนครั้งปรับอัตโนมัติ ← /alerts ที่ type="dose"
      off: H.readings.length ? Math.round(off / 60e3) + ' นาที' : '—', offSub: 'ในช่วง ' + R().long + 'ที่เลือก' };
  }

  /* ---------- กราฟเส้น SVG (ไม่ใช้ไลบรารี) ---------- */
  let uid = 0; const draws = new Map();
  const ro = new ResizeObserver(es => es.forEach(e => { const f = draws.get(e.target); f && f(); }));
  const reg = (el, f) => { draws.set(el, f); ro.observe(el); f(); };
  function smooth(p) {
    let d = 'M' + p[0];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += `C${b[0] + (c[0] - a[0]) / 6},${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6},${c[1] - (e[1] - b[1]) / 6} ${c[0]},${c[1]}`;
    }
    return d;
  }
  function lineChart(el) {
    const keys = el.dataset.keys.split(','), dual = keys.length > 1, pinOk = el.dataset.pin === '1', id = ++uid;
    const series = keys.map((k, i) => ({ s: sn(k), d: ser(k), r: i === 1 })).filter(x => x.d.length);
    if (!series.length) { el.innerHTML = `<div class="empty" style="height:100%"><div><b>ยังไม่มีข้อมูลในช่วงนี้</b><br>${H.configured() ? 'รอรับค่าจากเซนเซอร์ หรือเลือกช่วงเวลาอื่น' : 'ใส่ API_BASE_URL / WS_URL ใน js/config.js เพื่อเริ่มรับค่าเซนเซอร์'}</div></div>`; return; }
    const draw = () => {
      const W = el.clientWidth, Ht = el.clientHeight; if (W <= 0 || Ht <= 0) return;
      const hasR = series.some(x => x.r), L = 38, Rm = hasR ? 34 : 8, T = 7, B = 28, pw = W - L - Rm, ph = Ht - T - B;
      const last = series[0].d[series[0].d.length - 1][0], t1 = sample() ? sampleNow() : last, t0 = t1 - (sample() ? 47 * 1800e3 : R().ms);
      const X = t => L + (t - t0) / (t1 - t0) * pw;
      series.forEach(x => {
        let [lo, hi] = x.s.axis; x.d.forEach(p => { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; });
        x.dom = [lo, hi]; x.Y = v => T + ph - (v - lo) / (hi - lo) * ph; x.pts = x.d.map(p => [X(p[0]), x.Y(p[1])]);
      });
      let g = '';
      for (let i = 0; i < 4; i++) g += `<line x1="${L}" x2="${W - Rm}" y1="${T + ph * i / 3}" y2="${T + ph * i / 3}" stroke="#1c332e" stroke-dasharray="3 5"/>`;
      const b0 = series[0], ba = b0.Y(b0.s.target[1]), bb = b0.Y(b0.s.target[0]);
      g += `<rect x="${L}" y="${ba}" width="${pw}" height="${bb - ba}" fill="${dual ? '#7cf0a9' : b0.s.color}" opacity="${dual ? .13 : .1}"/>`;
      series.forEach(x => {
        for (let i = 0; i < 4; i++) {
          const v = x.dom[1] - (x.dom[1] - x.dom[0]) * i / 3;
          g += `<text x="${x.r ? W - Rm + 8 : L - 8}" y="${T + ph * i / 3 + 4}" text-anchor="${x.r ? 'start' : 'end'}" font-size="11" font-weight="500" fill="${dual ? x.s.color : '#5e7a71'}">${v.toFixed((x.dom[1] - x.dom[0]) / 3 < 1 ? 1 : 0)}</text>`;
        }
      });
      series.forEach((x, i) => {
        const e = x.pts[x.pts.length - 1];
        if (x.pts.length > 1) g += `<defs><linearGradient id="g${id}${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${x.s.color}" stop-opacity="${dual ? .22 : .4}"/><stop offset="1" stop-color="${x.s.color}" stop-opacity="0"/></linearGradient></defs><path d="${smooth(x.pts)}L${e[0]},${T + ph}L${x.pts[0][0]},${T + ph}Z" fill="url(#g${id}${i})"/><path d="${smooth(x.pts)}" fill="none" stroke="${x.s.color}" stroke-width="2" stroke-linecap="round"/>`;
        g += `<circle cx="${e[0]}" cy="${e[1]}" r="4.5" fill="${x.s.color}" stroke="#122521" stroke-width="2.5"/>`;
      });
      const n = innerWidth < 768 ? 5 : 7;
      for (let i = 0; i < n; i++) {
        const t = sample() ? t0 + 864e5 * i / (n - 1) : t0 + (t1 - t0) * i / (n - 1), lastT = i === n - 1, d = new Date(t);
        const lb = lastT ? 'ตอนนี้' : !sample() && R().ms > 864e5 ? d.getDate() + '/' + (d.getMonth() + 1) : hm(t);
        g += `<text x="${L + pw * i / (n - 1)}" y="${Ht - 6}" text-anchor="${i === 0 ? 'start' : lastT ? 'end' : 'middle'}" font-size="11" font-weight="${lastT ? 600 : 500}" fill="${lastT ? '#ecf6f2' : '#5e7a71'}">${lb}</text>`;
      }
      el.innerHTML = `<svg viewBox="0 0 ${W} ${Ht}" width="${W}" height="${Ht}">${g}<line id="cx" y1="${T}" y2="${T + ph}" stroke="#2a4a43" stroke-dasharray="3 4" opacity="0"/><g id="cd"></g></svg><div class="tip"></div>`;
      const svg = $('svg', el), tip = $('.tip', el), cx = $('#cx', el), cd = $('#cd', el), base = series[0], pin = sample() && pinOk && W >= 700 ? Math.round(.638 * (base.d.length - 1)) : -1;
      const nm = s => ({ ph: 'pH', ec: 'EC' }[s.key] || s.label);
      const at = bi => {
        const t = base.d[bi][0], x = base.pts[bi][0]; let html = `<div>${hm(t)} น.</div>`, dots = '';
        series.forEach(q => { let j = 0; q.d.forEach((p, i) => { if (Math.abs(p[0] - t) < Math.abs(q.d[j][0] - t)) j = i; });
          html += `<div><i style="background:${q.s.color}"></i>${nm(q.s)}<b>${fmt(q.d[j][1], q.s)}${q.s.unit ? ' ' + q.s.unit : ''}</b></div>`;
          dots += `<circle cx="${q.pts[j][0]}" cy="${q.pts[j][1]}" r="4.5" fill="${q.s.color}" stroke="#122521" stroke-width="2.5"/>`; });
        cx.setAttribute('x1', x); cx.setAttribute('x2', x); cx.setAttribute('opacity', 1); cd.innerHTML = dots;
        tip.innerHTML = html; tip.style.display = 'block';
        const tw = tip.offsetWidth; tip.style.left = Math.max(0, Math.min(W - tw, x + 14 > W - tw ? x - tw - 14 : x + 14)) + 'px'; tip.style.top = '6px';
      };
      const move = ev => { const rc = svg.getBoundingClientRect(), mx = (ev.clientX - rc.left) * (W / rc.width); let bi = 0; base.pts.forEach((p, i) => { if (Math.abs(p[0] - mx) < Math.abs(base.pts[bi][0] - mx)) bi = i; }); at(bi); };
      const out = () => { if (pin >= 0) at(pin); else { tip.style.display = 'none'; cx.setAttribute('opacity', 0); cd.innerHTML = ''; } };
      svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', out);
      if (pin >= 0) at(pin);
    };
    reg(el, draw);
  }
  function spark(el) {
    const k = el.dataset.k, s = sn(k), d = ser(k), id = ++uid;
    const draw = () => {
      const W = el.clientWidth; if (W <= 0 || d.length < 2) { if (d.length < 2) el.innerHTML = ''; return; }
      const lo = Math.min(...d.map(p => p[1])), hi = Math.max(...d.map(p => p[1])), r = (hi - lo) || 1;
      const pts = d.map((p, i) => [4 + i / (d.length - 1) * (W - 8), 46 - (p[1] - lo) / r * 38]), e = pts[pts.length - 1];
      el.innerHTML = `<svg width="${W}" height="52" viewBox="0 0 ${W} 52"><defs><linearGradient id="sp${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".35"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs><path d="${smooth(pts)}L${e[0]},52L${pts[0][0]},52Z" fill="url(#sp${id})"/><path d="${smooth(pts)}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round"/><circle cx="${e[0]}" cy="${e[1]}" r="3.5" fill="${s.color}" stroke="#122521" stroke-width="2"/></svg>`;
    };
    reg(el, draw);
  }

  /* ---------- ชิ้นส่วนที่ใช้ซ้ำ ---------- */
  const banner = () => H.configured() ? (H.err ? `<div class="card empty"><b>เชื่อมต่อไม่สำเร็จ</b>${esc(H.err)}</div>` : '') : '';
  const livePill = () => `<span class="live"><i></i><b data-live></b></span>`;
  const rangeSeg = () => `<div class="seg" role="tablist" aria-label="ช่วงเวลา">${Object.entries(C.RANGES).map(([k, r]) => `<button role="tab" data-r="${k}" aria-selected="${k === H.range}">${r.label}</button>`).join('')}</div>`;
  const bar = (s, v) => { const [a, b] = s.axis, pc = x => Math.max(0, Math.min(100, (x - a) / (b - a) * 100)); return `<div class="bar"><span class="tg" style="left:${pc(s.target[0])}%;width:${pc(s.target[1]) - pc(s.target[0])}%"></span>${v != null ? `<span class="dot" style="left:${pc(v)}%;background:${s.color}"></span>` : ''}</div>`; };
  const tgt = s => `${s.target[0]}–${s.target[1]}`;
  const kv = (a, b) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`;

  function kpi(s) {
    const m = M(s.key);
    return `<button class="card kpi" data-k="${s.key}" aria-label="${s.label} ดูกราฟ">
      <div class="kh">${chip(s)}<span class="lab">${s.label}</span>${stc(m.st)}<i class="sdot ${m.st[0]}"></i></div>
      <!-- 🔌 ค่า ${s.label} ปัจจุบัน (reading.${s.field}, หน่วย ${s.unit || 'ไม่มี'}) → ตัวเลขใหญ่ด้านล่าง -->
      <div class="val" data-sensor-value="${s.key}"><span>${m.v}</span><small>${s.unit}</small></div>
      <div class="spark" data-k="${s.key}"></div>
      <div class="kf"><span>เป้าหมาย ${tgt(s)}</span><b>${m.delta}</b></div></button>`;
  }
  function sumBlock(k) {
    const s = sn(k), m = M(k);
    return `<div class="sblock"><div class="sh"><span><i style="background:${s.color}"></i>${s.label}${s.unit ? ' (' + s.unit + ')' : ''}</span>${stc(m.st)}</div>
      <div class="stats"><div>ต่ำสุด<strong>${m.min}</strong></div><div>เฉลี่ย<strong>${m.avg}</strong></div><div>สูงสุด<strong>${m.max}</strong></div><div>ล่าสุด<strong style="color:${s.color}">${m.last}</strong></div></div>
      ${bar(s, lastNum(k))}<div class="tgt">เป้าหมาย ${tgt(s)}${s.unit ? ' ' + s.unit : ''}</div></div>`;
  }
  const alertRow = a => { const s = sn(a.k) || { tint: '#0e3038', color: '#4fd8f0', icon: 'cpu' }; return `<div class="al">${chip(s)}<div><p>${esc(a.msg)}</p><small>${esc(a.when)}</small></div></div>`; };
  function mini(k) {
    const s = sn(k), m = M(k);
    return `<div class="card"><div class="mh" style="margin-bottom:12px"><div class="l">${chip(s)}<div><div class="t">${s.label}</div><div class="t2">เป้าหมาย ${tgt(s)} ${s.unit}</div></div></div>
      <div class="big" style="color:${s.color}" data-sensor-value="${k}">${m.v}<small>${s.unit}</small></div></div>
      <div class="mini"><span>ต่ำสุด<b>${m.min}</b></span><span>เฉลี่ย<b>${m.avg}</b></span><span>สูงสุด<b>${m.max}</b></span></div>
      <div class="chart c-mini" data-keys="${k}" data-fill="1"></div></div>`;
  }

  /* ---------- หน้า: ภาพรวม ---------- */
  function home() {
    const I = insights(), al = alertItems();
    const sub = R().long + 'ที่ผ่านมา · บันทึกทุก ' + R().bucket.replace('m', ' นาที').replace('h', ' ชั่วโมง');
    return `${banner()}
    <header class="top only-d"><div><p class="eyebrow">${esc(C.FARM_NAME)} · ระบบไฮโดรโปนิกส์</p><h1>ภาพรวมคุณภาพน้ำและสภาพอากาศ</h1></div>
      <div class="ctl">${livePill()}${rangeSeg()}<button class="btn" data-install hidden>${ico('dl')}ติดตั้งแอป</button></div></header>
    <div class="only-m"><div class="mhead"><span class="logo">${ico('leaf')}</span><div><p class="eb">HydroSense</p><p class="nm">${esc(C.FARM_NAME)}${ico('down')}</p></div><a class="bellbtn" href="#settings" aria-label="แจ้งเตือน">${ico('bell')}</a></div>
      <div style="margin:16px 0 12px">${livePill()}</div>${rangeSeg()}</div>
    <section class="kpis">${C.SENSORS.map(kpi).join('')}</section>
    <section class="row"><div class="card"><div class="chead"><div><h2>pH และ EC ย้อนหลัง</h2><p class="sub">${sub}</p></div>
      <div class="legend"><span><i style="background:#b69cff"></i>pH</span><span><i style="background:#ffc857"></i>EC (mS/cm)</span><span><i class="band"></i>ช่วงเป้าหมาย</span></div></div>
      <div class="chart c-main" data-keys="ph,ec" data-fill="1" data-pin="1"></div>
      <div class="ins only-d"><div><span>เวลาที่อยู่ในช่วงเป้าหมาย</span><strong style="color:var(--ok)">${I.inT}</strong><small>pH และ EC พร้อมกัน</small></div>
      <div><span>ปรับค่าอัตโนมัติ</span><strong>${I.dose}</strong><small>${I.doseSub}</small></div>
      <div><span>เซนเซอร์ออฟไลน์</span><strong>${I.off}</strong><small>${I.offSub}</small></div></div></div>
      <div class="card sum only-d"><h2>สรุป ${R().long}</h2>${sumBlock('ph')}${sumBlock('ec')}<hr><h2 style="font-size:15px">การแจ้งเตือนล่าสุด</h2>
        ${al.length ? `<div class="alist">${al.map(alertRow).join('')}</div>` : `<div class="empty">${H.configured() ? 'ยังไม่มีการแจ้งเตือน' : ''}</div>`}</div></section>
    <section class="c3">${['water', 'air', 'humidity'].map(mini).join('')}</section>
    <p class="foot only-d">HydroSense · เชื่อมต่อผ่าน MQTT · ESP32${sample() ? ' 3 อุปกรณ์ออนไลน์ · ข้อมูลตัวอย่างสำหรับงานออกแบบ' : ''}</p>
    <p class="foot only-m">${sample() ? 'ข้อมูลตัวอย่างสำหรับงานออกแบบ · ' : ''}MQTT · ESP32</p>`;
  }

  /* ---------- หน้า: รายละเอียดเซนเซอร์ ---------- */
  function detail() {
    const s = sn(ST.sel), m = M(s.key), d = dev(s), rs = rows(s.key), v = lastNum(s.key);
    const sub = R().long + 'ที่ผ่านมา · บันทึกทุก ' + R().bucket.replace('m', ' นาที').replace('h', ' ชั่วโมง');
    const stat = (a, b, c, col) => `<div class="card"><span>${a}</span><strong${col ? ` style="color:${col}"` : ''}>${b}</strong><small>${c}</small></div>`;
    const rl = (r, i) => `<div class="tr${i >= 5 ? ' only-d' : ''}"><span>${r[0]}</span><b>${r[1]}</b><span class="only-d">${r[2]}</span>${stc(r[3], true)}</div>`;
    return `${banner()}
    <header class="top only-d"><div><p class="eyebrow"><a href="#home" style="display:flex;gap:8px;align-items:center">${ico('back')}ภาพรวม&nbsp; /&nbsp; ${s.label}</a></p>
      <div class="h1row"><h1>${s.label} · เซนเซอร์ ${s.id}</h1>${stc(m.st)}</div></div>
      <div class="ctl">${rangeSeg()}<button class="btn" id="csv">${ico('dl')}ส่งออก CSV</button></div></header>
    <div class="only-m"><div class="mhead"><a class="back" href="#home" aria-label="ย้อนกลับ">${ico('back')}</a><div><p class="nm" style="font-size:20px">${s.label}</p><p class="eb">${s.id} · ${esc(C.FARM_NAME)} · ${online() ? 'ออนไลน์' : 'ออฟไลน์'}</p></div><span style="margin-left:auto">${stc(m.st, true)}</span></div></div>
    <section class="card only-m"><div style="display:flex;justify-content:space-between;color:var(--t2);font-size:14px;font-weight:500"><span>ค่าล่าสุด</span><span style="font-weight:400;color:var(--t3)">อัปเดต ${upd()}</span></div>
      <!-- 🔌 ค่า ${s.label} ล่าสุด (reading.${s.field}) → ตัวเลขใหญ่ -->
      <div class="lastbig" style="color:${s.color};margin:8px 0" data-sensor-value="${s.key}">${m.v}</div>
      <div style="font-size:13px;color:var(--t3)">เป้าหมาย ${tgt(s)}${m.delta ? ' · ' + m.delta : ''}</div></section>
    <div class="only-m">${rangeSeg()}</div>
    <section class="stat5 only-d">${stat('ล่าสุด', m.v, 'อัปเดต ' + upd(), s.color)}${stat('เฉลี่ย ' + R().label, m.avg, 'เป้าหมาย ' + tgt(s))}${stat('สูงสุด', m.max, 'เวลา ' + m.tmax.replace(' น.', '') + ' น.')}${stat('ต่ำสุด', m.min, 'เวลา ' + m.tmin.replace(' น.', '') + ' น.')}${stat('อยู่ในช่วงเป้าหมาย', m.inT, 'ตลอด ' + R().long.replace('ชั่วโมง','ชม.') + 'ที่ผ่านมา', 'var(--ok)')}</section>
    <section class="detrow"><div class="card"><div class="chead"><div><h2>กราฟ ${s.label.replace('ค่า ', '')} ย้อนหลัง</h2><p class="sub">${sub}</p></div>
      <div class="legend"><span><i style="background:${s.color}"></i>${s.label.replace('ค่า ', '')}</span><span><i class="band"></i>ช่วงเป้าหมาย<span class="only-d">&nbsp;${tgt(s)}</span></span></div></div>
      <div class="chart c-det" data-keys="${s.key}" data-fill="1" data-pin="1"></div></div>
      <div class="side2 only-d"><div class="card"><h2>สถานะเซนเซอร์</h2><div class="kvs">${kv('รหัสเซนเซอร์', s.id)}${kv('ตัวควบคุม', d.ctrl)}${kv('สัญญาณ Wi-Fi', d.wifi)}${kv('ส่งข้อมูลล่าสุด', d.last)}${kv('สอบเทียบล่าสุด', d.cal)}</div>
        <button class="btn block" id="cal">${ico('flask')}บันทึกการสอบเทียบใหม่</button></div>
        <div class="card"><h2 style="font-size:16px;margin-bottom:14px">เกณฑ์ที่ตั้งไว้</h2>${bar(s, v)}
          <div class="thr"><div>เตือนต่ำกว่า<strong>${s.alert[0]}</strong></div><div>เป้าหมาย<strong>${tgt(s)}</strong></div><div>เตือนสูงกว่า<strong>${s.alert[1]}</strong></div></div></div></div></section>
    <section class="stat4 only-m"><div class="card"><span>เฉลี่ย ${R().label}</span><strong>${m.avg}</strong></div><div class="card"><span>สูงสุด</span><strong>${m.max}</strong></div><div class="card"><span>ต่ำสุด</span><strong>${m.min}</strong></div><div class="card"><span>อยู่ในช่วงเป้าหมาย</span><strong style="color:var(--ok)">${m.inT}</strong></div></section>
    <section class="card only-m"><h2>สถานะเซนเซอร์</h2><div class="kvs">${kv('รหัสเซนเซอร์', s.id)}${kv('ตัวควบคุม', d.ctrlShort)}${kv('สัญญาณ Wi-Fi', d.wifi)}${kv('สอบเทียบล่าสุด', d.cal)}</div></section>
    <section class="card"><div class="tbl"><div class="thead"><h2>บันทึกล่าสุด</h2><span class="only-d">แสดง ${rs.length} รายการล่าสุด</span></div>
      <div class="th only-d"><span>เวลา</span><span>${s.label}</span><span>เปลี่ยนแปลงจากครั้งก่อน</span><span>สถานะ</span></div>
      ${rs.length ? rs.map((r, i) => rl(r, i)).join('') : `<div class="empty">ยังไม่มีบันทึก</div>`}</div></section>`;
  }

  /* ---------- หน้า: ตั้งค่า ---------- */
  const sw = (a, on) => `<input class="sw" type="checkbox" role="switch" data-sw="${a}" ${on ? 'checked' : ''}>`;
  function settings() {
    const st = H.settings, q = st.quiet;
    const sv = (v, s) => Number(v).toFixed((s.axis[1] - s.axis[0]) / 3 < 1 ? 1 : 0);   // รูปแบบตัวเลขในช่องกรอก (pH/EC ทศนิยม 1 ตำแหน่ง)
    const sensD = C.SENSORS.map(s => `<div class="sensrow"><div class="who">${chip(s)}<div><b>${s.label}</b><small>${s.unit || 'ไม่มีหน่วย'}</small></div></div>
      <div class="pair"><input class="in" data-s="${s.key}" data-f="t0" value="${sv(s.target[0], s)}" inputmode="decimal" aria-label="${s.label} เป้าหมายต่ำ">–<input class="in" data-s="${s.key}" data-f="t1" value="${sv(s.target[1], s)}" inputmode="decimal" aria-label="${s.label} เป้าหมายสูง"></div>
      <input class="in amb" data-s="${s.key}" data-f="a0" value="${sv(s.alert[0], s)}" inputmode="decimal" aria-label="${s.label} เตือนต่ำกว่า"><input class="in amb" data-s="${s.key}" data-f="a1" value="${sv(s.alert[1], s)}" inputmode="decimal" aria-label="${s.label} เตือนสูงกว่า">
      ${sw('alert:' + s.key, st.alerts[s.key])}</div>`).join('');
    const sensM = C.SENSORS.map(s => `<div class="card sensm"><div class="top2"><div class="who">${chip(s)}<div><b>${s.label}</b><small>${s.unit || 'ไม่มีหน่วย'}</small></div></div>${sw('alert:' + s.key + ':m', st.alerts[s.key])}</div>
      <div class="labs"><span>เป้าหมาย ต่ำ – สูง</span><span>เตือนเมื่อ ต่ำ / สูงกว่า</span></div>
      <div class="ins4"><input class="in" data-s="${s.key}" data-f="t0" value="${sv(s.target[0], s)}" inputmode="decimal"><input class="in" data-s="${s.key}" data-f="t1" value="${sv(s.target[1], s)}" inputmode="decimal"><input class="in amb" data-s="${s.key}" data-f="a0" value="${sv(s.alert[0], s)}" inputmode="decimal"><input class="in amb" data-s="${s.key}" data-f="a1" value="${sv(s.alert[1], s)}" inputmode="decimal"></div></div>`).join('');
    const chans = `<div>${C.CHANNELS.map(c => `<div class="chrow"><span class="chip" style="background:${c.tint};color:${c.color};width:40px;height:40px">${ico(c.icon)}</span><div class="grow"><b>${esc(c.label)}</b><small>${esc(c.key === 'line' ? '' : c.sub)}${c.key === 'line' ? `<span class="only-d">${esc(c.sub)}</span><span class="only-m">เชื่อมต่อแล้ว</span>` : ''}</small></div>${sw('ch:' + c.key, st.channels[c.key])}</div>`).join('')}</div>`;
    const num = (n, v) => `<label class="num"><input data-n="${n}" value="${v}" inputmode="numeric"><span>นาที</span></label>`;
    const cond = (a, b, ctl) => `<div class="cond"><div><b>${a}</b><small>${b}</small></div>${ctl}</div>`;
    return `${banner()}
    <header class="top only-d"><div><p class="eyebrow">${esc(C.FARM_NAME)} · ตั้งค่า</p><h1>ช่วงเป้าหมายและการแจ้งเตือน</h1></div>
      <div class="ctl"><button class="btn" id="cancel">ยกเลิก</button><button class="btn pri" id="save">บันทึกการเปลี่ยนแปลง</button></div></header>
    <header class="only-m"><p class="eyebrow" style="margin-bottom:4px">${esc(C.FARM_NAME)} · ตั้งค่า</p><h1>ช่วงเป้าหมายและการแจ้งเตือน</h1></header>
    <section class="setgrid"><div class="col">
      <div class="card only-d"><h2>ช่วงเป้าหมายและเกณฑ์เตือน</h2><p class="sub">ค่าที่อยู่นอกช่วงเป้าหมายจะแสดงสถานะ "ต่ำ/สูงกว่าเกณฑ์" และส่งแจ้งเตือนเมื่อเกินเกณฑ์เตือน</p>
        <div class="sensrow head"><span>เซนเซอร์</span><span>ช่วงเป้าหมาย (ต่ำ – สูง)</span><span>เตือนต่ำกว่า</span><span>เตือนสูงกว่า</span><span>แจ้งเตือน</span></div>${sensD}</div>
      <p class="seclab only-m" style="order:1">ช่วงเป้าหมายและเกณฑ์เตือน</p><div class="only-m mstack" style="order:1">${sensM}</div>
      <p class="seclab only-m" style="order:3">เงื่อนไขการแจ้งเตือน</p>
      <div class="card" style="order:3"><h2 class="only-d">เงื่อนไขการแจ้งเตือน</h2><p class="sub only-d" style="margin-bottom:6px">ลดการแจ้งเตือนผิดพลาดจากสัญญาณรบกวนของเซนเซอร์</p>
        ${cond('<span class="only-d">ค่าอยู่นอกช่วงต่อเนื่องนานกว่า</span><span class="only-m">นอกช่วงต่อเนื่องนานกว่า</span>', '<span class="only-d">ป้องกันแจ้งเตือนจากค่ากระโดดชั่วคราว</span>', num('outMin', st.outMin))}
        ${cond('ไม่แจ้งซ้ำภายใน', '<span class="only-d">เมื่อเหตุการณ์เดิมยังไม่ถูกแก้ไข</span>', num('repeatMin', st.repeatMin))}
        ${cond('<span class="only-d">เซนเซอร์ขาดการเชื่อมต่อนานกว่า</span><span class="only-m">เซนเซอร์ออฟไลน์นานกว่า</span>', '<span class="only-d">ตรวจจับอุปกรณ์ออฟไลน์หรือไฟดับ</span>', num('offlineMin', st.offlineMin))}
        <div class="cond"><div><b>ช่วงห้ามรบกวน</b><small class="only-d">ระงับเฉพาะการแจ้งเตือนระดับ "เตือน" · เหตุวิกฤตยังส่งเสมอ</small><small class="only-m">${q.from} – ${q.to} · เหตุวิกฤตยังส่งเสมอ</small></div>
          <div style="display:flex;gap:10px;align-items:center"><span class="only-d" style="display:flex;gap:10px;align-items:center"><input class="time" type="text" maxlength="5" inputmode="numeric" data-q="from" value="${q.from}" aria-label="เริ่มช่วงห้ามรบกวน"><span style="color:var(--t3);font-size:12px">ถึง</span><input class="time" type="text" maxlength="5" inputmode="numeric" data-q="to" value="${q.to}" aria-label="สิ้นสุดช่วงห้ามรบกวน"></span>${sw('quiet', q.on)}</div></div></div>
      <button class="btn pri block only-m" id="save2" style="padding:16px;order:4">บันทึกการเปลี่ยนแปลง</button></div>
      <div class="col"><p class="seclab only-m" style="order:2">ช่องทางแจ้งเตือน</p>
        <div class="card" style="order:2"><h2 class="only-d" style="margin-bottom:6px">ช่องทางแจ้งเตือน</h2>${chans}</div>
        <div class="card only-d" style="order:5"><h2 style="margin-bottom:16px">ระดับการแจ้งเตือน</h2>
          <div class="lvl"><span class="st warn">เตือน</span><p>ค่าออกนอกช่วงเป้าหมาย แต่ยังไม่ถึงเกณฑ์เตือน</p></div>
          <div class="lvl"><span class="st warn">เกณฑ์เตือน</span><p>ค่าเกินเกณฑ์ที่ตั้ง<br>ส่งแจ้งเตือนตามช่องทางที่เปิด</p></div>
          <div class="lvl"><span class="st ok">ปกติ</span><p>ค่าอยู่ในช่วงเป้าหมาย ไม่ส่งแจ้งเตือน</p></div>
          <button class="btn block" id="test">${ico('bell')}ส่งข้อความทดสอบ</button></div></div></section>`;
  }
  function saveSettings() {                                      // อ่านค่าจากช่องกรอกที่มองเห็นอยู่ (เดสก์ท็อปหรือมือถือ)
    const vis = el => el.offsetParent !== null, g = sel => $$(sel).find(vis);
    const st = H.collectSettings();
    for (const s of C.SENSORS) {
      const v = f => parseFloat((g(`[data-s="${s.key}"][data-f="${f}"]`).value || '').replace(',', '.'));
      const t0 = v('t0'), t1 = v('t1'), a0 = v('a0'), a1 = v('a1');
      if (![t0, t1, a0, a1].every(Number.isFinite) || t0 >= t1) { toast(`${s.label}: ช่วงเป้าหมายไม่ถูกต้อง (ต่ำต้องน้อยกว่าสูง)`); return; }
      st.sensors[s.key] = { target: [t0, t1], alert: [a0, a1] };
    }
    C.SENSORS.forEach(s => { st.alerts[s.key] = !!(g(`[data-sw="alert:${s.key}"]`) || g(`[data-sw="alert:${s.key}:m"]`)).checked; });
    C.CHANNELS.forEach(c => { st.channels[c.key] = g(`[data-sw="ch:${c.key}"]`).checked; });
    ['outMin', 'repeatMin', 'offlineMin'].forEach(n => { const x = parseInt(g(`[data-n="${n}"]`).value, 10); if (Number.isFinite(x) && x > 0) st[n] = x; });
    st.quiet.on = g('[data-sw="quiet"]').checked;
    const qf = g('[data-q="from"]'), qt = g('[data-q="to"]'); const okT = x => /^([01]?\d|2[0-3]):[0-5]\d$/.test(x || '');
    if (qf && qt) { if (!okT(qf.value) || !okT(qt.value)) { toast('รูปแบบเวลาไม่ถูกต้อง (เช่น 22:00)'); return; } st.quiet.from = qf.value; st.quiet.to = qt.value; }
    H.saveSettings(st).then(() => { toast('บันทึกการเปลี่ยนแปลงแล้ว'); render(); }).catch(e => toast('บันทึกลงเซิร์ฟเวอร์ไม่สำเร็จ (' + e.message + ') · เก็บไว้ในเครื่องแล้ว'));
  }

  /* ---------- หน้า: อุปกรณ์ ---------- */
  function devicesBase() {
    return `${banner()}<header class="top"><div><p class="eyebrow">${esc(C.FARM_NAME)} · อุปกรณ์</p><h1>อุปกรณ์และเซนเซอร์</h1></div></header>
    <section class="card"><h2 style="margin-bottom:8px">เซนเซอร์ทั้งหมด</h2>${C.SENSORS.map(s => { const m = M(s.key), d = dev(s); return `<div class="dev">${chip(s)}<div class="grow" style="flex:1"><b>${s.label}</b><small>${s.id} · ${esc(d.ctrlShort)} · ${d.wifi}</small></div><div style="text-align:right"><b style="color:${s.color}">${m.v} ${s.unit}</b><br>${stc(m.st, true)}</div></div>`; }).join('')}</section>`;
  }

  function controls() {                                          // การ์ดสั่งอุปกรณ์ผ่าน MQTT (อยู่ในหน้า "อุปกรณ์" ซึ่งไม่มีในไฟล์ Figma)
    if (!(C.MQTT && C.MQTT.ENABLED && (C.MQTT.CONTROLS || []).length)) return '';
    const hint = c => H.pendingCtl[c.key] ? 'รอบอร์ดตอบกลับ…' : !H.mqttUp ? 'ยังไม่ได้เชื่อมต่อ MQTT' : H.offline() ? 'บอร์ดออฟไลน์' : '';
    return `<section class="card"><h2>ควบคุมอุปกรณ์</h2><p class="sub" style="margin-bottom:6px">สั่งผ่าน MQTT สวิตช์จะเปลี่ยนเมื่อบอร์ดรายงานสถานะกลับมา</p>
      ${C.MQTT.CONTROLS.map(c => `<div class="cond"><div><b>${esc(c.label)}</b><small>${hint(c)}</small></div><input class="sw" type="checkbox" role="switch" data-ctl="${esc(c.key)}" ${H.ctl[c.key] ? 'checked' : ''} ${!H.mqttUp || H.offline() || H.pendingCtl[c.key] ? 'disabled' : ''}></div>`).join('')}</section>`;
  }
  function devices() { return devicesBase() + controls(); }

  /* ---------- ควบคุมหน้าจอ ---------- */
  const VIEWS = { home, detail, settings, devices };
  const NAVMAP = { home: 'home', detail: 'detail', settings: 'settings', devices: 'devices' };
  function render() {
    const v = $('#view'); v.innerHTML = VIEWS[ST.view]();
    $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === NAVMAP[ST.view]));
    $$('.chart').forEach(lineChart); $$('.spark').forEach(spark);
    $$('.seg button').forEach(b => b.onclick = () => H.setRange(b.dataset.r));
    $$('.kpi').forEach(b => b.onclick = () => { ST.sel = b.dataset.k; location.hash = '#detail'; });
    $$('[data-install]').forEach(b => { b.hidden = !canInstall(); b.onclick = doInstall; });
    const on = (id, f) => $$('#' + id).forEach(b => b.onclick = f);
    on('save', saveSettings); on('save2', saveSettings); on('cancel', () => { render(); toast('ยกเลิกการเปลี่ยนแปลงแล้ว'); });
    on('test', () => { try { H.testNotify().then(() => toast('ส่งข้อความทดสอบแล้ว')).catch(noApi); } catch (e) { noApi(e); } });
    on('cal', () => { try { H.calibrate(sn(ST.sel).id).then(() => { toast('บันทึกการสอบเทียบแล้ว'); H.loadDevices(); }).catch(noApi); } catch (e) { noApi(e); } });
    on('csv', () => {                                            // ส่งออกจากข้อมูลจริงที่โหลดอยู่
      if (!H.readings.length) { toast(sample() ? 'ยังไม่มีข้อมูลจริงให้ส่งออก — ตั้งค่า API ก่อน' : 'ยังไม่มีข้อมูลในช่วงนี้'); return; }
      const head = ['time_iso', ...C.SENSORS.map(q => q.field)], body = H.readings.map(r => [new Date(r.ts).toISOString(), ...C.SENSORS.map(q => r[q.key] ?? '')].join(','));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + [head.join(','), ...body].join('\n')], { type: 'text/csv' }));
      a.download = `hydrosense-${H.range}-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(a.href);
    });
    $$('[data-ctl]').forEach(i => i.onchange = () => {            // 🔌 กดสวิตช์ → ส่งคำสั่ง ON/OFF ไปที่บอร์ด
      const k = i.dataset.ctl, want = i.checked; i.checked = !!H.ctl[k];
      H.command(k, want).then(() => toast('ส่งคำสั่ง' + (want ? 'เปิด' : 'ปิด') + 'แล้ว รอบอร์ดตอบกลับ')).catch(e => toast('ส่งคำสั่งไม่สำเร็จ (' + e.message + ')'));
    });
    live();
  }
  let pend; const schedule = () => { if (ST.view === 'settings') return; clearTimeout(pend); pend = setTimeout(render, 150); };
  function route() { const h = location.hash.slice(1); ST.view = VIEWS[h] ? h : 'home'; render(); scrollTo(0, 0); }

  /* ---------- แถบสถานะการเชื่อมต่อ ---------- */
  function live() {
    let c = 'off', m;
    if (sample()) { c = ''; m = S.live; }
    else if (!H.configured()) m = 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ';
    else if (!H.latest) { c = 'stale'; m = H.err ? 'เชื่อมต่อไม่สำเร็จ' : 'รอข้อมูลจากเซนเซอร์…'; }
    else if (H.offline()) m = 'ออฟไลน์ · ข้อมูลล่าสุด ' + age(Date.now() - H.latest.ts) + 'ที่แล้ว';
    else { c = ''; m = 'ออนไลน์ · อัปเดตเมื่อ ' + age(Date.now() - H.latest.ts) + 'ที่แล้ว'; }   // 🔌 อายุของค่าล่าสุดจาก reading.ts
    $$('.live').forEach(el => el.className = 'live ' + c); $$('[data-live]').forEach(t => t.textContent = m);
  }

  /* ---------- ติดตั้งแอป (PWA) ---------- */
  let dip = null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const canInstall = () => !!dip || (ios && !standalone);
  const doInstall = async () => { if (dip) { dip.prompt(); await dip.userChoice; dip = null; $$('[data-install]').forEach(b => b.hidden = true); } else toast('แตะปุ่มแชร์ใน Safari แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"'); };
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); dip = e; $$('[data-install]').forEach(b => { b.hidden = false; b.onclick = doInstall; }); });
  addEventListener('appinstalled', () => { dip = null; $$('[data-install]').forEach(b => b.hidden = true); toast('ติดตั้งแอปเรียบร้อยแล้ว'); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});

  ['reading', 'history', 'alerts', 'error', 'ctl'].forEach(e => H.on(e, schedule)); H.on('conn', live);
  H.on('cmdtimeout', k => toast('บอร์ดไม่ตอบกลับคำสั่ง (' + k + ') ตรวจสอบการเชื่อมต่อของบอร์ด'));
  addEventListener('hashchange', route);
  setInterval(live, 1000);
  route(); H.init();
})();
