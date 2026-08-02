import type { UsageDataset } from "./types";

export function renderReportHtml(_dataset: UsageDataset): string {
  const dataJson = JSON.stringify(_dataset).replaceAll("</", "<\\/");
  const limitCards =
    (_dataset.usageLimits?.limits ?? [])
      .map((limit) => {
        const label =
          limit.type === "five_hour"
            ? "Five-hour"
            : limit.type === "weekly"
              ? "Weekly"
              : limit.type === "monthly"
                ? "Monthly"
                : limit.type;
        const percent = Math.max(0, Math.min(100, limit.percentUsed));

        return `<article class="limit-card"><div class="limit-heading"><strong>${escapeHtml(label)}</strong><span>${formatNumber(limit.percentUsed, 1)}%</span></div><div class="progress"><span style="width:${percent}%"></span></div><p>${limit.resetsAt ? `Resets ${escapeHtml(formatTimestamp(limit.resetsAt))}` : "Rolling window"}</p></article>`;
      })
      .join("") ||
    `<article class="limit-card"><div class="limit-heading"><strong>ClinePass limits</strong><span>Unavailable</span></div><p>No current limit snapshot was returned.</p></article>`;
  const planName = _dataset.plan?.plan.displayName ?? "No active ClinePass plan";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cline usage report · ${escapeHtml(_dataset.account.displayName || _dataset.account.id)}</title>
  <style>
    :root { color-scheme: dark; --bg:#07070a; --panel:#111116; --panel-2:#17171e; --line:#2a2a33; --text:#f7f7f8; --muted:#9b9ba7; --purple:#7c3aed; --blue:#2563eb; --green:#22c55e; --amber:#f59e0b; --danger:#ef4444; }
    * { box-sizing:border-box; }
    body { margin:0; background:radial-gradient(circle at 85% -10%,rgba(124,58,237,.22),transparent 34rem),var(--bg); color:var(--text); font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    button,input,select { font:inherit; }
    main { width:min(1440px,calc(100% - 32px)); margin:0 auto; padding:36px 0 64px; }
    header { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; margin-bottom:28px; }
    .eyebrow { margin:0 0 6px; color:#a78bfa; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:0; font-size:clamp(30px,4vw,52px); line-height:1.05; letter-spacing:-.04em; }
    .subtitle { margin:12px 0 0; color:var(--muted); }
    .account-chip { padding:12px 16px; border:1px solid var(--line); border-radius:14px; background:rgba(17,17,22,.82); text-align:right; }
    .account-chip strong,.account-chip span { display:block; }
    .account-chip span { color:var(--muted); font-size:12px; }
    .stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .stat,.section,.limit-card { border:1px solid var(--line); background:rgba(17,17,22,.88); box-shadow:0 18px 50px rgba(0,0,0,.18); }
    .stat { min-height:126px; padding:20px; border-radius:18px; }
    .stat > span { display:block; color:var(--muted); font-size:12px; letter-spacing:.04em; text-transform:uppercase; }
    .stat strong { display:block; margin-top:9px; font-size:28px; line-height:1.1; letter-spacing:-.03em; }
    .stat small { display:block; margin-top:8px; color:var(--muted); white-space:nowrap; }
    .section { margin-top:16px; padding:22px; border-radius:20px; }
    .section-header { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:18px; }
    h2 { margin:0; font-size:20px; letter-spacing:-.02em; }
    .plan-grid { display:grid; grid-template-columns:1.1fr 2fr; gap:12px; }
    .plan-summary { padding:20px; border-radius:16px; background:linear-gradient(145deg,rgba(124,58,237,.22),rgba(37,99,235,.08)); border:1px solid rgba(124,58,237,.38); }
    .plan-summary h3 { margin:0; font-size:21px; }
    .plan-summary p { margin:8px 0 0; color:var(--muted); }
    .limits { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .limit-card { padding:16px; border-radius:16px; background:var(--panel-2); }
    .limit-heading { display:flex; justify-content:space-between; gap:12px; }
    .progress { height:8px; margin:14px 0 10px; overflow:hidden; background:#272732; border-radius:999px; }
    .progress span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--blue),var(--purple)); }
    .limit-card p { margin:0; color:var(--muted); font-size:12px; }
    .filters { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
    label { color:var(--muted); font-size:12px; }
    label span { display:block; margin:0 0 6px; }
    input,select { width:100%; height:42px; padding:0 11px; color:var(--text); background:var(--panel-2); border:1px solid var(--line); border-radius:10px; outline:none; }
    input:focus,select:focus { border-color:var(--purple); box-shadow:0 0 0 3px rgba(124,58,237,.16); }
    .chart-shell { margin-top:18px; min-height:390px; padding:12px; border-radius:16px; background:#0b0b10; border:1px solid var(--line); overflow:hidden; }
    #trend-chart { display:block; width:100%; min-width:720px; height:auto; }
    .breakdowns { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px; }
    .bars { display:grid; gap:12px; }
    .bar-row { display:grid; grid-template-columns:minmax(120px,1.5fr) 3fr auto; gap:12px; align-items:center; }
    .bar-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .bar-track { height:10px; overflow:hidden; background:#272732; border-radius:999px; }
    .bar-track span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--purple),var(--blue)); }
    .bar-value { color:var(--muted); font-variant-numeric:tabular-nums; }
    .table-wrap { overflow:auto; border:1px solid var(--line); border-radius:14px; }
    table { width:100%; border-collapse:collapse; min-width:940px; }
    th,td { padding:12px 14px; text-align:left; border-bottom:1px solid var(--line); }
    th { position:sticky; top:0; z-index:1; color:var(--muted); background:#15151b; font-size:11px; letter-spacing:.06em; text-transform:uppercase; }
    td { font-variant-numeric:tabular-nums; }
    tr:last-child td { border-bottom:0; }
    .pill { display:inline-flex; padding:3px 8px; border-radius:999px; background:rgba(124,58,237,.16); color:#c4b5fd; font-size:12px; }
    .note { color:var(--muted); font-size:12px; }
    footer { margin-top:20px; color:var(--muted); text-align:center; font-size:12px; }
    @media (max-width:1050px) { .stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .plan-grid,.breakdowns { grid-template-columns:1fr; } .filters { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:640px) { main { width:min(100% - 20px,1440px); padding-top:20px; } header { display:block; } .account-chip { margin-top:16px; text-align:left; } .stats,.limits,.filters { grid-template-columns:1fr; } .stat { min-height:auto; } .section { padding:16px; } }
  </style>
</head>
<body>
<main>
  <header>
    <div><p class="eyebrow">Cline account insights</p><h1>${escapeHtml(_dataset.account.displayName || "Cline usage")}</h1><p class="subtitle">All account history · ${escapeHtml(_dataset.history.from)} to ${escapeHtml(_dataset.history.to)} · generated ${escapeHtml(formatTimestamp(_dataset.generatedAt))}</p></div>
    <div class="account-chip"><strong>${escapeHtml(_dataset.account.id)}</strong><span>${escapeHtml(_dataset.account.email)}</span></div>
  </header>
  <section class="stats" aria-label="Usage summary">
    <article class="stat"><span>Total tokens</span><strong id="stat-tokens">${formatNumber(_dataset.summary.totalTokens)}</strong><small><span id="stat-prompt">${formatNumber(_dataset.summary.promptTokens)}</span> input · <span id="stat-output">${formatNumber(_dataset.summary.completionTokens)}</span> output</small></article>
    <article class="stat"><span>Requests</span><strong id="stat-requests">${formatNumber(_dataset.summary.requests)}</strong><small><span id="stat-days">${formatNumber(_dataset.summary.activeDays)}</span> active days</small></article>
    <article class="stat"><span>Reference cost</span><strong id="stat-cost">${money(_dataset.summary.referenceCostUsd)}</strong><small>Underlying model cost, including ClinePass</small></article>
    <article class="stat"><span>Credits consumed</span><strong id="stat-credits">${money(_dataset.summary.creditsUsedUsd)}</strong><small>Current balance ${money(_dataset.balance.balanceUsd)}</small></article>
    <article class="stat"><span>Cached tokens</span><strong id="stat-cached">${formatNumber(_dataset.summary.cachedTokens)}</strong><small><span id="stat-cache-share">${formatNumber(_dataset.summary.cacheSharePercent, 1)}%</span> of input</small></article>
    <article class="stat"><span>Average request</span><strong id="stat-average">${formatNumber(_dataset.summary.averageTokensPerRequest)}</strong><small>tokens per request</small></article>
    <article class="stat"><span>ClinePass requests</span><strong id="stat-pass">${formatNumber(_dataset.summary.clinePassRequests)}</strong><small>quota usage, not credit spend</small></article>
    <article class="stat"><span>Usage-billing requests</span><strong id="stat-billing">${formatNumber(_dataset.summary.usageBillingRequests)}</strong><small>pay-as-you-go activity</small></article>
  </section>
  <section class="section">
    <div class="section-header"><h2>Plan and limits</h2><span class="note">Current snapshot</span></div>
    <div class="plan-grid"><article class="plan-summary"><h3>${escapeHtml(planName)}</h3><p>${_dataset.plan ? `${escapeHtml(formatTimestamp(_dataset.plan.currentPeriodStart))} → ${escapeHtml(formatTimestamp(_dataset.plan.currentPeriodEnd))}` : "Account has no plan response."}</p></article><div class="limits">${limitCards}</div></div>
  </section>
  <section class="section">
    <div class="section-header"><h2>Explore usage</h2><span class="note">Every control re-aggregates exact request rows</span></div>
    <div class="filters">
      <label><span>From</span><input id="date-from" type="date" value="${escapeHtml(_dataset.history.from)}" min="${escapeHtml(_dataset.history.from)}" max="${escapeHtml(_dataset.history.to)}"></label>
      <label><span>To</span><input id="date-to" type="date" value="${escapeHtml(_dataset.history.to)}" min="${escapeHtml(_dataset.history.from)}" max="${escapeHtml(_dataset.history.to)}"></label>
      <label><span>Billing type</span><select id="billing-filter"><option value="all">All usage</option><option value="cline-pass">ClinePass</option><option value="cline-usage">Cline usage-billing</option></select></label>
      <label><span>Model</span><select id="model-filter"><option value="all">All models</option>${_dataset.models.map((model) => `<option value="${escapeHtml(model.model)}">${escapeHtml(model.model)}</option>`).join("")}</select></label>
      <label><span>Metric</span><select id="metric-filter"><option value="totalTokens">Total tokens</option><option value="promptTokens">Input tokens</option><option value="completionTokens">Output tokens</option><option value="cachedTokens">Cached tokens</option><option value="referenceCostUsd">Reference cost</option><option value="creditsUsedUsd">Credits used</option></select></label>
    </div>
    <div class="chart-shell"><svg id="trend-chart" viewBox="0 0 1100 390" role="img" aria-label="Filtered daily trend"></svg></div>
  </section>
  <div class="breakdowns">
    <section class="section"><div class="section-header"><h2>Models</h2><span class="note" id="model-count"></span></div><div id="model-bars" class="bars"></div></section>
    <section class="section"><div class="section-header"><h2>Billing type</h2><span class="note">Reference cost vs actual credits</span></div><div id="billing-bars" class="bars"></div></section>
  </div>
  <section class="section"><div class="section-header"><h2>Detailed usage</h2><span class="note" id="table-count"></span></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Billing</th><th>Model</th><th>Input</th><th>Output</th><th>Cached</th><th>Total</th><th>Reference cost</th><th>Credits used</th></tr></thead><tbody id="usage-rows"></tbody></table></div><p class="note">The table shows the 200 most recent rows in the current filter. The CSV contains every request.</p></section>
  <footer>Reference cost is the API's underlying model-cost field. ClinePass records can have reference cost while consuming zero account credits.</footer>
</main>
<script id="usage-data" type="application/json">${dataJson}</script>
<script>
(() => {
  "use strict";
  const data = JSON.parse(document.getElementById("usage-data").textContent);
  const fromInput = document.getElementById("date-from");
  const toInput = document.getElementById("date-to");
  const billingInput = document.getElementById("billing-filter");
  const modelInput = document.getElementById("model-filter");
  const metricInput = document.getElementById("metric-filter");
  const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const metricLabels = { totalTokens: "Total tokens", promptTokens: "Input tokens", completionTokens: "Output tokens", cachedTokens: "Cached tokens", referenceCostUsd: "Reference cost", creditsUsedUsd: "Credits used" };

  function esc(value) { return String(value).replace(/[&<>"']/g, function (character) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]; }); }
  function moneyValue(value) { return currency.format(value || 0); }
  function formatMetric(value, metric) { return metric.endsWith("Usd") ? moneyValue(value) : number.format(value); }
  function filtered() {
    const from = fromInput.value;
    const to = toInput.value;
    return data.usages.filter(function (row) { return (!from || row.date >= from) && (!to || row.date <= to) && (billingInput.value === "all" || row.billingType === billingInput.value) && (modelInput.value === "all" || row.model === modelInput.value); });
  }
  function sum(rows) { return rows.reduce(function (total, row) { total.requests += 1; total.promptTokens += row.promptTokens; total.completionTokens += row.completionTokens; total.cachedTokens += row.cachedTokens; total.totalTokens += row.totalTokens; total.referenceCostUsd += row.referenceCostUsd; total.creditsUsedUsd += row.creditsUsedUsd; return total; }, { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0, referenceCostUsd: 0, creditsUsedUsd: 0 }); }
  function setText(id, value) { document.getElementById(id).textContent = value; }
  function renderStats(rows) {
    const total = sum(rows);
    const days = new Set(rows.map(function (row) { return row.date; })).size;
    setText("stat-tokens", number.format(total.totalTokens)); setText("stat-prompt", number.format(total.promptTokens)); setText("stat-output", number.format(total.completionTokens)); setText("stat-requests", number.format(total.requests)); setText("stat-days", number.format(days)); setText("stat-cost", moneyValue(total.referenceCostUsd)); setText("stat-credits", moneyValue(total.creditsUsedUsd)); setText("stat-cached", number.format(total.cachedTokens)); setText("stat-cache-share", number.format(total.promptTokens ? total.cachedTokens / total.promptTokens * 100 : 0) + "%"); setText("stat-average", number.format(total.requests ? total.totalTokens / total.requests : 0)); setText("stat-pass", number.format(rows.filter(function (row) { return row.billingType === "cline-pass"; }).length)); setText("stat-billing", number.format(rows.filter(function (row) { return row.billingType === "cline-usage"; }).length));
  }
  function renderTrend(rows) {
    const metric = metricInput.value;
    const grouped = new Map();
    rows.forEach(function (row) { grouped.set(row.date, (grouped.get(row.date) || 0) + row[metric]); });
    const points = Array.from(grouped.entries()).sort(function (a, b) { return a[0].localeCompare(b[0]); });
    const svg = document.getElementById("trend-chart");
    const left = 74, right = 30, top = 48, bottom = 54, width = 1100, height = 390, plotWidth = width - left - right, plotHeight = height - top - bottom;
    const max = Math.max(Number.EPSILON, ...points.map(function (point) { return point[1]; }));
    let markup = '<rect width="1100" height="390" fill="#0b0b10" rx="12"/><text x="28" y="29" fill="#f7f7f8" font-size="17" font-weight="700">' + esc(metricLabels[metric]) + '</text>';
    for (let index = 0; index < 5; index += 1) { const y = top + index / 4 * plotHeight; const value = max * (1 - index / 4); markup += '<line x1="' + left + '" y1="' + y + '" x2="' + (width - right) + '" y2="' + y + '" stroke="#2a2a33"/><text x="' + (left - 10) + '" y="' + (y + 4) + '" text-anchor="end" fill="#9b9ba7" font-size="11">' + esc(formatMetric(value, metric)) + '</text>'; }
    if (!points.length) { markup += '<text x="550" y="205" text-anchor="middle" fill="#9b9ba7">No usage in this filter</text>'; svg.innerHTML = markup; return; }
    const plotted = points.map(function (point, index) { return { label: point[0], value: point[1], x: left + (points.length === 1 ? plotWidth / 2 : index / (points.length - 1) * plotWidth), y: top + plotHeight - point[1] / max * plotHeight }; });
    if (plotted.length > 1) { markup += '<polygon points="' + plotted[0].x + ',' + (top + plotHeight) + ' ' + plotted.map(function (point) { return point.x + ',' + point.y; }).join(' ') + ' ' + plotted[plotted.length - 1].x + ',' + (top + plotHeight) + '" fill="#7c3aed" opacity=".2"/>'; }
    markup += '<polyline points="' + plotted.map(function (point) { return point.x + ',' + point.y; }).join(' ') + '" fill="none" stroke="#7c3aed" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>';
    plotted.forEach(function (point, index) { markup += '<circle cx="' + point.x + '" cy="' + point.y + '" r="5" fill="#2563eb" stroke="#f7f7f8" stroke-width="2"><title>' + esc(point.label + ': ' + formatMetric(point.value, metric)) + '</title></circle>'; if (points.length <= 8 || index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0) { markup += '<text x="' + point.x + '" y="' + (height - 22) + '" text-anchor="middle" fill="#9b9ba7" font-size="11">' + esc(point.label.slice(5)) + '</text>'; } });
    svg.innerHTML = markup;
  }
  function renderBars(targetId, grouped, metric) {
    const rows = Array.from(grouped.entries()).map(function (entry) { return { label: entry[0], values: sum(entry[1]) }; }).sort(function (a, b) { return b.values[metric] - a.values[metric]; });
    const max = Math.max(1, ...rows.map(function (row) { return row.values[metric]; }));
    document.getElementById(targetId).innerHTML = rows.length ? rows.slice(0, 12).map(function (row) { return '<div class="bar-row"><span class="bar-label" title="' + esc(row.label) + '">' + esc(row.label) + '</span><span class="bar-track"><span style="width:' + (row.values[metric] / max * 100) + '%"></span></span><span class="bar-value">' + esc(formatMetric(row.values[metric], metric)) + '</span></div>'; }).join("") : '<p class="note">No matching usage.</p>';
    return rows.length;
  }
  function groupBy(rows, field) { const grouped = new Map(); rows.forEach(function (row) { const key = row[field]; const values = grouped.get(key) || []; values.push(row); grouped.set(key, values); }); return grouped; }
  function renderTable(rows) {
    const recent = rows.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 200);
    setText("table-count", number.format(rows.length) + " matching requests");
    document.getElementById("usage-rows").innerHTML = recent.length ? recent.map(function (row) { return '<tr><td>' + esc(new Date(row.createdAt).toLocaleString()) + '</td><td><span class="pill">' + esc(row.billingType === "cline-pass" ? "ClinePass" : "Usage-billing") + '</span></td><td title="' + esc(row.rawModel) + '">' + esc(row.model) + '</td><td>' + number.format(row.promptTokens) + '</td><td>' + number.format(row.completionTokens) + '</td><td>' + number.format(row.cachedTokens) + '</td><td>' + number.format(row.totalTokens) + '</td><td>' + moneyValue(row.referenceCostUsd) + '</td><td>' + moneyValue(row.creditsUsedUsd) + '</td></tr>'; }).join("") : '<tr><td colspan="9" class="note">No matching usage.</td></tr>';
  }
  function render() { if (fromInput.value && toInput.value && fromInput.value > toInput.value) { toInput.setCustomValidity("End date must not be before start date"); return; } toInput.setCustomValidity(""); const rows = filtered(); const metric = metricInput.value; renderStats(rows); renderTrend(rows); setText("model-count", renderBars("model-bars", groupBy(rows, "model"), metric) + " models"); renderBars("billing-bars", groupBy(rows, "billingType"), metric); renderTable(rows); }
  [fromInput, toInput, billingInput, modelInput, metricInput].forEach(function (input) { input.addEventListener("change", render); });
  render();
})();
</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function money(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
