import type {
  BillingTypeUsage,
  CollectedAccountData,
  DailyUsage,
  ModelUsage,
  NormalizedUsage,
  UsageDataset,
  UsageSlice,
} from "./types";

const MICRO_USD = 1_000_000;

export function buildDataset(collected: CollectedAccountData): UsageDataset {
  const usages = collected.usages
    .map(normalizeUsage)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const daily = buildDaily(usages);
  const models = buildModels(usages);
  const billingTypes = buildBillingTypes(usages);
  const totals = sumUsages(usages);
  const clinePassRequests = usages.filter((usage) => usage.billingType === "cline-pass").length;
  const usageBillingRequests = usages.length - clinePassRequests;

  return {
    schemaVersion: 1,
    generatedAt: collected.generatedAt,
    history: collected.history,
    account: collected.profile,
    balance: {
      ...collected.balance,
      balanceUsd: fromMicroUsd(collected.balance.balance),
    },
    plan: collected.plan,
    usageLimits: collected.usageLimits,
    summary: {
      ...totals,
      clinePassRequests,
      usageBillingRequests,
      activeDays: daily.length,
      averageTokensPerRequest: usages.length > 0 ? totals.totalTokens / usages.length : 0,
      averageReferenceCostUsd: usages.length > 0 ? totals.referenceCostUsd / usages.length : 0,
      cacheSharePercent:
        totals.promptTokens > 0 ? (totals.cachedTokens / totals.promptTokens) * 100 : 0,
    },
    daily,
    models,
    billingTypes,
    serverDaily: collected.serverDaily,
    usages,
  };
}

function normalizeUsage(item: CollectedAccountData["usages"][number]): NormalizedUsage {
  const promptTokens = finiteNumberOrZero(item.promptTokens);
  const completionTokens = finiteNumberOrZero(item.completionTokens);
  const cachedTokens = finiteNumberOrZero(item.cachedTokens);
  const totalTokens =
    typeof item.totalTokens === "number" && Number.isFinite(item.totalTokens)
      ? item.totalTokens
      : promptTokens + completionTokens;
  const metadata =
    item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
      ? item.metadata
      : {};

  return {
    id: item.id,
    userId: item.userId,
    createdAt: item.createdAt,
    date: item.createdAt.slice(0, 10),
    operation: item.operation,
    billingType: item.aiModelTypeName === "cline-pass" ? "cline-pass" : "cline-usage",
    rawModelTypeName: item.aiModelTypeName,
    provider: item.aiInferenceProviderName ?? "unknown",
    model: item.aiModelName,
    rawModel: typeof metadata.raw_model === "string" ? metadata.raw_model : item.aiModelName,
    promptTokens,
    completionTokens,
    cachedTokens,
    totalTokens,
    creditsUsedRaw: finiteNumberOrZero(item.creditsUsed),
    creditsUsedUsd: fromMicroUsd(finiteNumberOrZero(item.creditsUsed)),
    referenceCostRaw: finiteNumberOrZero(item.costUsd),
    referenceCostUsd: fromMicroUsd(finiteNumberOrZero(item.costUsd)),
    generationId: item.generationId ?? "",
    metadata,
  };
}

function buildDaily(usages: NormalizedUsage[]): DailyUsage[] {
  const grouped = new Map<string, NormalizedUsage[]>();

  for (const usage of usages) {
    const rows = grouped.get(usage.date) ?? [];
    rows.push(usage);
    grouped.set(usage.date, rows);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => ({ date, ...sumUsages(rows) }));
}

function buildModels(usages: NormalizedUsage[]): ModelUsage[] {
  const grouped = new Map<string, NormalizedUsage[]>();

  for (const usage of usages) {
    const rows = grouped.get(usage.model) ?? [];
    rows.push(usage);
    grouped.set(usage.model, rows);
  }

  return [...grouped.entries()]
    .map(([model, rows]) => ({
      model,
      rawModel: rows[0]?.rawModel ?? model,
      billingTypes: [...new Set(rows.map((row) => row.billingType))].sort(),
      ...sumUsages(rows),
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model));
}

function buildBillingTypes(usages: NormalizedUsage[]): BillingTypeUsage[] {
  return (["cline-pass", "cline-usage"] as const).map((type) => {
    const total = sumUsages(usages.filter((usage) => usage.billingType === type));

    return {
      type,
      requests: total.requests,
      totalTokens: total.totalTokens,
      referenceCostRaw: total.referenceCostRaw,
      referenceCostUsd: total.referenceCostUsd,
      creditsUsedRaw: total.creditsUsedRaw,
      creditsUsedUsd: total.creditsUsedUsd,
    };
  });
}

function sumUsages(usages: NormalizedUsage[]): UsageSlice {
  const raw = usages.reduce(
    (sum, usage) => ({
      requests: sum.requests + 1,
      promptTokens: sum.promptTokens + usage.promptTokens,
      completionTokens: sum.completionTokens + usage.completionTokens,
      cachedTokens: sum.cachedTokens + usage.cachedTokens,
      totalTokens: sum.totalTokens + usage.totalTokens,
      referenceCostRaw: sum.referenceCostRaw + usage.referenceCostRaw,
      creditsUsedRaw: sum.creditsUsedRaw + usage.creditsUsedRaw,
    }),
    {
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
      referenceCostRaw: 0,
      creditsUsedRaw: 0,
    },
  );

  return {
    ...raw,
    referenceCostUsd: fromMicroUsd(raw.referenceCostRaw),
    creditsUsedUsd: fromMicroUsd(raw.creditsUsedRaw),
  };
}

function fromMicroUsd(value: number): number {
  return value / MICRO_USD;
}

function finiteNumberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
