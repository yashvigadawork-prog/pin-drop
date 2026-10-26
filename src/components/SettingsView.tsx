"use client";

import { useState } from "react";
import { Ic } from "./Icon";
import { Card, useUi } from "./kit";
import { DEFAULT_CONFIG } from "@/lib/engine/config";
import { EVIDENCE, RULES, evidenceById } from "@/lib/engine/rulebook";
import type { EngineConfig, Tier } from "@/lib/engine/types";
import { MAP_CITIES, MODS, PIN_PREFIX } from "@/lib/desk/types";
import { ago } from "@/lib/desk/time";

const TABS: [string, string, string][] = [
  ["areas", "pin", "Areas"],
  ["checks", "shield", "Checks and safeguards"],
  ["email", "mail", "Email"],
  ["rules", "book", "Rulebook and history"],
];

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button className={`sw${on ? " on" : ""}`} onClick={onClick} aria-label={label} role="switch" aria-checked={on} />;
}
function SetRow({ icon, title, sub, children }: { icon: string; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="setrow">
      <span className="ic"><Ic n={icon} /></span>
      <div className="t"><b>{title}</b><small>{sub}</small></div>
      {children}
    </div>
  );
}

export function SettingsView() {
  const ui = useUi();
  const { nav, setNav } = ui;
  // Older links used other names. Ranking now lives in the top bar.
  const tab = nav.setting === "guard" ? "checks" : nav.setting === "history" ? "rules" : TABS.some((t) => t[0] === nav.setting) ? nav.setting : "areas";
  return (
    <div className="stack">
      <div className="seg" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
        {TABS.map(([k, ic, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setNav({ setting: k })}><Ic n={ic} />{l}</button>
        ))}
      </div>
      {tab === "areas" && <AreasTab />}
      {tab === "checks" && (
        <>
          <ChecksTab />
          <GuardTab />
        </>
      )}
      {tab === "email" && <EmailTab />}
      {tab === "rules" && (
        <>
          <RulebookTab />
          <HistoryTab />
        </>
      )}
    </div>
  );
}

function AreasTab() {
  const { ws } = useUi();
  const ui = useUi();
  return (
    <Card>
      <h3><Ic n="pin" />Where we take applications</h3>
      {MAP_CITIES.map((c) => {
        const on = c.served || ws.desk.servedOn[c.n];
        const w = ws.expList.filter((e) => e.city === c.n).length;
        return (
          <SetRow key={c.n} icon={on ? "pin" : "globe"} title={c.n} sub={`Pins start with ${PIN_PREFIX[c.n]}${w ? ` · ${w} waiting on the Expansion list` : ""}`}>
            {w > 0 && !c.served && <button className="btn sm" onClick={() => ui.go("expansion", { expF: c.n, expCity: c.n })}>See {w}</button>}
            <Switch on={!!on} label={`Serve ${c.n}`} onClick={() => { if (c.served) return; ws.toggleServed(c.n); if (!ws.desk.servedOn[c.n]) ui.toast(`${c.n} marked as served. ${w} waiting people matched. Add its territories in your sheet to start deciding.`); }} />
          </SetRow>
        );
      })}
    </Card>
  );
}

function ChecksTab() {
  const { ws } = useUi();
  return (
    <Card>
      <h3><Ic n="shield" />Checks and modules</h3>
      {MODS.map(([k, ic, t, d]) => (
        <SetRow key={k} icon={ic} title={t} sub={d}><Switch on={ws.desk.mods[k]} label={t} onClick={() => ws.setMod(k, !ws.desk.mods[k])} /></SetRow>
      ))}
    </Card>
  );
}

function EmailTab() {
  const { ws } = useUi();
  const mode = ws.desk.emailMode;
  return (
    <Card>
      <h3><Ic n="mail" />Email sending</h3>
      <div className="stack">
        <div className="seg" style={{ alignSelf: "flex-start" }}>
          <button className={mode === "demo" ? "on" : ""} onClick={() => ws.setEmailMode("demo")}>Demo: log only</button>
          <button className={mode === "real" ? "on" : ""} onClick={() => ws.setEmailMode("real")}>Real: send to test inbox</button>
        </div>
        <p className="muted">
          {mode === "demo" ? "Send marks the email as sent, moves the person on and writes to History. Nothing leaves the app." : "Emails go to one test inbox through an email service, never to applicants. Set RESEND_API_KEY and TEST_INBOX on the server first."}
        </p>
        <div className="row"><span style={{ width: 110, fontWeight: 600 }}>Language</span><span className="tag">English</span></div>
      </div>
    </Card>
  );
}

