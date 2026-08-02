export type DateWindow = {
  startDate: string;
  endDate: string;
};

export type ApiEnvelope<T> = {
  data: T | null;
  error?: string;
  success: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  termsAcceptedAt?: string;
  clineBenchConsent?: boolean;
  organizations: unknown[];
  createdAt: string;
  updatedAt: string;
};

export type UserBalance = {
  userId: string;
  balance: number;
};

export type PlanFeatureLimits = {
  last5HoursUsageCostUSDPerUser?: number;
  last7daysUsageCostUSDPerUser?: number;
  last30daysUsageCostUSDPerUser?: number;
};

export type UserPlan = {
  planHistoryId: string;
  userId: string;
  plan: {
    id: string;
    name: string;
    displayName: string;
    description: string;
    type: string;
    interval: string;
    pricePerSeatCents: number;
    priceId?: string;
    maxSeats?: number;
    features?: Record<string, unknown>;
    entitlements?: {
      cline_pass?: {
        enabled: boolean;
        inferenceCapThreshold?: PlanFeatureLimits;
      };
      [key: string]: unknown;
    };
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  subscriptionId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

export type UsageLimit = {
  type: "five_hour" | "weekly" | "monthly" | string;
  percentUsed: number;
  resetsAt?: string;
};

export type UsageLimits = {
  limits: UsageLimit[];
};

export type UsageMetadata = Record<string, unknown> & {
  model_id?: string;
  model_type?: string;
  model_type_id?: string;
  provider_id?: string;
  raw_model?: string;
};

export type UsageItem = {
  id: string;
  userId: string;
  createdAt: string;
  creditsUsed: number;
  costUsd: number;
  operation: string;
  aiInferenceProviderName?: string | null;
  aiModelTypeName: string;
  aiModelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  cachedTokens?: number;
  generationId?: string;
  metadata?: UsageMetadata | null;
};

export type DailyUsageItem = {
  date: string;
  operation: string;
  aiModelTypeName: string;
  aiModelName: string;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
};

export type PaginatedUsages = {
  items: UsageItem[];
  nextToken: string;
  total: number;
};

export type DailyUsages = {
  items: DailyUsageItem[];
};

export type CollectedAccountData = {
  generatedAt: string;
  history: {
    from: string;
    to: string;
    dailyWindows: DateWindow[];
    detailedPages: number;
  };
  profile: UserProfile;
  balance: UserBalance;
  plan: UserPlan | null;
  usageLimits: UsageLimits | null;
  serverDaily: DailyUsageItem[];
  usages: UsageItem[];
};

export type NormalizedUsage = {
  id: string;
  userId: string;
  createdAt: string;
  date: string;
  operation: string;
  billingType: "cline-pass" | "cline-usage";
  rawModelTypeName: string;
  provider: string;
  model: string;
  rawModel: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  creditsUsedRaw: number;
  creditsUsedUsd: number;
  referenceCostRaw: number;
  referenceCostUsd: number;
  generationId: string;
  metadata: UsageMetadata;
};

export type UsageSlice = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  referenceCostRaw: number;
  referenceCostUsd: number;
  creditsUsedRaw: number;
  creditsUsedUsd: number;
};

export type DailyUsage = UsageSlice & {
  date: string;
};

export type ModelUsage = UsageSlice & {
  model: string;
  rawModel: string;
  billingTypes: string[];
};

export type BillingTypeUsage = Pick<
  UsageSlice,
  | "requests"
  | "totalTokens"
  | "referenceCostRaw"
  | "referenceCostUsd"
  | "creditsUsedRaw"
  | "creditsUsedUsd"
> & {
  type: "cline-pass" | "cline-usage";
};

export type UsageDataset = {
  schemaVersion: 1;
  generatedAt: string;
  history: CollectedAccountData["history"];
  account: UserProfile;
  balance: UserBalance & { balanceUsd: number };
  plan: UserPlan | null;
  usageLimits: UsageLimits | null;
  summary: UsageSlice & {
    clinePassRequests: number;
    usageBillingRequests: number;
    activeDays: number;
    averageTokensPerRequest: number;
    averageReferenceCostUsd: number;
    cacheSharePercent: number;
  };
  daily: DailyUsage[];
  models: ModelUsage[];
  billingTypes: BillingTypeUsage[];
  serverDaily: DailyUsageItem[];
  usages: NormalizedUsage[];
};
