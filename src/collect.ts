import type { ClineApi } from "./api";
import type { CollectedAccountData } from "./types";

import { splitDateRange } from "./date-windows";

export async function collectAccountData(
  api: ClineApi,
  userId: string,
  now = new Date(),
): Promise<CollectedAccountData> {
  const profile = await api.getProfile();

  if (profile.id !== userId) {
    throw new Error(`Requested user ${userId} does not match authenticated account ${profile.id}`);
  }

  const from = profile.createdAt.slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const dailyWindows = splitDateRange(from, to);
  const [balance, plan, usageLimits, detailed] = await Promise.all([
    api.getBalance(userId),
    api.getPlan(),
    api.getUsageLimits(),
    api.getAllUsages(userId),
  ]);
  const serverDaily = [];

  for (const window of dailyWindows) {
    serverDaily.push(...(await api.getDailyUsages(userId, window.startDate, window.endDate)));
  }

  return {
    generatedAt: now.toISOString(),
    history: {
      from,
      to,
      dailyWindows,
      detailedPages: detailed.pages,
    },
    profile,
    balance,
    plan,
    usageLimits,
    serverDaily,
    usages: detailed.items,
  };
}
