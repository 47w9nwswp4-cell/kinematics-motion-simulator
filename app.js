const MODES = [
  { id: "uat", label: "已知 u, a, t", known: ["u", "a", "t"] },
  { id: "uvt", label: "已知 u, v, t", known: ["u", "v", "t"] },
  { id: "uva", label: "已知 u, v, a", known: ["u", "v", "a"] },
  { id: "uas", label: "已知 u, a, s", known: ["u", "a", "s"] },
  { id: "uvs", label: "已知 u, v, s", known: ["u", "v", "s"] },
  { id: "uts", label: "已知 u, t, s", known: ["u", "t", "s"] },
];

const RANGES = {
  u: { min: -30, max: 40, step: 0.1, unit: "m/s", name: "初速 u" },
  v: { min: -40, max: 50, step: 0.1, unit: "m/s", name: "末速 v" },
  a: { min: -10, max: 10, step: 0.1, unit: "m/s²", name: "加速度 a" },
  s: { min: -200, max: 400, step: 0.1, unit: "m", name: "位移 s" },
  t: { min: 0.1, max: 20, step: 0.1, unit: "s", name: "時間 t" },
};

const state = { u: 4, v: 16, a: 2, s: 80, t: 6, mode: "uat" };
let play = false;
let clock = 0;
let lastTs = 0;
let warn = "";

const $ = (id) => document.getElementById(id);

function fmt(n, d = 2) {
  if (!Number.isFinite(n)) return "—";
  const x = Math.abs(n) < 1e-10 ? 0 : n;
  return x.toFixed(d);
}

function almost(a, b, eps = 1e-4) { return Math.abs(a - b) <= eps; }

function solve() {
  warn = "";
  const { u, v, a, s, t } = state;
  try {
    if (state.mode === "uat") {
      state.v = u + a * t;
      state.s = u * t + 0.5 * a * t * t;
    } else if (state.mode === "uvt") {
      if (Math.abs(t) < 1e-9) throw "時間不可為 0。";
      state.a = (v - u) / t;
      state.s = 0.5 * (u + v) * t;
    } else if (state.mode === "uva") {
      if (Math.abs(a) < 1e-9) {
        if (!almost(u, v)) throw "a = 0 時必須 u = v，否則無解。";
        throw "a = 0 時無法由 u、v 單獨求出 t。請改用其他組合。";
      }
      state.t = (v - u) / a;
      if (state.t <= 0) throw "求得 t ≤ 0，呢組數值唔對應正向時間運動。";
      state.s = (v * v - u * u) / (2 * a);
    } else if (state.mode === "uas") {
      const disc = u * u + 2 * a * s;
      if (disc < -1e-8) throw "u² + 2as < 0，無實數末速。";
      if (Math.abs(a) < 1e-9) {
        if (Math.abs(u) < 1e-9) throw "u 同 a 都係 0，無法決定時間。";
        state.t = s / u;
        state.v = u;
      } else {
        const A = 0.5 * a, B = u, C = -s;
        const D = B * B - 4 * A * C;
        if (D < 0) throw "時間二次方程無實根。";
        const r1 = (-B + Math.sqrt(D)) / (2 * A);
        const r2 = (-B - Math.sqrt(D)) / (2 * A);
        const pos = [r1, r2].filter(x => x > 1e-8);
        if (!pos.length) throw "求得時間唔係正數。";
        state.t = Math.min(...pos);
        state.v = u + a * state.t;
      }
      if (state.t <= 0) throw "求得 t ≤ 0。";
    } else if (state.mode === "uvs") {
      if (Math.abs(s) < 1e-9) throw "位移為 0，請改用其他已知組合。";
      state.a = (v * v - u * u) / (2 * s);
      const sum = u + v;
      if (Math.abs(sum) < 1e-9) throw "u + v = 0 時無法用平均速度求 t。";
      state.t = (2 * s) / sum;
      if (state.t <= 0) throw "求得 t ≤ 0。";
    } else if (state.mode === "uts") {
      if (Math.abs(t) < 1e-9) throw "時間不可為 0。";
      state.a = 2 * (s - u * t) / (t * t);
      state.v = u + state.a * t;
    }
  } catch (e) {
    warn = String(e);
  }
  if (state.t > 20) state.t = 20;
}

function renderModes() {
  $("modes").innerHTML = MODES.map(m =>
    `<button class="mode ${m.id === state.mode ? "on" : ""}" data-m="${m.id}">${m.label}</button>`
  ).join("");
}

