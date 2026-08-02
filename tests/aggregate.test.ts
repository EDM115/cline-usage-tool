import { describe, expect, test } from "bun:test";

import { buildDataset } from "../src/aggregate";
import type { CollectedAccountData } from "../src/types";

describe("buildDataset", () => {
  test("separates ClinePass reference cost from usage-billing credit consumption", () => {
    const dataset = buildDataset(fixture());

    expect(dataset.summary).toMatchObject({
      requests: 3,
      promptTokens: 300,
      completionTokens: 150,
      cachedTokens: 60,
      totalTokens: 450,
      referenceCostRaw: 800000,
      referenceCostUsd: 0.8,
      creditsUsedRaw: 125000,
      creditsUsedUsd: 0.125,
      clinePassRequests: 2,
      usageBillingRequests: 1,
    });
    expect(dataset.billingTypes).toEqual([
      {
        type: "cline-pass",
        requests: 2,
        totalTokens: 300,
        referenceCostRaw: 500000,
        referenceCostUsd: 0.5,
        creditsUsedRaw: 0,
        creditsUsedUsd: 0,
      },
      {
        type: "cline-usage",
        requests: 1,
        totalTokens: 150,
        referenceCostRaw: 300000,
        referenceCostUsd: 0.3,
        creditsUsedRaw: 125000,
        creditsUsedUsd: 0.125,
      },
    ]);
  });

  test("builds exact daily and model slices from detailed usage", () => {
    const dataset = buildDataset(fixture());

    expect(dataset.daily).toEqual([
      {
        date: "2026-08-01",
        requests: 2,
        promptTokens: 200,
        completionTokens: 100,
        cachedTokens: 30,
        totalTokens: 300,
        referenceCostRaw: 500000,
        referenceCostUsd: 0.5,
        creditsUsedRaw: 0,
        creditsUsedUsd: 0,
      },
      {
        date: "2026-08-02",
        requests: 1,
        promptTokens: 100,
        completionTokens: 50,
        cachedTokens: 30,
        totalTokens: 150,
        referenceCostRaw: 300000,
        referenceCostUsd: 0.3,
        creditsUsedRaw: 125000,
        creditsUsedUsd: 0.125,
      },
    ]);
    expect(
      dataset.models.map((model) => ({
        model: model.model,
        requests: model.requests,
        totalTokens: model.totalTokens,
      })),
    ).toEqual([
      { model: "cline-pass/kimi-k3", requests: 2, totalTokens: 300 },
      { model: "anthropic/claude-sonnet", requests: 1, totalTokens: 150 },
    ]);
  });

  test("keeps raw API values while excluding the API key from serialized output", () => {
    const serialized = JSON.stringify(buildDataset(fixture()));

    expect(serialized).toContain('"balance":500000');
    expect(serialized).toContain('"raw_model":"moonshotai/kimi-k3"');
    expect(serialized).not.toContain("secret-key");
  });

  test("normalizes omitted cache, total-token, and metadata fields from older API records", () => {
    const collected = fixture();
    const legacyUsage = collected.usages[0]!;
    delete legacyUsage.cachedTokens;
    delete legacyUsage.totalTokens;
    delete legacyUsage.metadata;

    const dataset = buildDataset(collected);

    expect(dataset.usages[0]).toMatchObject({
      cachedTokens: 0,
      totalTokens: 150,
      rawModel: "cline-pass/kimi-k3",
      metadata: {},
    });
    expect(dataset.summary.cachedTokens).toBe(50);
    expect(dataset.summary.totalTokens).toBe(450);
    expect(JSON.stringify(dataset)).not.toContain('"cachedTokens":null');
    expect(JSON.stringify(dataset)).not.toContain('"totalTokens":null');
  });
});

function fixture(): CollectedAccountData {
  return {
    generatedAt: "2026-08-02T12:00:00.000Z",
    history: {
      from: "2026-07-31",
      to: "2026-08-02",
      dailyWindows: [{ startDate: "2026-07-31", endDate: "2026-08-02" }],
      detailedPages: 1,
    },
    profile: {
      id: "usr-example",
      email: "example@example.com",
      displayName: "Example",
      termsAcceptedAt: "2026-07-31T11:24:07Z",
      clineBenchConsent: true,
      organizations: [],
      createdAt: "2026-07-31T11:24:01Z",
      updatedAt: "2026-08-01T16:00:25Z",
    },
    balance: {
      userId: "usr-example",
      balance: 500000,
    },
    plan: null,
    usageLimits: null,
    serverDaily: [],
    usages: [
      usage("usg-1", "2026-08-01T10:00:00Z", "cline-pass", "cline-pass/kimi-k3", 250000, 0, 10),
      usage("usg-2", "2026-08-01T11:00:00Z", "cline-pass", "cline-pass/kimi-k3", 250000, 0, 20),
      usage(
        "usg-3",
        "2026-08-02T12:00:00Z",
        "cline",
        "anthropic/claude-sonnet",
        300000,
        125000,
        30,
      ),
    ],
  };
}

function usage(
  id: string,
  createdAt: string,
  modelType: string,
  model: string,
  costUsd: number,
  creditsUsed: number,
  cachedTokens: number,
) {
  return {
    id,
    userId: "usr-example",
    createdAt,
    creditsUsed,
    costUsd,
    operation: "chat_completion",
    aiInferenceProviderName: "vercel",
    aiModelTypeName: modelType,
    aiModelName: model,
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    cachedTokens,
    generationId: `gen-${id}`,
    metadata: {
      model_id: "amdl-example",
      model_type: modelType,
      model_type_id: "amt-example",
      provider_id: "aip-example",
      raw_model: model === "cline-pass/kimi-k3" ? "moonshotai/kimi-k3" : model,
    },
  };
}
