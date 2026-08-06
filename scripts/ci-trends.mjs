import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GITHUB_API = "https://api.github.com";

const USAGE = `Usage: bun scripts/ci-trends.mjs [options]

Fetches workflow run history from the GitHub Actions API and writes a
self-contained, zoomable HTML report plus the raw JSON it was built from.

Options:
  --owner <name>      Repo owner (default: parsed from git remote "origin")
  --repo <name>        Repo name (default: parsed from git remote "origin")
  --workflow <file>     Workflow file name or ID (default: ci.yml)
  --branch <name>       Branch to filter runs to (default: main)
  --token <token>       GitHub token (default: $GITHUB_TOKEN or $GH_TOKEN, optional)
  --limit <n>           Max runs to fetch (default: 500)
  --out <path>          HTML report path (default: .ci-trends/report.html)
  --json-out <path>     Raw data path (default: .ci-trends/data.json)
  -h, --help            Show this help
`;

function parseArgs(argv) {
  const args = {
    owner: undefined,
    repo: undefined,
    workflow: "ci.yml",
    branch: "main",
    token: undefined,
    limit: 500,
    out: ".ci-trends/report.html",
    jsonOut: ".ci-trends/data.json",
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => argv[++i];
    switch (flag) {
      case "--owner":
        args.owner = next();
        break;
      case "--repo":
        args.repo = next();
        break;
      case "--workflow":
        args.workflow = next();
        break;
      case "--branch":
        args.branch = next();
        break;
      case "--token":
        args.token = next();
        break;
      case "--limit":
        args.limit = Number(next());
        break;
      case "--out":
        args.out = next();
        break;
      case "--json-out":
        args.jsonOut = next();
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }
  return args;
}

function repoFromGitRemote() {
  try {
    const url = execSync("git remote get-url origin", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const match = url.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

function extractRun(run) {
  const durationSeconds =
    run.status === "completed" && run.run_started_at && run.updated_at
      ? Math.max(
          0,
          (new Date(run.updated_at) - new Date(run.run_started_at)) / 1000,
        )
      : null;
  return {
    id: run.id,
    runNumber: run.run_number,
    conclusion: run.conclusion,
    status: run.status,
    createdAt: run.created_at,
    runStartedAt: run.run_started_at,
    updatedAt: run.updated_at,
    sha: run.head_sha.slice(0, 7),
    url: run.html_url,
    durationSeconds,
  };
}

async function fetchAllRuns({ owner, repo, workflow, branch, token, limit }) {
  const runs = [];
  const perPage = 100;
  let page = 1;
  while (runs.length < limit) {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?branch=${encodeURIComponent(branch)}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(
        `GitHub API error ${res.status} ${res.statusText}: ${await res.text()}`,
      );
    }
    const body = await res.json();
    for (const run of body.workflow_runs) runs.push(extractRun(run));
    if (body.workflow_runs.length < perPage) break;
    page += 1;
  }
  return runs
    .slice(0, limit)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function jsonForScript(value) {
  // Safe to inline into a <script> tag: no "</" sequence can close it early.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildHtml(runs, meta) {
  const successCount = runs.filter((r) => r.conclusion === "success").length;
  const failureCount = runs.filter((r) => r.conclusion === "failure").length;
  const successRate = runs.length
    ? ((successCount / runs.length) * 100).toFixed(1)
    : "0.0";
  const completed = runs.filter((r) => r.durationSeconds !== null);
  const avgDuration = completed.length
    ? completed.reduce((sum, r) => sum + r.durationSeconds, 0) /
      completed.length
    : 0;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CI trends — ${escapeHtml(meta.owner)}/${escapeHtml(meta.repo)}@${escapeHtml(meta.branch)}</title>
<style>
  .viz-root {
    color-scheme: light;
    --surface-1: #fcfcfb;
    --page: #f9f9f7;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --text-muted: #898781;
    --grid: #e1e0d9;
    --axis: #c3c2b7;
    --border: rgba(11, 11, 11, 0.10);
    --good: #0ca30c;
    --critical: #d03b3b;
    --other: #898781;
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) .viz-root {
      color-scheme: dark;
      --surface-1: #1a1a19;
      --page: #0d0d0d;
      --text-primary: #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted: #898781;
      --grid: #2c2c2a;
      --axis: #383835;
      --border: rgba(255, 255, 255, 0.10);
      --good: #0ca30c;
      --critical: #e66767;
      --other: #898781;
    }
  }
  :root[data-theme="dark"] .viz-root {
    color-scheme: dark;
    --surface-1: #1a1a19;
    --page: #0d0d0d;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #898781;
    --grid: #2c2c2a;
    --axis: #383835;
    --border: rgba(255, 255, 255, 0.10);
    --good: #0ca30c;
    --critical: #e66767;
    --other: #898781;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--page);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--text-primary);
  }
  .viz-root { padding: 20px; max-width: 1040px; margin: 0 auto; }
  h1 { font-size: 1.25rem; margin: 0 0 2px; }
  .subtitle { color: var(--text-secondary); font-size: 0.875rem; margin: 0 0 20px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .stat {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .stat .value { font-size: 1.5rem; font-variant-numeric: tabular-nums; font-weight: 600; }
  .stat .label { font-size: 0.75rem; color: var(--text-secondary); }
  .card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
  }
  .toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  .toolbar .hint { color: var(--text-muted); font-size: 0.75rem; margin-left: auto; }
  button.ctrl {
    font: inherit;
    font-size: 0.8125rem;
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
  }
  button.ctrl:hover { background: var(--grid); }
  button.ctrl:disabled { opacity: 0.4; cursor: default; }
  svg.chart { width: 100%; height: auto; display: block; touch-action: none; user-select: none; }
  .grid-line { stroke: var(--grid); stroke-width: 1; }
  .axis-line { stroke: var(--axis); stroke-width: 1; }
  .axis-label { fill: var(--text-muted); font-size: 11px; }
  .brush { fill: var(--text-secondary); opacity: 0.12; }
  .point-dot { r: 4; stroke: var(--surface-1); stroke-width: 1.5; }
  .point-dot.success { fill: var(--good); }
  .point-dot.failure { fill: var(--critical); }
  .point-dot.other { fill: var(--other); }
  .point-hit { fill: transparent; r: 12; cursor: pointer; }
  .legend { display: flex; gap: 16px; margin-top: 10px; font-size: 0.8125rem; color: var(--text-secondary); flex-wrap: wrap; }
  .legend .key { display: inline-flex; align-items: center; gap: 6px; }
  .legend .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .tooltip {
    position: absolute;
    pointer-events: none;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 0.8125rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    display: none;
    white-space: nowrap;
    z-index: 10;
  }
  .tooltip .t-value { font-weight: 600; font-variant-numeric: tabular-nums; }
  .tooltip .t-secondary { color: var(--text-secondary); }
  .chart-wrap { position: relative; }
  details.table-view { margin-top: 20px; }
  details.table-view summary { cursor: pointer; font-size: 0.875rem; color: var(--text-secondary); }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 0.8125rem;
  }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--grid); }
  td.num { font-variant-numeric: tabular-nums; }
  tr.failure td { color: var(--critical); }
  a { color: inherit; }
</style>
</head>
<body>
<div class="viz-root">
  <h1>CI trends — ${escapeHtml(meta.owner)}/${escapeHtml(meta.repo)}</h1>
  <p class="subtitle">Workflow <strong>${escapeHtml(meta.workflow)}</strong> on branch <strong>${escapeHtml(meta.branch)}</strong> · ${runs.length} runs · generated ${escapeHtml(meta.generatedAt)}</p>

  <div class="stats">
    <div class="stat"><div class="value">${runs.length}</div><div class="label">Total runs</div></div>
    <div class="stat"><div class="value">${successRate}%</div><div class="label">Success rate</div></div>
    <div class="stat"><div class="value">${formatDuration(avgDuration)}</div><div class="label">Avg duration</div></div>
    <div class="stat"><div class="value">${failureCount}</div><div class="label">Failures</div></div>
  </div>

  <div class="card">
    <div class="toolbar">
      <button class="ctrl" id="zoom-in" type="button">Zoom in</button>
      <button class="ctrl" id="zoom-out" type="button">Zoom out</button>
      <button class="ctrl" id="zoom-reset" type="button" disabled>Reset zoom</button>
      <span class="hint">Drag to zoom · scroll to zoom · tap a point to open its run</span>
    </div>
    <div class="chart-wrap">
      <svg class="chart" id="chart" viewBox="0 0 960 420" preserveAspectRatio="xMidYMid meet" role="img" aria-label="CI run duration over time"></svg>
      <div class="tooltip" id="tooltip"></div>
    </div>
    <div class="legend" id="legend"></div>
  </div>

  <details class="table-view">
    <summary>View as table (full history, unaffected by zoom)</summary>
    <table>
      <thead><tr><th>Run</th><th>Date</th><th>Duration</th><th>Result</th><th>Commit</th></tr></thead>
      <tbody id="table-body"></tbody>
    </table>
  </details>
</div>

<script>
window.__CI_RUNS__ = ${jsonForScript(runs)};
</script>
<script>
(function () {
  "use strict";
  var runs = window.__CI_RUNS__;
  var points = runs
    .filter(function (r) { return r.durationSeconds !== null; })
    .map(function (r) {
      return {
        x: new Date(r.createdAt).getTime(),
        y: r.durationSeconds,
        conclusion: r.conclusion,
        runNumber: r.runNumber,
        sha: r.sha,
        url: r.url,
        createdAt: r.createdAt,
      };
    })
    .sort(function (a, b) { return a.x - b.x; });

  var W = 960, H = 420;
  var margin = { top: 16, right: 20, bottom: 40, left: 52 };
  var plotW = W - margin.left - margin.right;
  var plotH = H - margin.top - margin.bottom;

  var xs = points.map(function (p) { return p.x; });
  var fullDomain = points.length
    ? { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs) }
    : { x0: Date.now() - 86400000, x1: Date.now() };
  if (fullDomain.x0 === fullDomain.x1) {
    fullDomain.x0 -= 3600000;
    fullDomain.x1 += 3600000;
  } else {
    var pad = (fullDomain.x1 - fullDomain.x0) * 0.03;
    fullDomain.x0 -= pad;
    fullDomain.x1 += pad;
  }
  var MIN_SPAN_MS = 5 * 60 * 1000;
  var domain = { x0: fullDomain.x0, x1: fullDomain.x1 };

  var svg = document.getElementById("chart");
  var tooltip = document.getElementById("tooltip");
  var legendEl = document.getElementById("legend");
  var resetBtn = document.getElementById("zoom-reset");
  var zoomInBtn = document.getElementById("zoom-in");
  var zoomOutBtn = document.getElementById("zoom-out");
  var NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function xScale(t) {
    return margin.left + ((t - domain.x0) / (domain.x1 - domain.x0)) * plotW;
  }
  function invertX(px) {
    return domain.x0 + ((px - margin.left) / plotW) * (domain.x1 - domain.x0);
  }
  function yScale(v, yMax) {
    return margin.top + plotH - (v / yMax) * plotH;
  }

  function formatDuration(seconds) {
    if (seconds < 90) return Math.round(seconds) + "s";
    return (seconds / 60).toFixed(1) + "m";
  }

  function formatTick(t, spanMs, intervalMs) {
    var d = new Date(t);
    var DAY = 24 * 3600 * 1000;
    if (spanMs <= 26 * 3600 * 1000) {
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    if (intervalMs <= 26 * 3600 * 1000) {
      return (
        d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        ", " +
        d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      );
    }
    if (spanMs <= 400 * DAY) {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }

  function clampDomain(x0, x1) {
    var span = x1 - x0;
    if (span < MIN_SPAN_MS) {
      var mid = (x0 + x1) / 2;
      x0 = mid - MIN_SPAN_MS / 2;
      x1 = mid + MIN_SPAN_MS / 2;
      span = MIN_SPAN_MS;
    }
    if (x0 < fullDomain.x0) { x0 = fullDomain.x0; x1 = x0 + span; }
    if (x1 > fullDomain.x1) { x1 = fullDomain.x1; x0 = x1 - span; }
    return { x0: Math.max(x0, fullDomain.x0), x1: Math.min(x1, fullDomain.x1) };
  }

  function setDomain(x0, x1) {
    domain = clampDomain(x0, x1);
    render();
  }

  function isFullDomain() {
    return Math.abs(domain.x0 - fullDomain.x0) < 1000 && Math.abs(domain.x1 - fullDomain.x1) < 1000;
  }

  function conclusionClass(c) {
    if (c === "success") return "success";
    if (c === "failure") return "failure";
    return "other";
  }

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    resetBtn.disabled = isFullDomain();

    var visible = points.filter(function (p) { return p.x >= domain.x0 && p.x <= domain.x1; });
    var maxY = 30;
    for (var i = 0; i < visible.length; i++) if (visible[i].y > maxY) maxY = visible[i].y;
    maxY *= 1.2;

    // Y gridlines + labels
    var yTicks = 4;
    for (var t = 0; t <= yTicks; t++) {
      var v = (maxY / yTicks) * t;
      var y = yScale(v, maxY);
      svg.appendChild(svgEl("line", { class: "grid-line", x1: margin.left, x2: W - margin.right, y1: y, y2: y }));
      var label = svgEl("text", { class: "axis-label", x: margin.left - 8, y: y + 4, "text-anchor": "end" });
      label.textContent = formatDuration(v);
      svg.appendChild(label);
    }

    // X axis baseline + ticks
    svg.appendChild(svgEl("line", { class: "axis-line", x1: margin.left, x2: W - margin.right, y1: H - margin.bottom, y2: H - margin.bottom }));
    var xTickCount = 6;
    var span = domain.x1 - domain.x0;
    for (var i2 = 0; i2 <= xTickCount; i2++) {
      var tx = domain.x0 + (span / xTickCount) * i2;
      var px = xScale(tx);
      var anchor = i2 === 0 ? "start" : i2 === xTickCount ? "end" : "middle";
      var xlabel = svgEl("text", { class: "axis-label", x: px, y: H - margin.bottom + 18, "text-anchor": anchor });
      xlabel.textContent = formatTick(tx, span, span / xTickCount);
      svg.appendChild(xlabel);
    }

    // Points
    var pointsGroup = svgEl("g", {});
    visible.forEach(function (p) {
      var cx = xScale(p.x);
      var cy = yScale(p.y, maxY);
      var link = svgEl("a", { class: "point-pointlink" });
      link.setAttributeNS("http://www.w3.org/1999/xlink", "href", p.url);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
      var hit = svgEl("circle", { class: "point-hit", cx: cx, cy: cy });
      var dot = svgEl("circle", { class: "point-dot " + conclusionClass(p.conclusion), cx: cx, cy: cy });
      link.appendChild(hit);
      link.appendChild(dot);
      link.addEventListener("pointerenter", function () { showTooltip(p, cx, cy); });
      link.addEventListener("pointerleave", hideTooltip);
      link.addEventListener("focus", function () { showTooltip(p, cx, cy); });
      link.addEventListener("blur", hideTooltip);
      pointsGroup.appendChild(link);
    });
    svg.appendChild(pointsGroup);

    renderTable();
  }

  function showTooltip(p, cx, cy) {
    var rect = svg.getBoundingClientRect();
    var scale = rect.width / W;
    tooltip.innerHTML = "";
    var line1 = document.createElement("div");
    var strong = document.createElement("span");
    strong.className = "t-value";
    strong.textContent = "Run #" + p.runNumber + " · " + (p.conclusion || p.status);
    line1.appendChild(strong);
    var line2 = document.createElement("div");
    line2.className = "t-secondary";
    line2.textContent = formatDuration(p.y) + " · " + new Date(p.createdAt).toLocaleString() + " · " + p.sha;
    tooltip.appendChild(line1);
    tooltip.appendChild(line2);
    tooltip.style.display = "block";
    var left = cx * scale;
    var top = cy * scale;
    tooltip.style.left = Math.min(left + 12, rect.width - 220) + "px";
    tooltip.style.top = Math.max(top - 44, 0) + "px";
  }
  function hideTooltip() {
    tooltip.style.display = "none";
  }

  function renderTable() {
    var body = document.getElementById("table-body");
    if (body.childElementCount) return; // full history is static, build once
    runs.slice().reverse().forEach(function (r) {
      var tr = document.createElement("tr");
      if (r.conclusion === "failure") tr.className = "failure";
      var cells = [
        r.runNumber,
        new Date(r.createdAt).toLocaleString(),
        r.durationSeconds !== null ? formatDuration(r.durationSeconds) : "—",
        r.conclusion || r.status,
      ];
      cells.forEach(function (text, idx) {
        var td = document.createElement("td");
        if (idx === 0 || idx === 2) td.className = "num";
        td.textContent = String(text);
        tr.appendChild(td);
      });
      var shaTd = document.createElement("td");
      var a = document.createElement("a");
      a.href = r.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = r.sha;
      shaTd.appendChild(a);
      tr.appendChild(shaTd);
      body.appendChild(tr);
    });
  }

  function buildLegend() {
    var kinds = [
      { cls: "success", label: "Success" },
      { cls: "failure", label: "Failure" },
    ];
    if (points.some(function (p) { return conclusionClass(p.conclusion) === "other"; })) {
      kinds.push({ cls: "other", label: "Other" });
    }
    kinds.forEach(function (k) {
      var key = document.createElement("span");
      key.className = "key";
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = "var(--" + (k.cls === "other" ? "other" : k.cls === "success" ? "good" : "critical") + ")";
      var label = document.createElement("span");
      label.textContent = k.label;
      key.appendChild(dot);
      key.appendChild(label);
      legendEl.appendChild(key);
    });
  }

  // Drag-to-zoom + wheel-zoom, via Pointer Events (covers mouse + touch).
  var dragging = false;
  var dragStartPx = 0;
  var dragCurrentPx = 0;
  var brushRect = null;

  function pxFromEvent(e) {
    var rect = svg.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * W;
  }

  svg.addEventListener("pointerdown", function (e) {
    if (e.target.closest(".point-pointlink")) return;
    dragging = true;
    dragStartPx = dragCurrentPx = pxFromEvent(e);
    svg.setPointerCapture(e.pointerId);
    brushRect = svgEl("rect", { class: "brush", x: dragStartPx, y: margin.top, width: 0, height: plotH });
    svg.appendChild(brushRect);
  });
  svg.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    dragCurrentPx = pxFromEvent(e);
    var x = Math.min(dragStartPx, dragCurrentPx);
    var w = Math.abs(dragCurrentPx - dragStartPx);
    brushRect.setAttribute("x", x);
    brushRect.setAttribute("width", w);
  });
  svg.addEventListener("pointerup", function () {
    if (!dragging) return;
    dragging = false;
    if (brushRect) { svg.removeChild(brushRect); brushRect = null; }
    var dx = Math.abs(dragCurrentPx - dragStartPx);
    if (dx > 6) {
      var t0 = invertX(Math.min(dragStartPx, dragCurrentPx));
      var t1 = invertX(Math.max(dragStartPx, dragCurrentPx));
      setDomain(t0, t1);
    }
  });
  svg.addEventListener("pointercancel", function () {
    dragging = false;
    if (brushRect) { svg.removeChild(brushRect); brushRect = null; }
  });

  svg.addEventListener("wheel", function (e) {
    e.preventDefault();
    var factor = e.deltaY < 0 ? 0.8 : 1.25;
    var cursorT = invertX(pxFromEvent(e));
    var newX0 = cursorT - (cursorT - domain.x0) * factor;
    var newX1 = cursorT + (domain.x1 - cursorT) * factor;
    setDomain(newX0, newX1);
  }, { passive: false });

  zoomInBtn.addEventListener("click", function () {
    var mid = (domain.x0 + domain.x1) / 2;
    setDomain(mid - (mid - domain.x0) * 0.6, mid + (domain.x1 - mid) * 0.6);
  });
  zoomOutBtn.addEventListener("click", function () {
    var mid = (domain.x0 + domain.x1) / 2;
    setDomain(mid - (mid - domain.x0) * 1.6, mid + (domain.x1 - mid) * 1.6);
  });
  resetBtn.addEventListener("click", function () {
    domain = { x0: fullDomain.x0, x1: fullDomain.x1 };
    render();
  });

  buildLegend();
  render();
})();
</script>
</body>
</html>
`;
}

function formatDuration(seconds) {
  if (seconds < 90) return `${Math.round(seconds)}s`;
  return `${(seconds / 60).toFixed(1)}m`;
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const remote = repoFromGitRemote();
  const owner = args.owner ?? remote?.owner;
  const repo = args.repo ?? remote?.repo;
  if (!owner || !repo) {
    throw new Error(
      'Could not determine owner/repo. Pass --owner and --repo, or run inside a git checkout with a GitHub "origin" remote.',
    );
  }
  const token =
    args.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";

  console.log(
    `Fetching "${args.workflow}" runs for ${owner}/${repo}@${args.branch}...`,
  );
  const runs = await fetchAllRuns({
    owner,
    repo,
    workflow: args.workflow,
    branch: args.branch,
    token,
    limit: args.limit,
  });
  console.log(`Fetched ${runs.length} runs.`);

  mkdirSync(dirname(args.jsonOut), { recursive: true });
  writeFileSync(args.jsonOut, JSON.stringify(runs, null, 2));

  const html = buildHtml(runs, {
    owner,
    repo,
    workflow: args.workflow,
    branch: args.branch,
    generatedAt: new Date().toISOString(),
  });
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, html);

  const successCount = runs.filter((r) => r.conclusion === "success").length;
  const rate = runs.length
    ? ((successCount / runs.length) * 100).toFixed(1)
    : "0.0";
  console.log(`Success rate: ${rate}% (${successCount}/${runs.length})`);
  console.log(`Wrote ${args.jsonOut}`);
  console.log(`Wrote ${args.out} — open it in a browser to view the chart.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { buildHtml, extractRun, fetchAllRuns, repoFromGitRemote };
