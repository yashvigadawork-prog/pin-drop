import { workbookToSheets } from "../engine/workbook";
import type { CheckState } from "./types";

// Optional extra columns on the Applications sheet ("PAN", "Employment", "Proof of funds"...)
// pre-fill the onboarding checks. The judges' template has none of them, which is fine.

const KEYS: [RegExp, string][] = [
  [/\bpan\b/, "pan"], [/aadhaar|aadhar|kyc/, "kyc"], [/\bgst\b/, "gst"], [/bank statement/, "bank"], [/proof of funds|funds proof|\bpof\b/, "pof"],
  [/source of funds/, "src"], [/liquid/, "liq"], [/identity|address proof/, "idadd"], [/court|litigation/, "court"], [/credit|cibil/, "credit"],
  [/reference/, "refs"], [/employment|occupation|current job/, "emp"], [/competitor/, "comp"], [/property title|title deed|lease/, "title"],
  [/validation call/, "call"], [/meeting|discovery/, "meet"],
];

function toState(v: unknown): CheckState | null {
  const t = String(v ?? "").trim().toLowerCase();
  if (!t) return null;
  if (/^(verified|clear|cleared|ok|passed)$/.test(t)) return "verified";
  if (/^(flag|flagged|issue|problem|fail|failed)$/.test(t)) return "flag";
  if (/^(y|yes|true|received|submitted|done|attached|sent)$/.test(t)) return "received";
  return null;
}

export function readExtras(data: ArrayBuffer | Uint8Array): Record<string, Record<string, CheckState>> {
  try {
    const sheets = workbookToSheets(data);
    const name = Object.keys(sheets).find((k) => /application/i.test(k));
    if (!name) return {};
    const rows = sheets[name];
    const h = rows.findIndex((r) => r.some((c) => String(c ?? "").toLowerCase().replace(/[^a-z]/g, "") === "applicationid"));
    if (h < 0) return {};
    const head = rows[h].map((c) => String(c ?? "").toLowerCase());
    const cols = head.map((t, i) => [i, KEYS.find(([re]) => re.test(t))?.[1]] as const).filter((c): c is readonly [number, string] => !!c[1]);
    if (!cols.length) return {};
    const idCol = head.findIndex((t) => t.replace(/[^a-z]/g, "") === "applicationid");
    const out: Record<string, Record<string, CheckState>> = {};
    for (const r of rows.slice(h + 1)) {
      const id = String(r[idCol] ?? "").trim().toUpperCase();
      if (!id) continue;
      for (const [i, key] of cols) {
        const s = toState(r[i]);
        if (s) (out[id] ??= {})[key] = s;
      }
    }
    return out;
  } catch {
    return {};
  }
}
