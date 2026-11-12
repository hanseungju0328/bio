
"use strict";

// ======================================
// DNA Enhancer Simulator
// 인핸서-프로모터 접촉 확률 모델
// ======================================

// ---------- HTML 요소 ----------

const dnaCanvas = document.getElementById("dnaCanvas");
const ctx = dnaCanvas.getContext("2d");

const graphCanvas = document.getElementById("resultGraph");
const graphCtx = graphCanvas.getContext("2d");

const forceInput = document.getElementById("force");
const distanceInput = document.getElementById("distance");
const flexibilityInput = document.getElementById("flexibility");

const runBtn = document.getElementById("runBtn");
const downloadBtn = document.getElementById("downloadBtn");

const graphBtn = document.getElementById("graphBtn");
const graphDownloadBtn = document.getElementById(
  "graphDownloadBtn"
);

const statusText = document.getElementById("status");
const graphStatus = document.getElementById("graphStatus");

const trialCount = document.getElementById("trialCount");
const successCount = document.getElementById("successCount");
const targetResult = document.getElementById("targetResult");

// ---------- 기본 설정 ----------

const TOTAL = 2000;
const CONTACT_RADIUS = 55;

let running = false;
let animationId = null;

let lastResult = null;
let lastGraphData = null;

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

// ---------- 수학 함수 ----------

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// 정규분포 난수
function gaussian() {
  const u = Math.max(Math.random(), 1e-12);
  const v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) *
    Math.cos(2 * Math.PI * v);
}

// ---------- 변인 ----------

function getSettings() {
  return {
    force: Number(forceInput.value),
    distance: Number(distanceInput.value),
    flexibility: Number(flexibilityInput.value)
  };
}

function updateLabels() {
  document.getElementById("forceValue").textContent =
    forceInput.value;

  document.getElementById("distanceValue").textContent =
    distanceInput.value;

  document.getElementById("flexibilityValue").textContent =
    flexibilityInput.value;
}

// ======================================
// 1. DNA 구조 계산
// ======================================

function pointOnDNA(t, fold, s) {
  const W = dnaCanvas.width;
  const H = dnaCanvas.height;

  // 펼쳐진 DNA
  const straight = {
    x: 70 + t * (W - 140),
    y: H * 0.51
  };

  // U자 DNA 구조
  // 유연성에 따라 U자 간격이 조금 달라짐
  const radius =
    15 + (100 - s.flexibility) * 0.05;

  const cx = W * 0.5;
  const top = H * 0.17;
  const bottom = H * 0.82;
  const shoulder = bottom - radius;

  let x;
  let y;

  if (t < 0.38) {
    // 왼쪽 구간
    const k = t / 0.38;

    x = cx - radius;
    y = lerp(top, shoulder, k);

  } else if (t <= 0.62) {
    // 아래쪽 굽은 구간
    const k = (t - 0.38) / 0.24;
    const theta = Math.PI - Math.PI * k;

    x = cx + radius * Math.cos(theta);
    y = shoulder + radius * Math.sin(theta);

  } else {
    // 오른쪽 구간
    const k = (t - 0.62) / 0.38;

    x = cx + radius;
    y = lerp(shoulder, top, k);
  }

  // 직선에서 U자 형태로 보간
  const k = smooth(clamp(fold, 0, 1));

  return {
    x: lerp(straight.x, x, k),
    y: lerp(straight.y, y, k)
  };
}

// ======================================
// 2. 조절부위 위치
// ======================================

function markerPositions(fold, s) {
  // 인핸서는 오른쪽 DNA 구간에 배치
  const enhancerT = 0.88;

  // DNA상 거리가 커질수록
  // 프로모터 위치가 더 먼 쪽으로 이동
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

// ======================================
// 3. 한 번의 확률 실험
// ======================================

function sampleTrial(s) {
  const attraction = s.force / 100;
  const flex = s.flexibility / 100;

  // 교육용 접힘 모델
  // 상호작용 세기의 계수를 더 크게 설정
  // 무작위 변동을 포함
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

  const contact = d <= CONTACT_RADIUS;

  return {
    finalFold,
    distance: d,
    contact
  };
}

// ======================================
// 4. DNA 화면 그리기
// ======================================

function drawMarker(p, color, label, dx, dy) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);

  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "#263447";
  ctx.fillText(label, p.x + dx, p.y + dy);
}