function renderVars() {
  const known = new Set(MODES.find(m => m.id === state.mode).known);
  $("vars").innerHTML = ["u", "v", "a", "s", "t"].map(key => {
    const r = RANGES[key];
    const locked = !known.has(key);
    return `<div class="var ${locked ? "computed" : ""}">
      <div class="head">
        <label><span class="sym" style="color:var(--${key})">${key}</span>　${r.name}</label>
        <span class="lock">${locked ? "由公式求出" : "可調校"}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${state[key]}" data-k="${key}" ${locked ? "disabled" : ""} />
        <input type="number" step="${r.step}" value="${fmt(state[key])}" data-k="${key}" ${locked ? "readonly" : ""} />
      </div>
      <div class="lock">${r.unit}　範圍 ${r.min} ~ ${r.max}</div>
    </div>`;
  }).join("");
  $("warn").textContent = warn;
}

function plugFormulas() {
  const { u, v, a, s, t } = state;
  const lhs1 = v, rhs1 = u + a * t;
  const lhs2 = s, rhs2 = u * t + 0.5 * a * t * t;
  const lhs3 = v * v, rhs3 = u * u + 2 * a * s;
  $("plug1").innerHTML = `${fmt(v)} = ${fmt(u)} + (${fmt(a)})(${fmt(t)}) = <b>${fmt(rhs1)}</b>
    <div class="${almost(lhs1, rhs1, 0.05) ? "ok" : "bad"}">${almost(lhs1, rhs1, 0.05) ? "✓ 公式 1 成立" : "✗ 數值未一致"}</div>`;
  $("plug2").innerHTML = `${fmt(s)} = (${fmt(u)})(${fmt(t)}) + ½(${fmt(a)})(${fmt(t)})² = <b>${fmt(rhs2)}</b>
    <div class="${almost(lhs2, rhs2, 0.08) ? "ok" : "bad"}">${almost(lhs2, rhs2, 0.08) ? "✓ 公式 2 成立" : "✗ 數值未一致"}</div>`;
  $("plug3").innerHTML = `(${fmt(v)})² = (${fmt(u)})² + 2(${fmt(a)})(${fmt(s)})　→　${fmt(lhs3)} = <b>${fmt(rhs3)}</b>
    <div class="${almost(lhs3, rhs3, 0.5) ? "ok" : "bad"}">${almost(lhs3, rhs3, 0.5) ? "✓ 公式 3 成立" : "✗ 數值未一致"}</div>`;
}

function sAt(tt) { return state.u * tt + 0.5 * state.a * tt * tt; }
function vAt(tt) { return state.u + state.a * tt; }

