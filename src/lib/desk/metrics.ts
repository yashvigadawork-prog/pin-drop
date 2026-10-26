import type { Row } from "./model";
import { countBy } from "./model";
import type { Desk } from "./types";

// Numbers for the Overview page. Counts are always live. Time-based numbers are live where
// we have real timestamps; for the bundled sample file they fall back to labelled sample history.

export interface StageTime {
  name: string;
  avg: number | null; // days this week
  prev: number | null; // days last week
  target: number;
  note: string;
}

const SAMPLE: [string, number, number, number, string][] = [
  ["Application → decision", 0.4, 0.6, 1.0, "The engine reads and ranks the file"],
  ["Decision → email sent", 1.2, 2.1, 1.0, "How fast you act on a decision"],
  ["Email → documents in", 6.5, 5.3, 5.0, "Partner sends PAN, KYC and proof of funds"],
  ["Documents → checks clear", 3.1, 3.4, 4.0, "Background, funds and conflicts"],
  ["Checks → agreement", 4.2, 4.0, 5.0, "Site audit, validation call and signing"],
];
const LIVE_LABELS: [string, number, string][] = [
  ["Application → decision", 1.0, "The engine reads and ranks the file"],
  ["Decision → email sent", 1.0, "How fast you act on a decision"],
  ["Email → documents in", 5.0, "Partner sends PAN, KYC and proof of funds"],
  ["Documents → checks clear", 4.0, "Background, funds and conflicts"],
  ["Checks → agreement", 5.0, "Site audit, validation call and signing"],
];

export function stageTimes(desk: Desk, now: number): StageTime[] {
  if (desk.sample) return SAMPLE.map(([name, avg, prev, target, note]) => ({ name, avg, prev, target, note }));
  const up = desk.uploadedAt ? Date.parse(desk.uploadedAt) : NaN;
  const sent = Object.entries(desk.mail).filter(([k, m]) => !k.includes(":") && (m.type === "next" || m.type === "offer"));
  const days = sent.map(([, m]) => (Date.parse(m.at) - up) / 86400000).filter((d) => isFinite(d) && d >= 0);
  const decToMail = days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : null;
  void now;
  return LIVE_LABELS.map(([name, target, note], i) => ({ name, avg: i === 0 ? 0 : i === 1 ? decToMail : null, prev: null, target, note }));
}

export const SAMPLE_TREND = [38, 34, 31, 27];

export type ReasonKey = "capital" | "space" | "pin" | "slot" | "area";
export const REASON_META: Record<ReasonKey, [string, string]> = {
  capital: ["wallet", "Capital short or unproven"],
  space: ["build", "Space too small, upper floor or size missing"],
  pin: ["pin", "Pin typo, mismatch or duplicate"],
  slot: ["layers", "Qualified but no free slot"],
  area: ["globe", "Pin outside our areas"],
};
const CAP = new Set(["CAPITAL_SHORT", "FINANCING_PROBABLE", "INVESTMENT_MISSING"]);
const SPACE = new Set(["SPACE_TOO_SMALL", "FLOOR_UPPER", "SIZE_MISSING", "FLOOR_CONTRADICTION", "SPACE_MISSING"]);
const PIN = new Set(["PIN_INVALID", "PIN_CITY_MISMATCH", "DUPLICATE_SUBMISSION", "CITY_MISSING"]);

export function reasonCounts(rows: Row[]): Record<ReasonKey, number> {
  const o: Record<ReasonKey, number> = { capital: 0, space: 0, pin: 0, slot: 0, area: 0 };
  for (const r of rows) {
    if (r.ui === "adv" || r.ui === "redir" || r.withdrawn || (r.moved && r.moved !== "exp")) continue;
    if (r.ui === "exp") o.area++;
    else {
      const codes = r.d.issues.filter((i) => i.severity === "block").map((i) => i.code);
      if (codes.some((c) => CAP.has(c))) o.capital++;
      else if (codes.some((c) => SPACE.has(c))) o.space++;
      else if (codes.some((c) => PIN.has(c))) o.pin++;
      else if (r.ui === "wait") o.slot++;
    }
  }
  return o;
}

export function funnel(rows: Row[], desk: Desk): [string, number][] {
  const c = countBy(rows);
  const onb = Object.values(desk.onb);
  const ge = (n: number) => onb.filter((o) => o.stage >= n).length;
  return [
    ["Applications in", rows.length],
    ["Decided", rows.length],
    ["Accepted", c.adv + c.redir],
    ["Emailed, in onboarding", onb.length],
    ["Documents in", ge(2)],
    ["Checks clear", ge(3)],
    ["Site and call done", ge(5)],
    ["Agreement signed", ge(6)],
    ["Store open", ge(10)],
  ];
}

export function summaryLines(rows: Row[], desk: Desk, expCount: number, expAreas: number, times: StageTime[]): string[] {
  const c = countBy(rows);
  const worst = times.filter((t) => t.avg !== null).sort((a, b) => b.avg! - b.target - (a.avg! - a.target))[0];
  const lines = [
    `Applications: ${rows.length}`,
    `Accepted: ${c.adv + c.redir} · Pending: ${c.info + c.wait} · Not accepted, kept: ${c.no + c.exp}`,
    `In onboarding: ${Object.keys(desk.onb).length} partners`,
    `Expansion list: ${expCount} people across ${expAreas} areas`,
  ];
  if (worst && worst.avg! > worst.target) lines.push(`Biggest bottleneck: ${worst.name}, ${worst.avg} days against a ${worst.target}-day target`);
  return lines;
}