function drawDNA(fold, s) {
  const W = dnaCanvas.width;
  const H = dnaCanvas.height;

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

  // 접촉 판정 반경
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

  // 접촉 성공 시 연결선
  if (contact) {
    ctx.beginPath();
    ctx.moveTo(p.enhancer.x, p.enhancer.y);
    ctx.lineTo(p.promoter.x, p.promoter.y);

    ctx.strokeStyle = "#29936a";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // 조절부위 표시
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

  // 정보 표시
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

// ======================================
// 5. 접힘 애니메이션
// ======================================

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

// ======================================
// 6. 개별 시뮬레이션
// ======================================

function runSimulation() {
  if (running) return;

  running = true;
  runBtn.disabled = true;
  runBtn.textContent = "진행 중...";

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

  const probability = successes / TOTAL * 100;

  statusText.textContent =
    "DNA가 접히고 있습니다...";

  animateFold(results[0].finalFold, s, () => {
    trialCount.textContent =
      TOTAL.toLocaleString() + "회";

    successCount.textContent =
      successes.toLocaleString() + "회";

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

    running = false;
    runBtn.disabled = false;
    runBtn.textContent = "다시 실행";
  });
}

// ======================================
// 7. 접촉 확률 계산
// ======================================

function calculateProbability(s) {
  let successes = 0;

  for (let i = 0; i < TOTAL; i++) {
    if (sampleTrial(s).contact) {
      successes++;
    }
  }

  return successes / TOTAL * 100;
}

// ======================================
// 8. 세 변인 그래프 데이터
// ======================================

function createComparisonGraph() {
  graphBtn.disabled = true;

  graphStatus.textContent =
    "세 변인의 접촉 확률 계산 중...";

  // 비교 기준값
  const base = {
    force: 50,
    distance: 50,
    flexibility: 50
  };

  const series = [];

  for (const variable of graphVariables) {
    const points = [];

    // 0~100, 5 간격
    for (let x = 0; x <= 100; x += 5) {
      const s = { ...base };

      // 하나의 변인만 변경
      s[variable.key] = x;

      const probability =
        calculateProbability(s);

      points.push({
        x,
        y: probability
      });
    }

    series.push({
      ...variable,
      points
    });
  }

  lastGraphData = series;

  drawComparisonGraph(series);

  graphStatus.textContent =
    "그래프 생성 완료 | 총 63개 조건, " +
    "조건별 2,000회 시행";

  graphBtn.disabled = false;
}

// ======================================
// 9. 비교 그래프 그리기
// ======================================

function drawComparisonGraph(series) {
  const ctx = graphCtx;

  const W = graphCanvas.width;
  const H = graphCanvas.height;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const left = 80;
  const right = W - 45;
  const top = 50;
  const bottom = H - 105;

  const plotW = right - left;
  const plotH = bottom - top;

  function toX(x) {
    return left + x / 100 * plotW;
  }

  function toY(y) {
    return bottom - y / 100 * plotH;
  }

  // Y축 격자
  ctx.font = "14px Arial";

  for (let y = 0; y <= 100; y += 20) {
    const py = toY(y);

    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(right, py);

    ctx.strokeStyle = "#e5eaf0";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#697586";
    ctx.fillText(
      y + "%",
      34,
      py + 5
    );
  }

  // X축 눈금
  for (let x = 0; x <= 100; x += 20) {
    ctx.fillStyle = "#697586";

    ctx.fillText(
      String(x),
      toX(x) - 10,
      bottom + 25
    );
  }

  // 축
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);

  ctx.strokeStyle = "#7a8797";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 세 변인별 선
  for (const line of series) {
    ctx.beginPath();

    line.points.forEach((p, i) => {
      const px = toX(p.x);
      const py = toY(p.y);

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });

    ctx.strokeStyle = line.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 데이터 점
    for (const p of line.points) {
      ctx.beginPath();
      ctx.arc(
        toX(p.x),
        toY(p.y),
        3,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = line.color;
      ctx.fill();
    }
  }

  // 제목
  ctx.fillStyle = "#263447";
  ctx.font = "bold 17px Arial";

  ctx.fillText(
    "변인별 인핸서-프로모터 접촉 확률",
    left,
    28
  );

  // X축 설명
  ctx.font = "14px Arial";

  ctx.fillText(
    "변인 설정값 (0~100)",
    W / 2 - 68,
    bottom + 51
  );

  // 범례
  const legendY = H - 28;
  let legendX = 110;

  for (const line of series) {
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 24, legendY);

    ctx.strokeStyle = line.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#263447";
    ctx.font = "14px Arial";

    ctx.fillText(
      line.name,
      legendX + 32,
      legendY + 5
    );

    legendX += 225;
  }
}

// ======================================
// 10. CSV 저장
// ======================================

function saveCSV(filename, rows) {
  const blob = new Blob(
    ["\uFEFF" + rows.join("\n")],
    {
      type: "text/csv;charset=utf-8;"
    }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// 개별 실험 CSV
function downloadSimulationCSV() {
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

  saveCSV("DNA_simulation_results.csv", rows);
}

// 그래프 데이터 CSV
function downloadGraphCSV() {
  if (!lastGraphData) {
    alert("먼저 그래프를 생성하세요.");
    return;
  }

  const rows = [
    "Setting,ForceProbability,FlexibilityProbability,DistanceProbability"
  ];

  for (let i = 0; i <= 20; i++) {
    const x = i * 5;

    rows.push([
      x,
      lastGraphData[0].points[i].y.toFixed(2),
      lastGraphData[1].points[i].y.toFixed(2),
      lastGraphData[2].points[i].y.toFixed(2)
    ].join(","));
  }

  saveCSV("DNA_graph_results.csv", rows);
}

// ======================================
// 11. 이벤트 연결
// ======================================

runBtn.addEventListener(
  "click",
  runSimulation
);

downloadBtn.addEventListener(
  "click",
  downloadSimulationCSV
);

graphBtn.addEventListener(
  "click",
  createComparisonGraph
);

graphDownloadBtn.addEventListener(
  "click",
  downloadGraphCSV
);

// 변인 변경 시 애니메이션 초기화
[
  forceInput,
  distanceInput,
  flexibilityInput
].forEach(input => {
  input.addEventListener("input", () => {
    updateLabels();

    if (!running) {
      drawDNA(0, getSettings());

      statusText.textContent =
        "설정 변경됨 - 실행 대기";

      successCount.textContent = "-";
      targetResult.textContent = "-";
      lastResult = null;
    }
  });
});

// ======================================
// 12. 초기 화면
// ======================================

updateLabels();

drawDNA(0, getSettings());

drawComparisonGraph([]);

trialCount.textContent =
  TOTAL.toLocaleString() + "회";
