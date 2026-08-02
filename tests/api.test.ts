import { describe, expect, test } from "bun:test";

import { ClineApi } from "../src/api";

describe("ClineApi", () => {
  test("paginates detailed usage by sending nextToken back as cursor", async () => {
    const requestedUrls: string[] = [];
    const fetcher: typeof fetch = Object.assign(
      async (input: string | URL | Request) => {
        const url = String(input);
        requestedUrls.push(url);

        if (requestedUrls.length === 1) {
          return Response.json({
            data: {
              items: [usageItem("usg-1", "2026-08-01T10:00:00Z")],
              nextToken: "cursor/with spaces",
              total: 2,
            },
            success: true,
          });
        }

        return Response.json({
          data: {
            items: [usageItem("usg-2", "2026-08-01T11:00:00Z")],
            nextToken: "",
            total: 2,
          },
          success: true,
        });
      },
      { preconnect: fetch.preconnect },
    ) as typeof fetch;
    const api = new ClineApi({ apiKey: "secret-key", fetcher });

    const result = await api.getAllUsages("usr-example");

    expect(result.items.map((item) => item.id)).toEqual(["usg-1", "usg-2"]);
    expect(result.pages).toBe(2);
    expect(requestedUrls).toEqual([
      "https://api.cline.bot/api/v1/users/usr-example/usages?limit=1000",
      "https://api.cline.bot/api/v1/users/usr-example/usages?limit=1000&cursor=cursor%2Fwith+spaces",
    ]);
  });

  test("stops instead of looping when the server repeats a cursor", async () => {
    const fetcher: typeof fetch = Object.assign(
      async () =>
        Response.json({
          data: {
            items: [usageItem("usg-1", "2026-08-01T10:00:00Z")],
            nextToken: "same-cursor",
            total: 1,
          },
          success: true,
        }),
      { preconnect: fetch.preconnect },
    ) as typeof fetch;
    const api = new ClineApi({ apiKey: "secret-key", fetcher });

    await expect(api.getAllUsages("usr-example")).rejects.toThrow("repeated pagination cursor");
  });

  test("reports structured API errors without including the bearer token", async () => {
    const fetcher: typeof fetch = Object.assign(
      async () =>
        Response.json(
          {
            data: null,
            error: "Date range must not exceed 31 days",
            success: false,
          },
          { status: 400 },
        ),
      { preconnect: fetch.preconnect },
    ) as typeof fetch;
    const api = new ClineApi({ apiKey: "do-not-leak", fetcher });

    try {
      await api.getDailyUsages("usr-example", "2026-01-01", "2026-02-01");
      throw new Error("Expected getDailyUsages to fail");
    } catch (error) {
      expect(String(error)).toContain("Date range must not exceed 31 days");
      expect(String(error)).not.toContain("do-not-leak");
    }
  });

  test("treats a successful empty plan and usage-limits response as unavailable", async () => {
    const fetcher: typeof fetch = Object.assign(
      async () => Response.json({ data: null, success: true }),
      { preconnect: fetch.preconnect },
    ) as typeof fetch;
    const api = new ClineApi({ apiKey: "secret-key", fetcher });

    expect(await api.getPlan()).toBeNull();
    expect(await api.getUsageLimits()).toBeNull();
  });

  test("retries transient server failures but not authentication failures", async () => {
    let transientAttempts = 0;
    const transientFetcher: typeof fetch = Object.assign(
      async () => {
        transientAttempts += 1;

        if (transientAttempts === 1) {
          return Response.json({ data: null, error: "temporary", success: false }, { status: 503 });
        }

        return Response.json({ data: { id: "usr-example" }, success: true });
      },
      { preconnect: fetch.preconnect },
    ) as typeof fetch;
    const transientApi = new ClineApi({
      apiKey: "secret-key",
      fetcher: transientFetcher,
      maxRetries: 1,
      retryBaseDelayMs: 0,
    });

    expect((await transientApi.getProfile()).id).toBe("usr-example");
    expect(transientAttempts).toBe(2);

    let authenticationAttempts = 0;
    const authenticationFetcher: typeof fetch = Object.assign(
      async () => {
        authenticationAttempts += 1;
        return Response.json(
          { data: null, error: "Unauthorized", success: false },
          { status: 401 },
        );
      },
      { preconnect: fetch.preconnect },
    ) as typeof fetch;
    const authenticationApi = new ClineApi({
      apiKey: "secret-key",
      fetcher: authenticationFetcher,
      maxRetries: 2,
      retryBaseDelayMs: 0,
    });

    await expect(authenticationApi.getProfile()).rejects.toThrow("Unauthorized");
    expect(authenticationAttempts).toBe(1);
  });
});

function usageItem(id: string, createdAt: string) {
  return {
    id,
    userId: "usr-example",
    createdAt,
    creditsUsed: 0,
    costUsd: 250000,
    operation: "chat_completion",
    aiInferenceProviderName: "vercel",
    aiModelTypeName: "cline-pass",
    aiModelName: "cline-pass/kimi-k3",
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    cachedTokens: 25,
    generationId: `gen-${id}`,
    metadata: {
      model_id: "amdl-example",
      model_type: "cline-pass",
      model_type_id: "amt-example",
      provider_id: "aip-example",
      raw_model: "moonshotai/kimi-k3",
    },
  };
}
