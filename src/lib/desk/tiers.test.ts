import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../engine/config";
import { runEngine } from "../engine/engine";
import { readWorkbook } from "../engine/workbook";
import { buildRows } from "./model";
import { emptyDesk } from "./types";

const today = new Date("2026-10-26T00:00:00");
const load = () => readWorkbook(readFileSync(new URL("../../../public/sample-test-data.xlsx", import.meta.url)));

describe("impossible values become questions", () => {
  const run = (patch: (a: ReturnType<typeof load>["applications"][number]) => void) => {
    const input = load();
    const a = input.applications.find((x) => x.id === "APP-016")!;
    patch(a);
    return runEngine(input, DEFAULT_CONFIG, { today }).decisions["APP-016"];
  };

  it("a strong applicant passes before the change", () => {
    expect(run(() => {}).status).toBe("ADVANCE");
  });
  it("negative experience goes to Needs info with a question", () => {
    const d = run((a) => (a.experience = -3));
    expect(d.status).toBe("HOLD");
    expect(d.issues.some((i) => i.code === "VALUE_INVALID")).toBe(true);
  });
  it("negative investment is a question, not a hard 'Not now'", () => {
    const d = run((a) => (a.investment = -5));
    expect(d.status).toBe("HOLD");
    expect(d.issues.some((i) => i.code === "CAPITAL_SHORT")).toBe(false);
  });
  it("negative space or target months is a question", () => {
    expect(run((a) => (a.sizeSqft = -10)).status).toBe("HOLD");
    expect(run((a) => (a.targetMonths = -1)).status).toBe("HOLD");
  });
});

describe("tiers", () => {
  const input = load();
  const build = (cfg = DEFAULT_CONFIG) => {
    const result = runEngine(input, cfg, { today });
    return buildRows(input, result, emptyDesk());
  };

  it("labels only people who pass every check", () => {
    const rows = build();
    for (const r of rows) {
      const qualified = !r.withdrawn && (r.engine === "adv" || r.engine === "redir" || r.engine === "wait");
      expect(!!r.tier).toBe(qualified);
    }
  });
  it("A is the top 10 percent, A and B together the top 40 percent", () => {
    const rows = build();
    const pool = rows.filter((r) => r.tier);
    const a = pool.filter((r) => r.tier === "A").length;
    const ab = pool.filter((r) => r.tier !== "C").length;
    expect(a).toBe(Math.ceil(pool.length * 0.1));
    expect(ab).toBe(Math.ceil(pool.length * 0.4));
  });
  it("a higher tier never has a lower score than a lower tier", () => {
    const pool = build().filter((r) => r.tier);
    const min = (t: string) => Math.min(...pool.filter((r) => r.tier === t).map((r) => r.fit));
    const max = (t: string) => Math.max(...pool.filter((r) => r.tier === t).map((r) => r.fit));
    expect(min("A")).toBeGreaterThanOrEqual(max("B"));
    expect(min("B")).toBeGreaterThanOrEqual(max("C"));
  });
  it("the cut-offs are assumptions the owner can change", () => {
    const count = (cfg: typeof DEFAULT_CONFIG) => build(cfg).filter((r) => r.tier === "A").length;
    expect(count({ ...DEFAULT_CONFIG, tierA: 50 })).toBeGreaterThan(count(DEFAULT_CONFIG));
  });
  it("never changes a decision", () => {
    const base = runEngine(input, DEFAULT_CONFIG, { today }).counts;
    const other = runEngine(input, { ...DEFAULT_CONFIG, tierA: 50, tierB: 90 }, { today }).counts;
    expect(other).toEqual(base);
  });
});
