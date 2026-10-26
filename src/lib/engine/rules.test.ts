import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { runEngine } from "./engine";
import { readWorkbook } from "./workbook";

const today = new Date("2026-10-25T00:00:00");
const input = readWorkbook(readFileSync(new URL("../../../public/sample-test-data.xlsx", import.meta.url)));

describe("owner-added assumptions", () => {
  it("a 'hold' assumption moves failing applicants to Hold without a code change", () => {
    const base = runEngine(input, DEFAULT_CONFIG, { today });
    const next = runEngine(input, { ...DEFAULT_CONFIG, custom: [{ id: "x1", label: "Experience", field: "experience", op: "min", value: 99, effect: "hold" }] }, { today });
    const advanced = Object.values(base.decisions).filter((d) => d.status === "ADVANCE").length;
    const after = Object.values(next.decisions).filter((d) => d.status === "ADVANCE").length;
    expect(after).toBeLessThan(advanced);
    expect(Object.values(next.decisions).some((d) => d.issues.some((i) => i.code === "CUSTOM_HOLD_x1"))).toBe(true);
  });

  it("a 'not now' assumption is a hard stop and a 'flag' only warns", () => {
    const hard = runEngine(input, { ...DEFAULT_CONFIG, custom: [{ id: "x2", label: "Experience", field: "experience", op: "min", value: 99, effect: "notnow" }] }, { today });
    expect(Object.values(hard.decisions).some((d) => d.status === "NOT_NOW" && d.issues.some((i) => i.code === "CUSTOM_NOTNOW_x2"))).toBe(true);
    const base = runEngine(input, DEFAULT_CONFIG, { today });
    const soft = runEngine(input, { ...DEFAULT_CONFIG, custom: [{ id: "x3", label: "Experience", field: "experience", op: "min", value: 99, effect: "flag" }] }, { today });
    expect(soft.counts).toEqual(base.counts);
  });
});

describe("challenger rule", () => {
  const rank = (m: number) => runEngine(input, { ...DEFAULT_CONFIG, challengeMargin: m }, { today });

  it("only flags a neighbouring pin when the loser beats its holder by the margin", () => {
    for (const margin of [0, 10]) {
      const res = rank(margin);
      for (const d of Object.values(res.decisions)) {
        for (const c of d.challenges ?? []) {
          expect(c.margin).toBeGreaterThanOrEqual(margin);
          expect(c.myScore - c.vsScore).toBe(c.margin);
          expect(res.decisions[c.vsId].allocation?.pin).toBe(c.pin);
        }
      }
    }
  });

  it("a smaller margin never finds fewer challengers than a bigger one", () => {
    const count = (m: number) => Object.values(rank(m).decisions).reduce((a, d) => a + (d.challenges?.length ?? 0), 0);
    expect(count(0)).toBeGreaterThanOrEqual(count(10));
    console.log("challenges at margin 0:", count(0), "at 10:", count(10));
  });

  it("never changes anyone's status by itself", () => {
    const a = rank(0);
    const b = rank(999);
    expect(a.counts).toEqual(b.counts);
  });
});
