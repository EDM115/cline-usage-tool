import type { DateWindow } from "./types";

export function splitDateRange(_startDate: string, _endDate: string): DateWindow[] {
  const start = parseDate(_startDate);
  const end = parseDate(_endDate);

  if (start.getTime() > end.getTime()) {
    throw new Error("Start date must not be after end date");
  }

  const windows: DateWindow[] = [];
  let cursor = start;

  while (cursor.getTime() <= end.getTime()) {
    const windowEnd = addDays(cursor, 30);
    const boundedEnd = windowEnd.getTime() < end.getTime() ? windowEnd : end;
    windows.push({ startDate: formatDate(cursor), endDate: formatDate(boundedEnd) });
    cursor = addDays(boundedEnd, 1);
  }

  return windows;
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date ${value}, expected YYYY-MM-DD`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatDate(date) !== value) {
    throw new Error(`Invalid date ${value}, expected YYYY-MM-DD`);
  }

  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
