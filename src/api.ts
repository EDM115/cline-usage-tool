import type {
  ApiEnvelope,
  DailyUsageItem,
  DailyUsages,
  PaginatedUsages,
  UsageItem,
  UsageLimits,
  UserBalance,
  UserPlan,
  UserProfile,
} from "./types";

export class ClineApi {
  readonly #apiKey: string;
  readonly #fetcher: typeof fetch;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #retryBaseDelayMs: number;

  constructor(options: {
    apiKey: string;
    fetcher?: typeof fetch;
    baseUrl?: string;
    timeoutMs?: number;
    maxRetries?: number;
    retryBaseDelayMs?: number;
  }) {
    this.#apiKey = options.apiKey;
    this.#fetcher = options.fetcher ?? fetch;
    this.#baseUrl = (options.baseUrl ?? "https://api.cline.bot").replace(/\/$/, "");
    this.#timeoutMs = Math.max(1, options.timeoutMs ?? 30_000);
    this.#maxRetries = Math.max(0, Math.trunc(options.maxRetries ?? 2));
    this.#retryBaseDelayMs = Math.max(0, options.retryBaseDelayMs ?? 500);
  }

  async getProfile(): Promise<UserProfile> {
    return this.#request<UserProfile>("/api/v1/users/me");
  }

  async getBalance(userId: string): Promise<UserBalance> {
    return this.#request<UserBalance>(`/api/v1/users/${encodeURIComponent(userId)}/balance`);
  }

  async getPlan(): Promise<UserPlan | null> {
    return this.#request<UserPlan>("/api/v1/users/me/plan", undefined, true);
  }

  async getUsageLimits(): Promise<UsageLimits | null> {
    return this.#request<UsageLimits>("/api/v1/users/me/plan/usage-limits", undefined, true);
  }

  async getAllUsages(userId: string): Promise<{ items: UsageItem[]; pages: number }> {
    const items: UsageItem[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;

    do {
      const query = new URLSearchParams({ limit: "1000" });

      if (cursor) {
        query.set("cursor", cursor);
      }

      const page = await this.#request<PaginatedUsages>(
        `/api/v1/users/${encodeURIComponent(userId)}/usages`,
        query,
      );
      items.push(...page.items);
      pages += 1;
      cursor = page.nextToken || null;

      if (cursor && seenCursors.has(cursor)) {
        throw new Error("Cline API returned a repeated pagination cursor");
      }

      if (cursor) {
        seenCursors.add(cursor);
      }
    } while (cursor);

    return { items, pages };
  }

  async getDailyUsages(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyUsageItem[]> {
    const query = new URLSearchParams({ startDate, endDate });
    const result = await this.#request<DailyUsages>(
      `/api/v1/users/${encodeURIComponent(userId)}/usages/daily`,
      query,
    );

    return result.items;
  }

  async #request<T>(
    path: string,
    query: URLSearchParams | undefined,
    allowNull: true,
  ): Promise<T | null>;
  async #request<T>(path: string, query?: URLSearchParams, allowNull?: false): Promise<T>;
  async #request<T>(path: string, query?: URLSearchParams, allowNull = false): Promise<T | null> {
    const url = `${this.#baseUrl}${path}${query ? `?${query.toString()}` : ""}`;
    for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
      try {
        const response = await this.#fetcher(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.#apiKey}`,
          },
          signal: AbortSignal.timeout(this.#timeoutMs),
        });

        if (isRetryableStatus(response.status) && attempt < this.#maxRetries) {
          await response.body?.cancel();
          await retryDelay(this.#retryBaseDelayMs, attempt);
          continue;
        }

        let envelope: ApiEnvelope<T>;

        try {
          envelope = (await response.json()) as ApiEnvelope<T>;
        } catch {
          throw new Error(`Cline API request failed with HTTP ${response.status}`);
        }

        if (!response.ok || !envelope.success) {
          throw new Error(
            envelope.error || `Cline API request failed with HTTP ${response.status}`,
          );
        }

        if (envelope.data === null) {
          if (allowNull) {
            return null;
          }

          throw new Error(
            envelope.error || `Cline API request failed with HTTP ${response.status}`,
          );
        }

        return envelope.data;
      } catch (error) {
        if (attempt < this.#maxRetries && isRetryableFetchError(error)) {
          await retryDelay(this.#retryBaseDelayMs, attempt);
          continue;
        }

        if (
          error instanceof Error &&
          (error.name === "AbortError" || error.name === "TimeoutError")
        ) {
          throw new Error(`Cline API request timed out after ${this.#timeoutMs}ms`);
        }

        throw error;
      }
    }

    throw new Error("Cline API request failed after retries");
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableFetchError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
  );
}

async function retryDelay(baseDelayMs: number, attempt: number): Promise<void> {
  const delayMs = baseDelayMs * 2 ** attempt;

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
