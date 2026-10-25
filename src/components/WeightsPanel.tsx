"use client";

import { useEffect, useState } from "react";
import { PHASE_PRESETS } from "@/lib/engine/config";
import type { EngineConfig, Weights } from "@/lib/engine/types";
import { Card } from "./ui";

const LABEL: Record<keyof Weights, { name: string; what: string }> = {
  partner: { name: "Partner", what: "capital headroom, experience, owner-operator" },
  premises: { name: "Premises", what: "site ready, floor, size" },
  place: { name: "Place", what: "territory priority" },
  pace: { name: "Pace", what: "realistic, committed timeline" },
};

export function WeightsPanel({ config, onChange }: { config: EngineConfig; onChange: (c: EngineConfig, label: string) => void }) {
  const [draft, setDraft] = useState<Weights>(config.weights);
  useEffect(() => {
    setDraft(config.weights);
  }, [config.weights]);
  const sum = draft.partner + draft.premises + draft.place + draft.pace || 1;
  const dirty = (Object.keys(draft) as (keyof Weights)[]).some((k) => draft[k] !== config.weights[k]);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Ranking priorities for this phase</h3>
          <p className="text-xs text-slate-500">Changes who wins a contested slot. Hard rules (one store per pin, capital floor, site standards) never move.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Active: {config.phaseName}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PHASE_PRESETS.map((p) => (
          <button
            key={p.name}
            title={p.when}
            onClick={() => onChange({ ...config, weights: p.weights, phaseName: p.name }, `Ranking priorities set to "${p.name}"`)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${config.phaseName === p.name ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300"}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{PHASE_PRESETS.find((p) => p.name === config.phaseName)?.when ?? "Custom weights set by the owner."}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(Object.keys(LABEL) as (keyof Weights)[]).map((k) => (
          <label key={k} className="block">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-slate-700">
                {LABEL[k].name} <span className="font-normal text-slate-400">— {LABEL[k].what}</span>
              </span>
              <span className="tabular-nums font-semibold text-slate-800">{Math.round((draft[k] / sum) * 100)}%</span>
            </div>
            <input type="range" min={0} max={60} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} className="mt-1 w-full accent-indigo-600" />
          </label>
        ))}
      </div>
      {dirty && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onChange({ ...config, weights: draft, phaseName: "Custom" }, `Custom ranking weights: partner ${Math.round((draft.partner / sum) * 100)}%, premises ${Math.round((draft.premises / sum) * 100)}%, place ${Math.round((draft.place / sum) * 100)}%, pace ${Math.round((draft.pace / sum) * 100)}%`)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
            Apply &amp; re-rank
          </button>
          <button onClick={() => setDraft(config.weights)} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
            Reset
          </button>
        </div>
      )}
    </Card>
  );
}
