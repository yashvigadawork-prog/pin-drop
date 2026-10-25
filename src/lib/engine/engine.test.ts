import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { diffResults, runEngine } from "./engine";
import { readWorkbook } from "./workbook";
import type { EngineInput } from "./types";

const today = new Date("2026-10-25T00:00:00");
const load = () => readWorkbook(readFileSync(new URL("../../../public/sample-test-data.xlsx", import.meta.url)));
const clone = (i: EngineInput): EngineInput => structuredClone(i);

describe("sample workbook", () => {
  const input = load();
  const res = runEngine(input, DEFAULT_CONFIG, { today });
  const st = (id: string) => res.decisions[id]?.status;

  it("prints a summary", () => {
    for (const id of res.order) {
      const d = res.decisions[id];
      console.log(id.padEnd(13), d.status.padEnd(9), String(d.score?.total ?? "").padEnd(5), (d.allocation ? `${d.allocation.territoryId}/${d.allocation.pin}` : "").padEnd(16), d.headline);
    }
    console.log(res.counts, res.health);
    for (const t of res.territories) console.log(t.territory.id, "cap", t.capacity, "alloc", t.allocated.map((a) => a.appId + ":" + a.pin).join(","), t.issues.join(" | "));
  });

  it("skips the grey example row but keeps a real APP-001", () => {
    expect(input.health.exampleRowSkipped.length).toBe(2);
    expect(input.applications.find((a) => a.id === "APP-001")?.name).toBe("Anitha Rao");
  });

  it("never puts two stores in one pin, including existing stores", () => {
    const pins = Object.values(res.decisions).filter((d) => d.allocation).map((d) => d.allocation!.pin);
    expect(new Set(pins).size).toBe(pins.length);
    for (const s of input.stores) expect(pins).not.toContain(s.pin);
  });

  it("never exceeds territory capacity", () => {
    for (const t of res.territories) expect(t.allocated.length).toBeLessThanOrEqual(t.capacity);
  });

  it("handles the classic traps", () => {
    expect(st("APP-007")).toBe("HOLD"); // upper floor
    expect(st("APP-015")).toBe("NOT_NOW"); // no territory in Belagavi
    expect(st("APP-006")).toBe("NOT_NOW"); // capital far short
    expect(st("APP-005")).toBe("HOLD"); // financing probable
    expect(st("APP-019")).toBe("HOLD"); // pin/city mismatch
    expect(st("APP-020")).toBe("HOLD"); // invalid pin
    expect(st("APP-011")).toBe("HOLD"); // size missing
    expect(st("APP-024")).toBe("HOLD"); // investment missing
    expect(["REDIRECT", "WAITLIST"]).toContain(st("APP-004")); // pin has a store
    expect(st("APP-021")).toBe("ADVANCE"); // messy-but-strong text parsed
    expect(input.applications.find((a) => a.id === "APP-021")?.investment).toBe(50);
  });

  it("re-decides sensibly when APP-007 finds a ground-floor space", () => {
    const next = clone(input);
    const a = next.applications.find((x) => x.id === "APP-007")!;
    a.floor = "Ground";
    a.notes = "";
    a.extra.sizePendingAudit = true;
    const res2 = runEngine(next, DEFAULT_CONFIG, { today });
    expect(res2.decisions["APP-007"].status).toBe("ADVANCE");
    const changes = diffResults(res, res2);
    console.log("diff", changes);
    expect(changes.length).toBeGreaterThan(1); // someone else is bumped
  });

  it("extra committed capital clears a financing-probable hold", () => {
    const next = clone(input);
    next.applications.find((x) => x.id === "APP-005")!.extra.extraCapital = 4;
    const res2 = runEngine(next, DEFAULT_CONFIG, { today });
    expect(res2.decisions["APP-005"].status).not.toBe("HOLD");
  });

  it("owner-confirmed allocations are never displaced", () => {
    const d = res.decisions["APP-008"];
    expect(d.allocation).toBeTruthy();
    const next = clone(input);
    const a = next.applications.find((x) => x.id === "APP-007")!;
    a.floor = "Ground";
    a.notes = "";
    const res2 = runEngine(next, DEFAULT_CONFIG, {
      today,
      owner: [
        { appId: "APP-008", action: "confirm", allocation: d.allocation!, reason: "ok", at: "" },
        { appId: "APP-009", action: "confirm", allocation: res.decisions["APP-009"].allocation!, reason: "ok", at: "" },
      ],
    });
    expect(res2.decisions["APP-008"].allocation?.pin).toBe(d.allocation!.pin);
    expect(res2.decisions["APP-007"].status).not.toBe("ADVANCE");
  });
});
