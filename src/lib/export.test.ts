import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { DEFAULT_CONFIG } from "./engine/config";
import { runEngine } from "./engine/engine";
import { readWorkbook } from "./engine/workbook";
import { buildWorkbook } from "./export";
import { buildRows } from "./desk/model";
import { emptyDesk } from "./desk/types";

describe("Excel download", () => {
  it("builds every sheet with a valid name and can be written", () => {
    const input = readWorkbook(readFileSync(new URL("../../public/sample-test-data.xlsx", import.meta.url)));
    const result = runEngine(input, DEFAULT_CONFIG, { today: new Date("2026-10-26T00:00:00") });
    const desk = emptyDesk();
    const rows = buildRows(input, result, desk);
    const wb = buildWorkbook(result, input, [], rows, desk, []);
    expect(wb.SheetNames).toEqual(expect.arrayContaining(["Recommendations", "Territories", "Change log"]));
    expect(wb.SheetNames).not.toContain("History");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    expect(bytes.byteLength).toBeGreaterThan(5000);
    const back = XLSX.read(bytes, { type: "array" });
    const rec = XLSX.utils.sheet_to_json<Record<string, unknown>>(back.Sheets["Recommendations"]);
    expect(rec.length).toBe(input.applications.length);
    expect(Object.keys(rec[0])).toContain("Tier");
  });
});
