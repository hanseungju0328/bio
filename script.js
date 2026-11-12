
"use strict";

// =========================================
// DNA Enhancer Simulator
// 고정 그래프 + 슬라이더 연동 점
// =========================================

// 1. HTML 요소

const dnaCanvas = document.getElementById("dnaCanvas");
const ctx = dnaCanvas.getContext("2d");

const graphCanvas = document.getElementById("resultGraph");
const graphCtx = graphCanvas.getContext("2d");

const forceInput = document.getElementById("force");
const distanceInput = document.getElementById("distance");
const flexibilityInput = document.getElementById("flexibility");

const forceValue = document.getElementById("forceValue");
const distanceValue = document.getElementById("distanceValue");
const flexibilityValue = document.getElementById("flexibilityValue");

const runBtn = document.getElementById("runBtn");
const downloadBtn = document.getElementById("downloadBtn");

const statusText = document.getElementById("status");
const trialCount = document.getElementById("trialCount");
const successCount = document.getElementById("successCount");
const targetResult = document.getElementById("targetResult");

// 2. 기본 설정

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

// 3. 현재 슬라이더 설정

function getSettings() {
  return {
    force: Number(forceInput.value),
    distance: Number(distanceInput.value),
    flexibility: Number(flexibilityInput.value)
  };
}

function updateLabels() {
  forceValue.textContent = forceInput.value;
  distanceValue.textContent = distanceInput.value;
  flexibilityValue.textContent = flexibilityInput.value;
}

// =========================================
// 4. 그래프에 사용할 고정 데이터
// =========================================

// 아래 값은 설명을 위한 예시 데이터이다.
// 실제 시뮬레이션 결과가 아니다.
// 배열의 각 원소는 x = 0, 5, 10, ..., 100에 대응한다.

const fixedValues = {
  force: [
    2, 3, 4, 6, 9,
    14, 22, 32, 44, 57,
    69, 79, 86, 91, 94,
    96, 97, 98, 99, 99, 99
  ],

  flexibility: [
    8, 10, 12, 15, 18,
    22, 27, 32, 38, 44,
    50, 56, 62, 68, 73,
    77, 81, 84, 87, 89, 90
  ],

  distance: [
    65, 64, 63, 62, 61,
    59, 58, 57, 55, 54,
    52, 50, 48, 46, 44,
    42, 40, 38, 36, 34, 32
  ]
};

const graphVariables = [
  {
    key: "force",
    name: "상호작용 세기",
    color: "#377bc5"
  },
  {
    key: "flexibility",
    name: "DNA 유연성",
    color: "#238463"
  },
  {
    key: "distance",
    name: "DNA상 거리",
    color: "#dc9245"
  }
];

const fixedGraphData = graphVariables.map(variable => ({
  ...variable,

  points: fixedValues[variable.key].map((y, i) => ({
    x: i * 5,
    y
  }))
}));

// =========================================
// 5. 고정 그래프의 값 읽기
// =========================================

// 5 간격으로 저장한 두 점 사이를
// 선형 보간하여 임의의 슬라이더 값에 대응

function getGraphY(line, x) {
  const points = line.points;

  const value = clamp(x, 0, 100);

  if (value >= 100) {
    return points[points.length - 1].y;
  }

  const index = Math.floor(value / 5);

  const p1 = points[index];
  const p2 = points[index + 1];

  const ratio = (value - p1.x) / (p2.x - p1.x);

  return lerp(p1.y, p2.y, ratio);
}

// =========================================
// 6. 고정 그래프 그리기
// =========================================