function GuardTab() {
  const { ws } = useUi();
  const g = ws.desk.guard;
  return (
    <Card>
      <h3><Ic n="usercheck" />Safeguards: you stay the judge</h3>
      <p className="muted" style={{ marginBottom: 6 }}>The engine recommends. These keep you in control and catch its mistakes early.</p>
      <SetRow icon="eye" title="Review before any email goes out" sub="Every bulk send opens a list you can edit first."><Switch on label="Always on" onClick={() => {}} /></SetRow>
      <SetRow icon="shield" title="Spot-check rate" sub="Share of decisions you check each week against the engine.">
        <select className="sel" aria-label="Spot-check rate" value={g.spot} onChange={(e) => ws.setGuard({ spot: Number(e.target.value) })}>{[5, 10, 20].map((v) => <option key={v}>{v}</option>)}</select>
        <span className="muted">%</span>
      </SetRow>
      <SetRow icon="alert" title="Kill criterion" sub="Pause and recalibrate if 3 of the first 10 Proceed partners drop out before signing."><Switch on={g.kill} label="Kill criterion" onClick={() => ws.setGuard({ kill: !g.kill })} /></SetRow>
      <SetRow icon="calendar" title="Pin hold after next steps" sub="How long a pin is reserved before it is offered to the next person.">
        <select className="sel" aria-label="Pin hold days" value={g.hold} onChange={(e) => ws.setGuard({ hold: Number(e.target.value) })}>{[14, 30, 45].map((v) => <option key={v}>{v}</option>)}</select>
        <span className="muted">days</span>
      </SetRow>
    </Card>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "block", fontSize: 12.5 }} className="muted">
      {label}
      <input type="number" className="search" style={{ maxWidth: "none", marginTop: 4, width: "100%" }} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function RulebookTab() {
  const ui = useUi();
  const { ws } = ui;
  const config = ws.result?.config ?? DEFAULT_CONFIG;
  const [draft, setDraft] = useState<EngineConfig>(config);
  const tiers: Tier[] = ["Tier 1", "Tier 2", "Tier 3"];
  const changed = JSON.stringify(draft) !== JSON.stringify(config);
  return (
    <>
      <Card>
        <h3><Ic n="sliders" />Assumptions<span className="sp" /><span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>Every threshold is an assumption you can change</span></h3>
        <div className="grid g3">
          {tiers.map((t) => <Num key={t} label={`Minimum investment, ${t} (₹ lakh)`} value={draft.minCapital[t]} onChange={(v) => setDraft({ ...draft, minCapital: { ...draft.minCapital, [t]: v } })} />)}
          <Num label="“Financing probable” band (%)" value={Math.round(draft.nearMissBand * 100)} onChange={(v) => setDraft({ ...draft, nearMissBand: v / 100 })} />
          <Num label="Minimum space (sq ft)" value={draft.minSqft} onChange={(v) => setDraft({ ...draft, minSqft: v })} />
          <Num label="Comfortable space from (sq ft)" value={draft.tightSqft} onChange={(v) => setDraft({ ...draft, tightSqft: v })} />
        </div>
        <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
          <button className="btn primary" disabled={!changed} onClick={() => { ws.setConfig(draft, "Assumptions changed in Rulebook"); ui.toast("Assumptions applied. Everyone re-checked."); }}>Apply and re-decide</button>
          <button className="btn ghost" onClick={() => { const d = { ...DEFAULT_CONFIG, weights: config.weights, phaseName: config.phaseName }; setDraft(d); ws.setConfig(d, "Assumptions reset to defaults"); }}>Reset to defaults</button>
        </div>
      </Card>
      <div className="grid g2">
        {RULES.map((r, i) => (
          <Card key={r.id} i={i}>
            <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}><span className="tag mono">{r.gate}</span><b>{r.title}</b></div>
            <p><b>Rule. </b>{r.rule}</p>
            <p className="muted" style={{ marginTop: 6 }}><b style={{ color: "var(--ink)" }}>Why. </b>{r.why}</p>
            {r.assumption && <p className="tag warn" style={{ whiteSpace: "normal", marginTop: 8 }}><span><b>Assumption and how to check it. </b>{r.assumption}</span></p>}
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--accent)" }}>Real-world evidence ({r.evidence.length})</summary>
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
            </details>
          </Card>
        ))}
      </div>
      <span className="muted" style={{ fontSize: 12 }}>{EVIDENCE.length} evidence cards back these rules.</span>
    </>
  );
}

function HistoryTab() {
  const ui = useUi();
  const { ws, now } = ui;
  const ev = [...ws.state.audit].reverse();
  return (
    <Card>
      <h3><Ic n="history" />History<span className="sp" /><span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>{ws.state.runId ? `Saved to database · run ${ws.state.runId}` : "Kept in this browser"}</span></h3>
      {ev.map((e) => (
        <SetRow key={e.id} icon={e.kind === "mail" ? "mail" : e.kind === "upload" ? "upload" : e.kind === "move" ? "move" : "check"} title={e.summary} sub={ago(e.at, now)}>
          {e.changes.length > 0 && <span className="tag">{e.changes.length} changed</span>}
        </SetRow>
      ))}
    </Card>
  );
}
