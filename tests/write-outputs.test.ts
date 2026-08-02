import { describe, expect, test } from "bun:test";

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeOutputs } from "../src/export";
import { reportDataset } from "./test-dataset";

describe("writeOutputs", () => {
  test("writes JSON, detailed CSV, self-contained HTML, and four SVG charts", async () => {
    const root = mkdtempSync(join(tmpdir(), "cline-usage-tool-"));

    const result = await writeOutputs(reportDataset(), root, { includePng: false });

    expect(result.files.map((path) => path.slice(root.length + 1)).sort()).toEqual([
      "chart-billing-type.svg",
      "chart-daily-cost.svg",
      "chart-daily-tokens.svg",
      "chart-model-tokens.svg",
      "cline-usage-report.html",
      "cline-usage.csv",
      "cline-usage.json",
    ]);
    expect(result.warnings).toEqual([]);
    expect(JSON.parse(readFileSync(join(root, "cline-usage.json"), "utf8")).schemaVersion).toBe(1);
    expect(existsSync(join(root, "cline-usage-report.html"))).toBe(true);
  });

  test("renders a PNG copy of every standalone chart when enabled", async () => {
    const root = mkdtempSync(join(tmpdir(), "cline-usage-png-"));

    const result = await writeOutputs(reportDataset(), root, { includePng: true });
    const pngFiles = result.files.filter((path) => path.endsWith(".png"));

    expect(pngFiles.map((path) => path.slice(root.length + 1)).sort()).toEqual([
      "chart-billing-type.png",
      "chart-daily-cost.png",
      "chart-daily-tokens.png",
      "chart-model-tokens.png",
    ]);
    expect(result.warnings).toEqual([]);

    for (const path of pngFiles) {
      expect([...readFileSync(path).subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
  });
});
