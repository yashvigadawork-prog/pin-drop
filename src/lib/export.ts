import * as XLSX from "xlsx";
import type { EngineInput, EngineResult } from "./engine/types";
import type { AuditEvent } from "@/components/useWorkspace";
import type { Row } from "./desk/model";
import { MAIL_LABEL, STAGES, UI_META, type Desk, type ExpPerson } from "./desk/types";

// Built apart from the download so a test can check every sheet is valid (Excel reserves names like "History").
export function buildWorkbook(result: EngineResult, input: EngineInput, audit: AuditEvent[], rows: Row[], desk: Desk, exp: ExpPerson[]) {
  const rec = rows.map((r) => {
    const d = r.d;
    return {
      "Application ID": r.id,
      "Applicant name": r.app.name,
      City: r.app.city ?? r.app.cityRaw,
      "Pin applied": r.app.pin ?? r.app.pinRaw,
      "Where they are": UI_META[r.ui].label,
      "Engine recommended": UI_META[r.engine].label,
      "Your decision": r.move ? `Moved: ${r.move.reason}` : d.ownerOverride ? `${d.ownerOverride.action}: ${d.ownerOverride.reason}` : "",
      "Moved on to": r.moved === "onb" ? "Onboarding" : r.moved === "closed" ? "Closed" : r.moved === "exp" ? "Expansion list" : "",
      "Fit score": r.fit,
      Tier: r.tier ?? "",
      "Offer strength if moved": r.offer ?? "",
      Territory: d.territoryId ?? "",
      "Slot / offer": d.allocation ? `${d.allocation.territoryId} · ${d.allocation.pin}${d.allocation.kind === "redirect" ? " (offer)" : ""}${d.allocation.locked ? " (locked)" : ""}` : "",
      Headline: d.headline,
      "Why (plain language)": d.explanation,
      "Next steps": d.nextSteps.join("\n"),
      "Issues found": d.issues.filter((i) => i.severity !== "info").map((i) => i.message).join("\n"),
      "Planned opening": d.plan?.plannedOpen ?? "",
      "Training language": d.plan?.training.languages.join(" + ") ?? "",
      "Mentor store": d.plan ? `${d.plan.training.mentorStore.id} (${d.plan.training.mentorStore.city})` : "",
      "Indicative payback (months)": d.plan?.payback?.months ?? "",
      "Last email": desk.mail[r.id] ? `${MAIL_LABEL[desk.mail[r.id].type]} · ${desk.mail[r.id].at}` : "",
      Notes: desk.notes[r.id] ?? "",
    };
  });
  const terr = result.territories.map((t) => ({
    "Territory ID": t.territory.id,
    City: t.territory.city,
    Priority: t.territory.priority,
    "Sheet slots": t.territory.slots,
    "Real capacity": t.capacity,
    "Pins with existing store": t.blockedPins.map((b) => `${b.pin} (${b.storeId})`).join(", "),
    Allocated: t.allocated.map((a) => `${a.appId} → ${a.pin}${a.kind === "redirect" ? " (offer)" : ""}${a.locked ? " (locked)" : ""}`).join(", "),
    Notes: t.issues.join(" "),
  }));
  const onb = Object.entries(desk.onb).map(([id, o]) => ({
    "Application ID": id,
    Applicant: rows.find((r) => r.id === id)?.app.name ?? "",
    Stage: STAGES[o.stage],
    "Pin held until": o.holdUntil.slice(0, 10),
    ...Object.fromEntries(Object.entries(o.chk).map(([k, v]) => [k, v])),
  }));
  const expRows = exp.map((e) => ({ ID: e.id, Name: e.name, Area: e.city, Pin: e.pin, "Why they are here": e.reason, Fit: e.fit, Added: e.added, "Email 1 (keep on file)": desk.mail["exp:" + e.id]?.at ?? "", "Email 2 (we expanded)": desk.mail["exp2:" + e.id]?.at ?? "" }));
  const log = audit.map((e) => ({ Time: e.at, Type: e.kind, Change: e.summary, Effect: e.changes.map((c) => `${c.id}: ${c.from} → ${c.to}${c.toAlloc ? ` (${c.toAlloc})` : ""}`).join("; ") }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rec);
  ws["!cols"] = [10, 18, 14, 10, 14, 14, 24, 14, 8, 6, 10, 10, 18, 40, 70, 60, 50, 12, 14, 18, 10, 22, 30].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Recommendations");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(terr), "Territories");
  if (onb.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(onb), "Onboarding");
  if (expRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows), "Expansion list");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(log), "Change log");
  void input;
  return wb;
}

export function exportWorkbook(result: EngineResult, input: EngineInput, audit: AuditEvent[], fileName: string, rows: Row[], desk: Desk, exp: ExpPerson[]) {
  const wb = buildWorkbook(result, input, audit, rows, desk, exp);
  XLSX.writeFile(wb, `pin-drop-${fileName.replace(/\.xlsx?$/i, "")}.xlsx`);
}
