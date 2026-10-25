import * as XLSX from "xlsx";
import { buildInput, type SheetRows } from "./parse";
import type { EngineInput } from "./types";

export function workbookToSheets(data: ArrayBuffer | Uint8Array): Record<string, SheetRows> {
  const wb = XLSX.read(data, { type: "array", cellDates: false });
  const sheets: Record<string, SheetRows> = {};
  for (const name of wb.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true, blankrows: true }) as SheetRows;
  }
  return sheets;
}

export function readWorkbook(data: ArrayBuffer | Uint8Array): EngineInput {
  return buildInput(workbookToSheets(data));
}
