import type { WriteResult } from "./export";

import { resolve } from "node:path";

import { buildDataset } from "./aggregate";
import { ClineApi } from "./api";
import { collectAccountData } from "./collect";
import { writeOutputs } from "./export";

export type CliOptions = {
  apiKey: string | null;
  userId: string | null;
  outDir: string;
  help: boolean;
};

export async function runCli(
  _args: string[],
  _environment: Record<string, string | undefined>,
  _runtime: { api?: ClineApi; now?: Date; includePng?: boolean; log?: (line: string) => void } = {},
): Promise<WriteResult | null> {
  const options = parseArgs(_args, _environment);
  const log = _runtime.log ?? console.log;

  if (options.help) {
    log(helpText());

    return null;
  }

  const api = _runtime.api ?? new ClineApi({ apiKey: options.apiKey! });
  log(`Collecting all Cline history for ${options.userId}`);
  const collected = await collectAccountData(api, options.userId!, _runtime.now);
  log(
    `Collected ${collected.usages.length} detailed requests across ${collected.history.dailyWindows.length} daily API windows`,
  );
  const dataset = buildDataset(collected);
  const outDir = resolve(options.outDir);
  const result = await writeOutputs(dataset, outDir, { includePng: _runtime.includePng ?? true });
  log(`Generated ${result.files.length} files in ${outDir}`);
  log(
    `Total tokens : ${new Intl.NumberFormat().format(dataset.summary.totalTokens)} · reference cost : ${money(dataset.summary.referenceCostUsd)} · credits consumed : ${money(dataset.summary.creditsUsedUsd)}`,
  );

  for (const warning of result.warnings) {
    log(`Warning : ${warning}`);
  }

  return result;
}

export function parseArgs(_args: string[], _environment: Record<string, string | undefined>): CliOptions {
  const options: CliOptions = {
    apiKey: null,
    userId: null,
    outDir: "outputs/cline-usage",
    help: false,
  };

  for (let index = 0; index < _args.length; index += 1) {
    const argument = _args[index]!;

    if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--out") {
      const value = _args[++index];

      if (!value) {
        throw new Error("--out requires a directory");
      }

      options.outDir = value;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option ${argument}`);
    } else if (options.userId) {
      throw new Error(`Unexpected argument ${argument}`);
    } else {
      options.userId = argument;
    }
  }

  options.apiKey = _environment.CLINE_API_KEY ?? null;

  if (!options.help && !options.apiKey) {
    throw new Error("CLINE_API_KEY is required");
  }

  if (!options.userId) {
    options.userId = _environment.CLINE_USER_ID ?? null;
  }

  if (!options.help && (!options.userId || !/^usr-[A-Za-z0-9]+$/.test(options.userId))) {
    throw new Error("Expected a Cline user ID beginning with usr-");
  }

  return options;
}

function helpText(): string {
  return `Cline usage tool

Usage:
  bun usage <user-id> [--out <directory>]

Arguments:
  <user-id>          Cline account ID such as usr-01EXAMPLE

Options:
  --out <directory>  Output directory (default: outputs/cline-usage)
  --help, -h         Show this help

Environment:
  CLINE_API_KEY      Required Cline API key or account token
  CLINE_USER_ID      Optional Cline user ID (can be provided as argument instead)

The command fetches all account history and generates HTML, JSON, CSV, SVG and PNG files`;
}

function money(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

if (import.meta.main) {
  runCli(process.argv.slice(2), process.env).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
