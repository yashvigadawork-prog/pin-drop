"use client";

import { useState } from "react";
import { Ic } from "./Icon";
import { Card, useUi } from "./kit";
import { DEFAULT_CONFIG } from "@/lib/engine/config";
import { BRIEF, EVIDENCE, RULES, evidenceById } from "@/lib/engine/rulebook";
import type { CustomRule, EngineConfig, Tier } from "@/lib/engine/types";

const FIELDS: [CustomRule["field"], string][] = [["investment", "Investment (₹ lakh)"], ["experience", "Experience (years)"], ["sizeSqft", "Space (sq ft)"], ["targetMonths", "Target launch (months)"]];
const EFFECTS: [CustomRule["effect"], string][] = [["hold", "Ask a question (Needs info)"], ["flag", "Flag only"], ["notnow", "Stop (Not now)"]];

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "block", fontSize: 12.5 }} className="muted">
      {label}
      <input type="number" className="search" style={{ maxWidth: "none", marginTop: 4, width: "100%" }} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function RulebookView() {
  const ui = useUi();
  const { ws } = ui;
  const config = ws.result?.config ?? DEFAULT_CONFIG;
  const [draft, setDraft] = useState<EngineConfig>(config);
  const tiers: Tier[] = ["Tier 1", "Tier 2", "Tier 3"];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const changed = !same(draft, config);
  const custom = draft.custom ?? [];
  const setCustom = (c: CustomRule[]) => setDraft({ ...draft, custom: c });
  const edit = (id: string, patch: Partial<CustomRule>) => setCustom(custom.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const add = () => setCustom([...custom, { id: `a${Date.now().toString(36)}`, label: "New assumption", field: "experience", op: "min", value: 1, effect: "hold" }]);

  return (
    <div className="stack">
      <Card>
        <h3><Ic n="sliders" />Assumptions<span className="sp" /><span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>Change, add, then re-decide. No redeploy.</span></h3>
        <div className="grid g3">
          {tiers.map((t) => <Num key={t} label={`Minimum investment, ${t} (₹ lakh)`} value={draft.minCapital[t]} onChange={(v) => setDraft({ ...draft, minCapital: { ...draft.minCapital, [t]: v } })} />)}
          <Num label="“Financing probable” band (%)" value={Math.round(draft.nearMissBand * 100)} onChange={(v) => setDraft({ ...draft, nearMissBand: v / 100 })} />
          <Num label="Minimum space (sq ft)" value={draft.minSqft} onChange={(v) => setDraft({ ...draft, minSqft: v })} />
          <Num label="Comfortable space from (sq ft)" value={draft.tightSqft} onChange={(v) => setDraft({ ...draft, tightSqft: v })} />
          <Num label="Tier A: top share of qualified (%)" value={draft.tierA ?? 10} onChange={(v) => setDraft({ ...draft, tierA: v })} />
          <Num label="Tier A + B: top share (%)" value={draft.tierB ?? 40} onChange={(v) => setDraft({ ...draft, tierB: v })} />
          <Num label="Challenger margin (points)" value={draft.challengeMargin ?? 10} onChange={(v) => setDraft({ ...draft, challengeMargin: v })} />
        </div>

        <div className="eyebrow" style={{ marginTop: 16 }}>Your own assumptions</div>
        <div className="stack" style={{ gap: 8, marginTop: 6 }}>
          {custom.length === 0 && <div className="muted">None yet. Add one to test a different threshold, for example “experience must be at least 2 years”.</div>}
          {custom.map((c) => (
            <div key={c.id} className="row wrap customrow" style={{ gap: 8 }}>
              <input className="search" style={{ maxWidth: 200 }} aria-label="Name" value={c.label} onChange={(e) => edit(c.id, { label: e.target.value })} />
              <select className="sel" aria-label="Field" value={c.field} onChange={(e) => edit(c.id, { field: e.target.value as CustomRule["field"] })}>{FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <select className="sel" aria-label="Rule" value={c.op} onChange={(e) => edit(c.id, { op: e.target.value as CustomRule["op"] })}><option value="min">must be at least</option><option value="max">must be at most</option></select>
              <input type="number" className="search" style={{ maxWidth: 90 }} aria-label="Value" value={c.value} onChange={(e) => edit(c.id, { value: Number(e.target.value) })} />
              <select className="sel" aria-label="If it fails" value={c.effect} onChange={(e) => edit(c.id, { effect: e.target.value as CustomRule["effect"] })}>{EFFECTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <button className="btn sm ghost" aria-label="Remove" onClick={() => setCustom(custom.filter((x) => x.id !== c.id))}><Ic n="x" /></button>
            </div>
          ))}
          <button className="btn" style={{ alignSelf: "flex-start" }} onClick={add}><Ic n="plus" />Add an assumption</button>
        </div>

        <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
          <button className="btn primary" disabled={!changed} onClick={() => { ws.setConfig({ ...draft, weights: config.weights, phaseName: config.phaseName }, "Assumptions changed in Rulebook"); ui.toast("Assumptions applied. Everyone re-checked."); }}>Apply and re-decide</button>
          <button className="btn ghost" onClick={() => { const d = { ...DEFAULT_CONFIG, weights: config.weights, phaseName: config.phaseName }; setDraft(d); ws.setConfig(d, "Assumptions reset to defaults"); }}>Reset to defaults</button>
          {changed && <span className="muted">Not applied yet.</span>}
        </div>
      </Card>

      <div className="grid g2">
        {RULES.map((r, i) => (
          <Card key={r.id} i={i}>
            <div className="row wrap" style={{ gap: 8, marginBottom: 4 }}><span className="tag mono">{r.gate}</span><b>{r.title}</b></div>
            <p style={{ margin: 0 }}>{BRIEF[r.id] ?? r.rule}</p>
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--accent)" }}>Details</summary>
              <p className="muted" style={{ marginTop: 6 }}><b style={{ color: "var(--ink)" }}>Full rule. </b>{r.rule}</p>
              <p className="muted" style={{ marginTop: 6 }}><b style={{ color: "var(--ink)" }}>Why. </b>{r.why}</p>
              {r.assumption && <p className="tag warn" style={{ whiteSpace: "normal", marginTop: 8 }}><span><b>Assumption. </b>{r.assumption}</span></p>}
              {r.evidence.length > 0 && (
                <ul className="plain" style={{ marginTop: 8, listStyle: "none", paddingLeft: 0 }}>
                  {r.evidence.map((id) => {
                    const e = evidenceById(id);
                    if (!e) return null;
                    return (
                      <li key={id} className="card flat" style={{ padding: 10 }}>
                        <div className="row wrap" style={{ gap: 6 }}><b>{e.company_or_body}</b>{e.figure && <span className="tag">{e.figure}</span>}<span className="tag">{e.confidence} confidence</span></div>
                        <div className="muted" style={{ fontSize: 12.5 }}>{e.claim}</div>
                        <a className="lnk" href={e.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{e.source_title} ↗</a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </details>
          </Card>
        ))}
      </div>
      <span className="muted" style={{ fontSize: 12 }}>{EVIDENCE.length} evidence cards back these rules.</span>
    </div>
  );
}
