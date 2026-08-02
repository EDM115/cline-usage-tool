import { describe, expect, test } from "bun:test";

import { usageCsv } from "../src/export";
import { reportDataset } from "./test-dataset";

describe("usageCsv", () => {
  test("exports one detailed row per request and safely quotes metadata", () => {
    const dataset = reportDataset();
    dataset.usages = [
      {
        id: "usg-1",
        userId: "usr-example",
        createdAt: "2026-08-01T10:00:00Z",
        date: "2026-08-01",
        operation: "chat_completion",
        billingType: "cline-pass",
        rawModelTypeName: "cline-pass",
        provider: "vercel",
        model: "cline-pass/kimi-k3",
        rawModel: "moonshotai/kimi-k3",
        promptTokens: 100,
        completionTokens: 50,
        cachedTokens: 25,
        totalTokens: 150,
        creditsUsedRaw: 0,
        creditsUsedUsd: 0,
        referenceCostRaw: 250000,
        referenceCostUsd: 0.25,
        generationId: "gen-1",
        metadata: { note: 'quoted, "value"' },
      },
    ];
    const csv = usageCsv(dataset);

    expect(csv).toContain("id,user_id,created_at,date,operation,billing_type");
    expect(csv).toContain("usg-1,usr-example,2026-08-01T10:00:00Z,2026-08-01");
    expect(JSON.parse(parseCsvLine(csv.trimEnd().split("\n")[1] ?? "")[19] ?? "null")).toEqual({
      note: 'quoted, "value"',
    });
    expect(csv.endsWith("\n")).toBe(true);
  });

  test("neutralizes spreadsheet formulas in API-controlled cells", () => {
    const dataset = reportDataset();
    dataset.usages[0]!.operation = '=HYPERLINK("https://example.invalid")';
    dataset.usages[0]!.provider = "+cmd";
    dataset.usages[0]!.model = "-danger";
    dataset.usages[0]!.rawModel = "@SUM(1,1)";
    const values = parseCsvLine(usageCsv(dataset).trimEnd().split("\n")[1] ?? "");

    expect(values[4]).toBe('\'=HYPERLINK("https://example.invalid")');
    expect(values[7]).toBe("'+cmd");
    expect(values[8]).toBe("'-danger");
    expect(values[9]).toBe("'@SUM(1,1)");
  });
});

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);

  return values;
}