function drawWorld() {
  const c = $("world");
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.46);
  sky.addColorStop(0, "#6ec1e4");
  sky.addColorStop(1, "#d7eef8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.46);
  ctx.fillStyle = "#f7d27a";
  ctx.beginPath(); ctx.arc(w - 90, 42, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5aa15a";
  ctx.fillRect(0, h * 0.46, w, 28);
  const roadY = h * 0.62;
  ctx.fillStyle = "#3b3f46";
  ctx.fillRect(0, roadY, w, 78);
  ctx.fillStyle = "#d7c56a";
  ctx.fillRect(0, roadY + 36, w, 4);
  const tNow = Math.min(Math.max(clock, 0), state.t);
  const sNow = sAt(tNow);
  const vNow = vAt(tNow);
  const sEnd = state.s;
  const sMin = Math.min(0, sEnd, sNow);
  const sMax = Math.max(0, sEnd, sNow, 1);
  const span = Math.max(20, sMax - sMin) * 1.25;
  const xOf = (ss) => 70 + ((ss - sMin) / span) * (w - 140);
  ctx.strokeStyle = "rgba(255,255,255,.25)";
  ctx.setLineDash([8, 10]);
  ctx.beginPath(); ctx.moveTo(0, roadY + 18); ctx.lineTo(w, roadY + 18); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#e8f1fb";
  ctx.font = "12px Noto Sans TC";
  for (let m = Math.floor(sMin / 10) * 10; m <= sMax + span * 0.2; m += 10) {
    const x = xOf(m);
    if (x < 20 || x > w - 20) continue;
    ctx.fillRect(x, roadY + 50, 2, 8);
    ctx.fillText(m + " m", x - 10, roadY + 72);
  }
  const x0 = xOf(0);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(x0, roadY - 8, 3, 20);
  ctx.fillText("起點", x0 - 12, roadY - 12);
  drawCar(ctx, xOf(sNow), roadY + 10, vNow >= 0 ? 1 : -1);
  $("hudTime").textContent = `t = ${fmt(tNow)} s  /  ${fmt(state.t)} s`;
  $("hudVel").textContent = `v = ${fmt(vNow)} m/s`;
  $("hudDisp").textContent = `s = ${fmt(sNow)} m`;
}

function drawCar(ctx, x, y, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = "#1b6cff";
  roundRect(ctx, -34, -28, 68, 22, 6); ctx.fill();
  ctx.fillStyle = "#0b2a66";
  roundRect(ctx, -8, -42, 28, 16, 5); ctx.fill();
  ctx.fillStyle = "#9fe8ff";
  ctx.fillRect(-2, -38, 16, 10);
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(-20, -6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(20, -6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#bbb";
  ctx.beginPath(); ctx.arc(-20, -6, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(20, -6, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGraph(id, kind) {
  const c = $(id);
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#08141f";
  ctx.fillRect(0, 0, w, h);
  const pad = { l: 36, r: 10, t: 10, b: 22 };
  const tMax = Math.max(state.t, 0.1);
  const samples = 80;
  const ys = [];
  for (let i = 0; i <= samples; i++) {
    const tt = tMax * i / samples;
    ys.push(kind === "v" ? vAt(tt) : sAt(tt));
  }
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(0, ...ys);
  const spanY = Math.max(1, yMax - yMin) * 1.2;
  const xOf = (tt) => pad.l + (tt / tMax) * (w - pad.l - pad.r);
  const yOf = (yy) => pad.t + (1 - (yy - yMin) / spanY) * (h - pad.t - pad.b);
  ctx.strokeStyle = "#1e3a56";
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.15)";
  ctx.beginPath(); ctx.moveTo(pad.l, yOf(0)); ctx.lineTo(w - pad.r, yOf(0)); ctx.stroke();
  ctx.strokeStyle = kind === "v" ? "#ff8a4c" : "#3dd6c6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ys.forEach((yy, i) => {
    const tt = tMax * i / samples;
    const x = xOf(tt), y = yOf(yy);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  const tNow = Math.min(clock, tMax);
  const yNow = kind === "v" ? vAt(tNow) : sAt(tNow);
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(xOf(tNow), yOf(yNow), 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8aa0b8";
  ctx.font = "11px JetBrains Mono";
  ctx.fillText("0", pad.l - 12, yOf(0) + 3);
  ctx.fillText(fmt(tMax, 1) + "s", w - 40, h - 6);
  ctx.fillText(kind === "v" ? "v" : "s", 8, 16);
}

function refresh(full = true) {
  solve();
  if (clock > state.t) clock = state.t;
  if (full) {
    renderModes();
    renderVars();
    bindVarInputs();
  } else {
    document.querySelectorAll("#vars input[readonly], #vars input[disabled]").forEach(inp => {
      const k = inp.dataset.k;
      if (inp.type === "number") inp.value = fmt(state[k]);
      if (inp.type === "range") inp.value = state[k];
    });
    $("warn").textContent = warn;
  }
  plugFormulas();
  drawWorld();
  drawGraph("vt", "v");
  drawGraph("st", "s");
}

function bindVarInputs() {
  document.querySelectorAll("#vars input").forEach(inp => {
    inp.oninput = () => {
      const k = inp.dataset.k;
      const known = new Set(MODES.find(m => m.id === state.mode).known);
      if (!known.has(k)) return;
      const val = parseFloat(inp.value);
      if (!Number.isFinite(val)) return;
      state[k] = val;
      play = false;
      clock = 0;
      refresh(false);
      document.querySelectorAll("#vars input[data-k=\"" + k + "\"]").forEach(el => {
        if (el !== inp) el.value = inp.type === "number" ? fmt(val) : val;
      });
    };
  });
}

document.getElementById("modes").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-m]");
  if (!btn) return;
  state.mode = btn.dataset.m;
  play = false; clock = 0;
  refresh(true);
});

document.querySelector(".presets").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-p]");
  if (!btn) return;
  const p = btn.dataset.p;
  state.mode = "uat";
  if (p === "accel") Object.assign(state, { u: 0, a: 3, t: 6 });
  if (p === "cruise") Object.assign(state, { u: 16, a: 0, t: 8 });
  if (p === "brake") Object.assign(state, { u: 20, a: -4, t: 5 });
  if (p === "highway") Object.assign(state, { u: 10, a: 2.5, t: 10 });
  if (p === "reverse") Object.assign(state, { u: -6, a: -1.5, t: 5 });
  play = false; clock = 0;
  refresh(true);
});

document.getElementById("btnPlay").onclick = () => {
  if (clock >= state.t - 1e-6) clock = 0;
  play = !play;
  document.getElementById("btnPlay").textContent = play ? "⏸ 暫停" : "▶ 播放";
};
document.getElementById("btnReset").onclick = () => {
  play = false; clock = 0;
  document.getElementById("btnPlay").textContent = "▶ 播放";
  drawWorld(); drawGraph("vt", "v"); drawGraph("st", "s");
};

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (play) {
    const rate = parseFloat(document.getElementById("rate").value) || 1;
    clock += dt * rate;
    if (clock >= state.t) {
      clock = state.t;
      play = false;
      document.getElementById("btnPlay").textContent = "▶ 播放";
    }
    drawWorld();
    drawGraph("vt", "v");
    drawGraph("st", "s");
  }
  requestAnimationFrame(loop);
}

refresh(true);
requestAnimationFrame(loop);
