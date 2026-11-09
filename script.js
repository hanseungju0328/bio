
"use strict";

// DNA Enhancer Simulator
// U자 접힘 기반 교육용 확률 시뮬레이션

const canvas = document.getElementById("dnaCanvas");
const ctx = canvas.getContext("2d");

const force = document.getElementById("force");
const distance = document.getElementById("distance");
const flexibility = document.getElementById("flexibility");

const runBtn = document.getElementById("runBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusText = document.getElementById("status");

const targetResult = document.getElementById("targetResult");
const successCount = document.getElementById("successCount");
const trialCount = document.getElementById("trialCount");

const TOTAL = 2000;
const CONTACT_RADIUS = 55;

let running = false;
let animationId = null;
let lastResult = null;

const clamp = (v, min, max) =>
  Math.max(min, Math.min(max, v));

const lerp = (a, b, t) =>
  a + (b - a) * t;

const smooth = t =>
  t * t * (3 - 2 * t);

// ===== 설정값 =====

function getSettings() {
  return {
    force: Number(force.value),
    distance: Number(distance.value),
    flexibility: Number(flexibility.value)
  };
}

function updateLabels() {
  document.getElementById("forceValue").textContent =
    force.value;

  document.getElementById("distanceValue").textContent =
    distance.value;

  document.getElementById("flexibilityValue").textContent =
    flexibility.value;
}

// ===== 정규분포 난수 =====

function gaussian() {
  const u = Math.max(Math.random(), 1e-12);
  const v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) *
    Math.cos(2 * Math.PI * v);
}

// ===== DNA 접힘 구조 =====

function pointOnDNA(t, fold, s) {
  const W = canvas.width;
  const H = canvas.height;

  // 초기 상태: 수평 직선
  const straight = {
    x: 70 + t * (W - 140),
    y: H * 0.51
  };

  // 최종 상태: 부드러운 U자
  const radius =
    15 + (100 - s.flexibility) * 0.05;

  const cx = W * 0.5;
  const bottom = H * 0.82;
  const top = H * 0.17;
  const shoulder = bottom - radius;

  let x, y;

  if (t < 0.38) {
    const k = t / 0.38;

    x = cx - radius;
    y = lerp(top, shoulder, k);

  } else if (t <= 0.62) {
    const k = (t - 0.38) / 0.24;
    const theta = Math.PI - Math.PI * k;

    x = cx + radius * Math.cos(theta);
    y = shoulder + radius * Math.sin(theta);

  } else {
    const k = (t - 0.62) / 0.38;

    x = cx + radius;
    y = lerp(shoulder, top, k);
  }

  const k = smooth(clamp(fold, 0, 1));

  return {
    x: lerp(straight.x, x, k),
    y: lerp(straight.y, y, k)
  };
}

// ===== 인핸서와 프로모터 위치 =====

function markerPositions(fold, s) {
  const offset = (s.distance - 50) / 1000;

  const promoterT =
    clamp(0.12 + offset, 0.04, 0.22);

  const enhancerT =
    clamp(0.88 - offset, 0.78, 0.96);

  return {
    promoter: pointOnDNA(promoterT, fold, s),
    enhancer: pointOnDNA(enhancerT, fold, s)
  };
}

function separation(a, b) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

// ===== 한 번의 확률 실험 =====

function sampleTrial(s) {
  const attraction = s.force / 100;

  const resistance =
    0.15 + (100 - s.flexibility) / 150;

  // 무작위 접힘 변동
  const fluctuation = gaussian() * 0.13;

  const finalFold = clamp(
    0.30 +
    attraction * 1.05 -
    resistance +
    fluctuation,
    0,
    1
  );

  const p = markerPositions(finalFold, s);

  const d = separation(
    p.enhancer,
    p.promoter
  );

  return {
    finalFold,
    distance: d,
    contact: d <= CONTACT_RADIUS
  };
}

// ===== 화면 그리기 =====

function drawPoint(p, color, label, dx, dy) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "#263447";
  ctx.fillText(label, p.x + dx, p.y + dy);
}

