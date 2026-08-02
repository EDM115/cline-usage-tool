# Cline usage tool

Generate a polished, self-contained report for one Cline account from the authenticated Cline API. The command collects the account's complete history, preserves the raw API units alongside normalized dollar values, and writes HTML, JSON, CSV, SVG, and PNG artifacts.

## Requirements

- Bun 1.3 or newer
- A Cline API key from [app.cline.bot](https://app.cline.bot) → Settings → API Keys
- Your Cline user ID, such as `usr-01EXAMPLE`

## Install

```pwsh
bun install --frozen-lockfile
```

## Run

```pwsh
$env:CLINE_API_KEY = "your-api-key"
bun usage usr-01EXAMPLE
```

Choose another output directory when needed:

```pwsh
bun usage usr-01EXAMPLE --out .\reports\cline
```

The API key is read only from `CLINE_API_KEY`. It is sent in the `Authorization: Bearer …` request header and is never written to an artifact or printed by the CLI.

## What it fetches

- `/api/v1/users/me` for the authenticated profile and account creation date
- `/api/v1/users/{id}/balance` for the current credit balance
- `/api/v1/users/me/plan` for the current ClinePass subscription
- `/api/v1/users/me/plan/usage-limits` for five-hour, weekly, and monthly utilization
- `/api/v1/users/{id}/usages` for cursor-paginated detailed request history
- `/api/v1/users/{id}/usages/daily` for server-generated daily/model totals
  The requested user ID must match `/users/me.id`. All history is collected from the account creation date through the current UTC date. Because the daily endpoint rejects ranges above 31 days, the CLI splits that history into consecutive inclusive windows of at most 31 days. Detailed-history pagination follows each response's `nextToken` by sending it back as the next request's `cursor`. Requests time out after 30 seconds and retry transient network, rate-limit, and server failures twice with bounded exponential backoff. A successful empty plan or usage-limit response is preserved as `null`, so accounts without an active ClinePass can still be reported.

## Output files

```text
cline-usage-report.html    Interactive offline report
cline-usage.json           Complete normalized dataset and API snapshots
cline-usage.csv            One row per detailed usage request
chart-daily-tokens.svg     Daily token trend
chart-daily-cost.svg       Daily reference-cost trend
chart-model-tokens.svg     Token usage by model
chart-billing-type.svg     ClinePass versus usage-billing tokens
chart-*.png                PNG copy of each standalone SVG chart
```

The HTML embeds its data, CSS, and JavaScript and does not load third-party assets. Its date, billing-type, model, and metric controls re-aggregate the exact detailed request rows in the browser.

## Understanding the money fields

ClinePass and ordinary Cline usage-billing are separate:

- `referenceCostUsd` is normalized from the API's integer `costUsd` field. It represents underlying/reference inference cost and can be nonzero for ClinePass requests.
- `creditsUsedUsd` is normalized from `creditsUsed`. It represents actual pay-as-you-go credits consumed and is normally zero for ClinePass requests.
- `balanceUsd` is normalized from the account's integer `balance` field.
  The dashboard displays a raw balance of `500000` as `$0.5000`, so the report treats these integer money fields as millionths of a US dollar. Every raw integer is retained in JSON and CSV so this inference remains auditable if the API changes.

## Development

```pwsh
bun test
bun run typecheck
```

Tests cover 31-day range boundaries, cursor pagination, null plan snapshots, transient retries, structured API errors, account-ID validation, legacy optional usage fields, unit normalization, aggregation, spreadsheet-safe CSV escaping, embedded-report safety, SVG/PNG rendering, and the complete CLI-to-output flow.

## API status

The user profile, balance, and detailed usage endpoints are listed in Cline's [Enterprise API reference](https://docs.cline.bot/enterprise-solutions/api-reference). The daily usage and plan-limit endpoints are used by the current Cline dashboard but are not fully described in the public reference, so their typed response shapes are intentionally kept narrow and raw values remain available in the generated JSON.
