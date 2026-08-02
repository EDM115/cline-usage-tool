import { describe, expect, test } from "bun:test";

import { renderChartSvgs } from "../src/charts";
import { renderReportHtml } from "../src/report-html";
import { reportDataset } from "./test-dataset";

describe("report rendering", () => {
  test("renders four standalone SVG charts from the normalized dataset", () => {
    const charts = renderChartSvgs(reportDataset());

    expect(charts.map((chart) => chart.name)).toEqual([
      "chart-daily-tokens.svg",
      "chart-daily-cost.svg",
      "chart-model-tokens.svg",
      "chart-billing-type.svg",
    ]);
    expect(
      charts.every((chart) => chart.svg.startsWith("<svg") && chart.svg.includes("</svg>")),
    ).toBe(true);
    expect(charts[0]?.svg).toContain("Daily tokens");
    expect(charts[2]?.svg).toContain("cline-pass/kimi-k3");
  });

  test("scales sub-dollar cost charts to their actual maximum", () => {
    const costChart = renderChartSvgs(reportDataset()).find(
      (chart) => chart.name === "chart-daily-cost.svg",
    );

    expect(costChart?.svg).toContain("$0.2500");
    expect(costChart?.svg).not.toContain("$1.00");
  });

  test("produces a self-contained interactive report with safely embedded data", () => {
    const dataset = reportDataset();
    dataset.usages[0]!.metadata.note = "</script><script>alert(1)</script>";

    const html = renderReportHtml(dataset);

    expect(html).toContain('<script id="usage-data" type="application/json">');
    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain('id="date-from"');
    expect(html).toContain('id="date-to"');
    expect(html).toContain('id="billing-filter"');
    expect(html).toContain('id="model-filter"');
    expect(html).toContain('id="metric-filter"');
    expect(html).toContain("Five-hour");
    expect(html).toContain("ClinePass");
    expect(html).not.toContain("https://cdn.");

    const executableScripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
      .map((match) => match[1] ?? "")
      .filter((script) => !script.trimStart().startsWith("{"));

    for (const script of executableScripts) {
      expect(() => new Function(script)).not.toThrow();
    }
  });
});
