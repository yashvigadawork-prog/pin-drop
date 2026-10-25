"use client";

import { useMemo, useState } from "react";
import type { EngineInput, EngineResult, Status } from "@/lib/engine/types";
import { Card, STATUS_META, STATUS_ORDER, StatusChip } from "./ui";

export function DecisionsTab({ result, input, onOpen }: { result: EngineResult; input: EngineInput; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"sheet" | "score" | "status">("sheet");
  const apps = useMemo(() => Object.fromEntries(input.applications.map((a) => [a.id, a])), [input]);

  const rows = useMemo(() => {
    let ids = result.order.filter((id) => filter === "ALL" || result.decisions[id].status === filter);
    if (q.trim()) {
      const s = q.toLowerCase();
      ids = ids.filter((id) => `${id} ${apps[id]?.name} ${apps[id]?.city} ${apps[id]?.pin} ${result.decisions[id].territoryId}`.toLowerCase().includes(s));
    }
    if (sort === "score") ids = [...ids].sort((a, b) => (result.decisions[b].score?.total ?? 0) - (result.decisions[a].score?.total ?? 0));
    if (sort === "status") ids = [...ids].sort((a, b) => STATUS_ORDER.indexOf(result.decisions[a].status) - STATUS_ORDER.indexOf(result.decisions[b].status));
    return ids;
  }, [result, filter, q, sort, apps]);

  const h = result.health;
  const total = result.order.length;

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "ALL" : s)}
            className={`rounded-xl border bg-white p-3 text-left transition hover:border-slate-300 ${filter === s ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200"}`}
            title={STATUS_META[s].desc}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
              {STATUS_META[s].label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{result.counts[s]}</div>
          </button>
        ))}
      </div>

      {/* Data health */}
      {(h.warnings.length > 0 || h.exampleRowSkipped.length > 0) && (
        <Card className="border-amber-200 bg-amber-50/50 p-3">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-amber-900">
              Data check: read {h.applicationsRead} applications and {h.territoriesRead} territories
              {h.exampleRowSkipped.length > 0 && ` · skipped the grey example row${h.exampleRowSkipped.length > 1 ? "s" : ""}`}
              {h.warnings.length > 0 && ` · ${h.warnings.length} file-level note${h.warnings.length > 1 ? "s" : ""}`}
            </summary>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-900/80">
              {h.exampleRowSkipped.map((e) => (
                <li key={e.sheet}>
                  {e.sheet} row {e.row} is the template&apos;s grey example — not treated as data.
                </li>
              ))}
              {h.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {result.territories.flatMap((t) => t.issues.map((i) => <li key={t.territory.id + i}>{t.territory.id}: {i}</li>))}
            </ul>
          </details>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, name, city, pin, territory…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="sheet">Sheet order</option>
            <option value="score">Highest score</option>
            <option value="status">By recommendation</option>
          </select>
          {filter !== "ALL" && (
            <button onClick={() => setFilter("ALL")} className="text-xs text-indigo-600 hover:underline">
              Clear filter ({STATUS_META[filter].label})
            </button>
          )}
          <span className="text-xs text-slate-400">
            {rows.length} of {total}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 font-semibold">Applicant</th>
                <th className="px-3 py-2 font-semibold">Location</th>
                <th className="px-3 py-2 font-semibold">Recommendation</th>
                <th className="px-3 py-2 text-right font-semibold">Score</th>
                <th className="hidden px-3 py-2 font-semibold md:table-cell">Why</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((id) => {
                const d = result.decisions[id];
                const a = apps[id];
                return (
                  <tr key={id} onClick={() => onOpen(id)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs text-slate-500">{id}</div>
                      <div className="font-medium text-slate-900">{a?.name || "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <div>{a?.city ?? (a?.cityRaw || "—")}</div>
                      <div className="text-xs text-slate-400">
                        pin {a?.pin ?? (a?.pinRaw || "?")}
                        {d.appliedTerritoryId ? ` · ${d.appliedTerritoryId}` : " · no territory"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <StatusChip status={d.status} />
                        {d.ownerOverride && <span className="rounded bg-indigo-50 px-1 text-[10px] font-semibold text-indigo-700" title="Owner decision recorded">OWNER</span>}
                      </div>
                      {d.allocation && <div className="mt-0.5 text-xs text-slate-500">{d.allocation.kind === "redirect" ? "offer" : "slot"}: {d.allocation.territoryId} · {d.allocation.pin}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{d.score ? d.score.total.toFixed(0) : "—"}</td>
                    <td className="hidden max-w-md px-3 py-2.5 text-slate-600 md:table-cell">
                      <span className="line-clamp-2">{d.headline}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
