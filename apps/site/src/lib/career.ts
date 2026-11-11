// Date maths for the /career page (content/career.yml). Months only, because that's all
// LinkedIn records. Durations count both the start and the end month, matching how LinkedIn
// shows them (Nov 2021 – Jun 2023 is "1 yr 8 mos").
import type { CollectionEntry } from "astro:content";

export type CareerEmployer = CollectionEntry<"career">["data"]["employers"][number];
export type CareerRole = CareerEmployer["roles"][number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toIndex(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return year! * 12 + (m! - 1);
}

/** The current month as "YYYY-MM", for open-ended roles. */
export function currentMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Months from start to end, both included. */
export function monthsBetween(start: string, end: string): number {
  return toIndex(end) - toIndex(start) + 1;
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTHS[m! - 1]} ${year}`;
}

export function formatRange(start: string, end?: string): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : "now"}`;
}

/** "5 yrs 1 mo"-style length, inclusive of both months. */
export function formatDuration(start: string, end: string): string {
  const total = monthsBetween(start, end);
  const years = Math.floor(total / 12);
  const months = total % 12;
  const parts = [];
  if (years) parts.push(`${years} ${years === 1 ? "yr" : "yrs"}`);
  if (months) parts.push(`${months} ${months === 1 ? "mo" : "mos"}`);
  return parts.join(" ");
}

/** First start and last end across an employer's roles; end is undefined while any role is
 *  current. */
export function employerSpan(employer: CareerEmployer): { start: string; end?: string } {
  const starts = employer.roles.map((r) => r.start).sort();
  const current = employer.roles.some((r) => !r.end);
  const ends = employer.roles.flatMap((r) => (r.end ? [r.end] : [])).sort();
  return { start: starts[0]!, end: current ? undefined : ends.at(-1) };
}
