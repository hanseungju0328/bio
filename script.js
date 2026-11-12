
(() => {
  "use strict";

  function init() {

    // =====================================
    // 1. HTML 요소 연결
    // =====================================

    const get = id => document.getElementById(id);

    const dnaCanvas = get("dnaCanvas");
    const graphCanvas = get("resultGraph");

    const forceInput = get("force");
    const distanceInput = get("distance");
    const flexibilityInput = get("flexibility");

    const runBtn = get("runBtn");
    const downloadBtn = get("downloadBtn");

    const status = get("status");
    const trialCount = get("trialCount");
    const successCount = get("successCount");
    const targetResult = get("targetResult");
    const graphStatus = get("graphStatus");

    const required = {
      dnaCanvas,
      graphCanvas,
      forceInput,
      distanceInput,
      flexibilityInput,
      runBtn,
      downloadBtn,
      status,
      trialCount,
      successCount,
      targetResult
    };

    const missing = Object.keys(required).filter(
      key => !required[key]
    );

    if (missing.length) {
      console.error(
        "HTML 요소가 없습니다:",
        missing.join(", ")
      );
      return;
    }

    const ctx = dnaCanvas.getContext("2d");
    const g = graphCanvas.getContext("2d");

    if (!ctx || !g) {
      console.error("Canvas를 초기화할 수 없습니다.");
      return;
    }

    // 그래프 표시 설정
    graphCanvas.style.display = "block";
    graphCanvas.style.width = "100%";
    graphCanvas.style.maxWidth = "900px";
    graphCanvas.style.height = "auto";
    graphCanvas.style.background = "#ffffff";

    // =====================================
    // 2. 기본 설정
    // =====================================

    const TOTAL = 2000;
    const CONTACT_RADIUS = 55;

    let animationId = null;
    let running = false;
    let lastResult = null;

    const clamp = (n, lo, hi) =>
      Math.max(lo, Math.min(hi, n));

    const lerp = (a, b, t) =>
      a + (b - a) * t;

    const smooth = t =>
      t * t * (3 - 2 * t);

    function getSettings() {
      return {
        force: Number(forceInput.value),
        distance: Number(distanceInput.value),
        flexibility: Number(flexibilityInput.value)
      };
    }

    function updateLabels() {
      get("forceValue").textContent =
        forceInput.value;

      get("distanceValue").textContent =
        distanceInput.value;

      get("flexibilityValue").textContent =
        flexibilityInput.value;
    }

    // =====================================
    // 3. 그래프 고정 데이터
    // =====================================

    // 그래프는 항상 동일한 곡선을 표시함.
    // 아래 값들은 설명을 위한 예시 수치이며
    // 실제 실험에서 측정된 결과가 아님.

    const curves = [
      {
        key: "force",
        name: "상호작용 세기",
        color: "#377bc5",
        values: [
          2, 3, 4, 6, 9,
          14, 22, 32, 44, 57,
          69, 79, 86, 91, 94,
          96, 97, 98, 99, 99, 99
        ]
      },
      {
        key: "flexibility",
        name: "DNA 유연성",
        color: "#238463",
        values: [
          8, 10, 12, 15, 18,
          22, 27, 32, 38, 44,
          50, 56, 62, 68, 73,
          77, 81, 84, 87, 89, 90
        ]
      },
      {
        key: "distance",
        name: "DNA상 거리",
        color: "#dc9245",
        values: [
          65, 64, 63, 62, 61,
          59, 58, 57, 55, 54,
          52, 50, 48, 46, 44,
          42, 40, 38, 36, 34, 32
        ]
      }
    ];

    // 슬라이더 설정값에 해당하는
    // 곡선의 Y값 계산
    function curveAt(values, x) {
      const v = clamp(x, 0, 100);

      if (v === 100) {
        return values[20];
      }

      const i = Math.floor(v / 5);

      return lerp(
        values[i],
        values[i + 1],
        (v - i * 5) / 5
      );
    }

    // =====================================
    // 4. 그래프 그리기
    // =====================================

    function drawGraph() {
      const W = graphCanvas.width;
      const H = graphCanvas.height;

      const left = 76;
      const right = W - 35;
      const top = 45;
      const bottom = H - 77;

      const X = x =>
        left + x / 100 * (right - left);

      const Y = y =>
        bottom - y / 100 * (bottom - top);

      // 배경
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, W, H);

      // 격자와 눈금
      for (let n = 0; n <= 100; n += 20) {
        g.beginPath();

        g.moveTo(left, Y(n));
        g.lineTo(right, Y(n));

        g.strokeStyle = "#e4eaf0";
        g.lineWidth = 1;
        g.stroke();

        g.fillStyle = "#64748b";
        g.font = "13px Arial";

        g.textAlign = "right";
        g.fillText(
          n + "%",
          left - 10,
          Y(n) + 5
        );

        g.textAlign = "center";
        g.fillText(
          String(n),
          X(n),
          bottom + 23
        );
      }

      // X축, Y축
      g.beginPath();

      g.moveTo(left, top);
      g.lineTo(left, bottom);
      g.lineTo(right, bottom);

      g.strokeStyle = "#8c98a6";
      g.lineWidth = 1.5;
      g.stroke();

      // 그래프 제목
      g.textAlign = "left";
      g.fillStyle = "#263447";
      g.font = "bold 17px Arial";

      g.fillText(
        "변인별 접촉 확률 비교 (고정 예시)",
        left,
        25
      );

      // X축 제목
      g.font = "13px Arial";
      g.textAlign = "center";

      g.fillText(
        "변인 설정값 (0~100)",
        W / 2,
        bottom + 51
      );

      // =================================
      // 세 곡선 그리기
      // =================================

      // 곡선 자체는 슬라이더와 무관하게 고정
      for (const curve of curves) {
        g.beginPath();

        curve.values.forEach((y, i) => {
          const x = i * 5;

          if (i === 0) {
            g.moveTo(X(x), Y(y));
          } else {
            g.lineTo(X(x), Y(y));
          }
        });

        g.strokeStyle = curve.color;
        g.lineWidth = 3;
        g.lineCap = "round";
        g.lineJoin = "round";
        g.stroke();
      }

      // =================================
      // 슬라이더에 따라 움직이는 점
      // =================================

      const s = getSettings();

      for (const curve of curves) {
        const x = s[curve.key];
        const y = curveAt(curve.values, x);

        const px = X(x);
        const py = Y(y);

        // 점 표시
        g.beginPath();

        g.arc(
          px,
          py,
          8,
          0,
          Math.PI * 2
        );

        g.fillStyle = curve.color;
        g.fill();

        g.strokeStyle = "#ffffff";
        g.lineWidth = 3;
        g.stroke();

        // 점의 예시 확률 표시
        g.font = "bold 13px Arial";
        g.fillStyle = curve.color;
        g.textAlign = "center";

        g.fillText(
          y.toFixed(1) + "%",
          clamp(px, left + 27, right - 27),
          Math.max(top + 15, py - 14)
        );
      }

      // =================================
      // 그래프 범례
      // =================================

      const legendY = H - 20;
      const legendXs = [105, 360, 600];

      curves.forEach((curve, i) => {
        const x = legendXs[i];

        g.beginPath();

        g.moveTo(x, legendY);
        g.lineTo(x + 25, legendY);

        g.strokeStyle = curve.color;
        g.lineWidth = 4;
        g.stroke();

        g.font = "13px Arial";
        g.fillStyle = "#263447";
        g.textAlign = "left";

        g.fillText(
          curve.name,
          x + 33,
          legendY + 4
        );
      });
    }

    // =====================================
    // 5. DNA 구조 계산
    // =====================================

    function pointOnDNA(t, fold, s) {
      const W = dnaCanvas.width;
      const H = dnaCanvas.height;

      // 초기 상태: 직선 DNA
      const straight = {
        x: 70 + t * (W - 140),
        y: H * 0.51
      };

      // 최종 상태: U자 구조
      const radius =
        15 + (100 - s.flexibility) * 0.05;

      const cx = W / 2;
      const top = H * 0.17;
      const shoulder = H * 0.82 - radius;

      let x;
      let y;

      if (t < 0.38) {

        // U자의 왼쪽
        x = cx - radius;

        y = lerp(
          top,
          shoulder,
          t / 0.38
        );

      } else if (t <= 0.62) {

        // U자의 아래쪽 곡선
        const k = (t - 0.38) / 0.24;
        const theta = Math.PI * (1 - k);

        x = cx + radius * Math.cos(theta);
        y = shoulder + radius * Math.sin(theta);

      } else {

        // U자의 오른쪽
        x = cx + radius;

        y = lerp(
          shoulder,
          top,
          (t - 0.62) / 0.38
        );
      }

      // 직선과 U자 사이 보간
      const a = smooth(clamp(fold, 0, 1));

      return {
        x: lerp(straight.x, x, a),
        y: lerp(straight.y, y, a)
      };
    }

    // =====================================
    // 6. 인핸서와 프로모터 위치
    // =====================================

    function markerPositions(fold, s) {
      return {
        enhancer: pointOnDNA(
          0.88,
          fold,
          s
        ),

        promoter: pointOnDNA(
          0.12 - s.distance * 0.0008,
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

    // =====================================
    // 7. 확률적 접힘 계산
    // =====================================

    function gaussian() {
      const u = Math.max(
        Math.random(),
        1e-12
      );

      return Math.sqrt(
        -2 * Math.log(u)
      ) * Math.cos(
        2 * Math.PI * Math.random()
      );
    }

    function sampleTrial(s) {
      const fold = clamp(
        0.40 +
        0.70 * s.force / 100 +
        0.42 * s.flexibility / 100 +
        gaussian() * 0.12,
        0,
        1
      );

      const p = markerPositions(fold, s);

      const d = separation(
        p.enhancer,
        p.promoter
      );

      return {
        fold,
        distance: d,
        contact: d <= CONTACT_RADIUS
      };
    }

    // =====================================
    // 8. DNA 애니메이션 화면
    // =====================================

    function drawMarker(p, color, label, dx) {
      ctx.beginPath();

      ctx.arc(
        p.x,
        p.y,
        8,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = color;
      ctx.fill();

      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "#263447";

      ctx.fillText(
        label,
        p.x + dx,
        p.y - 14
      );
    }

    function drawDNA(fold, s) {
      const W = dnaCanvas.width;
      const H = dnaCanvas.height;

      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = "#fbfcfe";
      ctx.fillRect(0, 0, W, H);

      // DNA 사슬 그리기
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

      // 접촉 범위 원
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

      drawMarker(
        p.promoter,
        "#d58a32",
        "Promoter",
        -90
      );

      drawMarker(
        p.enhancer,
        "#29936a",
        "Enhancer",
        12
      );

      // 상태 표시
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

    // =====================================
    // 9. 슬라이더 변경
    // =====================================

    function resetForNewSettings() {

      // 실행 중인 애니메이션 취소
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      running = false;
      runBtn.disabled = false;
      runBtn.textContent = "시뮬레이션 실행";

      lastResult = null;

      // 슬라이더 숫자 업데이트
      updateLabels();

      // 그래프를 다시 그림
      // 곡선은 고정이고 점 위치만 달라짐
      drawGraph();

      // DNA를 초기 상태로 변경
      drawDNA(0, getSettings());

      successCount.textContent = "-";
      targetResult.textContent = "-";

      status.textContent =
        "설정 변경됨 - 실행 대기";
    }

    // =====================================
    // 10. 시뮬레이션 실행
    // =====================================

    function runSimulation() {
      if (running) return;

      running = true;

      runBtn.disabled = true;
      runBtn.textContent = "시뮬레이션 진행 중";

      successCount.textContent = "-";
      targetResult.textContent = "-";
      lastResult = null;

      const s = getSettings();

      const results = [];
      let successes = 0;

      // 2,000회 반복 시행
      for (let i = 0; i < TOTAL; i++) {
        const result = sampleTrial(s);

        results.push(result);

        if (result.contact) {
          successes++;
        }
      }

      status.textContent =
        "DNA가 접히고 있습니다...";

      const targetFold = results[0].fold;
      const duration = 2400;

      let start = null;

      function frame(time) {
        if (start === null) {
          start = time;
        }

        const t = clamp(
          (time - start) / duration,
          0,
          1
        );

        drawDNA(
          targetFold * smooth(t),
          s
        );

        if (t < 1) {
          animationId = requestAnimationFrame(frame);
        } else {
          animationId = null;

          const probability =
            successes / TOTAL * 100;

          trialCount.textContent =
            TOTAL.toLocaleString() + "회";

          successCount.textContent =
            successes.toLocaleString() + "회";

          targetResult.textContent =
            probability.toFixed(2) + "%";

          lastResult = {
            settings: s,
            results
          };

          status.textContent =
            "2,000회 반복 실험 완료";

          running = false;
          runBtn.disabled = false;
          runBtn.textContent = "다시 실행";
        }
      }

      animationId = requestAnimationFrame(frame);
    }

    // =====================================
    // 11. CSV 저장
    // =====================================

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
          r.fold.toFixed(5),
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

    // =====================================
    // 12. 이벤트 연결
    // =====================================

    forceInput.addEventListener(
      "input",
      resetForNewSettings
    );

    distanceInput.addEventListener(
      "input",
      resetForNewSettings
    );

    flexibilityInput.addEventListener(
      "input",
      resetForNewSettings
    );

    runBtn.addEventListener(
      "click",
      runSimulation
    );

    downloadBtn.addEventListener(
      "click",
      downloadCSV
    );

    // =====================================
    // 13. 페이지 초기 실행
    // =====================================

    updateLabels();

    trialCount.textContent =
      TOTAL.toLocaleString() + "회";

    // DNA 초기 상태
    drawDNA(0, getSettings());

    // 사이트가 열리면 그래프 즉시 표시
    drawGraph();

    if (graphStatus) {
      graphStatus.textContent =
        "고정 예시 그래프 — 슬라이더를 움직이면 점만 이동합니다.";
    }
  }

  // HTML이 모두 로드된 다음 실행
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }
})();
