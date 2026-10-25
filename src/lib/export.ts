import * as XLSX from "xlsx";
import type { EngineInput, EngineResult } from "./engine/types";
import type { AuditEvent } from "@/components/useWorkspace";

const LABEL = { ADVANCE: "Advance", REDIRECT: "Redirect", WAITLIST: "Waitlist", HOLD: "Hold", NOT_NOW: "Not now", WITHDRAWN: "Withdrawn" } as const;

export function exportWorkbook(result: EngineResult, input: EngineInput, audit: AuditEvent[], fileName: string) {
  const apps = Object.fromEntries(input.applications.map((a) => [a.id, a]));
  const rows = result.order.map((id) => {
    const d = result.decisions[id];
    const a = apps[id];
    return {
      "Application ID": id,
      "Applicant name": a.name,
      City: a.city ?? a.cityRaw,
      "Pin applied": a.pin ?? a.pinRaw,
      Recommendation: LABEL[d.status],
      "Owner decision": d.ownerOverride ? `${d.ownerOverride.action}: ${d.ownerOverride.reason}` : "",
      "Fit score": d.score ? Math.round(d.score.total) : "",
      Territory: d.territoryId ?? "",
      "Slot / offer": d.allocation ? `${d.allocation.territoryId} · ${d.allocation.pin}${d.allocation.kind === "redirect" ? " (offer)" : ""}` : "",
      Headline: d.headline,
      "Why (plain language)": d.explanation,
      "Next steps": d.nextSteps.join("\n"),
      "Issues found": d.issues.filter((i) => i.severity !== "info").map((i) => i.message).join("\n"),
      "Planned opening": d.plan?.plannedOpen ?? "",
      "Training language": d.plan?.training.languages.join(" + ") ?? "",
      "Mentor store": d.plan ? `${d.plan.training.mentorStore.id} (${d.plan.training.mentorStore.city})` : "",
      "Indicative payback (months)": d.plan?.payback?.months ?? "",
    };
  });
  const terr = result.territories.map((t) => ({
    "Territory ID": t.territory.id,
    City: t.territory.city,
    Priority: t.territory.priority,
    "Sheet slots": t.territory.slots,
    "Real capacity": t.capacity,
    "Pins with existing store": t.blockedPins.map((b) => `${b.pin} (${b.storeId})`).join(", "),
    Allocated: t.allocated.map((a) => `${a.appId} → ${a.pin}${a.kind === "redirect" ? " (offer)" : ""}`).join(", "),
    Notes: t.issues.join(" "),
  }));
  const log = audit.map((e) => ({ Time: e.at, Type: e.kind, Change: e.summary, Effect: e.changes.map((c) => `${c.id}: ${c.from} → ${c.to}${c.toAlloc ? ` (${c.toAlloc})` : ""}`).join("; ") }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [10, 18, 14, 10, 12, 20, 8, 10, 18, 40, 70, 60, 50, 12, 14, 18, 10].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Recommendations");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(terr), "Territories");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(log), "Audit log");
  XLSX.writeFile(wb, `recommendations-${fileName.replace(/\.xlsx?$/i, "")}.xlsx`);
}
