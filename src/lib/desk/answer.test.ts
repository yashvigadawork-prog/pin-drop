import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../engine/config";
import { runEngine } from "../engine/engine";
import { readWorkbook } from "../engine/workbook";
import { deskAnswer } from "./answer";
import { buildRows } from "./model";
import { emptyDesk } from "./types";

const input = readWorkbook(readFileSync(new URL("../../../public/sample-test-data.xlsx", import.meta.url)));
const result = runEngine(input, DEFAULT_CONFIG, { today: new Date("2026-10-26T00:00:00") });
const desk = emptyDesk();
const rows = buildRows(input, result, desk);
const ask = (q: string) => deskAnswer(q, rows, desk, input.applications.map((a) => a.id), Date.now())?.text ?? "";

describe("chat answers from the records", () => {
  it("answers 'how many on the waitlist' with that one number", () => {
    const n = rows.filter((r) => r.ui === "wait").length;
    expect(ask("How many applicants are on the waitlist?")).toBe(`${n} Waitlist.`);
  });
  it("counts Proceed as Proceed plus new-pin offers", () => {
    const n = rows.filter((r) => r.ui === "adv" || r.ui === "redir").length;
    expect(ask("how many are proceed")).toBe(`${n} Proceed.`);
  });
  it("gives the four groups when no status is named", () => {
    const t = ask("how many applicants are there");
    expect(t).toContain("29 applicants");
    expect(t).toContain("• Proceed:");
    expect(t).toContain("• Not now:");
    expect(t).not.toContain("new pin");
  });
});
