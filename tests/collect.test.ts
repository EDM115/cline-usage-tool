import { describe, expect, test } from "bun:test";

import { ClineApi } from "../src/api";
import { collectAccountData } from "../src/collect";

describe("collectAccountData", () => {
  test("collects all history using inclusive 31-day daily windows", async () => {
    const requestedUrls: string[] = [];
    const fetcher = fakeFetch(requestedUrls);
    const api = new ClineApi({ apiKey: "secret-key", fetcher });

    const collected = await collectAccountData(
      api,
      "usr-example",
      new Date("2026-10-01T12:00:00Z"),
    );

    expect(collected.history).toEqual({
      from: "2026-07-31",
      to: "2026-10-01",
      dailyWindows: [
        { startDate: "2026-07-31", endDate: "2026-08-30" },
        { startDate: "2026-08-31", endDate: "2026-09-30" },
        { startDate: "2026-10-01", endDate: "2026-10-01" },
      ],
      detailedPages: 1,
    });
    expect(collected.serverDaily).toHaveLength(3);
    expect(requestedUrls.filter((url) => url.includes("/usages/daily?"))).toEqual([
      "https://api.cline.bot/api/v1/users/usr-example/usages/daily?startDate=2026-07-31&endDate=2026-08-30",
      "https://api.cline.bot/api/v1/users/usr-example/usages/daily?startDate=2026-08-31&endDate=2026-09-30",
      "https://api.cline.bot/api/v1/users/usr-example/usages/daily?startDate=2026-10-01&endDate=2026-10-01",
    ]);
    expect(requestedUrls.some((url) => url.endsWith("/api/v1/users/usr-example/balance"))).toBe(
      true,
    );
    expect(requestedUrls.some((url) => url.endsWith("/api/v1/users/me/plan"))).toBe(true);
    expect(requestedUrls.some((url) => url.endsWith("/api/v1/users/me/plan/usage-limits"))).toBe(
      true,
    );
  });

  test("rejects a requested user ID that does not match the authenticated account", async () => {
    const requestedUrls: string[] = [];
    const api = new ClineApi({ apiKey: "secret-key", fetcher: fakeFetch(requestedUrls) });

    await expect(
      collectAccountData(api, "usr-different", new Date("2026-08-02T12:00:00Z")),
    ).rejects.toThrow("does not match authenticated account usr-example");
    expect(requestedUrls).toEqual(["https://api.cline.bot/api/v1/users/me"]);
  });
});

function fakeFetch(requestedUrls: string[]): typeof fetch {
  return Object.assign(
    async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.endsWith("/api/v1/users/me")) {
        return envelope({
          id: "usr-example",
          email: "example@example.com",
          displayName: "Example",
          organizations: [],
          createdAt: "2026-07-31T11:24:01Z",
          updatedAt: "2026-08-01T16:00:25Z",
        });
      }

      if (url.endsWith("/balance")) {
        return envelope({ userId: "usr-example", balance: 500000 });
      }

      if (url.endsWith("/users/me/plan")) {
        return envelope({
          planHistoryId: "iph-example",
          userId: "usr-example",
          plan: {
            id: "pln-example",
            name: "Cline Pass (Monthly)[Internal]",
            displayName: "Cline Pass (Monthly)",
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
        return envelope({ limits: [{ type: "five_hour", percentUsed: 12.5 }] });
      }

      if (url.includes("/usages/daily?")) {
        const parsed = new URL(url);

        return envelope({
          items: [
            {
              date: parsed.searchParams.get("startDate"),
              operation: "chat_completion",
              aiModelTypeName: "cline-pass",
              aiModelName: "cline-pass/kimi-k3",
              costUsd: 250000,
              promptTokens: 100,
              completionTokens: 50,
            },
          ],
        });
      }

      if (url.includes("/usages?")) {
        return envelope({ items: [], nextToken: "", total: 0 });
      }

      return Response.json(
        { success: false, error: `Unexpected URL ${url}`, data: null },
        { status: 404 },
      );
    },
    { preconnect: fetch.preconnect },
  ) as typeof fetch;
}

function envelope(data: unknown): Response {
  return Response.json({ data, success: true });
}