function draw(fold, s) {
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fbfcfe";
  ctx.fillRect(0, 0, W, H);

  // DNA 사슬
  ctx.beginPath();

  for (let i = 0; i <= 180; i++) {
    const t = i / 180;
    const p = pointOnDNA(t, fold, s);

    if (i === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }

  ctx.strokeStyle = "#5988c4";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  const p = markerPositions(fold, s);

  const d = separation(
    p.enhancer,
    p.promoter
  );

  const contact = d <= CONTACT_RADIUS;

  // 접촉 판정 범위
  ctx.beginPath();
  ctx.arc(
    p.promoter.x,
    p.promoter.y,
    CONTACT_RADIUS,
    0,
    Math.PI * 2
  );

  ctx.strokeStyle = "#d7b36e";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 접촉 성공 표시
  if (contact) {
    ctx.beginPath();
    ctx.moveTo(p.enhancer.x, p.enhancer.y);
    ctx.lineTo(p.promoter.x, p.promoter.y);

    ctx.strokeStyle = "#29936a";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  drawPoint(
    p.promoter,
    "#d58a32",
    "Promoter",
    -90,
    -16
  );

  drawPoint(
    p.enhancer,
    "#29936a",
    "Enhancer",
    12,
    -13
  );

  ctx.fillStyle = "#263447";
  ctx.font = "bold 18px Arial";

  ctx.fillText(
    contact ? "접촉 성공" : "접촉하지 않음",
    24,
    34
  );

  ctx.font = "14px Arial";
  ctx.fillStyle = "#697586";

  ctx.fillText(
    `접힘 정도: ${(fold * 100).toFixed(1)}%`,
    24,
    H - 45
  );

  ctx.fillText(
    `부위 간 거리: ${d.toFixed(1)} (모형 단위)`,
    24,
    H - 22
  );
}

// ===== 접힘 애니메이션 =====

function animateFold(targetFold, s, callback) {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }

  const duration = 2600;
  let start = null;

  function frame(timestamp) {
    if (start === null) {
      start = timestamp;
    }

    const t = clamp(
      (timestamp - start) / duration,
      0,
      1
    );

    const fold = targetFold * smooth(t);

    draw(fold, s);

    if (t < 1) {
      animationId = requestAnimationFrame(frame);
    } else {
      animationId = null;
      callback();
    }
  }

  animationId = requestAnimationFrame(frame);
}

// ===== 2,000회 반복 실험 =====

function simulate() {
  if (running) return;

  running = true;
  runBtn.disabled = true;
  runBtn.textContent = "시뮬레이션 진행 중";

  const s = getSettings();

  const results = [];
  let successes = 0;

  for (let i = 0; i < TOTAL; i++) {
    const result = sampleTrial(s);

    results.push(result);

    if (result.contact) {
      successes++;
    }
  }

  const probability =
    successes / TOTAL * 100;

  const first = results[0];

  statusText.textContent =
    "DNA가 접히고 있습니다...";

  animateFold(first.finalFold, s, () => {
    successCount.textContent =
      `${successes.toLocaleString()}회`;

    trialCount.textContent =
      `${TOTAL.toLocaleString()}회`;

    targetResult.textContent =
      probability.toFixed(2) + "%";

    lastResult = {
      settings: s,
      results,
      successes,
      probability
    };

    statusText.textContent =
      "2,000회 반복 실험 완료";

    runBtn.disabled = false;
    runBtn.textContent = "다시 실행";
    running = false;
  });
}

// ===== CSV 저장 =====

function downloadCSV() {
  if (!lastResult) {
    alert("먼저 시뮬레이션을 실행하세요.");
    return;
  }

  const s = lastResult.settings;

  const rows = [
    "Trial,Force,Distance,Flexibility,FinalFold,Separation,Contact"
  ];

  lastResult.results.forEach((r, i) => {
    rows.push([
      i + 1,
      s.force,
      s.distance,
      s.flexibility,
      r.finalFold.toFixed(5),
      r.distance.toFixed(4),
      r.contact ? 1 : 0
    ].join(","));
  });

  const blob = new Blob(
    ["\uFEFF" + rows.join("\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "DNA_contact_results.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ===== 초기화 및 이벤트 =====

runBtn.addEventListener("click", simulate);
downloadBtn.addEventListener("click", downloadCSV);

[force, distance, flexibility].forEach(input => {
  input.addEventListener("input", () => {
    updateLabels();

    if (!running) {
      draw(0, getSettings());

      statusText.textContent =
        "설정 변경됨 - 실행 대기";

      successCount.textContent = "-";
      targetResult.textContent = "-";
      lastResult = null;
    }
  });
});

updateLabels();
draw(0, getSettings());
