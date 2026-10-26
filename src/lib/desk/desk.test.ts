import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../engine/config";
import { runEngine } from "../engine/engine";
import { readWorkbook } from "../engine/workbook";
import type { OwnerAction } from "../engine/types";
import { ctxFromRow, defaultMailType, mailFor } from "./mail";
import { reasonCounts, summaryLines, stageTimes } from "./metrics";
import { buildRows, countBy, expAll, freePins, spotIds } from "./model";
import { readPaste } from "./paste";
import { emptyDesk } from "./types";
import { extractSignals } from "../engine/signals";

const today = new Date("2026-10-26T00:00:00");
const input = readWorkbook(readFileSync(new URL("../../../public/sample-test-data.xlsx", import.meta.url)));
const run = (owner: OwnerAction[] = []) => runEngine(input, DEFAULT_CONFIG, { today, owner });
const at = "2026-10-26T00:00:00.000Z";

describe("desk model on the sample file", () => {
  const result = run();
  const desk = emptyDesk();
  const rows = buildRows(input, result, desk);
  const ui = (id: string) => rows.find((r) => r.id === id)!.ui;

  it("maps engine statuses to what the owner sees", () => {
    expect(ui("APP-001")).toBe("adv");
    expect(ui("APP-004")).toBe("redir");
    expect(ui("APP-007")).toBe("info");
    expect(ui("APP-002")).toBe("wait");
    expect(ui("APP-006")).toBe("no");
  });

  it("keeps valid pins we do not serve on the Expansion list instead of rejecting them", () => {
    expect(ui("APP-015")).toBe("exp"); // no territory in Belagavi
    expect(ui("APP-022")).toBe("exp"); // pin outside every territory
    const list = expAll(rows, desk);
    expect(list.map((e) => e.id).sort()).toEqual(["APP-015", "APP-022"]);
  });

  it("asks about typos and mismatches instead of rejecting", () => {
    expect(ui("APP-020")).toBe("info");
    expect(rows.find((r) => r.id === "APP-020")!.tag).toBe("pin");
    expect(rows.find((r) => r.id === "APP-019")!.tag).toBe("pin");
    expect(rows.find((r) => r.id === "APP-003-R29")!.tag).toBe("dup");
  });

  it("totals every applicant exactly once", () => {
    const c = countBy(rows);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(rows.length);
  });

  it("shows fit at the applied pin, and offer strength separately", () => {
    const r = rows.find((x) => x.id === "APP-002")!;
    expect(r.fit).toBeGreaterThan(75);
    expect(r.offer).toBeLessThan(r.fit);
  });

  it("lists free pins only where a slot is open", () => {
    expect(freePins(result, "Bengaluru")).toEqual([]);
    expect(freePins(result, "Tumakuru").map((p) => p.pin)).toContain("572102");
  });

  it("samples about ten percent of decisions for spot-checks", () => {
    expect(spotIds(rows, 10)).toHaveLength(3);
    expect(spotIds(rows, 20).length).toBeGreaterThan(3);
  });
});

describe("owner moves go through the engine", () => {
  it("Proceed with a free pin locks that pin, even for someone on hold", () => {
    const a: OwnerAction = { appId: "APP-017", action: "confirm", allocation: { territoryId: "TER-07", pin: "572102", kind: "own_pin" }, reason: "Loan sanctioned", at };
    const r = run([a]);
    expect(r.decisions["APP-017"].status).toBe("ADVANCE");
    expect(r.decisions["APP-017"].allocation).toMatchObject({ pin: "572102", locked: true });
  });

  it("moving someone out of Proceed frees the pin for the next person, and the pin rule holds", () => {
    const a: OwnerAction = { appId: "APP-001", action: "override", status: "HOLD", reason: "Not convinced", at };
    const r = run([a]);
    expect(r.decisions["APP-001"].status).toBe("HOLD");
    expect(r.decisions["APP-002"].status).toBe("ADVANCE");
    const pins = Object.values(r.decisions).filter((d) => d.allocation).map((d) => d.allocation!.pin);
    expect(new Set(pins).size).toBe(pins.length);
  });

  it("locking several people at once, including new-pin offers, does not break the engine", () => {
    const base = run();
    const owner: OwnerAction[] = Object.values(base.decisions)
      .filter((d) => d.allocation)
      .map((d) => ({ appId: d.id, action: "confirm" as const, allocation: { territoryId: d.allocation!.territoryId, pin: d.allocation!.pin, kind: d.allocation!.kind }, reason: "Next steps sent", at }));
    expect(owner.some((o) => o.allocation!.kind === "redirect")).toBe(true);
    const r = run(owner);
    for (const o of owner) expect(r.decisions[o.appId].allocation).toMatchObject({ pin: o.allocation!.pin, locked: true });
  });

  it("a locked pin is not taken away by a better applicant", () => {
    const a: OwnerAction = { appId: "APP-025", action: "confirm", allocation: { territoryId: "TER-02", pin: "560011", kind: "own_pin" }, reason: "Locked", at };
    const r = run([a]);
    expect(r.decisions["APP-025"].allocation?.locked).toBe(true);
  });
});

