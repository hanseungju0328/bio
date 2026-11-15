
(() => {
  "use strict";

  function init() {

    // =====================================
    // 1. 요소 연결
    // =====================================

    const el = id => document.getElementById(id);

    const dnaCanvas = el("dnaCanvas");
    const graphCanvas = el("resultGraph");

    if (!dnaCanvas || !graphCanvas) {
      console.error("Canvas 요소를 찾을 수 없습니다.");
      return;
    }

    const ctx = dnaCanvas.getContext("2d");
    const graphCtx = graphCanvas.getContext("2d");

    const inputs = {
      force: el("force"),
      flexibility: el("flexibility"),
      distance: el("distance")
    };

    const runBtn = el("runBtn");
    const downloadBtn = el("downloadBtn");

    const status = el("status");
    const successCount = el("successCount");
    const targetResult = el("targetResult");

    // =====================================
    // 2. 기본 설정
    // =====================================

    const TOTAL = 2000;
    const CONTACT_RADIUS = 55;
    const FOLD_NOISE = 0.12;

    const BASE = {
      force: 50,
      flexibility: 50,
      distance: 50
    };

    const SERIES = [
      {
        key: "force",
        name: "상호작용 세기",
        color: "#3478bd"
      },
      {
        key: "flexibility",
        name: "DNA 유연성",
        color: "#238463"
      },
      {
        key: "distance",
        name: "DNA상 거리",
        color: "#d58a32"
      }
    ];

    let animationId = null;
    let running = false;
    let lastResult = null;

    const clamp = (v, lo, hi) =>
      Math.max(lo, Math.min(hi, v));

    const lerp = (a, b, t) =>
      a + (b - a) * t;

    const smooth = t =>
      t * t * (3 - 2 * t);

    function settings() {
      return {
        force: Number(inputs.force.value),
        flexibility: Number(inputs.flexibility.value),
        distance: Number(inputs.distance.value)
      };
    }

    function updateValueLabels() {
      for (const key of Object.keys(inputs)) {
        el(key + "Value").textContent =
          inputs[key].value;
      }
    }

    // =====================================
    // 3. DNA 구조 모델
    // =====================================

    function pointOnDNA(t, fold, s) {
      const W = dnaCanvas.width;
      const H = dnaCanvas.height;

      // 초기 직선 구조
      const straight = {
        x: 70 + t * (W - 140),
        y: H * 0.51
      };

      // 최종 U자 구조
      const r =
        15 + (100 - s.flexibility) * 0.05;

      const cx = W / 2;
      const top = H * 0.17;
      const shoulder = H * 0.82 - r;

      let x;
      let y;

      if (t < 0.38) {

        x = cx - r;

        y = lerp(
          top,
          shoulder,
          t / 0.38
        );

      } else if (t <= 0.62) {

        const theta = Math.PI *
          (1 - (t - 0.38) / 0.24);

        x = cx + r * Math.cos(theta);
        y = shoulder + r * Math.sin(theta);

      } else {

        x = cx + r;

        y = lerp(
          shoulder,
          top,
          (t - 0.62) / 0.38
        );
      }

      const k = smooth(clamp(fold, 0, 1));

      return {
        x: lerp(straight.x, x, k),
        y: lerp(straight.y, y, k)
      };
    }

    function markerPositions(fold, s) {
      return {
        enhancer: pointOnDNA(
          0.88,
          fold,
          s
        ),

        promoter: pointOnDNA(
          0.12 - 0.0005 * s.distance,
          fold,
          s
        )
      };
    }

    function separation(a, b) {
      return Math.hypot(
        a.x - b.x,
        a.y - b.y
      );
    }

    function markerDistance(fold, s) {
      const p = markerPositions(fold, s);

      return separation(
        p.enhancer,
        p.promoter
      );
    }

    // =====================================
    // 4. 접힘 정도 계산
    // =====================================

    // 세 변인이 접힘에 주는 영향을
    // 가정한 교육용 수학적 모델

    function meanFold(s) {
      return (
        0.67 +
        0.48 * s.force / 100 +
        0.20 * s.flexibility / 100 -
        0.18 * s.distance / 100
      );
    }

    // 인핸서와 프로모터가 접촉하는
    // 최소 접힘 정도를 계산

    function contactThreshold(s) {

      if (
        markerDistance(0, s) <=
        CONTACT_RADIUS
      ) {
        return 0;
      }

      if (
        markerDistance(1, s) >
        CONTACT_RADIUS
      ) {
        return Infinity;
      }

      let low = 0;
      let high = 1;

      // 이분법으로 접촉 경계 탐색
      for (let i = 0; i < 32; i++) {

        const mid = (low + high) / 2;

        if (
          markerDistance(mid, s) <=
          CONTACT_RADIUS
        ) {
          high = mid;
        } else {
          low = mid;
        }
      }

      return high;
    }

    // =====================================
    // 5. 정규분포 누적확률
    // =====================================

    // 매끄러운 예상 확률 그래프 계산에 사용

    function normalCDF(x) {
      const z = Math.abs(x);

      const t =
        1 / (1 + 0.2316419 * z);

      const density =
        Math.exp(-z * z / 2) /
        Math.sqrt(2 * Math.PI);

      const poly = t * (
        0.319381530 +
        t * (
          -0.356563782 +
          t * (
            1.781477937 +
            t * (
              -1.821255978 +
              t * 1.330274429
            )
          )
        )
      );

      const positive = 1 - density * poly;

      return x >= 0
        ? positive
        : 1 - positive;
    }

    // =====================================
    // 6. 예상 접촉 확률
    // =====================================

    function expectedProbability(s) {
      const threshold = contactThreshold(s);

      if (threshold === Infinity) {
        return 0;
      }

      if (threshold <= 0) {
        return 100;
      }

      const z =
        (meanFold(s) - threshold) /
        FOLD_NOISE;

      return clamp(
        normalCDF(z) * 100,
        0,
        100
      );
    }

    // =====================================
    // 7. 그래프 데이터 생성
    // =====================================

    // 페이지를 열 때 한 번만 계산
    // 따라서 곡선 자체는 움직이지 않음

    const fixedSeries = SERIES.map(meta => {

      const values = [];

      for (let x = 0; x <= 100; x++) {

        const s = {
          ...BASE,
          [meta.key]: x
        };

        values.push(
          expectedProbability(s)
        );
      }

      return {
        ...meta,
        values
      };
    });

    // =====================================
    // 8. 세 변인 비교 그래프
    // =====================================

    function drawGraph() {
      const g = graphCtx;

      const W = graphCanvas.width;
      const H = graphCanvas.height;

      const left = 80;
      const right = W - 45;
      const top = 50;
      const bottom = H - 97;

      const X = x =>
        left + x / 100 * (right - left);

      const Y = y =>
        bottom - y / 100 * (bottom - top);

      const s = settings();

      // 배경
      g.clearRect(0, 0, W, H);

      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, W, H);

      g.font = "14px Arial";

      // 격자 및 눈금
      for (let v = 0; v <= 100; v += 20) {

        g.beginPath();
        g.moveTo(left, Y(v));
        g.lineTo(right, Y(v));

        g.strokeStyle = "#e4eaf0";
        g.lineWidth = 1;
        g.stroke();

        g.fillStyle = "#667488";

        g.textAlign = "right";
        g.fillText(
          v + "%",
          left - 12,
          Y(v) + 5
        );

        g.textAlign = "center";
        g.fillText(
          String(v),
          X(v),
          bottom + 24
        );
      }

      // 좌표축
      g.beginPath();

      g.moveTo(left, top);
      g.lineTo(left, bottom);
      g.lineTo(right, bottom);

      g.lineWidth = 1.5;
      g.strokeStyle = "#8d9bac";
      g.stroke();

      // 제목
      g.textAlign = "left";
      g.fillStyle = "#243044";
      g.font = "bold 17px Arial";

      g.fillText(
        "세 변인에 따른 예상 접촉 확률",
        left,
        27
      );

      g.font = "13px Arial";
      g.textAlign = "center";

      g.fillText(
        "변인 설정값 (0~100)",
        W / 2,
        bottom + 52
      );

      // ===============================
      // 매끄러운 고정 곡선 3개
      // ===============================

      fixedSeries.forEach(line => {

        g.beginPath();

        line.values.forEach((v, x) => {

          if (x === 0) {
            g.moveTo(X(x), Y(v));
          } else {
            g.lineTo(X(x), Y(v));
          }
        });

        g.strokeStyle = line.color;
        g.lineWidth = 3.2;
        g.lineJoin = "round";
        g.stroke();
      });

      // ===============================
      // 슬라이더에 따라 움직이는 점
      // ===============================

      fixedSeries.forEach((line, i) => {

        const x = s[line.key];
        const y = line.values[x];

        const px = X(x);
        const py = Y(y);

        // 점의 흰색 테두리
        g.beginPath();

        g.arc(
          px,
          py,
          7 + i * 3,
          0,
          Math.PI * 2
        );

        g.strokeStyle = "#ffffff";
        g.lineWidth = 5;
        g.stroke();

        // 변인별 색상 점
        g.beginPath();

        g.arc(
          px,
          py,
          7 + i * 3,
          0,
          Math.PI * 2
        );

        g.strokeStyle = line.color;
        g.lineWidth = 3;
        g.stroke();

        // 현재 슬라이더 위치와 예상 확률
        const display = el(
          line.key + "GraphValue"
        );

        if (display) {
          display.textContent =
            `${x} → ${y.toFixed(1)}%`;
        }
      });
    }

    // =====================================
    // 9. 무작위 시뮬레이션
    // =====================================

    function gaussian() {
      const u = Math.max(
        Math.random(),
        1e-12
      );

      return (
        Math.sqrt(-2 * Math.log(u)) *
        Math.cos(
          2 * Math.PI * Math.random()
        )
      );
    }

    function sampleTrial(s) {

      const fold = clamp(
        meanFold(s) +
        gaussian() * FOLD_NOISE,
        0,
        1
      );

      const d = markerDistance(fold, s);

      return {
        fold,
        distance: d,
        contact: d <= CONTACT_RADIUS
      };
    }

    // =====================================
    // 10. DNA 화면 그리기
    // =====================================

    function drawDNA(fold, s) {
      const W = dnaCanvas.width;
      const H = dnaCanvas.height;

      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = "#fbfcfe";
      ctx.fillRect(0, 0, W, H);

      // DNA 사슬
      ctx.beginPath();

      for (let i = 0; i <= 180; i++) {

        const p = pointOnDNA(
          i / 180,
          fold,
          s
        );

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

      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "#d7b36e";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // 접촉 시 연결선
      if (contact) {
        ctx.beginPath();

        ctx.moveTo(
          p.enhancer.x,
          p.enhancer.y
        );

        ctx.lineTo(
          p.promoter.x,
          p.promoter.y
        );

        ctx.strokeStyle = "#29936a";
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // 인핸서와 프로모터 표시
      const markers = [
        [
          p.promoter,
          "#d58a32",
          "Promoter",
          -90
        ],
        [
          p.enhancer,
          "#29936a",
          "Enhancer",
          12
        ]
      ];

      for (const item of markers) {

        const [point, color, label, dx] = item;

        ctx.beginPath();

        ctx.arc(
          point.x,
          point.y,
          8,
          0,
          Math.PI * 2
        );

        ctx.fillStyle = color;
        ctx.fill();

        ctx.fillStyle = "#263447";
        ctx.font = "bold 14px Arial";

        ctx.fillText(
          label,
          point.x + dx,
          point.y - 15
        );
      }

      // 상태 표시
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#263447";

      ctx.fillText(
        contact
          ? "접촉 성공"
          : "접촉하지 않음",
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

    // =====================================
    // 11. 슬라이더 변경
    // =====================================

    function reset() {

      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }

      animationId = null;
      running = false;

      runBtn.disabled = false;
      runBtn.textContent =
        "2,000회 시뮬레이션 실행";

      lastResult = null;

      successCount.textContent = "—";
      targetResult.textContent = "—";

      status.textContent =
        "설정 변경됨 — 실행 대기";

      updateValueLabels();

      // 곡선 유지, 점 위치 갱신
      drawGraph();

      // DNA 초기화
      drawDNA(0, settings());
    }

    // =====================================
    // 12. 시뮬레이션 실행
    // =====================================

    function runSimulation() {
      if (running) return;

      running = true;

      runBtn.disabled = true;
      runBtn.textContent =
        "시뮬레이션 진행 중";

      const s = settings();

      const results = [];
      let successes = 0;

      for (let i = 0; i < TOTAL; i++) {

        const result = sampleTrial(s);

        results.push(result);

        if (result.contact) {
          successes++;
        }
      }

      status.textContent =
        "DNA가 접히고 있습니다...";

      const finalFold = results[0].fold;
      const duration = 2200;

      let start = null;

      function frame(now) {

        if (start === null) {
          start = now;
        }

        const t = clamp(
          (now - start) / duration,
          0,
          1
        );

        drawDNA(
          finalFold * smooth(t),
          s
        );

        if (t < 1) {

          animationId =
            requestAnimationFrame(frame);

        } else {

          animationId = null;

          lastResult = {
            s,
            results
          };

          successCount.textContent =
            `${successes.toLocaleString()}회`;

          targetResult.textContent =
            `${(100 * successes / TOTAL).toFixed(2)}%`;

          status.textContent =
            "2,000회 반복 실험 완료";

          running = false;

          runBtn.disabled = false;
          runBtn.textContent = "다시 실행";
        }
      }

      animationId =
        requestAnimationFrame(frame);
    }

    // =====================================
    // 13. CSV 저장
    // =====================================

    function downloadCSV() {

      if (!lastResult) {
        alert("먼저 시뮬레이션을 실행하세요.");
        return;
      }

      const { s, results } = lastResult;

      const rows = [
        "Trial,Force,Distance,Flexibility,FinalFold,Separation,Contact"
      ];

      results.forEach((r, i) => {
        rows.push([
          i + 1,
          s.force,
          s.distance,
          s.flexibility,
          r.fold.toFixed(5),
          r.distance.toFixed(3),
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
      const a = document.createElement("a");

      a.href = url;
      a.download = "DNA_contact_trials.csv";

      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    }

    // =====================================
    // 14. 이벤트
    // =====================================

    for (const input of Object.values(inputs)) {
      input.addEventListener("input", reset);
    }

    runBtn.addEventListener(
      "click",
      runSimulation
    );

    downloadBtn.addEventListener(
      "click",
      downloadCSV
    );

    // =====================================
    // 15. 초기 실행
    // =====================================

    updateValueLabels();

    drawDNA(0, settings());

    // 사이트 접속 즉시 고정 곡선 표시
    drawGraph();

    el("trialCount").textContent =
      TOTAL.toLocaleString() + "회";
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
