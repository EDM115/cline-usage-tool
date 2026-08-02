import type { UsageDataset } from "./types";

export type ChartSvg = {
  name: string;
  svg: string;
};

export function renderChartSvgs(_dataset: UsageDataset): ChartSvg[] {
  return [
    {
      name: "chart-daily-tokens.svg",
      svg: renderLineChart(
        "Daily tokens",
        _dataset.daily.map((day) => ({ label: day.date, value: day.totalTokens })),
        "tokens",
      ),
    },
    {
      name: "chart-daily-cost.svg",
      svg: renderLineChart(
        "Daily reference cost",
        _dataset.daily.map((day) => ({ label: day.date, value: day.referenceCostUsd })),
        "USD",
      ),
    },
    {
      name: "chart-model-tokens.svg",
      svg: renderBarChart(
        "Tokens by model",
        _dataset.models
          .slice(0, 12)
          .map((model) => ({ label: model.model, value: model.totalTokens })),
        "tokens",
      ),
    },
    {
      name: "chart-billing-type.svg",
      svg: renderBarChart(
        "Tokens by billing type",
        _dataset.billingTypes.map((billing) => ({
          label: billing.type === "cline-pass" ? "ClinePass" : "Cline usage-billing",
          value: billing.totalTokens,
        })),
        "tokens",
      ),
    },
  ];
}

const colors = {
  background: "#07070a",
  panel: "#111116",
  grid: "#2a2a33",
  text: "#f7f7f8",
  muted: "#9b9ba7",
  accent: "#7c3aed",
  accent2: "#2563eb",
};

function renderLineChart(
  title: string,
  values: Array<{ label: string; value: number }>,
  unit: string,
): string {
  const width = 960;
  const height = 480;
  const left = 72;
  const right = 34;
  const top = 80;
  const bottom = 72;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = Math.max(Number.EPSILON, ...values.map((point) => point.value));
  const points = values.map((point, index) => ({
    ...point,
    x: left + (values.length <= 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth),
    y: top + plotHeight - (point.value / max) * plotHeight,
  }));
  const grid = Array.from({ length: 5 }, (_, index) => {
    const fraction = index / 4;
    const y = top + fraction * plotHeight;
    const value = max * (1 - fraction);

    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="${colors.grid}"/><text x="${left - 12}" y="${y + 4}" text-anchor="end" class="muted">${escapeXml(formatValue(value, unit))}</text>`;
  }).join("");
  const polyline =
    points.length > 0
      ? `<polyline points="${points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}" fill="none" stroke="${colors.accent}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`
      : "";
  const area =
    points.length > 1
      ? `<polygon points="${points[0]!.x},${top + plotHeight} ${points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")} ${points.at(-1)!.x},${top + plotHeight}" fill="${colors.accent}" opacity="0.18"/>`
      : "";
  const dots = points
    .map(
      (point) =>
        `<circle cx="${point.x}" cy="${point.y}" r="5" fill="${colors.accent2}" stroke="${colors.text}" stroke-width="2"><title>${escapeXml(`${point.label}: ${formatValue(point.value, unit)}`)}</title></circle>`,
    )
    .join("");
  const labels = points
    .filter(
      (_, index) =>
        values.length <= 8 ||
        index === 0 ||
        index === values.length - 1 ||
        index % Math.ceil(values.length / 6) === 0,
    )
    .map(
      (point) =>
        `<text x="${point.x}" y="${height - 34}" text-anchor="middle" class="muted">${escapeXml(shortDate(point.label))}</text>`,
    )
    .join("");
  const empty =
    values.length === 0
      ? `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="muted">No usage data</text>`
      : "";

  return svgWrap(
    width,
    height,
    `<text x="34" y="42" class="title">${escapeXml(title)}</text>${grid}${area}${polyline}${dots}${labels}${empty}`,
  );
}

function renderBarChart(
  title: string,
  values: Array<{ label: string; value: number }>,
  unit: string,
): string {
  const width = 960;
  const rowHeight = 44;
  const top = 78;
  const bottom = 32;
  const left = 300;
  const right = 90;
  const height = Math.max(300, top + Math.max(values.length, 1) * rowHeight + bottom);
  const max = Math.max(1, ...values.map((row) => row.value));
  const bars = values
    .map((row, index) => {
      const y = top + index * rowHeight;
      const barWidth = (row.value / max) * (width - left - right);

      return `<text x="${left - 14}" y="${y + 23}" text-anchor="end" class="label">${escapeXml(truncate(row.label, 38))}</text><rect x="${left}" y="${y + 5}" width="${Math.max(barWidth, row.value > 0 ? 2 : 0)}" height="26" rx="7" fill="${index % 2 === 0 ? colors.accent : colors.accent2}"><title>${escapeXml(`${row.label}: ${formatValue(row.value, unit)}`)}</title></rect><text x="${Math.min(width - right + 8, left + barWidth + 8)}" y="${y + 23}" class="muted">${escapeXml(formatValue(row.value, unit))}</text>`;
    })
    .join("");
  const empty =
    values.length === 0
      ? `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="muted">No usage data</text>`
      : "";

  return svgWrap(
    width,
    height,
    `<text x="34" y="42" class="title">${escapeXml(title)}</text>${bars}${empty}`,
  );
}

function svgWrap(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>svg{background:${colors.background};font-family:Inter,ui-sans-serif,system-ui,sans-serif}.title{fill:${colors.text};font-size:22px;font-weight:700}.label{fill:${colors.text};font-size:13px}.muted{fill:${colors.muted};font-size:12px}</style><rect width="100%" height="100%" fill="${colors.background}"/><rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="18" fill="${colors.panel}" stroke="${colors.grid}"/>${body}</svg>`;
}

function formatValue(value: number, unit: string): string {
  if (unit === "USD") {
    return `$${value.toFixed(value < 1 ? 4 : 2)}`;
  }

  return `${new Intl.NumberFormat("en", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

function shortDate(value: string): string {
  const [year, month, day] = value.split("-");

  return year && month && day ? `${day}/${month}/${year.slice(2)}` : value;
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
