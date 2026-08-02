import type { UsageDataset } from "./types";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { renderChartSvgs } from "./charts";
import { renderReportHtml } from "./report-html";

export type WriteResult = {
  files: string[];
  warnings: string[];
};

export async function writeOutputs(
  _dataset: UsageDataset,
  _outDir: string,
  _options: { includePng: boolean },
): Promise<WriteResult> {
  mkdirSync(_outDir, { recursive: true });
  const files: string[] = [];
  const warnings: string[] = [];
  const jsonPath = join(_outDir, "cline-usage.json");
  const csvPath = join(_outDir, "cline-usage.csv");
  const htmlPath = join(_outDir, "cline-usage-report.html");
  writeFileSync(jsonPath, `${JSON.stringify(_dataset, null, 2)}\n`, "utf8");
  writeFileSync(csvPath, usageCsv(_dataset), "utf8");
  writeFileSync(htmlPath, renderReportHtml(_dataset), "utf8");
  files.push(jsonPath, csvPath, htmlPath);

  for (const chart of renderChartSvgs(_dataset)) {
    const svgPath = join(_outDir, chart.name);
    writeFileSync(svgPath, chart.svg, "utf8");
    files.push(svgPath);

    if (_options.includePng) {
      const pngPath = svgPath.replace(/\.svg$/, ".png");

      try {
        const { Resvg } = await import("@resvg/resvg-js");
        const renderer = new Resvg(chart.svg, {
          fitTo: { mode: "original" },
          background: "#07070a",
        });
        writeFileSync(pngPath, renderer.render().asPng());
        files.push(pngPath);
      } catch (error) {
        warnings.push(
          `PNG export skipped for ${chart.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return { files, warnings: [...new Set(warnings)] };
}

export function usageCsv(_dataset: UsageDataset): string {
  const header = [
    "id",
    "user_id",
    "created_at",
    "date",
    "operation",
    "billing_type",
    "raw_model_type",
    "provider",
    "model",
    "raw_model",
    "prompt_tokens",
    "completion_tokens",
    "cached_tokens",
    "total_tokens",
    "credits_used_raw",
    "credits_used_usd",
    "reference_cost_raw",
    "reference_cost_usd",
    "generation_id",
    "metadata_json",
  ];
  const rows = _dataset.usages.map((usage) => [
    usage.id,
    usage.userId,
    usage.createdAt,
    usage.date,
    usage.operation,
    usage.billingType,
    usage.rawModelTypeName,
    usage.provider,
    usage.model,
    usage.rawModel,
    String(usage.promptTokens),
    String(usage.completionTokens),
    String(usage.cachedTokens),
    String(usage.totalTokens),
    String(usage.creditsUsedRaw),
    usage.creditsUsedUsd.toFixed(6),
    String(usage.referenceCostRaw),
    usage.referenceCostUsd.toFixed(6),
    usage.generationId,
    JSON.stringify(usage.metadata),
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvCell(value: string): string {
  const spreadsheetSafeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;

  if (!/[",\r\n]/.test(spreadsheetSafeValue)) {
    return spreadsheetSafeValue;
  }

  return `"${spreadsheetSafeValue.replaceAll('"', '""')}"`;
}
