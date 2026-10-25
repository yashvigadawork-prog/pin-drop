import { normCity, normFloor, normLanguages, normPin, normSpace } from "./parse";
import type { EngineInput } from "./types";

// New information about an applicant ("APP-012 has found a ground-floor space") is applied
// as a field change, then the whole engine reruns. Every change is logged with before/after.

export type UpdateField =
  | "investment"
  | "extraCapital"
  | "experience"
  | "space"
  | "sizeSqft"
  | "floor"
  | "targetMonths"
  | "language"
  | "pin"
  | "city"
  | "financing"
  | "ownerOperatorConfirmed"
  | "withdrawn"
  | "note";

export const UPDATE_FIELDS: UpdateField[] = ["investment", "extraCapital", "experience", "space", "sizeSqft", "floor", "targetMonths", "language", "pin", "city", "financing", "ownerOperatorConfirmed", "withdrawn", "note"];

export interface Update {
  appId: string;
  field: UpdateField;
  value: string | number | boolean;
  source: "chat" | "owner" | "ai";
  text?: string; // the sentence it came from
}

export interface AppliedUpdate extends Update {
  before: string;
  after: string;
  ok: boolean;
  error?: string;
}

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "blank" : Array.isArray(v) ? v.join(", ") || "blank" : String(v));
const num = (v: Update["value"]) => (typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, "")));

export function applyUpdates(input: EngineInput, updates: Update[]): { input: EngineInput; applied: AppliedUpdate[] } {
  const next: EngineInput = structuredClone(input);
  const applied: AppliedUpdate[] = [];
  for (const u of updates) {
    const app = next.applications.find((a) => a.id.toUpperCase() === u.appId.toUpperCase());
    if (!app) {
      applied.push({ ...u, before: "", after: "", ok: false, error: `No application ${u.appId} in this file.` });
      continue;
    }
    let before = "";
    let after = "";
    let error: string | undefined;
    switch (u.field) {
      case "investment": {
        before = show(app.investment);
        const n = num(u.value);
        if (isNaN(n)) error = "not a number";
        else app.investment = n;
        after = show(app.investment);
        break;
      }
      case "extraCapital": {
        before = show(app.extra.extraCapital ?? 0);
        const n = num(u.value);
        if (isNaN(n)) error = "not a number";
        else app.extra.extraCapital = (app.extra.extraCapital ?? 0) + n;
        after = show(app.extra.extraCapital);
        break;
      }
      case "experience": {
        before = show(app.experience);
        const n = num(u.value);
        if (isNaN(n)) error = "not a number";
        else app.experience = n;
        after = show(app.experience);
        break;
      }
      case "space": {
        before = show(app.space);
        const s = normSpace(String(u.value));
        if (!s) error = "unknown space status";
        else app.space = s;
        after = show(app.space);
        break;
      }
      case "sizeSqft": {
        before = show(app.sizeSqft);
        const n = num(u.value);
        if (isNaN(n)) error = "not a number";
        else {
          app.sizeSqft = n;
          app.extra.sizePendingAudit = false;
        }
        after = show(app.sizeSqft);
        break;
      }
      case "floor": {
        before = show(app.floor);
        const f = normFloor(String(u.value));
        if (!f) error = "unknown floor";
        else {
          // A newly found space replaces the old one: old notes about the floor no longer apply,
          // and if they had no space before, they have one now (terms to be confirmed).
          if (app.floor !== f) {
            app.notes = app.notes.replace(/[^.]*(first floor|1st floor|upper floor|second floor|2nd floor|above (a|the)|basement|mezzanine)[^.]*\.?/gi, "").trim();
            if (app.space === "Not yet identified") app.space = "Rented";
            app.extra.sizePendingAudit = true;
          }
          app.floor = f;
        }
        after = show(app.floor);
        break;
      }
      case "targetMonths": {
        before = show(app.targetMonths);
        const n = num(u.value);
        if (isNaN(n)) error = "not a number";
        else app.targetMonths = n;
        after = show(app.targetMonths);
        break;
      }
      case "language": {
        before = show(app.languages);
        const l = normLanguages(String(u.value));
        if (!l.length) error = "unknown language";
        else app.languages = l;
        after = show(app.languages);
        break;
      }
      case "pin": {
        before = show(app.pin);
        const p = normPin(String(u.value));
        if (!p) error = "not a 6-digit pin";
        else app.pin = p;
        after = show(app.pin);
        break;
      }
      case "city": {
        before = show(app.city);
        const c = normCity(String(u.value));
        if (!c) error = "city not in the plan";
        else {
          app.city = c;
          app.cityRaw = c;
        }
        after = show(app.city);
        break;
      }
      case "financing": {
        before = show(app.extra.financing ?? "none");
        const v = String(u.value).toLowerCase();
        app.extra.financing = /sanction|approv|disburs/.test(v) ? "sanctioned" : "applied";
        after = app.extra.financing;
        break;
      }
      case "ownerOperatorConfirmed":
        before = show(!!app.extra.ownerOperatorConfirmed);
        app.extra.ownerOperatorConfirmed = u.value !== false && u.value !== "false";
        after = show(app.extra.ownerOperatorConfirmed);
        break;
      case "withdrawn":
        before = show(!!app.extra.withdrawn);
        app.extra.withdrawn = u.value !== false && u.value !== "false";
        after = show(app.extra.withdrawn);
        break;
      case "note":
        before = "";
        app.extra.infoNotes = [...(app.extra.infoNotes ?? []), String(u.value)];
        after = String(u.value);
        break;
    }
    applied.push({ ...u, before, after, ok: !error, error });
  }
  return { input: next, applied };
}

export const FIELD_LABEL: Record<UpdateField, string> = {
  investment: "Investment (₹ lakh)",
  extraCapital: "Additional committed funds (₹ lakh)",
  experience: "Retail experience (years)",
  space: "Space",
  sizeSqft: "Space size (sq ft)",
  floor: "Floor",
  targetMonths: "Target launch (months)",
  language: "Training language",
  pin: "Pin code",
  city: "City",
  financing: "Loan status",
  ownerOperatorConfirmed: "Will run the store personally",
  withdrawn: "Withdrawn",
  note: "Note",
};
