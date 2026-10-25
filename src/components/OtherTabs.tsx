"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CONFIG } from "@/lib/engine/config";
import { RULES } from "@/lib/engine/rulebook";
import type { EngineConfig, EngineResult, Tier } from "@/lib/engine/types";
import type { AuditEvent } from "./useWorkspace";
import { Card, EvidenceList, SectionTitle, STATUS_META, StatusChip } from "./ui";

export function TerritoriesTab({ result, onOpen }: { result: EngineResult; onOpen: (id: string) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {result.territories.map((tv) => {
        const t = tv.territory;
        const inTerr = result.order.filter((id) => result.decisions[id].territoryId === t.id);
        const waiting = inTerr.filter((id) => ["WAITLIST", "HOLD"].includes(result.decisions[id].status));
        return (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono text-xs text-slate-500">{t.id}</div>
                <div className="font-semibold text-slate-900">
                  {t.city ?? t.cityRaw} <span className="text-sm font-normal text-slate-500">· {t.tier}</span>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.priority === "High" ? "bg-rose-50 text-rose-700" : t.priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{t.priority ?? "?"} priority</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <div className="flex gap-1">
                {Array.from({ length: Math.max(tv.capacity, 0) }).map((_, i) => (
                  <span key={i} className={`h-3 w-6 rounded ${i < tv.allocated.length ? "bg-indigo-500" : "bg-slate-200"}`} />
                ))}
              </div>
              <span className="text-slate-600">
                {tv.allocated.length}/{tv.capacity} real slots filled
                {t.slots !== tv.capacity && <span className="text-slate-400"> (sheet says {t.slots})</span>}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.pins.map((p) => {
                const store = tv.blockedPins.find((b) => b.pin === p);
                const alloc = tv.allocated.find((a) => a.pin === p);
                return (
                  <span
                    key={p}
                    title={store ? `Existing store ${store.storeId}` : alloc ? `Allocated to ${alloc.appId}` : "Free"}
                    className={`rounded-md px-2 py-0.5 font-mono text-xs ring-1 ${store ? "bg-slate-800 text-white ring-slate-800" : alloc ? "bg-indigo-50 text-indigo-800 ring-indigo-200" : "bg-white text-slate-600 ring-slate-200"}`}
                  >
                    {p}
                    {store ? ` · ${store.storeId}` : alloc ? ` · ${alloc.appId}` : ""}
                  </span>
                );
              })}
            </div>
            {tv.allocated.length > 0 && (
              <ul className="mt-3 space-y-1">
                {tv.allocated.map((a) => (
                  <li key={a.appId}>
                    <button onClick={() => onOpen(a.appId)} className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm hover:bg-slate-50">
                      <StatusChip status={result.decisions[a.appId].status} />
                      <span className="font-mono text-xs text-slate-500">{a.appId}</span>
                      <span className="truncate text-slate-700">pin {a.pin}</span>
                      <span className="ml-auto tabular-nums text-xs text-slate-400">{result.decisions[a.appId].score?.total.toFixed(0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {waiting.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Also in line</div>
                <div className="flex flex-wrap gap-1.5">
                  {waiting.map((id) => (
                    <button key={id} onClick={() => onOpen(id)} className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${STATUS_META[result.decisions[id].status].cls}`}>
                      {id} · {STATUS_META[result.decisions[id].status].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tv.issues.length > 0 && <p className="mt-2 text-xs text-slate-500">{tv.issues.join(" ")}</p>}
          </Card>
        );
      })}
    </div>
  );
}

export function RulebookTab({ config, onConfig, focus }: { config: EngineConfig; onConfig: (c: EngineConfig, label: string) => void; focus?: string | null }) {
  const [draft, setDraft] = useState(config);
  useEffect(() => {
    setDraft(config);
  }, [config]);
  useEffect(() => {
    if (focus) document.getElementById(`rule-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);
  const tiers: Tier[] = ["Tier 1", "Tier 2", "Tier 3"];
  const changed = JSON.stringify(draft) !== JSON.stringify(config);
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle hint="every threshold is an assumption you can change">Assumptions</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {tiers.map((t) => (
            <Num key={t} label={`Minimum investment, ${t} (₹ lakh)`} value={draft.minCapital[t]} onChange={(v) => setDraft({ ...draft, minCapital: { ...draft.minCapital, [t]: v } })} />
          ))}
          <Num label="'Financing probable' band (%)" value={Math.round(draft.nearMissBand * 100)} onChange={(v) => setDraft({ ...draft, nearMissBand: v / 100 })} />
          <Num label="Minimum space (sq ft)" value={draft.minSqft} onChange={(v) => setDraft({ ...draft, minSqft: v })} />
          <Num label="Comfortable space from (sq ft)" value={draft.tightSqft} onChange={(v) => setDraft({ ...draft, tightSqft: v })} />
        </div>
        <div className="mt-3 flex gap-2">
          <button disabled={!changed} onClick={() => onConfig(draft, "Assumptions changed in Rulebook")} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
            Apply &amp; re-decide
          </button>
          <button onClick={() => onConfig({ ...DEFAULT_CONFIG, weights: config.weights, phaseName: config.phaseName }, "Assumptions reset to defaults")} className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
            Reset to defaults
          </button>
        </div>
      </Card>

      {RULES.map((r) => (
        <Card key={r.id} className={`p-4 ${focus === r.id ? "ring-2 ring-indigo-500" : ""}`}>
          <div id={`rule-${r.id}`} className="scroll-mt-24" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{r.gate}</span>
            <h3 className="font-semibold text-slate-900">{r.title}</h3>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            <b className="text-slate-900">Rule. </b>
            {r.rule}
          </p>
          <p className="mt-1.5 text-sm text-slate-600">
            <b className="text-slate-800">Why (first principles). </b>
            {r.why}
          </p>
          {r.assumption && (
            <p className="mt-1.5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <b>Assumption &amp; how we&apos;d check it. </b>
              {r.assumption}
            </p>
          )}
          <details className="mt-2" open={focus === r.id}>
            <summary className="cursor-pointer text-sm font-medium text-indigo-600">Real-world evidence ({r.evidence.length})</summary>
            <div className="mt-2">
              <EvidenceList ids={r.evidence} />
            </div>
          </details>
        </Card>
      ))}
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs text-slate-600">
      {label}
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
    </label>
  );
}

export function AuditTab({ audit, onOpen, runId }: { audit: AuditEvent[]; onOpen: (id: string) => void; runId: string | null }) {
  return (
    <Card className="p-4">
      <SectionTitle hint={runId ? `saved to database · run ${runId}` : "kept in this browser"}>Audit log — every change and its effect</SectionTitle>
      <ol className="space-y-3">
        {[...audit].reverse().map((e) => (
          <li key={e.id} className="border-l-2 border-slate-200 pl-3">
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="text-xs tabular-nums text-slate-400">{new Date(e.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span className="rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-600">{e.kind}</span>
              <span className="text-slate-800">{e.summary}</span>
            </div>
            {e.changes.length > 0 && <ChangeList changes={e.changes} onOpen={onOpen} />}
            {e.kind !== "upload" && e.changes.length === 0 && <div className="text-xs text-slate-400">No recommendation changed.</div>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function ChangeList({ changes, onOpen, max = 12 }: { changes: import("@/lib/engine/types").Change[]; onOpen: (id: string) => void; max?: number }) {
  return (
    <ul className="mt-1.5 space-y-1">
      {changes.slice(0, max).map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-1.5 text-xs">
          <button onClick={() => onOpen(c.id)} className="font-mono font-medium text-indigo-700 hover:underline">
            {c.id}
          </button>
          {c.from && <StatusChip status={c.from} />}
          {c.from !== c.to && (
            <>
              <span className="text-slate-400">→</span>
              {c.to && <StatusChip status={c.to} />}
            </>
          )}
          {c.fromAlloc !== c.toAlloc && (
            <span className="text-slate-500">
              {c.fromAlloc ?? "no slot"} → {c.toAlloc ?? "no slot"}
            </span>
          )}
          {c.from === c.to && c.fromAlloc === c.toAlloc && (
            <span className="text-slate-500">
              score {c.fromScore?.toFixed(0)} → {c.toScore?.toFixed(0)}
            </span>
          )}
        </li>
      ))}
      {changes.length > max && <li className="text-xs text-slate-400">+ {changes.length - max} more</li>}
    </ul>
  );
}