function drawComparisonGraph() {
  const g = graphCtx;

  const W = graphCanvas.width;
  const H = graphCanvas.height;

  g.clearRect(0, 0, W, H);

  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);

  const left = 85;
  const right = W - 48;
  const top = 55;
  const bottom = H - 85;

  const plotW = right - left;
  const plotH = bottom - top;

  const toX = x =>
    left + (x / 100) * plotW;

  const toY = y =>
    bottom - (y / 100) * plotH;

  // 배경 격자와 Y축 눈금
  g.font = "14px Arial";

  for (let y = 0; y <= 100; y += 20) {
    const py = toY(y);

    g.beginPath();
    g.moveTo(left, py);
    g.lineTo(right, py);

    g.strokeStyle = "#e5eaf0";
    g.lineWidth = 1;
    g.stroke();

    g.fillStyle = "#697586";
    g.textAlign = "right";
    g.fillText(`${y}%`, left - 13, py + 5);
  }

  // X축 눈금
  for (let x = 0; x <= 100; x += 20) {
    const px = toX(x);

    g.fillStyle = "#697586";
    g.textAlign = "center";
    g.fillText(String(x), px, bottom + 25);
  }

  // 좌표축
  g.beginPath();
  g.moveTo(left, top);
  g.lineTo(left, bottom);
  g.lineTo(right, bottom);

  g.strokeStyle = "#7a8797";
  g.lineWidth = 1.5;
  g.stroke();

  // 제목
  g.fillStyle = "#263447";
  g.font = "bold 17px Arial";
  g.textAlign = "left";

  g.fillText(
    "변인별 접촉 확률 비교",
    left,
    28
  );

  // 세 곡선은 항상 같은 데이터로 그림
  for (const line of fixedGraphData) {
    g.beginPath();

    line.points.forEach((p, i) => {
      const px = toX(p.x);
      const py = toY(p.y);

      if (i === 0) {
        g.moveTo(px, py);
      } else {
        g.lineTo(px, py);
      }
    });

    g.strokeStyle = line.color;
    g.lineWidth = 3;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.stroke();
  }

  // 현재 슬라이더 값
  const settings = getSettings();

  // 각 곡선 위에 현재 위치 점 표시
  for (const line of fixedGraphData) {
    const x = settings[line.key];
    const y = getGraphY(line, x);

    const px = toX(x);
    const py = toY(y);

    // 점 아래의 보조선
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px, bottom);

    g.strokeStyle = line.color;
    g.globalAlpha = 0.35;
    g.lineWidth = 1.5;
    g.setLineDash([5, 5]);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;

    // 하얀 테두리의 색상 점
    g.beginPath();
    g.arc(px, py, 8, 0, Math.PI * 2);

    g.fillStyle = line.color;
    g.fill();

    g.strokeStyle = "#ffffff";
    g.lineWidth = 3;
    g.stroke();

    // 점 위에 예시 접촉 확률 표시
    g.fillStyle = line.color;
    g.font = "bold 13px Arial";
    g.textAlign = "center";

    const labelY = Math.max(py - 16, top + 15);

    g.fillText(
      `${y.toFixed(1)}%`,
      clamp(px, left + 28, right - 28),
      labelY
    );
  }

  // X축 제목
  g.fillStyle = "#263447";
  g.font = "14px Arial";
  g.textAlign = "center";

  g.fillText(
    "변인 설정값 (0~100)",
    W / 2,
    H - 34
  );

  // Y축 제목
  g.textAlign = "left";
  g.font = "12px Arial";

  g.fillText(
    "예시 접촉 확률 (%)",
    left,
    top - 12
  );

  g.textAlign = "left";
}

// =========================================
// 7. DNA 구조 계산
// =========================================

