"use client";

import type { ReactNode } from "react";
import { ruleById, evidenceById } from "@/lib/engine/rulebook";
import type { GateState, Status } from "@/lib/engine/types";

export const STATUS_META: Record<Status, { label: string; cls: string; dot: string; desc: string }> = {
  ADVANCE: { label: "Advance", cls: "bg-emerald-50 text-emerald-800 ring-emerald-600/20", dot: "bg-emerald-500", desc: "Slot provisionally reserved — owner to confirm" },
  REDIRECT: { label: "Redirect", cls: "bg-sky-50 text-sky-800 ring-sky-600/20", dot: "bg-sky-500", desc: "Strong partner, offer a different free pin" },
  WAITLIST: { label: "Waitlist", cls: "bg-amber-50 text-amber-800 ring-amber-600/25", dot: "bg-amber-500", desc: "Qualified, but slots went to higher scores" },
  HOLD: { label: "Hold", cls: "bg-orange-50 text-orange-800 ring-orange-600/25", dot: "bg-orange-500", desc: "A fixable question must be answered first" },
  NOT_NOW: { label: "Not now", cls: "bg-slate-100 text-slate-700 ring-slate-500/20", dot: "bg-slate-400", desc: "Doesn't fit this round — kept in pipeline" },
  WITHDRAWN: { label: "Withdrawn", cls: "bg-zinc-100 text-zinc-500 ring-zinc-400/20", dot: "bg-zinc-300", desc: "Applicant withdrew" },
};

export const STATUS_ORDER: Status[] = ["ADVANCE", "REDIRECT", "WAITLIST", "HOLD", "NOT_NOW", "WITHDRAWN"];

export function StatusChip({ status, size = "sm" }: { status: Status; size?: "sm" | "md" }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-medium whitespace-nowrap ${m.cls} ${size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function GateIcon({ state }: { state: GateState }) {
  if (state === "pass")
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700" aria-label="pass">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3.5 8.5l3 3 6-7" /></svg>
      </span>
    );
  if (state === "attention")
    return <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700" aria-label="attention">!</span>;
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700" aria-label="blocked">
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</h3>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  );
}

export function Bar({ value, className = "bg-indigo-500" }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function RuleLink({ ruleId, onOpen }: { ruleId?: string; onOpen: (id: string) => void }) {
  const r = ruleById(ruleId);
  if (!r) return null;
  return (
    <button onClick={() => onOpen(r.id)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
      Why this rule?
    </button>
  );
}

export function EvidenceList({ ids }: { ids: string[] }) {
  return (
    <ul className="space-y-2">
      {ids.map((id) => {
        const e = evidenceById(id);
        if (!e) return null;
        return (
          <li key={id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800">{e.company_or_body}</span>
              {e.figure && <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">{e.figure}</span>}
              <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${e.confidence === "high" ? "text-emerald-600" : e.confidence === "medium" ? "text-amber-600" : "text-rose-600"}`}>{e.confidence} confidence</span>
            </div>
            <p className="mt-1 text-slate-600">{e.claim}</p>
            <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-xs text-indigo-600 hover:underline">
              {e.source_title} ↗
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onClick={onClose}>
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-2xl bg-white shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="font-semibold text-slate-900">{title}</div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function fmtL(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : `₹${Number.isInteger(n) ? n : n.toFixed(1)}L`;
}
