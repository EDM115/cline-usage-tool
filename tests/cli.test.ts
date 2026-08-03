import { describe, expect, test } from "bun:test";

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ClineApi } from "../src/api";
import { parseArgs, runCli } from "../src/cli";

describe("parseArgs", () => {
  test("uses one positional user ID and a conventional output directory", () => {
    expect(parseArgs(["usr-01EXAMPLE"], { CLINE_API_KEY: "sk_EXAMPLE" })).toEqual({
      apiKey: "sk_EXAMPLE",
      userId: "usr-01EXAMPLE",
      outDir: "outputs/cline-usage",
      help: false,
    });
  });

  test("accepts only the output directory as an operational flag", () => {
    expect(parseArgs(["usr-01EXAMPLE", "--out", "reports/cline"], { CLINE_API_KEY: "sk_EXAMPLE" })).toEqual({
      apiKey: "sk_EXAMPLE",
      userId: "usr-01EXAMPLE",
      outDir: "reports/cline",
      help: false,
    });
    expect(() => parseArgs(["usr-01EXAMPLE", "--from", "2026-01-01"], { CLINE_API_KEY: "sk_EXAMPLE" })).toThrow(
      "Unknown option --from",
    );
  });

  test("rejects malformed Cline user IDs", () => {
    expect(() => parseArgs(["example"], { CLINE_API_KEY: "sk_EXAMPLE" })).toThrow("Expected a Cline user ID beginning with usr-");
  });

  test("runs the complete collection and export path with the API key kept out of artifacts", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "cline-cli-"));
    const lines: string[] = [];
    const api = new ClineApi({ apiKey: "secret-key", fetcher: cliFetch() });

    const result = await runCli(
      ["usr-example", "--out", outDir],
      { CLINE_API_KEY: "secret-key" },
      {
        api,
        now: new Date("2026-08-02T12:00:00Z"),
        includePng: false,
        log: (line) => lines.push(line),
      },
    );

    expect(result?.files).toHaveLength(7);
    expect(lines.join("\n")).toContain("Generated 7 files");
    expect(readFileSync(join(outDir, "cline-usage.json"), "utf8")).not.toContain("secret-key");
  });

  test("requires CLINE_API_KEY before making requests", async () => {
    await expect(runCli(["usr-example"], {}, { includePng: false })).rejects.toThrow(
      "CLINE_API_KEY is required",
    );
  });

  test("prints help without requiring credentials", async () => {
    const lines: string[] = [];

    expect(await runCli(["--help"], {}, { log: (line) => lines.push(line) })).toBeNull();
    expect(lines.join("\n")).toContain("bun usage <user-id>");
  });
});

function cliFetch(): typeof fetch {
  return Object.assign(
    async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith("/api/v1/users/me")) {
        return response({
          id: "usr-example",
          email: "example@example.com",
          displayName: "Example",
          organizations: [],
          createdAt: "2026-07-31T11:24:01Z",
          updatedAt: "2026-08-01T16:00:25Z",
        });
      }

      if (url.endsWith("/balance")) {
        return response({ userId: "usr-example", balance: 500000 });
      }

      if (url.endsWith("/users/me/plan")) {
        return response({
          planHistoryId: "iph-example",
          userId: "usr-example",
          plan: {
            id: "pln-example",
            name: "Cline Pass",
            displayName: "Cline Pass",
            description: "ClinePass",
            type: "individual",
            interval: "Monthly",
            pricePerSeatCents: 999,
            isActive: true,
            createdAt: "2026-05-26T09:34:05Z",
            updatedAt: "2026-07-20T11:20:12Z",
          },
          currentPeriodStart: "2026-07-31T11:26:46Z",
          currentPeriodEnd: "2026-08-31T11:26:46Z",
        });
      }

      if (url.endsWith("/users/me/plan/usage-limits")) {
        return response({ limits: [] });
      }

      if (url.includes("/usages/daily?")) {
        return response({ items: [] });
      }

      if (url.includes("/usages?")) {
        return response({ items: [], nextToken: "", total: 0 });
      }

      return Response.json(
        { data: null, error: "Unexpected URL", success: false },
        { status: 404 },
      );
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
}

function response(data: unknown): Response {
  return Response.json({ data, success: true });
}