function pointOnDNA(t, fold, s) {
  const W = dnaCanvas.width;
  const H = dnaCanvas.height;

  // 초기 직선 상태
  const straight = {
    x: 70 + t * (W - 140),
    y: H * 0.51
  };

  // 최종 U자 상태
  const radius =
    15 + (100 - s.flexibility) * 0.05;

  const cx = W * 0.5;
  const top = H * 0.17;
  const bottom = H * 0.82;
  const shoulder = bottom - radius;

  let x;
  let y;

  if (t < 0.38) {
    // 왼쪽 DNA 구간
    const k = t / 0.38;

    x = cx - radius;
    y = lerp(top, shoulder, k);

  } else if (t <= 0.62) {
    // U자의 아래쪽 곡선
    const k = (t - 0.38) / 0.24;
    const theta = Math.PI - Math.PI * k;

    x = cx + radius * Math.cos(theta);
    y = shoulder + radius * Math.sin(theta);

  } else {
    // 오른쪽 DNA 구간
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

// =========================================
// 8. 인핸서와 프로모터 위치 계산
// =========================================

function markerPositions(fold, s) {
  const enhancerT = 0.88;

  // DNA상 거리 설정에 따라
  // 프로모터의 상대 위치를 변경
  const promoterT =
    0.12 - (s.distance / 100) * 0.08;

  return {
    enhancer: pointOnDNA(enhancerT, fold, s),
    promoter: pointOnDNA(promoterT, fold, s)
  };
}

function separation(a, b) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

// =========================================
// 9. 확률적 접힘 모형
// =========================================

function gaussian() {
  const u = Math.max(Math.random(), 1e-12);
  const v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) *
    Math.cos(2 * Math.PI * v);
}

function sampleTrial(s) {
  const attraction = s.force / 100;
  const flex = s.flexibility / 100;

  // 모형에서 가정한 접힘 식
  const fluctuation = gaussian() * 0.12;

  const finalFold = clamp(
    0.40 +
    0.70 * attraction +
    0.42 * flex +
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

// =========================================
// 10. DNA 화면 그리기
// =========================================

function drawMarker(p, color, label, dx, dy) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);

  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "#263447";

  ctx.fillText(
    label,
    p.x + dx,
    p.y + dy
  );
}

function drawDNA(fold, s) {
  const W = dnaCanvas.width;
  const H = dnaCanvas.height;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#fbfcfe";
  ctx.fillRect(0, 0, W, H);

  // DNA 중심선
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

  // 접촉 시 연결선 표시
  if (contact) {
    ctx.beginPath();
    ctx.moveTo(p.enhancer.x, p.enhancer.y);
    ctx.lineTo(p.promoter.x, p.promoter.y);

    ctx.strokeStyle = "#29936a";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  drawMarker(
    p.promoter,
    "#d58a32",
    "Promoter",
    -90,
    -16
  );

  drawMarker(
    p.enhancer,
    "#29936a",
    "Enhancer",
    12,
    -13
  );

  // 현재 접힘 상태
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

// =========================================
// 11. DNA 접힘 애니메이션
// =========================================

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

    drawDNA(fold, s);

    if (t < 1) {
      animationId = requestAnimationFrame(frame);
    } else {
      animationId = null;
      callback();
    }
  }

  animationId = requestAnimationFrame(frame);
}

// =========================================
// 12. 시뮬레이션 실행
// =========================================

function runSimulation() {
  if (running) return;

  running = true;

  runBtn.disabled = true;
  runBtn.textContent = "시뮬레이션 진행 중";

  const settings = getSettings();

  let successes = 0;
  const results = [];

  // 2,000회 반복
  for (let i = 0; i < TOTAL; i++) {
    const result = sampleTrial(settings);

    results.push(result);

    if (result.contact) {
      successes++;
    }
  }

  const probability =
    successes / TOTAL * 100;

  statusText.textContent =
    "DNA가 접히고 있습니다...";

  // 첫 번째 시행을 애니메이션으로 표시
  animateFold(
    results[0].finalFold,
    settings,
    () => {
      trialCount.textContent =
        TOTAL.toLocaleString() + "회";

      successCount.textContent =
        successes.toLocaleString() + "회";

      targetResult.textContent =
        probability.toFixed(2) + "%";

      lastResult = {
        settings,
        results,
        successes,
        probability
      };

      statusText.textContent =
        "2,000회 반복 실험 완료";

      running = false;
      runBtn.disabled = false;
      runBtn.textContent = "다시 실행";
    }
  );
}

// =========================================
// 13. CSV 저장
// =========================================

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
    {
      type: "text/csv;charset=utf-8;"
    }
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

// =========================================
// 14. 슬라이더와 그래프 연결
// =========================================

function onSliderChange() {
  // 숫자 표시 갱신
  updateLabels();

  // 고정 곡선은 그대로, 점 위치만 갱신
  drawComparisonGraph();

  // 시뮬레이션 실행 중이 아닐 때만
  // DNA 화면을 초기 상태로 변경
  if (!running) {
    drawDNA(0, getSettings());

    statusText.textContent =
      "설정 변경됨 - 실행 대기";

    successCount.textContent = "-";
    targetResult.textContent = "-";
    lastResult = null;
  }
}

forceInput.addEventListener(
  "input",
  onSliderChange
);

distanceInput.addEventListener(
  "input",
  onSliderChange
);

flexibilityInput.addEventListener(
  "input",
  onSliderChange
);

// =========================================
// 15. 버튼 이벤트
// =========================================

runBtn.addEventListener(
  "click",
  runSimulation
);

downloadBtn.addEventListener(
  "click",
  downloadCSV
);

// =========================================
// 16. 초기 화면
// =========================================

updateLabels();

// 처음 접속하면 DNA는 펼쳐진 상태
drawDNA(0, getSettings());

// 처음 접속하면 그래프와 점 모두 표시
drawComparisonGraph();

trialCount.textContent =
  TOTAL.toLocaleString() + "회";