describe("emails, replies and numbers", () => {
  const result = run();
  const rows = buildRows(input, result, emptyDesk());
  it("drafts the right email for each bucket", () => {
    const m = (id: string) => {
      const r = rows.find((x) => x.id === id)!;
      return mailFor(ctxFromRow(r), defaultMailType(r.ui, r.tag));
    };
    expect(m("APP-001").sub).toContain("Next steps");
    expect(m("APP-020").sub).toContain("confirm your pin");
    expect(m("APP-015").sub).toContain("not in");
    expect(m("APP-007").html).toContain("ground-floor");
  });

  it("reads facts out of a pasted reply", () => {
    const { updates, fields } = readPaste("Found a ground floor shop, 450 sq ft, pin 570001. My FD of ₹4 lakh can be used.");
    expect(fields.map((f) => f[0])).toEqual(["Floor", "Size", "Funds", "Pin"]);
    expect(updates.map((u) => u.field)).toEqual(["floor", "sizeSqft", "extraCapital", "pin"]);
    expect(readPaste("Mudra loan sanctioned").updates[0]).toMatchObject({ field: "financing", value: "sanctioned" });
  });

  it("counts why people are not proceeding and writes a boss summary", () => {
    const rc = reasonCounts(rows);
    expect(rc.capital).toBeGreaterThan(0);
    expect(rc.pin).toBeGreaterThanOrEqual(3);
    expect(rc.area).toBe(2);
    const lines = summaryLines(rows, emptyDesk(), 2, 2, stageTimes(emptyDesk(), 0));
    expect(lines[0]).toContain("Applications");
  });
});

describe("optional upload columns", () => {
  it("pre-fill checks when the sheet has them, and do nothing when it does not", async () => {
    const { readExtras } = await import("./extras");
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Applications"], ["Application ID", "Applicant name", "PAN card", "Employment status", "Proof of funds"], ["APP-001", "A", "Yes", "Verified", ""], ["APP-002", "B", "", "flag", "received"]]), "Applications");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const ex = readExtras(buf);
    expect(ex["APP-001"]).toEqual({ pan: "received", emp: "verified" });
    expect(ex["APP-002"]).toEqual({ emp: "flag", pof: "received" });
    expect(readExtras(readFileSync(new URL("../../../public/sample-test-data.xlsx", import.meta.url)))).toEqual({});
  });
});

describe("messy free text", () => {
  const sigs = (business: string, notes: string) => {
    const a = { ...input.applications[0], business, notes };
    return extractSignals(a, today).map((s) => s.kind);
  };
  it("catches conditional funds, government jobs, upper floors, competitors and disputes", () => {
    expect(sigs("Teacher", "Funds will come after I sell my plot")).toContain("funding_conditional");
    expect(sigs("Farmer", "Money from sale of agricultural land")).toContain("funding_conditional");
    expect(sigs("Clerk", "I am a government employee")).toContain("owner_not_operator");
    expect(sigs("Shop", "Shop in the mall, 3rd floor food court")).toContain("floor_mentioned_upper");
    expect(sigs("Optical", "Currently a franchisee of another brand")).toContain("competitor_franchise");
    expect(sigs("Stationery", "Pending court case on property title")).toContain("legal_issue");
  });
  it("does not read 'after Diwali' as a launch deadline", () => {
    expect(sigs("Shop", "he will send the money after Diwali")).not.toContain("festival_deadline");
    expect(sigs("Shop", "Wants to open before Diwali")).toContain("festival_deadline");
  });
  it("treats names in other scripts as different people", () => {
    const base = structuredClone(input);
    const t = base.applications[0];
    base.applications = [
      { ...t, id: "K-1", name: "ರವಿ ಕುಮಾರ್", pin: "570001", city: "Mysuru" },
      { ...t, id: "K-2", name: "ಅನಿತಾ ರಾವ್", pin: "570001", city: "Mysuru" },
    ];
    const r = runEngine(base, DEFAULT_CONFIG, { today });
    expect(r.decisions["K-2"].issues.some((i) => i.code === "DUPLICATE_SUBMISSION")).toBe(false);
  });
  it("warns when a pin is listed in two territories", () => {
    const wb = readWorkbook(readFileSync(new URL("../../../public/sample-test-data.xlsx", import.meta.url)));
    expect(wb.health.warnings.filter((w) => w.includes("listed in both"))).toEqual([]);
  });
});
